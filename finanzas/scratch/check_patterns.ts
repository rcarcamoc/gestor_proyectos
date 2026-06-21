import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Checking AutoClassificationPatterns...");
  const patterns = await prisma.autoClassificationPattern.findMany({
    include: {
      category: true,
    }
  });

  console.log(`Total patterns: ${patterns.length}`);
  console.log("Patterns detail:");
  patterns.forEach(p => {
    console.log(`ID: ${p.id} | Pattern: "${p.pattern}" | CategoryId: ${p.categoryId} | Category: "${p.category?.name}" | HouseholdId: ${p.householdId}`);
  });

  // Check for duplicates by pattern (case insensitive or exact)
  const patternCounts: Record<string, any[]> = {};
  patterns.forEach(p => {
    const key = p.pattern.toLowerCase();
    if (!patternCounts[key]) {
      patternCounts[key] = [];
    }
    patternCounts[key].push(p);
  });

  console.log("\nDuplicates/Conflicts analysis:");
  let conflictsFound = false;
  for (const [key, list] of Object.entries(patternCounts)) {
    if (list.length > 1) {
      conflictsFound = true;
      console.log(`Pattern: "${key}" is defined ${list.length} times:`);
      list.forEach(p => {
        console.log(`  - Category: "${p.category?.name}" (ID: ${p.categoryId}), Household: ${p.householdId}`);
      });
    }
  }

  if (!conflictsFound) {
    console.log("No duplicates/conflicts found by pattern name.");
  }
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
