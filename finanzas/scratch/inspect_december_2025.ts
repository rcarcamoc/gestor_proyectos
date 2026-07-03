import fs from "fs";
import path from "path";

// Load environment variables manually
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
    if (match) {
      process.env.DATABASE_URL = match[1];
    }
    const groqMatch = envContent.match(/GROQ_API_KEY=["']?([^"'\r\n]+)["']?/);
    if (groqMatch) {
      process.env.GROQ_API_KEY = groqMatch[1];
    }
  }
} catch (e) {
  console.error("Error reading .env file:", e);
}

import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    console.log("Searching for records in December 2025...");

    const txs_period = await prisma.transaction.findMany({
      where: {
        OR: [
          { billingPeriod: "2025-12" },
          { billingPeriod: "Diciembre - 2025" },
          { billingPeriod: "Diciembre 2025" },
          { billingPeriod: "diciembre 2025" }
        ]
      }
    });

    const budgets = await prisma.budget.findMany({
      where: {
        month: 12,
        year: 2025
      }
    });

    const salaries = await prisma.salary.findMany({
      where: {
        OR: [
          { period: "2025-12" },
          { period: "2025-12" }
        ]
      }
    });

    const debts = await prisma.debt.findMany({
      where: {
        OR: [
          { billingPeriod: "2025-12" },
          { billingPeriod: "Diciembre - 2025" },
          { billingPeriod: "Diciembre 2025" },
          { billingPeriod: "diciembre 2025" }
        ]
      }
    });

    console.log(`Found ${txs_period.length} transactions for December 2025.`);
    console.log(`Found ${budgets.length} budgets for December 2025.`);
    console.log(`Found ${salaries.length} salaries for December 2025.`);
    console.log(`Found ${debts.length} debts for December 2025.`);

    if (txs_period.length > 0) {
      console.log("Sample transaction:", txs_period[0]);
    }
  } catch (error) {
    console.error("Error inspecting database:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
