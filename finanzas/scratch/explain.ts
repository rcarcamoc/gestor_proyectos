import { prisma } from "../src/lib/prisma";

async function main() {
  const user = await prisma.user.findFirst();
  const household = await prisma.household.findFirst();
  if (!user) {
    console.log("No user found");
    return;
  }
  console.log("User:", user.id);
  console.log("Household:", household?.id);

  const billingPeriod = "2026-06";

  const explain1 = await prisma.$queryRawUnsafe(`
    EXPLAIN SELECT * FROM \`Transaction\` 
    WHERE \`deletedAt\` IS NULL 
      AND (\`userId\` = '${user.id}' OR \`householdId\` IN (SELECT \`householdId\` FROM \`UserHousehold\` WHERE \`userId\` = '${user.id}'))
      AND (\`billingPeriod\` = '${billingPeriod}' OR (\`billingPeriod\` IS NULL AND \`date\` >= '2026-06-01 00:00:00' AND \`date\` <= '2026-06-30 23:59:59'))
    ORDER BY \`date\` DESC
    LIMIT 1000
  `);
  console.log("Explain Plan 1 (Unspecified Household):");
  console.log(JSON.stringify(explain1, null, 2));

  if (household) {
    const explain2 = await prisma.$queryRawUnsafe(`
      EXPLAIN SELECT * FROM \`Transaction\` 
      WHERE \`deletedAt\` IS NULL 
        AND \`householdId\` = '${household.id}'
        AND (\`billingPeriod\` = '${billingPeriod}' OR (\`billingPeriod\` IS NULL AND \`date\` >= '2026-06-01 00:00:00' AND \`date\` <= '2026-06-30 23:59:59'))
      ORDER BY \`date\` DESC
      LIMIT 1000
    `);
    console.log("Explain Plan 2 (Specified Household):");
    console.log(JSON.stringify(explain2, null, 2));
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
