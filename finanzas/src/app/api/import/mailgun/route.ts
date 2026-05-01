import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { extractTransactionFromEmail } from "@/lib/ai/groq";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const formData = await req.formData();
  const timestamp = formData.get('timestamp') as string;
  const token = formData.get('token') as string;
  const signature = formData.get('signature') as string;

  const signingKey = process.env.MAILGUN_SIGNING_KEY || "";
  if (!signingKey) {
    console.error("MAILGUN_SIGNING_KEY is not set");
    return NextResponse.json({ message: "Server configuration error" }, { status: 500 });
  }

  const value = timestamp + token;
  const hash = crypto.createHmac('sha256', signingKey).update(value).digest('hex');

  if (hash !== signature) {
    return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
  }

  try {
    const sender = formData.get('sender') as string;
    const body = formData.get('body-plain') as string;
    const messageId = formData.get('Message-Id') as string;

    const user = await prisma.user.findUnique({
      where: { email: sender }
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" });
    }

    const categories = await prisma.category.findMany({
      where: { OR: [{ isDefault: true }, { userId: user.id }] }
    });

    const extracted = await extractTransactionFromEmail(body, categories.map(c => c.name));

    if (extracted && extracted.confidence > 0.6) {
      const category = categories.find(c => c.name === extracted.category);
      const account = await prisma.account.findFirst({
        where: { userId: user.id }
      });

      if (account) {
        await prisma.transaction.create({
          data: {
            amount: Math.abs(extracted.amount),
            currency: extracted.currency || 'CLP',
            date: new Date(extracted.date || new Date()),
            type: extracted.amount >= 0 ? 'INCOME' : 'EXPENSE',
            description: extracted.description,
            accountId: account.id,
            categoryId: category?.id,
            userId: user.id,
            userId_internal: user.id,
            externalId: messageId,
            source: 'EMAIL',
            status: 'CONFIRMED'
          }
        });

        await prisma.account.update({
          where: { id: account.id },
          data: { balance: { increment: extracted.amount } }
        });
      }
    }

    return NextResponse.json({ message: "Email processed" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Error processing email" }, { status: 500 });
  }
}
