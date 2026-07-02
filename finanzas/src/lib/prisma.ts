import { PrismaClient } from '@/generated/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import fs from 'node:fs';
import path from 'node:path';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaClient: PrismaClient;

if (globalForPrisma.prisma) {
  prismaClient = globalForPrisma.prisma;
} else {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set in environment variables');
  }

  // Parse DATABASE_URL
  const dbUrl = new URL(databaseUrl);
  const host = dbUrl.hostname;
  const port = dbUrl.port ? Number(dbUrl.port) : 3306;
  const user = decodeURIComponent(dbUrl.username);
  const password = decodeURIComponent(dbUrl.password);
  const database = dbUrl.pathname.replace(/^\//, '');

  // Extract SSL CA certificate path if present in query params or default it
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
      // Try local path in project root or current working dir
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

  prismaClient = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prismaClient;
  }
}

export const prisma = prismaClient;
