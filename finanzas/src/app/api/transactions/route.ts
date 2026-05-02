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
  const userId = (session.user as any).id;

  try {
    const whereBase = householdId ? { householdId } : { userId, householdId: null };
    const whereFilter = uncategorized
      ? { ...whereBase, OR: [{ categoryId: null }, { categorySource: 'needs_review' }] }
      : whereBase;

    const transactions = await prisma.transaction.findMany({
      where: whereFilter,
      include: {
        account: true,
        category: true,
      },
      orderBy: { date: 'desc' },
      take: 100,
    });

    return NextResponse.json(transactions);
  } catch (error) {
    return NextResponse.json({ message: "Error fetching transactions" }, { status: 500 });
  }
}
