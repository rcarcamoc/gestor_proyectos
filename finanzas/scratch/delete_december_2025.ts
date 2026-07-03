import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    console.log("Locating records for billing period '2025-12'...");

    // Find transactions
    const txs = await prisma.transaction.findMany({
      where: {
        OR: [
          { billingPeriod: "2025-12" },
          { billingPeriod: "Diciembre - 2025" },
          { billingPeriod: "Diciembre 2025" },
          { billingPeriod: "diciembre 2025" }
        ]
      }
    });

    console.log(`Found ${txs.length} transactions to delete:`);
    for (const tx of txs) {
      console.log(`- ID: ${tx.id}, Amount: ${tx.amount} ${tx.currency}, Date: ${tx.date.toISOString()}, Desc: ${tx.description}, Period: ${tx.billingPeriod}`);
    }

    if (txs.length > 0) {
      const deletedTxs = await prisma.transaction.deleteMany({
        where: {
          id: {
            in: txs.map(t => t.id)
          }
        }
      });
      console.log(`Successfully deleted ${deletedTxs.count} transactions.`);
    } else {
      console.log("No transactions found to delete.");
    }

    // Also look for budgets, salaries, or debts just in case
    const deletedBudgets = await prisma.budget.deleteMany({
      where: {
        month: 12,
        year: 2025
      }
    });
    if (deletedBudgets.count > 0) {
      console.log(`Deleted ${deletedBudgets.count} budgets.`);
    }

    const deletedSalaries = await prisma.salary.deleteMany({
      where: {
        OR: [
          { period: "2025-12" },
          { period: "Diciembre - 2025" },
          { period: "Diciembre 2025" }
        ]
      }
    });
    if (deletedSalaries.count > 0) {
      console.log(`Deleted ${deletedSalaries.count} salaries.`);
    }

    const deletedDebts = await prisma.debt.deleteMany({
      where: {
        OR: [
          { billingPeriod: "2025-12" },
          { billingPeriod: "Diciembre - 2025" },
          { billingPeriod: "Diciembre 2025" }
        ]
      }
    });
    if (deletedDebts.count > 0) {
      console.log(`Deleted ${deletedDebts.count} debts.`);
    }

    console.log("Process complete.");
  } catch (error) {
    console.error("Error executing deletion:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
