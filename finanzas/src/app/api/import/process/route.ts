import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { NextResponse } from "next/server";
import { findDuplicate, generateRowHash } from "@/lib/deduplication";
import { categorizeTransactionsBatch } from "@/lib/ai/groq";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { transactions, accountId } = await req.json();
    const userId = (session.user as any).id;

    // Get account to get householdId if applicable
    const account = await prisma.account.findUnique({
        where: { id: accountId }
    });

    if (!account) return NextResponse.json({ message: "Account not found" }, { status: 404 });

    const results = {
        imported: 0,
        duplicates: 0,
        aiCategorized: 0,
    };

    // 1. Fetch available categories
    const categories = await prisma.category.findMany({
        where: {
            OR: [
                { userId },
                { householdId: account.householdId },
                { isDefault: true }
            ]
        }
    });

    const transactionsToCreate = [];

    for (const tx of transactions) {
        // Convert amount to number and ensure it's absolute for comparison if needed, 
        // but typically database stores signed amounts.
        const amount = parseFloat(tx.amount);
        const date = new Date(tx.date);
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

        transactionsToCreate.push({
            amount,
            currency: account.currency,
            date,
            type: (amount < 0 ? "EXPENSE" : "INCOME") as any,
            description: tx.description || "",
            source: "EXCEL" as any,
            status: status as any,
            accountId: accountId,
            userId: userId,
            userId_internal: userId, // Creator is the same as owner in this context
            householdId: account.householdId,
            externalId,
            metadata: tx.metadata || {}
        });
    }

    // 2. AI Categorization for transactions without category
    const transactionsToCategorize = transactionsToCreate
        .map((t, i) => ({ index: i, description: t.description, amount: Number(t.amount) }))
        .filter((_, i) => !transactions[i].categoryId); // Only those not manually mapped

    if (transactionsToCategorize.length > 0 && process.env.GROQ_API_KEY) {
        const aiSuggestions = await categorizeTransactionsBatch(
            transactionsToCategorize.map(t => ({ description: t.description, amount: t.amount })),
            categories.map(c => ({ id: c.id, name: c.name }))
        );

        Object.entries(aiSuggestions).forEach(([aiIndex, categoryName]) => {
            const originalIndex = transactionsToCategorize[parseInt(aiIndex)].index;
            const category = categories.find(c => c.name.toLowerCase() === (categoryName as string).toLowerCase());
            
            if (category) {
                transactionsToCreate[originalIndex].categoryId = category.id;
                transactionsToCreate[originalIndex].metadata = {
                    ...(transactionsToCreate[originalIndex].metadata as any || {}),
                    ai_suggested: true,
                    ai_category_name: categoryName
                };
                results.aiCategorized++;
            }
        });
    } else {
        // Fallback or manual assignment from mapping if present
        transactionsToCreate.forEach((t, i) => {
            if (transactions[i].categoryId) {
                t.categoryId = transactions[i].categoryId;
            }
        });
    }

    if (transactionsToCreate.length > 0) {
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
