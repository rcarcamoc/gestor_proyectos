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
  const userId = (session.user as any).id;

  try {
    const where = householdId ? { householdId } : { userId, householdId: null };
    const billingPeriod = searchParams.get('billingPeriod');

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const oldestDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Parallel execution of all stats queries
    const [accounts, expensesByCategory, categories, monthlyTxs] = await Promise.all([
      prisma.account.findMany({ where }),
      prisma.transaction.groupBy({
        by: ['categoryId'],
        where: {
          ...where,
          type: 'EXPENSE',
          deletedAt: null,
          ...(billingPeriod ? { billingPeriod } : { date: { gte: startOfMonth } })
        },
        _sum: { amount: true }
      }),
      prisma.category.findMany({
        where: {
          OR: [
            householdId ? { householdId } : {},
            { isDefault: true }
          ]
        },
        select: { id: true, name: true }
      }),
      prisma.transaction.findMany({
        where: {
          ...where,
          deletedAt: null,
          date: { gte: oldestDate, lt: nextMonthDate }
        },
        select: {
          amount: true,
          type: true,
          date: true
        }
      })
    ]);

    // 1. Total Balance
    const totalBalance = accounts.reduce((acc, a) => acc + Number(a.balance), 0);

    // 2. Expenses by category
    const formattedExpenses = expensesByCategory.map(e => ({
      name: categories.find(c => c.id === e.categoryId)?.name || 'Sin categoría',
      amount: Number(e._sum.amount || 0)
    }));

    // 3. Monthly evolution
    const evolution = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const monthlyData = monthlyTxs.filter(tx => tx.date >= d && tx.date < nextD);
      
      const ingresos = monthlyData
        .filter(tx => tx.type === 'INCOME')
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      const gastos = monthlyData
        .filter(tx => tx.type === 'EXPENSE')
        .reduce((sum, tx) => sum + Number(tx.amount), 0);

      evolution.push({
        month: d.toLocaleString('es-CL', { month: 'short' }),
        ingresos,
        gastos
      });
    }

    return NextResponse.json({
      totalBalance,
      expensesByCategory: formattedExpenses,
      evolution
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Error fetching stats" }, { status: 500 });
  }}
