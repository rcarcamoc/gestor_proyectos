import { prisma } from "@/lib/prisma";

export interface BehaviourInsight {
  type: string;
  title: string;
  description: string;
  value: number;
  unit: string;
  severity: "BAJA" | "MEDIA" | "ALTA" | "POSITIVA";
  actionRecommended: string;
  categoryName?: string;
}

export interface SpendingProjection {
  categoryName: string;
  projectedAmount: number;
  confiability: number; // 0.0 - 1.0
}

// Helper to convert "2026-06" or "Enero - 2026" to Date
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

// Helper to get last N period labels from a start period in YYYY-MM format
function getLastNPeriods(startPeriod: string, n = 6): string[] {
  const date = getPeriodDate(startPeriod);
  const periods: string[] = [];
  
  for (let i = 0; i < n; i++) {
    const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    periods.push(`${d.getFullYear()}-${month}`);
  }
  return periods.reverse();
}

/**
 * Detects outlier transactions where amount exceeds 2 standard deviations of category average.
 */
export async function detectOutliers(householdId: string, billingPeriod: string): Promise<any[]> {
  const periods = getLastNPeriods(billingPeriod, 6);
  
  // 1. Get transactions for the past 6 periods
  const txs = await prisma.transaction.findMany({
    where: {
      householdId,
      type: "EXPENSE",
      billingPeriod: { in: periods },
      ignored: false
    },
    include: { category: true }
  });

  const currentTxs = txs.filter(t => t.billingPeriod === billingPeriod);

  // Group by category to compute stats
  const catStats: Record<string, { avg: number; stdDev: number; count: number }> = {};
  const catAmounts: Record<string, number[]> = {};

  txs.forEach(t => {
    const catName = t.category?.name || "Sin Categoría";
    if (!catAmounts[catName]) catAmounts[catName] = [];
    catAmounts[catName].push(Number(t.amount));
  });

  Object.entries(catAmounts).forEach(([catName, amounts]) => {
    if (amounts.length < 2) return;
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);
    catStats[catName] = { avg, stdDev, count: amounts.length };
  });

  const outliers: any[] = [];
  currentTxs.forEach(t => {
    const catName = t.category?.name || "Sin Categoría";
    const stats = catStats[catName];
    if (!stats || stats.stdDev === 0) return;

    const amount = Number(t.amount);
    const zScore = (amount - stats.avg) / stats.stdDev;

    if (zScore > 2.0 && amount > 15000) { // Limit to values above 15k to avoid small noise
      outliers.push({
        id: t.id,
        description: t.description,
        amount,
        date: t.date,
        categoryName: catName,
        categoryColor: t.category?.color || "#A8A29E",
        categoryIcon: t.category?.icon || "Tag",
        zScore: Number(zScore.toFixed(1)),
        factor: Number((amount / stats.avg).toFixed(1))
      });
    }
  });

  return outliers.sort((a, b) => b.zScore - a.zScore);
}

/**
 * Detects recurrent expenses that appear multiple times in the current period.
 */
export async function detectRecurrence(householdId: string, billingPeriod: string): Promise<BehaviourInsight[]> {
  const txs = await prisma.transaction.findMany({
    where: { householdId, type: "EXPENSE", billingPeriod, ignored: false },
    include: { category: true }
  });

  const groups: Record<string, typeof txs> = {};
  txs.forEach(t => {
    const desc = (t.normalizedDescription && t.normalizedDescription !== "undefined")
      ? t.normalizedDescription
      : (t.description || "").trim().toLowerCase();
    
    if (desc.length < 3) return;
    if (!groups[desc]) groups[desc] = [];
    groups[desc].push(t);
  });

  const insights: BehaviourInsight[] = [];
  Object.entries(groups).forEach(([desc, items]) => {
    if (items.length >= 3) {
      const avg = items.reduce((a, b) => a + Number(b.amount), 0) / items.length;
      const total = items.reduce((acc, t) => acc + Number(t.amount), 0);
      const cat = items[0].category;

      insights.push({
        type: "GASTO_RECURRENTE",
        title: "Gasto Recurrente Detectado",
        description: `Has realizado ${items.length} transacciones en "${items[0].description}" sumando un total de $${Math.round(total).toLocaleString("es-CL")} CLP.`,
        value: total,
        unit: "CLP",
        severity: items.length >= 5 ? "MEDIA" : "BAJA",
        actionRecommended: "Establece un presupuesto límite o consolida estas compras para buscar alternativas de ahorro.",
        categoryName: cat?.name
      });
    }
  });

  return insights;
}

/**
 * Calculates budget projections using linear regression.
 */
export async function getPredictions(householdId: string, currentPeriod: string): Promise<SpendingProjection[]> {
  const periods = getLastNPeriods(currentPeriod, 6); // 6 months of data
  
  const categories = await prisma.category.findMany({
    where: { OR: [{ householdId }, { isDefault: true }] }
  });

  const txs = await prisma.transaction.findMany({
    where: {
      householdId,
      type: "EXPENSE",
      billingPeriod: { in: periods },
      ignored: false
    }
  });

  const projections: SpendingProjection[] = [];

  categories.forEach(cat => {
    // Map periods to totals
    const history: number[] = [];
    periods.forEach(p => {
      const total = txs
        .filter(t => t.categoryId === cat.id && t.billingPeriod === p)
        .reduce((acc, t) => acc + Number(t.amount), 0);
      history.push(total);
    });

    // We need at least 3 periods with spending to project
    const activeMonths = history.filter(h => h > 0).length;
    if (activeMonths < 3) return;

    // Linear regression: y = m*x + c
    const n = history.length;
    const sumX = history.map((_, idx) => idx).reduce((a, b) => a + b, 0);
    const sumY = history.reduce((a, b) => a + b, 0);
    const sumXY = history.map((val, idx) => idx * val).reduce((a, b) => a + b, 0);
    const sumX2 = history.map((_, idx) => idx * idx).reduce((a, b) => a + b, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Project next month
    const projectedAmount = Math.max(0, slope * n + intercept);
    
    // Confiability based on standard deviation / mean variability
    const mean = sumY / n;
    let confiability = 1.0;
    if (mean > 0) {
      const variance = history.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
      const stdDev = Math.sqrt(variance);
      confiability = Math.max(0.1, Math.min(1.0, 1 - (stdDev / mean)));
    }

    projections.push({
      categoryName: cat.name,
      projectedAmount: Math.round(projectedAmount),
      confiability: Number(confiability.toFixed(2))
    });
  });

  return projections.sort((a, b) => b.projectedAmount - a.projectedAmount);
}

/**
 * Calculates a Behavior Score (0-100) based on household financials.
 */
export async function calculateBehaviorScore(householdId: string, billingPeriod: string): Promise<{
  score: number;
  liquidezRatio: number;
  ahorroRatio: number;
  volatilidadRatio: number;
}> {
  // 1. Fetch incomes & expenses
  const txs = await prisma.transaction.findMany({
    where: { householdId, billingPeriod, ignored: false }
  });

  let incomes = txs.filter(t => t.type === "INCOME").reduce((acc, t) => acc + Number(t.amount), 0);
  const expenses = txs.filter(t => t.type === "EXPENSE").reduce((acc, t) => acc + Number(t.amount), 0);

  // Fallback: check salaries if no INCOME transactions logged
  if (incomes === 0) {
    const periodStr = parseBillingPeriod(billingPeriod);
    const salaries = await prisma.salary.findMany({
      where: { householdId, period: periodStr }
    });
    incomes = salaries.reduce((acc, s) => acc + Number(s.amount), 0);
  }

  // Ratio calculations
  const liquidezRatio = expenses > 0 ? incomes / expenses : incomes > 0 ? 3.0 : 1.0;
  const savings = Math.max(0, incomes - expenses);
  const ahorroRatio = incomes > 0 ? savings / incomes : 0.0;

  // Volatility across 3 months
  const periods = getLastNPeriods(billingPeriod, 3);
  const historicalTxs = await prisma.transaction.findMany({
    where: { householdId, type: "EXPENSE", billingPeriod: { in: periods }, ignored: false }
  });

  const totals = periods.map(p => 
    historicalTxs.filter(t => t.billingPeriod === p).reduce((acc, t) => acc + Number(t.amount), 0)
  );

  const meanExpenses = totals.reduce((a, b) => a + b, 0) / totals.length;
  let volatilidadRatio = 0.0;
  if (meanExpenses > 0) {
    const variance = totals.reduce((a, b) => a + Math.pow(b - meanExpenses, 2), 0) / totals.length;
    const stdDev = Math.sqrt(variance);
    volatilidadRatio = stdDev / meanExpenses; // Coefficient of variation
  }

  // Ponderate score
  let score = 0;

  // Liquidity (0 to 35 points)
  if (liquidezRatio >= 1.5) score += 35;
  else if (liquidezRatio >= 1.2) score += 28;
  else if (liquidezRatio >= 1.0) score += 20;
  else if (liquidezRatio >= 0.8) score += 10;

  // Savings rate (0 to 35 points)
  if (ahorroRatio >= 0.3) score += 35;
  else if (ahorroRatio >= 0.2) score += 30;
  else if (ahorroRatio >= 0.1) score += 20;
  else if (ahorroRatio >= 0.05) score += 10;

  // Stability (0 to 30 points)
  if (volatilidadRatio < 0.15) score += 30;
  else if (volatilidadRatio < 0.3) score += 22;
  else if (volatilidadRatio < 0.5) score += 12;
  else if (volatilidadRatio < 0.8) score += 5;

  return {
    score: Math.min(100, Math.max(10, score)),
    liquidezRatio: Number(liquidezRatio.toFixed(2)),
    ahorroRatio: Number((ahorroRatio * 100).toFixed(1)),
    volatilidadRatio: Number((volatilidadRatio * 100).toFixed(1))
  };
}

function parseBillingPeriod(billingPeriod: string): string {
  if (/^\d{4}-\d{2}$/.test(billingPeriod)) {
    return billingPeriod;
  }
  const parts = billingPeriod.split(" - ");
  if (parts.length !== 2) return billingPeriod;
  const monthName = parts[0];
  const year = parts[1];
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const monthIdx = monthNames.indexOf(monthName);
  if (monthIdx === -1) return billingPeriod;
  const month = String(monthIdx + 1).padStart(2, "0");
  return `${year}-${month}`;
}
