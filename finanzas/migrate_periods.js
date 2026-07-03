const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
      if (match) {
        dbUrl = match[1];
      }
    }
  } catch (e) {}
}

let prisma;
if (dbUrl) {
  const parsedUrl = new URL(dbUrl);
  const host = parsedUrl.hostname;
  const port = parsedUrl.port ? Number(parsedUrl.port) : 3306;
  const user = decodeURIComponent(parsedUrl.username);
  const password = decodeURIComponent(parsedUrl.password);
  const database = parsedUrl.pathname.replace(/^\//, '');

  const sslcaQuery = parsedUrl.searchParams.get('sslca');
  let sslOptions = undefined;

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

  prisma = new PrismaClient({ adapter });
} else {
  prisma = new PrismaClient();
}

const months = {
  "Enero": "01", "Febrero": "02", "Marzo": "03", "Abril": "04", "Mayo": "05", "Junio": "06",
  "Julio": "07", "Agosto": "08", "Septiembre": "09", "Octubre": "10", "Noviembre": "11", "Diciembre": "12"
};

async function migrate() {
  console.log("Starting billing period migration...");

  // 1. Migrate Transactions
  const txs = await prisma.transaction.findMany({
    where: { billingPeriod: { contains: ' - ' } }
  });
  console.log(`Found ${txs.length} transactions to migrate`);
  for (const tx of txs) {
    const [monthName, year] = tx.billingPeriod.split(' - ');
    const m = months[monthName.trim()];
    if (m && year) {
      const newPeriod = `${year.trim()}-${m}`;
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { billingPeriod: newPeriod }
      });
    }
  }

  // 2. Migrate Debts
  if (prisma.debt) {
    const debts = await prisma.debt.findMany({
      where: { billingPeriod: { contains: ' - ' } }
    });
    console.log(`Found ${debts.length} debts to migrate`);
    for (const debt of debts) {
      const [monthName, year] = debt.billingPeriod.split(' - ');
      const m = months[monthName.trim()];
      if (m && year) {
        const newPeriod = `${year.trim()}-${m}`;
        await prisma.debt.update({
          where: { id: debt.id },
          data: { billingPeriod: newPeriod }
        });
      }
    }
  } else {
    console.log("Debt model not found in Prisma client, skipping debt migration.");
  }

  console.log("Migration completed successfully!");
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
