import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { NextResponse } from "next/server";
import { findDuplicate, generateRowHash } from "@/lib/deduplication";

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
    };

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
            type: amount < 0 ? "EXPENSE" : "INCOME",
            description: tx.description || "",
            source: "EXCEL",
            status: status,
            accountId: accountId,
            userId: userId,
            userId_internal: userId, // Creator is the same as owner in this context
            householdId: account.householdId,
            externalId,
            metadata: tx.metadata || {}
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
