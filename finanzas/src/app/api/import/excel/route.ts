export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { NextResponse } from "next/server";
import { findDuplicate, generateRowHash } from "@/lib/deduplication";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { rows, mapping, accountId, householdId } = await req.json();
    const userId = (session.user as any).id;

    const results = {
      imported: 0,
      skipped: 0,
      flagged: 0,
    };

    for (const row of rows) {
      const amount = parseFloat(row[mapping.amount]);
      const date = new Date(row[mapping.date]);
      const description = row[mapping.description] || "";
      const externalId = generateRowHash(row);

      const duplicate = await findDuplicate({
        amount,
        date,
        description,
        externalId,
        accountId
      });

      if (duplicate?.type === 'EXACT') {
        results.skipped++;
        continue;
      }

      await prisma.transaction.create({
        data: {
          amount,
          currency: 'CLP', // Should be dynamic
          date,
          type: amount >= 0 ? 'INCOME' : 'EXPENSE',
          description,
          accountId,
          categoryId: mapping.categoryId || null,
          householdId,
          userId: userId,
          userId_internal: userId,
          externalId,
          status: duplicate?.type === 'PROBABLE' ? 'PENDING_REVIEW' : 'CONFIRMED'
        }
      });

      if (duplicate?.type === 'PROBABLE') results.flagged++;
      else results.imported++;

      // Update account balance
      await prisma.account.update({
        where: { id: accountId },
        data: { balance: { increment: amount } }
      });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Import failed" }, { status: 500 });
  }
}
