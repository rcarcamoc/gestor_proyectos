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

    // 1. Total Balance
    const accounts = await prisma.account.findMany({ where });
    const totalBalance = accounts.reduce((acc, a) => acc + Number(a.balance), 0);

    const billingPeriod = searchParams.get('billingPeriod');

    // 2. Expenses by category
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const expensesByCategory = await prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        ...where,
        type: 'EXPENSE',
        ...(billingPeriod ? { billingPeriod } : { date: { gte: startOfMonth } })
      },
      _sum: { amount: true }
    });

    // Resolve category names
    const categories = await prisma.category.findMany();
    const formattedExpenses = expensesByCategory.map(e => ({
      name: categories.find(c => c.id === e.categoryId)?.name || 'Sin categoría',
      amount: Number(e._sum.amount || 0)
    }));

    // 3. Monthly evolution (last 6 months)
    const evolution = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const monthlyData = await prisma.transaction.groupBy({
        by: ['type'],
        where: {
          ...where,
          date: { gte: d, lt: nextD }
        },
        _sum: { amount: true }
      });

      evolution.push({
        month: d.toLocaleString('es-CL', { month: 'short' }),
        ingresos: Number(monthlyData.find(m => m.type === 'INCOME')?._sum.amount || 0),
        gastos: Number(monthlyData.find(m => m.type === 'EXPENSE')?._sum.amount || 0)
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
  }
}
