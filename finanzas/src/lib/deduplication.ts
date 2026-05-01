import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function findDuplicate(data: {
  amount: number;
  date: Date;
  description?: string;
  externalId?: string;
  accountId: string;
}) {
  // 1. Exact match by external ID (Message-ID or row hash)
  if (data.externalId) {
    const exact = await prisma.transaction.findFirst({
      where: { externalId: data.externalId, accountId: data.accountId }
    });
    if (exact) return { type: 'EXACT', transaction: exact };
  }

  // 2. Probable match: same amount, account, and date (+/- 1 day)
  const startDate = new Date(data.date);
  startDate.setDate(startDate.getDate() - 1);
  const endDate = new Date(data.date);
  endDate.setDate(endDate.getDate() + 1);

  const probable = await prisma.transaction.findFirst({
    where: {
      accountId: data.accountId,
      amount: data.amount,
      date: {
        gte: startDate,
        lte: endDate
      }
    }
  });

  if (probable) return { type: 'PROBABLE', transaction: probable };

  return null;
}

export function generateRowHash(row: any) {
  return crypto.createHash('md5').update(JSON.stringify(row)).digest('hex');
}
