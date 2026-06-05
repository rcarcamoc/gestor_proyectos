import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { DebtStatus } from "@prisma/client";

// Helper to check if user belongs to the household
async function checkHouseholdMembership(userId: string, householdId: string) {
  const membership = await prisma.userHousehold.findFirst({
    where: { userId, householdId },
  });
  return !!membership;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const { searchParams } = new URL(req.url);
  const householdId = searchParams.get("householdId");
  const status = searchParams.get("status") as DebtStatus | null;
  const billingPeriod = searchParams.get("billingPeriod"); // e.g., "YYYY-MM"

  if (!householdId) {
    return NextResponse.json({ message: "householdId is required" }, { status: 400 });
  }

  const isMember = await checkHouseholdMembership(userId, householdId);
  if (!isMember) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const debts = await prisma.debt.findMany({
      where: {
        householdId,
        ...(status ? { status } : {}),
        ...(billingPeriod ? { billingPeriod } : {}),
      },
      include: {
        debtor: {
          select: { id: true, name: true, email: true },
        },
        creditor: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(debts);
  } catch (error) {
    console.error("GET debts error:", error);
    return NextResponse.json({ message: "Error fetching debts" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const body = await req.json();
  const {
    id,
    householdId,
    debtorId,
    debtorName,
    creditorId,
    creditorName,
    amount,
    reason,
    status = "PENDIENTE",
    billingPeriod,
    dueDate,
    notes,
  } = body;

  if (!householdId || !debtorName || !creditorName || amount === undefined || !reason) {
    return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
  }

  const isMember = await checkHouseholdMembership(userId, householdId);
  if (!isMember) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const data = {
      householdId,
      debtorId: debtorId || null,
      debtorName,
      creditorId: creditorId || null,
      creditorName,
      amount: Number(amount),
      reason,
      status: status as DebtStatus,
      billingPeriod: billingPeriod || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes || null,
    };

    if (id) {
      const debt = await prisma.debt.update({
        where: { id },
        data,
      });
      return NextResponse.json(debt);
    }

    const debt = await prisma.debt.create({
      data,
    });

    return NextResponse.json(debt);
  } catch (error) {
    console.error("POST debt error:", error);
    return NextResponse.json({ message: "Error saving debt" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ message: "id is required" }, { status: 400 });
  }

  try {
    const debt = await prisma.debt.findUnique({
      where: { id },
    });

    if (!debt) {
      return NextResponse.json({ message: "Debt not found" }, { status: 404 });
    }

    const isMember = await checkHouseholdMembership(userId, debt.householdId);
    if (!isMember) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await prisma.debt.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Debt deleted successfully" });
  } catch (error) {
    console.error("DELETE debt error:", error);
    return NextResponse.json({ message: "Error deleting debt" }, { status: 500 });
  }
}
