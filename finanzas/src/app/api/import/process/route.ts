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

        // Skip credit card payment entries completely
        const descUpper = (tx.description || '').trim().toUpperCase();
        if (descUpper === 'MONTO CANCELADO') {
            results.total--;
            continue;
        }

        const amount = typeof rawAmount === 'number' 
            ? rawAmount 
            : (() => {
                const str = String(rawAmount).trim();
                const cleaned = str.replace(/\./g, '').replace(/,/g, '').replace(/[^0-9-]/g, '');
                const parsed = parseInt(cleaned, 10);
                return isNaN(parsed) ? NaN : parsed;
            })();
        
        let date = new Date(rawDate);
        if (isNaN(date.getTime()) && typeof rawDate === 'string') {
            const parts = rawDate.split(/[-/]/);
            if (parts.length === 3) {
                if (parts[2].length === 4) {
                    date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00Z`);
                } else if (parts[0].length === 4) {
                    date = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T12:00:00Z`);
                }
            }
        }

        if (isNaN(amount) || isNaN(date.getTime())) {
            console.log(`Skipping invalid row: Amount=${rawAmount}, Date=${rawDate}`);
            continue;
        }

        // Apply Android Credit Card methodology:
        // - Credit card transactions are always EXPENSE.
        // - Amount retains its original sign (positive for charge/gasto, negative for abono/reversa).
        // - Checking/debit accounts follow standard rule (negative statement amount = EXPENSE, positive = INCOME).
        let txType: string;
        let finalAmount: number;

        if (account.type === 'CREDIT_CARD') {
            txType = "EXPENSE";
            finalAmount = amount;
        } else {
            txType = amount < 0 ? "EXPENSE" : "INCOME";
            finalAmount = Math.abs(amount);
        }

        const externalId = tx.externalId || generateRowHash(tx);

        // Find duplicate
        const duplicate = await findDuplicate({
            amount: finalAmount,
            date,
            description: tx.description,
            externalId,
            accountId: accountId
        });

        if (duplicate?.type === 'EXACT') {
            results.duplicates++;
            continue;
        }

        const isProbable = duplicate?.type === 'PROBABLE';
        const status = isProbable ? "PENDING_REVIEW" : "CONFIRMED";
        
        if (isProbable) results.duplicates++;
        else results.imported++;

        const newTx: any = {
            amount: finalAmount,
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

        // --- CLASSIFICATION CASCADE ---
        let categoryId: string | null = tx.categoryId || null;
        let catSource: string = categoryId ? 'manual' : 'none';
        let confidence: number | null = null;

        if (isProbable) {
            categoryId = null;
            catSource = 'needs_review';
        } else if (!categoryId) {
            categoryId = categorizeByKeywords(newTx.description, categories);
            if (categoryId) { catSource = 'keyword'; confidence = 1.0; results.keywordCategorized++; }
        }

        if (!categoryId) {
            const mlResult = mlPredictor(newTx.description);
            if (mlResult.categoryId) {
                categoryId = mlResult.categoryId;
                catSource = 'ml';
                confidence = mlResult.confidence;
                results.mlCategorized++;
            }
        }

        if (!categoryId) {
            groqBatch.push({ txIndex: transactionsToCreate.length, description: newTx.description, amount: newTx.amount });
        }

        newTx.categoryId = categoryId;
        newTx.categorySource = catSource;
        newTx.aiConfidence = confidence;
        
        transactionsToCreate.push(newTx);
    }

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
                transactionsToCreate[originalIndex].aiConfidence = 0.8;
                results.aiCategorized++;
            } else {
                transactionsToCreate[originalIndex].categorySource = 'needs_review';
                transactionsToCreate[originalIndex].aiConfidence = null;
            }
        });
    }

    if (groqBatch.length > 0) {
        groqBatch.forEach(({ txIndex }) => {
            const tx = transactionsToCreate[txIndex];
            if (!tx.categoryId) {
                tx.categorySource = 'needs_review';
            }
        });
    }

    if (!dryRun && transactionsToCreate.length > 0) {
        // Calculate net balance change
        const netBalanceChange = transactionsToCreate.reduce((sum, tx) => {
            const multiplier = tx.type === 'INCOME' ? 1 : -1;
            return sum + Number(tx.amount) * multiplier;
        }, 0);

        await prisma.$transaction([
            prisma.transaction.createMany({
                data: transactionsToCreate
            }),
            prisma.account.update({
                where: { id: accountId },
                data: { balance: { increment: netBalanceChange } }
            })
        ]);
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ message: "Error processing transactions" }, { status: 500 });
  }
}
