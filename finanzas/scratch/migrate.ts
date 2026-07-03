import { prisma as prismaSource } from '../src/lib/prisma';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import fs from 'node:fs';
import path from 'node:path';

function createTargetClient(databaseUrl: string) {
  const dbUrl = new URL(databaseUrl);
  const host = dbUrl.hostname;
  const port = dbUrl.port ? Number(dbUrl.port) : 3306;
  const user = decodeURIComponent(dbUrl.username);
  const password = decodeURIComponent(dbUrl.password);
  const database = dbUrl.pathname.replace(/^\//, '');

  const sslcaQuery = dbUrl.searchParams.get('sslca');
  let sslOptions: any = undefined;

  if (sslcaQuery) {
    let caPath = sslcaQuery;
    if (fs.existsSync(caPath)) {
      sslOptions = {
        ca: fs.readFileSync(caPath, 'utf8'),
        rejectUnauthorized: true,
      };
    } else {
      const localCaPath = path.join(process.cwd(), 'ca.pem');
      if (fs.existsSync(localCaPath)) {
        sslOptions = {
          ca: fs.readFileSync(localCaPath, 'utf8'),
          rejectUnauthorized: true,
        };
      }
    }
  }

  const adapter = new PrismaMariaDb({
    host,
    port,
    user,
    password,
    database,
    ssl: sslOptions,
  });

  return new PrismaClient({ adapter });
}

async function runMigration() {
  const targetUrl = 'mysql://hedkzmww_admin:sgsGRrR$o2@server.001webhospedaje.com:3306/hedkzmww_finanzas';
  console.log("Connecting to target database...");
  const prismaTarget = createTargetClient(targetUrl);

  try {
    console.log("Starting Migration...");
    
    // Disable FK checks on target DB
    console.log("Temporarily disabling foreign key checks on target database...");
    await prismaTarget.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');

    // List of models to migrate
    // We clear target tables first
    const tables = [
      'AuditLog', 'AutoClassificationPattern', 'Debt', 'Salary', 'EmailAccount', 
      'TelegramUser', 'ExcelProfile', 'SavingsGoal', 'Budget', 'Transaction', 
      'Category', 'Account', 'Invitation', 'UserHousehold', 'Household', 'User'
    ];

    console.log("Clearing existing data in target database using DELETE FROM...");
    for (const table of tables) {
      await prismaTarget.$executeRawUnsafe(`DELETE FROM \`${table}\`;`);
    }

    // Define helper to migrate a single model
    const migrateModel = async (modelName: string, prismaModelSource: any, prismaModelTarget: any) => {
      console.log(`Migrating ${modelName}...`);
      const data = await prismaModelSource.findMany();
      console.log(`Found ${data.length} records in source for ${modelName}.`);
      if (data.length > 0) {
        // Insert in chunks/batches of 100 to prevent query size limit issues
        const chunkSize = 100;
        for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize);
          await prismaModelTarget.createMany({
            data: chunk,
          });
        }
        console.log(`Successfully migrated ${data.length} records for ${modelName}.`);
      }
    };

    // Migrate each table in dependency order (though FK checks are disabled, it's good practice)
    await migrateModel('User', prismaSource.user, prismaTarget.user);
    await migrateModel('Household', prismaSource.household, prismaTarget.household);
    await migrateModel('UserHousehold', prismaSource.userHousehold, prismaTarget.userHousehold);
    await migrateModel('Invitation', prismaSource.invitation, prismaTarget.invitation);
    await migrateModel('Account', prismaSource.account, prismaTarget.account);
    await migrateModel('Category', prismaSource.category, prismaTarget.category);
    await migrateModel('Transaction', prismaSource.transaction, prismaTarget.transaction);
    await migrateModel('Budget', prismaSource.budget, prismaTarget.budget);
    await migrateModel('SavingsGoal', prismaSource.savingsGoal, prismaTarget.savingsGoal);
    await migrateModel('ExcelProfile', prismaSource.excelProfile, prismaTarget.excelProfile);
    await migrateModel('TelegramUser', prismaSource.telegramUser, prismaTarget.telegramUser);
    await migrateModel('EmailAccount', prismaSource.emailAccount, prismaTarget.emailAccount);
    await migrateModel('Salary', prismaSource.salary, prismaTarget.salary);
    await migrateModel('Debt', prismaSource.debt, prismaTarget.debt);
    await migrateModel('AutoClassificationPattern', prismaSource.autoClassificationPattern, prismaTarget.autoClassificationPattern);
    await migrateModel('AuditLog', prismaSource.auditLog, prismaTarget.auditLog);

    console.log("\nRe-enabling foreign key checks on target database...");
    await prismaTarget.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');

    console.log("\n=========================================");
    console.log("MIGRATION COMPLETED SUCCESSFULLY!");
    console.log("=========================================");

    // Verify row count on target DB
    console.log("\nVerifying row counts on new target database:");
    const targetUsers = await prismaTarget.user.count();
    const targetTransactions = await prismaTarget.transaction.count();
    console.log(`- Users in Target: ${targetUsers}`);
    console.log(`- Transactions in Target: ${targetTransactions}`);

  } catch (error) {
    console.error("Migration failed with error:", error);
    try {
      console.log("Attempting to re-enable foreign key checks on target DB...");
      await prismaTarget.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
    } catch (e) {
      console.error("Failed to re-enable FK checks:", e);
    }
  } finally {
    await prismaSource.$disconnect();
    await prismaTarget.$disconnect();
  }
}

runMigration();
