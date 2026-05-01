export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { name, type, currency, householdId } = await req.json();
    const userId = (session.user as any).id;

    const account = await prisma.account.create({
      data: {
        name,
        type,
        currency,
        userId: householdId ? null : userId,
        householdId: householdId || null,
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Error creating account" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const householdId = searchParams.get('householdId');
  const userId = (session.user as any).id;

  try {
    const accounts = await prisma.account.findMany({
      where: householdId
        ? { householdId }
        : { userId, householdId: null },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(accounts);
  } catch (error) {
    return NextResponse.json({ message: "Error fetching accounts" }, { status: 500 });
  }
}
