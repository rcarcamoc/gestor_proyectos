import { prisma } from "../src/lib/prisma";

async function main() {
  const user = await prisma.user.findFirst();
  const household = await prisma.household.findFirst();
  if (!user || !household) {
    console.log("Required data not found in database. Cannot run benchmark.");
    return;
  }
  
  const userId = user.id;
  const householdId = household.id;
  const targetPeriod = "2026-06";
  const month = 6;
  const year = 2026;

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);
  
  const periods = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
  const startOf6Months = new Date(2026, 0, 1);

  // Common where filter for transactions
  const transactionWhere = {
    ignored: false,
    deletedAt: null,
    AND: [
      {
        OR: [
          { billingPeriod: { in: periods } },
          {
            billingPeriod: null,
            date: { gte: startOf6Months, lte: endOfMonth }
          }
        ]
      }
    ]
  };

  console.log("Warming up database connections...");
  // Warmup strategy 1
  await Promise.all([
    prisma.transaction.findMany({ where: { ...transactionWhere, householdId, scope: 'HOUSEHOLD' } }),
    prisma.category.findMany({ where: { OR: [{ userId }, { householdId }, { isDefault: true }] } }),
    prisma.budget.findMany({ where: { month, year, OR: [{ householdId }] } }),
    prisma.account.findMany({ where: { householdId } }),
    prisma.salary.findMany({ where: { householdId, period: targetPeriod } })
  ]);
  // Warmup strategy 2
  await prisma.household.findUnique({
    where: { id: householdId },
    include: {
      transactions: {
        where: { ...transactionWhere, scope: 'HOUSEHOLD' },
        include: { category: true }
      },
      categories: true,
      budgets: {
        where: { month, year }
      },
      accounts: true,
      salaries: {
        where: { period: targetPeriod }
      }
    }
  });

  console.log("=========================================");
  console.log("COMPARING STRATEGY 1 (Promise.all) VS STRATEGY 2 (Nested Include)");
  console.log("=========================================\n");

  // Run Strategy 1: Promise.all
  const startStrat1 = performance.now();
  const [txs1, cats1, budgets1, accounts1, salaries1] = await Promise.all([
    prisma.transaction.findMany({ 
      where: { ...transactionWhere, householdId, scope: 'HOUSEHOLD' },
      include: { category: true }
    }),
    prisma.category.findMany({ where: { OR: [{ userId }, { householdId }, { isDefault: true }] } }),
    prisma.budget.findMany({ where: { month, year, OR: [{ householdId }] } }),
    prisma.account.findMany({ where: { householdId } }),
    prisma.salary.findMany({ where: { householdId, period: targetPeriod } })
  ]);
  const endStrat1 = performance.now();
  console.log(`Strategy 1 (Promise.all) completed in: ${(endStrat1 - startStrat1).toFixed(2)} ms`);
  console.log(`- Loaded: ${txs1.length} txs, ${cats1.length} categories, ${budgets1.length} budgets, ${accounts1.length} accounts, ${salaries1.length} salaries.\n`);

  // Run Strategy 2: Single request nested include
  const startStrat2 = performance.now();
  const householdData = await prisma.household.findUnique({
    where: { id: householdId },
    include: {
      transactions: {
        where: { ...transactionWhere, scope: 'HOUSEHOLD' },
        include: { category: true }
      },
      categories: true,
      budgets: {
        where: { month, year }
      },
      accounts: true,
      salaries: {
        where: { period: targetPeriod }
      }
    }
  });
  const endStrat2 = performance.now();
  console.log(`Strategy 2 (Nested Include) completed in: ${(endStrat2 - startStrat2).toFixed(2)} ms`);
  if (householdData) {
    console.log(`- Loaded: ${householdData.transactions.length} txs, ${householdData.categories.length} categories, ${householdData.budgets.length} budgets, ${householdData.accounts.length} accounts, ${householdData.salaries.length} salaries.`);
  }
  console.log();

  console.log("=========================================");
  console.log("DECISION:");
  if (endStrat2 < endStrat1) {
    console.log(`Strategy 2 (Nested Include) is faster by ${(endStrat1 - endStrat2).toFixed(2)} ms!`);
  } else {
    console.log(`Strategy 1 (Promise.all) is faster by ${(endStrat2 - endStrat1).toFixed(2)} ms!`);
  }
  console.log("=========================================");
}

main().catch(console.error).finally(() => prisma.$disconnect());
