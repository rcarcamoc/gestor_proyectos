import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { NextResponse } from "next/server";
import { findDuplicate, generateRowHash } from "@/lib/deduplication";
import { categorizeTransactionsBatch } from "@/lib/ai/groq";
import { categorizeByKeywords } from "@/services/categorizerService";
import { trainNaiveBayes } from "@/services/mlCategorizerService";
import { formatBillingPeriod } from "@/lib/utils";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { transactions, accountId, dryRun = false, billingPeriod } = await req.json();
    const userId = (session.user as any).id;

    // Get account to get householdId if applicable
    const account = await prisma.account.findUnique({
        where: { id: accountId }
    });

    if (!account) return NextResponse.json({ message: "Account not found" }, { status: 404 });

    const results = {
        total: transactions.length,
        imported: 0,
        duplicates: 0,
        aiCategorized: 0,
        keywordCategorized: 0,
        mlCategorized: 0,
    };

    // 1. Fetch available categories and history for ML
    const [categories, history] = await Promise.all([
        prisma.category.findMany({
            where: {
                OR: [
                    { userId },
                    { householdId: account.householdId },
                    { isDefault: true }
                ]
            }
        }),
        prisma.transaction.findMany({
            where: { userId, categoryId: { not: null } },
            select: { description: true, categoryId: true },
            take: 1000 // Limit for performance
        })
    ]);

    // Train ML classifier
    const mlPredictor = trainNaiveBayes(history.map(h => ({ 
        description: h.description || '', 
        categoryId: h.categoryId! 
    })));

    const transactionsToCreate: any[] = [];
    const groqBatch: any[] = [];

    for (const tx of transactions) {
        const rawAmount = tx.amount;
        const rawDate = tx.date;

        if (rawAmount === undefined || rawDate === undefined) continue;

        const amount = typeof rawAmount === 'number' 
            ? rawAmount 
            : (() => {
                // Handle Chilean locale: "4,470" = 4470 (comma = thousands separator)
                // Also handles negative: "-70,147" = -70147
                const str = String(rawAmount).trim();
                const isNegative = str.startsWith('-');
                // Remove dots used as thousands separators (European format)
                // Remove commas used as thousands separators (Chilean/US format)
                // Keep only digits, minus sign, and decimal point
                const cleaned = str.replace(/\./g, '').replace(/,/g, '').replace(/[^0-9-]/g, '');
                const parsed = parseInt(cleaned, 10);
                return isNaN(parsed) ? NaN : parsed;
            })();
        
        let date = new Date(rawDate);
        if (isNaN(date.getTime()) && typeof rawDate === 'string') {
            // Attempt to parse dd-mm-yyyy or dd/mm/yyyy
            const parts = rawDate.split(/[-/]/);
            if (parts.length === 3) {
                // If it looks like dd-mm-yyyy
                if (parts[2].length === 4) {
                    date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00Z`);
                } 
                // If it looks like yyyy-mm-dd
                else if (parts[0].length === 4) {
                    date = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T12:00:00Z`);
                }
            }
        }

        if (isNaN(amount) || isNaN(date.getTime())) {
            console.log(`Skipping invalid row: Amount=${rawAmount}, Date=${rawDate}`);
            continue;
        }

        // Banking rules for transaction type:
        // - Regular accounts (debit/current): positive = income, negative = expense
        // - Credit cards: positive = cargo/gasto (EXPENSE), negative = abono/reversa (INCOME)
        // Also detect reversa/abono by description keyword
        const descLower = (tx.description || '').toLowerCase();
        const isReversa = descLower.includes('rev.') || descLower.includes('reversa') || descLower.includes('abono') || descLower.includes('devol');
        
        let txType: string;
        if (account.type === 'CREDIT_CARD') {
            // Negative OR explicit reversa keywords = abono (INCOME)
            txType = (amount < 0 || isReversa) ? "INCOME" : "EXPENSE";
        } else {
            txType = amount < 0 ? "EXPENSE" : "INCOME"; // standard rule
        }
        
        const absAmount = Math.abs(amount);

        const externalId = tx.externalId || generateRowHash(tx);

        // Find duplicate
        const duplicate = await findDuplicate({
            amount: absAmount,
            date,
            description: tx.description,
            externalId,
            accountId: accountId
        });

        if (duplicate?.type === 'EXACT') {
            results.duplicates++;
            continue; // Completely omit exact duplicates
        }

        const isProbable = duplicate?.type === 'PROBABLE';
        const status = isProbable ? "PENDING_REVIEW" : "CONFIRMED";
        
        if (isProbable) results.duplicates++;
        else results.imported++;

        const newTx: any = {
            amount: absAmount,
            currency: account.currency,
            date,
            type: txType as any,
            description: tx.description || "",
            source: "EXCEL" as any,
            status: status as any,
            accountId: accountId,
            userId: userId,
            userId_internal: userId,
            householdId: account.householdId,
            externalId,
            billingPeriod: billingPeriod || formatBillingPeriod(date),
            cardType: tx.cardType ? String(tx.cardType).split(' ')[0] : null,
            metadata: {
                ...(tx.metadata || {}),
                duplicate_type: isProbable ? 'PROBABLE' : null
            }
        };

        // --- CASCADE DE CLASIFICACIÓN ---
        // Capa 1: Keywords (instantáneo, sin IA)
        let categoryId: string | null = tx.categoryId || null;
        let catSource: string = categoryId ? 'manual' : 'none';
        let confidence: number | null = null;

        // If it's a probable duplicate, force it to 'needs_review' and skip auto-classification
        if (isProbable) {
            categoryId = null;
            catSource = 'needs_review';
        } else if (!categoryId) {
            categoryId = categorizeByKeywords(newTx.description, categories);
            if (categoryId) { catSource = 'keyword'; confidence = 1.0; results.keywordCategorized++; }
        }

        // Capa 2: Naive Bayes ML (aprende del historial del usuario, cero costo)
        if (!categoryId) {
            const mlResult = mlPredictor(newTx.description);
            if (mlResult.categoryId) {
                categoryId = mlResult.categoryId;
                catSource = 'ml';
                confidence = mlResult.confidence;
                results.mlCategorized++;
            }
        }

        // Capa 3: Groq LLM (solo si las capas anteriores fallaron — mínimo de llamadas)
        // Se acumula para procesar en batch al final (más eficiente)
        if (!categoryId) {
            groqBatch.push({ txIndex: transactionsToCreate.length, description: newTx.description, amount: newTx.amount });
        }

        newTx.categoryId = categoryId;
        newTx.categorySource = catSource;
        newTx.aiConfidence = confidence;
        
        transactionsToCreate.push(newTx);
    }

    // Capa 3: Procesar batch de Groq (solo transacciones que llegaron hasta aquí)
    // NO se ejecuta en dry run para ahorrar costos de API
    if (!dryRun && groqBatch.length > 0 && process.env.GROQ_API_KEY) {
        const aiSuggestions = await categorizeTransactionsBatch(
            groqBatch.map(t => ({ description: t.description, amount: t.amount })),
            categories.map(c => ({ id: c.id, name: c.name }))
        );

        Object.entries(aiSuggestions).forEach(([aiIndex, categoryName]) => {
            const batchIdx = parseInt(aiIndex);
            const originalIndex = groqBatch[batchIdx].txIndex;
            const category = categories.find(
                c => c.name.toLowerCase() === (categoryName as string).toLowerCase()
            );

            if (category) {
                transactionsToCreate[originalIndex].categoryId = category.id;
                transactionsToCreate[originalIndex].categorySource = 'groq';
                transactionsToCreate[originalIndex].aiConfidence = 0.8; // Groq default confidence
                results.aiCategorized++;
            } else {
                // Groq no pudo clasificar → pedir asistencia al usuario
                transactionsToCreate[originalIndex].categorySource = 'needs_review';
                transactionsToCreate[originalIndex].aiConfidence = null;
            }
        });
    }

    // Sin API key o en dry run → marcar como needs_review las que quedaron sin categoría
    if (groqBatch.length > 0) {
        groqBatch.forEach(({ txIndex }) => {
            const tx = transactionsToCreate[txIndex];
            if (!tx.categoryId) {
                tx.categorySource = 'needs_review';
            }
        });
    }

    if (!dryRun && transactionsToCreate.length > 0) {
        await prisma.transaction.createMany({
            data: transactionsToCreate
        });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ message: "Error processing transactions" }, { status: 500 });
  }
}
