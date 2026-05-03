export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { NextResponse } from "next/server";
import { formatBillingPeriod } from "@/lib/utils";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const {
      amount,
      currency,
      date,
      type,
      description,
      accountId,
      categoryId,
      householdId,
      billingPeriod
    } = await req.json();

    const userId = (session.user as any).id;
    const finalBillingPeriod = billingPeriod || formatBillingPeriod(date);

    // Start a transaction to update account balance and create the transaction record
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          amount,
          currency,
          date: new Date(date),
          type,
          description,
          accountId,
          categoryId,
          householdId,
          billingPeriod: finalBillingPeriod,
          userId: userId, // The owner
          userId_internal: userId, // The creator
        },
      });

      // Update balance
      const multiplier = type === 'INCOME' ? 1 : -1;
      await tx.account.update({
        where: { id: accountId },
        data: {
          balance: {
            increment: Number(amount) * multiplier,
          },
        },
      });

      return transaction;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Error creating transaction" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const householdId = searchParams.get('householdId');
  const uncategorized = searchParams.get('uncategorized') === 'true';
  const includeIgnored = searchParams.get('includeIgnored') === 'true';
  const userId = (session.user as any).id;

  try {
    // Get all households the user belongs to
    const userHouseholds = await prisma.userHousehold.findMany({
      where: { userId },
      select: { householdId: true }
    });
    const householdIds = userHouseholds.map(uh => uh.householdId);

    let whereFilter: any = {};
    
    if (householdId) {
      whereFilter = { householdId };
    } else {
      // Return personal transactions OR household transactions for households the user is in
      whereFilter = {
        OR: [
          { userId },
          { householdId: { in: householdIds } }
        ]
      };
    }

    if (uncategorized) {
      whereFilter = {
        ...whereFilter,
        OR: [
          ...(whereFilter.OR || []),
          { categoryId: null },
          { categorySource: 'needs_review' }
        ]
      };
    }

    // By default hide ignored transactions; show them only when explicitly requested
    if (!includeIgnored) {
      whereFilter = { ...whereFilter, ignored: false };
    }

    const transactions = await prisma.transaction.findMany({
      where: whereFilter,
      include: {
        account: true,
        category: true,
      },
      orderBy: { date: 'desc' },
      take: 200,
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Error fetching transactions" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const billingPeriod = searchParams.get('billingPeriod');
  const userId = (session.user as any).id;

  if (!billingPeriod) return NextResponse.json({ message: "Billing period is required" }, { status: 400 });

  try {
    // Security check: Only delete transactions the user owns or in their households
    const userHouseholds = await prisma.userHousehold.findMany({
      where: { userId },
      select: { householdId: true }
    });
    const householdIds = userHouseholds.map(uh => uh.householdId);

    const whereFilter = {
      billingPeriod,
      OR: [
        { userId },
        { householdId: { in: householdIds } }
      ]
    };

    // Find transactions to adjust balances
    const transactionsToDelete = await prisma.transaction.findMany({
      where: whereFilter,
      select: { amount: true, type: true, accountId: true }
    });

    if (transactionsToDelete.length === 0) {
      return NextResponse.json({ message: "No transactions found for this period", count: 0 });
    }

    // Execute deletion and balance adjustment in a transaction
    await prisma.$transaction(async (tx) => {
      // Group adjustments by account
      const adjustments: Record<string, number> = {};
      for (const t of transactionsToDelete) {
        const multiplier = t.type === 'INCOME' ? -1 : 1; // Reverse the original operation
        const adjustment = Number(t.amount) * multiplier;
        adjustments[t.accountId] = (adjustments[t.accountId] || 0) + adjustment;
      }

      // Apply adjustments
      for (const [accountId, amount] of Object.entries(adjustments)) {
        await tx.account.update({
          where: { id: accountId },
          data: { balance: { increment: amount } }
        });
      }

      // Delete the transactions
      await tx.transaction.deleteMany({
        where: whereFilter
      });
    });

    return NextResponse.json({ message: "Period deleted successfully", count: transactionsToDelete.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Error deleting period" }, { status: 500 });
  }
}
