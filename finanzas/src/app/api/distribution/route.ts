export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const householdId = searchParams.get('householdId');

  if (!householdId) {
    return NextResponse.json({ message: "Household ID required" }, { status: 400 });
  }

  try {
    // 1. Get household members
    const members = await prisma.userHousehold.findMany({
      where: { householdId },
      include: { user: { select: { id: true, name: true } } }
    });

    // 2. Get incomes for each member in the last 30 days (or current month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const memberIncomes = await Promise.all(members.map(async (m) => {
      const income = await prisma.transaction.aggregate({
        where: {
          userId_internal: m.userId,
          type: 'INCOME',
          date: { gte: startOfMonth }
        },
        _sum: { amount: true }
      });
      return {
        userId: m.userId,
        name: m.user.name,
        income: Number(income._sum.amount || 0)
      };
    }));

    const totalIncome = memberIncomes.reduce((acc, m) => acc + m.income, 0);

    // 3. Calculate percentages
    const distribution = memberIncomes.map(m => ({
      ...m,
      percentage: totalIncome > 0 ? (m.income / totalIncome) : (1 / members.length)
    }));

    // 4. Get total household expenses
    const totalExpenses = await prisma.transaction.aggregate({
      where: {
        householdId,
        type: 'EXPENSE',
        date: { gte: startOfMonth }
      },
      _sum: { amount: true }
    });

    const expenseAmount = Number(totalExpenses._sum.amount || 0);

    const result = {
      totalIncome,
      totalExpenses: expenseAmount,
      distribution: distribution.map(d => ({
        ...d,
        suggestedContribution: expenseAmount * d.percentage
      }))
    };

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: "Error calculating distribution" }, { status: 500 });
  }
}
