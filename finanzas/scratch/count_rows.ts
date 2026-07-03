import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    console.log("Counting rows in current TiDB Cloud database...");
    
    const users = await prisma.user.count();
    const households = await prisma.household.count();
    const userHouseholds = await prisma.userHousehold.count();
    const invitations = await prisma.invitation.count();
    const accounts = await prisma.account.count();
    const categories = await prisma.category.count();
    const transactions = await prisma.transaction.count();
    const budgets = await prisma.budget.count();
    const savingsGoals = await prisma.savingsGoal.count();
    const telegramUsers = await prisma.telegramUser.count();
    const emailAccounts = await prisma.emailAccount.count();
    const salaries = await prisma.salary.count();
    const debts = await prisma.debt.count();
    const autoClassificationPatterns = await prisma.autoClassificationPattern.count();
    const auditLogs = await prisma.auditLog.count();

    console.log("-----------------------------------------");
    console.log(`User: ${users}`);
    console.log(`Household: ${households}`);
    console.log(`UserHousehold: ${userHouseholds}`);
    console.log(`Invitation: ${invitations}`);
    console.log(`Account: ${accounts}`);
    console.log(`Category: ${categories}`);
    console.log(`Transaction: ${transactions}`);
    console.log(`Budget: ${budgets}`);
    console.log(`SavingsGoal: ${savingsGoals}`);
    console.log(`TelegramUser: ${telegramUsers}`);
    console.log(`EmailAccount: ${emailAccounts}`);
    console.log(`Salary: ${salaries}`);
    console.log(`Debt: ${debts}`);
    console.log(`AutoClassificationPattern: ${autoClassificationPatterns}`);
    console.log(`AuditLog: ${auditLogs}`);
    console.log("-----------------------------------------");
  } catch (error) {
    console.error("Error reading current database:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
