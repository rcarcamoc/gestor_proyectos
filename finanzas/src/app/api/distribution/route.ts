import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';

// Helper to convert "Enero - 2026" to "2026-01"
function parseBillingPeriod(billingPeriod: string): string {
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

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const householdId = searchParams.get('householdId');
  const billingPeriodParam = searchParams.get('billingPeriod');

  if (!householdId) {
    return NextResponse.json({ error: 'Household ID required' }, { status: 400 });
  }

  // 1. Format billing period
  const now = new Date();
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const currentPeriod = `${monthNames[now.getMonth()]} - ${now.getFullYear()}`;
  const billingPeriod = billingPeriodParam || currentPeriod;
  const androidPeriod = parseBillingPeriod(billingPeriod);

  try {
    // 2. Fetch all members (users) of the household
    const members = await prisma.userHousehold.findMany({
      where: { householdId },
      include: { user: true }
    });

    // 3. Fetch salaries from the new Salary table for this period
    const dbSalaries = await prisma.salary.findMany({
      where: { householdId, period: androidPeriod }
    });

    // 4. Construct user income list
    const incomeResults: { name: string; userId: string | null; income: number }[] = [];

    if (dbSalaries.length > 0) {
      // Loop through all registered members of the household first
      for (const m of members) {
        const salary = dbSalaries.find(s => s.userId === m.userId);
        incomeResults.push({
          name: m.user.name || m.user.email,
          userId: m.userId,
          income: salary ? Number(salary.amount) : 0
        });
      }

      // Also add fictional (dummy) users who have salaries in this period
      const dummySalaries = dbSalaries.filter(s => !s.userId && s.dummyUserName);
      for (const ds of dummySalaries) {
        incomeResults.push({
          name: ds.dummyUserName || "Ficticio",
          userId: null,
          income: Number(ds.amount)
        });
      }
    } else {
      // Fallback: sum incomes from transactions (compat)
      for (const m of members) {
        const incomes = await prisma.transaction.aggregate({
          where: {
            userId: m.userId,
            type: 'INCOME',
            billingPeriod,
            ignored: false
          },
          _sum: { amount: true }
        });
        incomeResults.push({
          name: m.user.name || m.user.email,
          userId: m.userId,
          income: Number(incomes._sum.amount || 0)
        });
      }
    }

    // 5. Get "Tarjeta titular" category
    const categories = await prisma.category.findMany({
      where: {
        OR: [
          { householdId },
          { isDefault: true }
        ]
      }
    });
    const categoryTarjetaTitular = categories.find(c =>
      c.name.toLowerCase() === "tarjeta titular"
    );

    // 6. Get all household expenses in this period
    const allExpensesList = await prisma.transaction.findMany({
      where: {
        householdId,
        type: 'EXPENSE',
        billingPeriod,
        ignored: false
      }
    });

    const totalExpenses = allExpensesList.reduce((acc, t) => acc + Number(t.amount), 0);

    // Calculate Tarjeta Titular expenses
    const tarjetaTitularExpenses = allExpensesList
      .filter(t => categoryTarjetaTitular && t.categoryId === categoryTarjetaTitular.id)
      .reduce((acc, t) => acc + Number(t.amount), 0);

    // Total distributable (distributable = total - tarjeta titular)
    const totalADistribuir = Math.max(0, totalExpenses - tarjetaTitularExpenses);

    const totalIncome = incomeResults.reduce((acc, r) => acc + r.income, 0);

    // 7. Calculate proportional contribution with target adjustments
    const distribution = incomeResults.map(r => {
      const percentage = totalIncome > 0 ? (r.income / totalIncome) : 0;
      let suggestedContribution = totalADistribuir * percentage;
      let cardExpenses = 0;

      // Rule: Add Tarjeta Titular expenses directly to "papá"
      const isPapa = r.name.toLowerCase() === "papá" || r.name.toLowerCase() === "papa";
      if (isPapa) {
        suggestedContribution += tarjetaTitularExpenses;
        cardExpenses = tarjetaTitularExpenses;
      }

      return {
        name: r.name,
        userId: r.userId,
        income: r.income,
        percentage: percentage * 100,
        suggestedContribution,
        cardExpenses,
        baseContribution: totalADistribuir * percentage
      };
    });

    return NextResponse.json({
      totalExpenses,
      totalTarjetaTitular: tarjetaTitularExpenses,
      totalADistribuir,
      totalIncome,
      distribution,
      billingPeriod
    });
  } catch (error) {
    console.error("GET distribution error:", error);
    return NextResponse.json({ error: "Error calculating distribution" }, { status: 500 });
  }
}
