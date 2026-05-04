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

  // Get all transactions in that window with the same amount
  const candidates = await prisma.transaction.findMany({
    where: {
      accountId: data.accountId,
      amount: data.amount,
      date: {
        gte: startDate,
        lte: endDate
      }
    }
  });

  if (candidates.length === 0) return null;

  // Check if any candidate has the exact same description
  const cleanDesc = (data.description || '').toLowerCase().trim();
  const exactDescMatch = candidates.find(c => (c.description || '').toLowerCase().trim() === cleanDesc);

  if (exactDescMatch) {
    return { type: 'EXACT', transaction: exactDescMatch };
  }

  // If amount and date match, but description is different, it's a PROBABLE duplicate
  return { type: 'PROBABLE', transaction: candidates[0] };
}

export function generateRowHash(row: any) {
  return crypto.createHash('md5').update(JSON.stringify(row)).digest('hex');
}
