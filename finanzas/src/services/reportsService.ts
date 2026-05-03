import { prisma } from "@/lib/prisma";
import { getBudgets } from "./budgetService";

export async function generateMonthlyReport(params: { month: number; year: number; userId: string; householdId?: string; billingPeriod?: string }) {
  const { month, year, userId, householdId, billingPeriod } = params;
  
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  // Build where filter robustly
  const whereFilter: any = {
    ignored: false,
  };
  
  if (householdId) {
    whereFilter.householdId = householdId;
    whereFilter.scope = 'HOUSEHOLD';
  } else {
    whereFilter.OR = [
      { userId, householdId: null },
      { userId_internal: userId, scope: 'PERSONAL' }
    ];
  }

  if (billingPeriod) {
    whereFilter.billingPeriod = billingPeriod;
  } else {
    whereFilter.date = { gte: startOfMonth, lte: endOfMonth };
  }

  // 1. Fetch data in parallel
  const [transactions, categories, budgets, accounts] = await Promise.all([
    prisma.transaction.findMany({
      where: whereFilter,
      include: { category: true },
      orderBy: { date: 'desc' }
    }),
    prisma.category.findMany({
        where: {
            OR: [
                { userId },
                { householdId },
                { isDefault: true }
            ]
        }
    }),
    getBudgets({ month, year, userId: householdId ? undefined : userId, householdId }),
    prisma.account.findMany({
      where: householdId ? { householdId } : { userId, householdId: null }
    })
  ]);

  // 2. Metrics calculation
  const totalBalance = accounts.reduce((acc, a) => acc + Number(a.balance), 0);
  const expensesPerCategory: Record<string, number> = {};
  let totalExpenses = 0;
  let totalIncome = 0;

  transactions.forEach(t => {
    if (t.type === 'EXPENSE') {
      const catName = t.category?.name || 'Sin Categoría';
      expensesPerCategory[catName] = (expensesPerCategory[catName] || 0) + Number(t.amount);
      totalExpenses += Number(t.amount);
    } else if (t.type === 'INCOME') {
      totalIncome += Number(t.amount);
    }
  });

  // 3. Evolution (Last 6 months)
  const evolution = [];
  const now = new Date(year, month - 1, 1);
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const endD = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

    const groupWhere: any = {
      ignored: false,
      date: { gte: d, lte: endD }
    };

    if (householdId) {
      groupWhere.householdId = householdId;
      groupWhere.scope = 'HOUSEHOLD';
    } else {
      groupWhere.OR = [
        { userId, householdId: null },
        { userId_internal: userId, scope: 'PERSONAL' }
      ];
    }

    const monthlyTxs = await prisma.transaction.groupBy({
      by: ['type'],
      where: groupWhere,
      _sum: { amount: true }
    });

    evolution.push({
      month: d.toLocaleString('es-CL', { month: 'short' }),
      ingresos: Number(monthlyTxs.find(m => m.type === 'INCOME')?._sum.amount || 0),
      gastos: Number(monthlyTxs.find(m => m.type === 'EXPENSE')?._sum.amount || 0)
    });
  }

  // 4. Budget vs Actual
  const budgetVsActual = categories.map(cat => {
    const budget = budgets.find(b => b.categoryId === cat.id);
    const actual = expensesPerCategory[cat.name] || 0;
    const limit = budget ? Number(budget.limit) : 0;
    
    return {
      categoryId: cat.id,
      categoryName: cat.name,
      categoryColor: cat.color,
      categoryIcon: cat.icon,
      budgetedAmount: limit,
      actualAmount: actual,
      percentUsed: limit > 0 ? (actual / limit) * 100 : 0,
      isOverBudget: limit > 0 && actual > limit
    };
  }).filter(item => item.budgetedAmount > 0 || item.actualAmount > 0);

  // 5. Insights & Alerts
  const alerts: string[] = [];
  const insights: string[] = [];

  budgetVsActual.forEach(item => {
    if (item.isOverBudget) {
      alerts.push(`Superaste el presupuesto de ${item.categoryName} por ${Math.round(item.actualAmount - item.budgetedAmount)} CLP.`);
    } else if (item.percentUsed > 80) {
      alerts.push(`Has usado el ${Math.round(item.percentUsed)}% en ${item.categoryName}.`);
    }
  });

  const totalBudget = budgets.reduce((acc, b) => acc + Number(b.limit), 0);
  if (totalExpenses > totalBudget && totalBudget > 0) {
    insights.push(`Este mes has gastado un ${Math.round((totalExpenses / totalBudget - 1) * 100)}% más de lo presupuestado.`);
  } else if (totalBudget > 0) {
    insights.push(`¡Vas bien! Te queda el ${Math.round((1 - totalExpenses / totalBudget) * 100)}% de tu presupuesto total.`);
  }

  return {
    month,
    year,
    totalBalance,
    totalExpenses,
    totalIncome,
    totalBudget,
    evolution,
    expensesByCategory: budgetVsActual.map(b => ({ name: b.categoryName, amount: b.actualAmount })),
    budgetVsActual,
    recentTransactions: transactions.slice(0, 5),
    alerts,
    insights
  };
}
