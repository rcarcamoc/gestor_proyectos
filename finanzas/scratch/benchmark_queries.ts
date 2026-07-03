import { prisma } from "../src/lib/prisma";
import { generateMonthlyReport } from "../src/services/reportsService";

async function main() {
  const user = await prisma.user.findFirst();
  const household = await prisma.household.findFirst();
  if (!user) {
    console.log("No user found in database. Cannot run benchmark.");
    return;
  }
  
  const userId = user.id;
  const householdId = household?.id;
  const billingPeriod = "2026-06";
  const userHouseholds = await prisma.userHousehold.findMany({
    where: { userId },
    select: { householdId: true }
  });
  const householdIds = userHouseholds.map(uh => uh.householdId);

  // WARMUP
  console.log("Warming up database connections and JIT compilation...");
  await generateMonthlyReport({ month: 6, year: 2026, userId, householdId, billingPeriod });
  
  console.log("=========================================");
  console.log("BENCHMARKING DATABASE QUERIES (WARM RUN)");
  console.log(`User: ${userId}`);
  console.log(`Household: ${householdId || "None"}`);
  console.log(`Period: ${billingPeriod}`);
  console.log("================================*********\n");

  // 1. Benchmark generateMonthlyReport
  console.log("1. Benchmarking generateMonthlyReport (Dashboard stats)...");
  const startReport = performance.now();
  const reportResult = await generateMonthlyReport({
    month: 6,
    year: 2026,
    userId,
    householdId,
    billingPeriod
  });
  const endReport = performance.now();
  console.log(`[PASS] generateMonthlyReport completed in: ${(endReport - startReport).toFixed(2)} ms`);
  console.log(`- Transactions fetched: ${reportResult.recentTransactions.length}`);
  console.log(`- Categories in report: ${reportResult.expensesByCategory.length}\n`);

  // 2. Benchmark transaction list queries (split logic in /api/transactions)
  console.log("2. Benchmarking transaction queries (GET /api/transactions)...");
  const startSplit = performance.now();
  const limit = 1000;
  const [personalTxs, householdTxs] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        deletedAt: null,
        ignored: false,
        userId,
        householdId: null
      },
      include: { account: true, category: true },
      orderBy: { date: 'desc' },
      take: limit
    }),
    prisma.transaction.findMany({
      where: {
        deletedAt: null,
        ignored: false,
        householdId: { in: householdIds }
      },
      include: { account: true, category: true },
      orderBy: { date: 'desc' },
      take: limit
    })
  ]);
  const combinedTxs = [...personalTxs, ...householdTxs]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, limit);
  const endSplit = performance.now();
  console.log(`[PASS] Split Transaction query completed in: ${(endSplit - startSplit).toFixed(2)} ms`);
  console.log(`- Total transactions loaded: ${combinedTxs.length}\n`);

  // 3. Compare with old style OR query (for comparison)
  console.log("3. Benchmarking old style OR query...");
  const startOld = performance.now();
  const oldTxs = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      ignored: false,
      OR: [
        { userId },
        { householdId: { in: householdIds } }
      ]
    },
    include: { account: true, category: true },
    orderBy: { date: 'desc' },
    take: limit
  });
  const endOld = performance.now();
  console.log(`[INFO] Old OR query completed in: ${(endOld - startOld).toFixed(2)} ms`);
  console.log(`- Total transactions loaded: ${oldTxs.length}\n`);

  console.log("=========================================");
  console.log("SUMMARY OF OPTIMIZATIONS");
  console.log(`- Split Index-Friendly Queries: ${(endSplit - startSplit).toFixed(2)} ms`);
  console.log(`- Original OR Query: ${(endOld - startOld).toFixed(2)} ms`);
  console.log(`- Monthly Report (Dashboard): ${(endReport - startReport).toFixed(2)} ms`);
  console.log("=========================================");
}

main().catch(console.error).finally(() => prisma.$disconnect());
