import { prisma } from "@/lib/prisma";
import { getBudgets } from "./budgetService";
import { detectOutliers, detectRecurrence, getPredictions, calculateBehaviorScore } from "./advancedInsightsService";

function getLastNPeriods(startPeriod: string, n = 6): string[] {
  const parts = startPeriod.split("-");
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const date = new Date(year, month - 1, 1);
  const periods: string[] = [];
  
  for (let i = 0; i < n; i++) {
    const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    periods.push(`${d.getFullYear()}-${m}`);
  }
  return periods.reverse();
}

function getPeriodDate(periodLabel: string): Date {
  if (/^\d{4}-\d{2}$/.test(periodLabel)) {
    const parts = periodLabel.split("-");
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
  }
  const parts = periodLabel.split(" - ");
  if (parts.length !== 2) return new Date();
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const monthIdx = monthNames.indexOf(parts[0]);
  return new Date(parseInt(parts[1]), monthIdx === -1 ? 0 : monthIdx, 1);
}

export async function generateMonthlyReport(params: { month: number; year: number; userId: string; householdId?: string; billingPeriod?: string }) {
  const { month, year, userId, householdId, billingPeriod } = params;
  
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  const targetPeriod = billingPeriod || `${year}-${String(month).padStart(2, "0")}`;
  const periods = getLastNPeriods(targetPeriod, 6);

  // We want to fetch 6 months of data in a single query
  const firstPeriodParts = periods[0].split("-");
  const startOf6Months = new Date(parseInt(firstPeriodParts[0]), parseInt(firstPeriodParts[1]) - 1, 1);

  const periodOrDateCondition = {
    OR: [
      { billingPeriod: { in: periods } },
      {
        billingPeriod: null,
        date: { gte: startOf6Months, lte: endOfMonth }
      }
    ]
  };

  const whereFilter: any = {
    ignored: false,
    deletedAt: null,
    AND: [
      periodOrDateCondition
    ]
  };
  
  if (householdId) {
    whereFilter.householdId = householdId;
    whereFilter.scope = 'HOUSEHOLD';
  } else {
    whereFilter.AND.push({
      OR: [
        { userId, householdId: null },
        { userId_internal: userId, scope: 'PERSONAL' }
      ]
    });
  }

  // 1. Fetch data in parallel
  const [allTransactions, categories, budgets, accounts, salaries] = await Promise.all([
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
    }),
    prisma.salary.findMany({
      where: {
        period: { in: periods },
        ...(householdId ? { householdId } : { userId })
      }
    })
  ]);

  // Filter transactions for the current period in memory
  const transactions = allTransactions.filter(t => 
    t.billingPeriod === targetPeriod || 
    (t.billingPeriod === null && t.date >= startOfMonth && t.date <= endOfMonth)
  );

  // 2. Metrics calculation
  const expensesPerCategory: Record<string, number> = {};
  let totalExpenses = 0;

  transactions.forEach(t => {
    if (t.type === 'EXPENSE') {
      const catName = t.category?.name || 'Sin Categoría';
      expensesPerCategory[catName] = (expensesPerCategory[catName] || 0) + Number(t.amount);
      totalExpenses += Number(t.amount);
    }
  });

  const totalIncome = salaries.filter(s => s.period === targetPeriod).reduce((sum, s) => sum + Number(s.amount), 0);
  const totalBalance = totalIncome - totalExpenses;

  // 3. Evolution (Last 6 months) calculated completely in memory
  const evolution = [];
  for (let i = 5; i >= 0; i--) {
    const periodLabel = periods[5 - i];
    const d = getPeriodDate(periodLabel);

    const monthlyTxs = allTransactions.filter(t => t.billingPeriod === periodLabel);
    const ingresos = salaries.filter(s => s.period === periodLabel).reduce((sum, s) => sum + Number(s.amount), 0);
    const gastos = monthlyTxs.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Number(t.amount), 0);

    evolution.push({
      period: periodLabel,
      month: d.toLocaleString('es-CL', { month: 'short' }),
      ingresos,
      gastos
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
  const alerts: { categoryId: string; message: string }[] = [];
  const insights: string[] = [];

  budgetVsActual.forEach(item => {
    if (item.isOverBudget) {
      alerts.push({
        categoryId: item.categoryId,
        message: `Superaste el presupuesto de ${item.categoryName} por ${Math.round(item.actualAmount - item.budgetedAmount)} CLP.`
      });
    } else if (item.percentUsed > 80) {
      alerts.push({
        categoryId: item.categoryId,
        message: `Has usado el ${Math.round(item.percentUsed)}% en ${item.categoryName}.`
      });
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

  // 8. Advanced Insights integration (Android alignment)
  let advancedInsights: any[] = [];
  let advancedOutliers: any[] = [];
  let projections: any[] = [];
  let behaviorScore: any = null;

  if (householdId && targetPeriod) {
    try {
      const [outliers, recurrence, preds, score] = await Promise.all([
        detectOutliers(householdId, targetPeriod, allTransactions),
        detectRecurrence(householdId, targetPeriod, transactions),
        getPredictions(householdId, targetPeriod, allTransactions, categories),
        calculateBehaviorScore(householdId, targetPeriod, allTransactions, salaries)
      ]);
      advancedOutliers = outliers;
      advancedInsights = recurrence;
      projections = preds;
      behaviorScore = score;
    } catch (err) {
      console.error("Error generating advanced insights:", err);
    }
  }

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
        id: b.categoryId,
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
    insights: advancedInsights.length > 0 ? [...insights, ...advancedInsights.map(ai => ai.description)] : insights,
    anomalousExpenses: advancedOutliers.length > 0 ? advancedOutliers : anomalousExpenses,
    projections,
    behaviorScore,
    dailyAverage
  };
}
