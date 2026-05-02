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

        const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(/[^0-9.-]+/g, ""));
        const date = new Date(rawDate);

        if (isNaN(amount) || isNaN(date.getTime())) {
            console.log(`Skipping invalid row: Amount=${rawAmount}, Date=${rawDate}`);
            continue;
        }

        const externalId = tx.externalId || generateRowHash(tx);

        // Find duplicate
        const duplicate = await findDuplicate({
            amount,
            date,
            description: tx.description,
            externalId,
            accountId: accountId
        });

        const status = duplicate ? "PENDING_REVIEW" : "CONFIRMED";
        if (duplicate) results.duplicates++;
        else results.imported++;

        const newTx: any = {
            amount,
            currency: account.currency,
            date,
            type: (amount < 0 ? "EXPENSE" : "INCOME") as any,
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
                duplicate_type: duplicate ? (duplicate as any).type : null
            }
        };

        // --- CASCADE DE CLASIFICACIÓN ---
        // Capa 1: Keywords (instantáneo, sin IA)
        let categoryId: string | null = tx.categoryId || null;
        let catSource: string = categoryId ? 'manual' : 'none';
        let confidence: number | null = null;

        if (!categoryId) {
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
