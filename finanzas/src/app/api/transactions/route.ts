export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { NextResponse } from "next/server";
import { formatBillingPeriod } from "@/lib/utils";
import { authenticateBasicAuth } from "@/lib/basicAuth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const basicUser = !session?.user ? await authenticateBasicAuth(req) : null;
  const userId = session?.user ? (session.user as any).id : basicUser?.id;
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const {
      amount,
      currency,
      date,
      type,
      description,
      accountId,
      categoryId,
      categoryName,
      householdId,
      billingPeriod,
      externalId
    } = await req.json();

    const finalBillingPeriod = billingPeriod || formatBillingPeriod(date);

    // Start a transaction to update account balance and create the transaction record
    const result = await prisma.$transaction(async (tx) => {
      let resolvedAccountId = accountId;
      if (!resolvedAccountId) {
        let defaultAccount = await tx.account.findFirst({
          where: { householdId, isArchived: false }
        });
        if (!defaultAccount) {
          defaultAccount = await tx.account.create({
            data: {
              name: "Cuenta Principal",
              type: "CHECKING",
              balance: 0,
              currency: currency || "CLP",
              householdId
            }
          });
        }
        resolvedAccountId = defaultAccount.id;
      }

      let resolvedCategoryId = categoryId;
      if (!resolvedCategoryId && categoryName && categoryName.trim() !== "") {
        const trimmedName = categoryName.trim();
        const match = await tx.category.findFirst({
          where: {
            name: trimmedName,
            OR: [
              { householdId },
              { isDefault: true }
            ]
          }
        });
        if (match) {
          resolvedCategoryId = match.id;
        } else {
          const newCat = await tx.category.create({
            data: {
              name: trimmedName,
              householdId,
              isDefault: false
            }
          });
          resolvedCategoryId = newCat.id;
        }
      }

      const transaction = await tx.transaction.create({
        data: {
          amount,
          currency: currency || "CLP",
          date: new Date(date),
          type,
          description,
          accountId: resolvedAccountId,
          categoryId: resolvedCategoryId,
          householdId,
          billingPeriod: finalBillingPeriod,
          userId: userId, // The owner
          userId_internal: userId, // The creator
          externalId
        },
      });

      // Update balance
      const multiplier = type === 'INCOME' ? 1 : -1;
      await tx.account.update({
        where: { id: resolvedAccountId },
        data: {
          balance: {
            increment: Number(amount) * multiplier,
          },
        },
      });

      return transaction;
    });

    const mappedResult = {
      ...result,
      amount: Number(result.amount),
      date: result.date.getTime(),
      createdAt: result.createdAt.getTime(),
      updatedAt: result.updatedAt.getTime(),
      deletedAt: result.deletedAt ? result.deletedAt.getTime() : null
    };

    return NextResponse.json(mappedResult, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Error creating transaction" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const basicUser = !session?.user ? await authenticateBasicAuth(req) : null;
  const userId = session?.user ? (session.user as any).id : basicUser?.id;
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const householdId = searchParams.get('householdId');
  const uncategorized = searchParams.get('uncategorized') === 'true';
  const includeIgnored = searchParams.get('includeIgnored') === 'true';

  try {
    // Get all households the user belongs to
    const userHouseholds = await prisma.userHousehold.findMany({
      where: { userId },
      select: { householdId: true }
    });
    const householdIds = userHouseholds.map(uh => uh.householdId);

    let whereFilter: any = {
      deletedAt: null // Only active transactions
    };
    
    if (householdId) {
      whereFilter.householdId = householdId;
    } else {
      // Return personal transactions OR household transactions for households the user is in
      whereFilter.OR = [
        { userId },
        { householdId: { in: householdIds } }
      ];
    }

    if (uncategorized) {
      whereFilter = {
        ...whereFilter,
        OR: [
          ...(whereFilter.OR || []),
          { categoryId: null },
          { categorySource: { not: 'manual' } }
        ]
      };
    }

    // By default hide ignored transactions; show them only when explicitly requested
    if (!includeIgnored) {
      whereFilter.ignored = false;
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

    const mappedTransactions = transactions.map(t => ({
      ...t,
      amount: Number(t.amount),
      date: t.date.getTime(),
      createdAt: t.createdAt.getTime(),
      updatedAt: t.updatedAt.getTime(),
      deletedAt: t.deletedAt ? t.deletedAt.getTime() : null,
      account: t.account ? {
        ...t.account,
        balance: Number(t.account.balance),
        createdAt: t.account.createdAt.getTime(),
        updatedAt: t.account.updatedAt.getTime()
      } : null,
      category: t.category ? {
        ...t.category,
        createdAt: t.category.createdAt.getTime(),
        updatedAt: t.category.updatedAt.getTime()
      } : null
    }));

    return NextResponse.json(mappedTransactions);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Error fetching transactions" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const basicUser = !session?.user ? await authenticateBasicAuth(req) : null;
  const userId = session?.user ? (session.user as any).id : basicUser?.id;
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const billingPeriod = searchParams.get('billingPeriod');

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
      deletedAt: null,
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

    // Execute soft deletion and balance adjustment in a transaction
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

      // Soft delete the transactions (instead of hard delete)
      await tx.transaction.updateMany({
        where: whereFilter,
        data: { deletedAt: new Date() }
      });
    });

    return NextResponse.json({ message: "Period deleted successfully", count: transactionsToDelete.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Error deleting period" }, { status: 500 });
  }
}
