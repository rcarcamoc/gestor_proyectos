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
    const periodLabel = `${['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][d.getMonth()]} - ${d.getFullYear()}`;

    const groupWhere: any = {
      ignored: false,
      billingPeriod: periodLabel
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

  // 6. Anomalous Expenses (Outliers)
  const expenses = transactions.filter(t => t.type === 'EXPENSE');
  const expenseAmounts = expenses.map(e => Number(e.amount));
  const anomalousExpenses: any[] = [];
  if (expenseAmounts.length > 0) {
    const avg = expenseAmounts.reduce((a, b) => a + b, 0) / expenseAmounts.length;
    const variance = expenseAmounts.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / expenseAmounts.length;
    const stdDev = Math.sqrt(variance);
    // z-score > 1.5 and amount >= 40.000 CLP
    const threshold = Math.max(avg + 1.5 * stdDev, 40000);
    expenses.forEach(e => {
      if (Number(e.amount) > threshold) {
        anomalousExpenses.push({
          id: e.id,
          description: e.description,
          amount: Number(e.amount),
          date: e.date,
          categoryName: e.category?.name || 'Sin Categoría',
          categoryColor: e.category?.color || '#A8A29E',
          categoryIcon: e.category?.icon || 'Tag',
          deviationFactor: (Number(e.amount) / avg).toFixed(1)
        });
      }
    });
    anomalousExpenses.sort((a, b) => b.amount - a.amount);
  }

  // 7. Daily Average Calculation
  const daysInMonth = new Date(year, month, 0).getDate();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const isCurrentPeriod = (year === currentYear && month === currentMonth);
  const daysElapsed = isCurrentPeriod ? Math.max(1, new Date().getDate()) : daysInMonth;
  const dailyAverage = totalExpenses / daysElapsed;

  return {
    month,
    year,
    totalBalance,
    totalExpenses,
    totalIncome,
    totalBudget,
    evolution,
    expensesByCategory: budgetVsActual
      .map(b => ({ 
        name: b.categoryName, 
        amount: b.actualAmount,
        color: b.categoryColor || '#A8A29E',
        icon: b.categoryIcon || 'Tag'
      }))
      .filter(e => e.amount > 0)
      .sort((a, b) => b.amount - a.amount),
    budgetVsActual,
    recentTransactions: transactions.slice(0, 5),
    alerts,
    insights,
    anomalousExpenses,
    dailyAverage
  };
}
