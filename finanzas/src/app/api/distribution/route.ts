import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const householdId = searchParams.get('householdId');

  if (!householdId) {
    return NextResponse.json({ error: 'Household ID required' }, { status: 400 });
  }

  // 1. Get all members of the household
  const members = await prisma.userHousehold.findMany({
    where: { householdId },
    include: { user: true }
  });

  // 2. Get incomes for each member in the current month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const results = await Promise.all(members.map(async (m) => {
    const incomes = await prisma.transaction.aggregate({
      where: {
        userId: m.userId,
        type: 'INCOME',
        date: { gte: startOfMonth }
      },
      _sum: { amount: true }
    });

    return {
      userId: m.userId,
      name: m.user.name,
      income: Number(incomes._sum.amount || 0)
    };
  }));

  // 3. Get total household expenses (shared accounts)
  const expenses = await prisma.transaction.aggregate({
    where: {
      householdId,
      type: 'EXPENSE',
      date: { gte: startOfMonth }
    },
    _sum: { amount: true }
  });

  const totalIncome = results.reduce((acc, r) => acc + r.income, 0);
  const totalExpenses = Number(expenses._sum.amount || 0);

  const distribution = results.map(r => {
    const percentage = totalIncome > 0 ? (r.income / totalIncome) : 0;
    return {
      ...r,
      percentage: percentage * 100,
      suggestedContribution: totalExpenses * percentage
    };
  });

  return NextResponse.json({
    totalExpenses,
    totalIncome,
    distribution
  });
}
