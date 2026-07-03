import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import fs from 'node:fs';
import path from 'node:path';

function createPrismaClient(databaseUrl: string) {
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

async function runBenchmark() {
  const currentUrl = process.env.DATABASE_URL;
  const newUrl = 'mysql://hedkzmww_admin:sgsGRrR$o2@server.001webhospedaje.com:3306/hedkzmww_finanzas';

  if (!currentUrl) {
    console.error("DATABASE_URL env var is not set!");
    return;
  }

  console.log("Initializing database clients with PrismaMariaDb adapter...");
  
  const prismaCurrent = createPrismaClient(currentUrl);
  const prismaNew = createPrismaClient(newUrl);

  try {
    console.log("\n=========================================");
    console.log("DATABASE PERFORMANCE BENCHMARK");
    console.log("=========================================");

    // Warmup connections
    await prismaCurrent.$queryRaw`SELECT 1`;
    await prismaNew.$queryRaw`SELECT 1`;

    const runs = 5;

    // --- 1. Latency Test (SELECT 1) ---
    console.log("\n--- 1. Simple Network Latency (SELECT 1) ---");
    let currentLatencySum = 0;
    let newLatencySum = 0;

    for (let i = 0; i < runs; i++) {
      const startCurrent = performance.now();
      await prismaCurrent.$queryRaw`SELECT 1`;
      const currentLatency = performance.now() - startCurrent;
      currentLatencySum += currentLatency;

      const startNew = performance.now();
      await prismaNew.$queryRaw`SELECT 1`;
      const newLatency = performance.now() - startNew;
      newLatencySum += newLatency;

      console.log(`Run ${i + 1}: Current TiDB = ${currentLatency.toFixed(2)}ms | New Host = ${newLatency.toFixed(2)}ms`);
    }

    const currentLatAvg = currentLatencySum / runs;
    const newLatAvg = newLatencySum / runs;
    console.log(`Average Latency: TiDB = ${currentLatAvg.toFixed(2)}ms | New Host = ${newLatAvg.toFixed(2)}ms`);

    // --- 2. Write Latency Test (Insert and Delete Single Record) ---
    console.log("\n--- 2. Write and Delete Latency (Single Row CRUD) ---");
    // We create a dummy user
    const testEmailCurrent = `test_tidb_${Date.now()}@example.com`;
    const testEmailNew = `test_new_${Date.now()}@example.com`;

    // Time insert on Current
    const startInsertCurrent = performance.now();
    const userCurrent = await prismaCurrent.user.create({
      data: {
        email: testEmailCurrent,
        passwordHash: 'dummy_hash',
        name: 'Benchmark User'
      }
    });
    const insertCurrentTime = performance.now() - startInsertCurrent;

    // Time insert on New
    const startInsertNew = performance.now();
    const userNew = await prismaNew.user.create({
      data: {
        email: testEmailNew,
        passwordHash: 'dummy_hash',
        name: 'Benchmark User'
      }
    });
    const insertNewTime = performance.now() - startInsertNew;
    console.log(`Insert Single User: TiDB = ${insertCurrentTime.toFixed(2)}ms | New Host = ${insertNewTime.toFixed(2)}ms`);

    // Time delete on Current
    const startDeleteCurrent = performance.now();
    await prismaCurrent.user.delete({
      where: { id: userCurrent.id }
    });
    const deleteCurrentTime = performance.now() - startDeleteCurrent;

    // Time delete on New
    const startDeleteNew = performance.now();
    await prismaNew.user.delete({
      where: { id: userNew.id }
    });
    const deleteNewTime = performance.now() - startDeleteNew;
    console.log(`Delete Single User: TiDB = ${deleteCurrentTime.toFixed(2)}ms | New Host = ${deleteNewTime.toFixed(2)}ms`);


    // --- 3. Bulk Write Test (Multiple Inserts in Transactions) ---
    console.log("\n--- 3. Sequential Writes (10 records one by one) ---");
    const writeRuns = 10;
    
    // Seed parent household and user first (no timing for this setup)
    const setupUserCurrent = await prismaCurrent.user.create({ data: { email: `bulk_curr_${Date.now()}@ex.com`, passwordHash: 'hash' } });
    const setupHouseholdCurrent = await prismaCurrent.household.create({ data: { name: 'Bulk Test' } });
    const setupAccountCurrent = await prismaCurrent.account.create({ data: { name: 'Cash', userId: setupUserCurrent.id, householdId: setupHouseholdCurrent.id, balance: 0 } });

    const setupUserNew = await prismaNew.user.create({ data: { email: `bulk_new_${Date.now()}@ex.com`, passwordHash: 'hash' } });
    const setupHouseholdNew = await prismaNew.household.create({ data: { name: 'Bulk Test' } });
    const setupAccountNew = await prismaNew.account.create({ data: { name: 'Cash', userId: setupUserNew.id, householdId: setupHouseholdNew.id, balance: 0 } });

    // Time sequential writes on Current
    const startSeqCurrent = performance.now();
    for (let i = 0; i < writeRuns; i++) {
      await prismaCurrent.transaction.create({
        data: {
          amount: 10.5,
          currency: 'USD',
          date: new Date(),
          type: 'EXPENSE',
          accountId: setupAccountCurrent.id,
          userId: setupUserCurrent.id,
          userId_internal: setupUserCurrent.id,
          householdId: setupHouseholdCurrent.id,
          description: `Test transaction ${i}`
        }
      });
    }
    const seqCurrentTime = performance.now() - startSeqCurrent;

    // Time sequential writes on New
    const startSeqNew = performance.now();
    for (let i = 0; i < writeRuns; i++) {
      await prismaNew.transaction.create({
        data: {
          amount: 10.5,
          currency: 'USD',
          date: new Date(),
          type: 'EXPENSE',
          accountId: setupAccountNew.id,
          userId: setupUserNew.id,
          userId_internal: setupUserNew.id,
          householdId: setupHouseholdNew.id,
          description: `Test transaction ${i}`
        }
      });
    }
    const seqNewTime = performance.now() - startSeqNew;
    console.log(`10 Sequential Transaction Inserts: TiDB = ${seqCurrentTime.toFixed(2)}ms (${(seqCurrentTime/10).toFixed(2)}ms avg) | New Host = ${seqNewTime.toFixed(2)}ms (${(seqNewTime/10).toFixed(2)}ms avg)`);

    // --- 4. Read Query performance ---
    console.log("\n--- 4. Read Queries (Fetch transactions) ---");
    const startReadCurrent = performance.now();
    const txsCurrent = await prismaCurrent.transaction.findMany({
      where: { userId: setupUserCurrent.id }
    });
    const readCurrentTime = performance.now() - startReadCurrent;

    const startReadNew = performance.now();
    const txsNew = await prismaNew.transaction.findMany({
      where: { userId: setupUserNew.id }
    });
    const readNewTime = performance.now() - startReadNew;
    console.log(`Read transactions: TiDB = ${readCurrentTime.toFixed(2)}ms | New Host = ${readNewTime.toFixed(2)}ms`);


    // --- Cleanup ---
    console.log("\nCleaning up test data...");
    await prismaCurrent.transaction.deleteMany({ where: { userId: setupUserCurrent.id } });
    await prismaCurrent.account.delete({ where: { id: setupAccountCurrent.id } });
    await prismaCurrent.household.delete({ where: { id: setupHouseholdCurrent.id } });
    await prismaCurrent.user.delete({ where: { id: setupUserCurrent.id } });

    await prismaNew.transaction.deleteMany({ where: { userId: setupUserNew.id } });
    await prismaNew.account.delete({ where: { id: setupAccountNew.id } });
    await prismaNew.household.delete({ where: { id: setupHouseholdNew.id } });
    await prismaNew.user.delete({ where: { id: setupUserNew.id } });

    console.log("Cleanup complete!");

  } catch (error) {
    console.error("Benchmark failed with error:", error);
  } finally {
    await prismaCurrent.$disconnect();
    await prismaNew.$disconnect();
  }
}

runBenchmark();
