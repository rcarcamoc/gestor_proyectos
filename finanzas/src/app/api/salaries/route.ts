import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

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
  const period = searchParams.get("period"); // Optional, format YYYY-MM

  if (!householdId) {
    return NextResponse.json({ message: "householdId is required" }, { status: 400 });
  }

  const isMember = await checkHouseholdMembership(userId, householdId);
  if (!isMember) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const salaries = await prisma.salary.findMany({
      where: {
        householdId,
        ...(period ? { period } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        period: "desc",
      },
    });

    return NextResponse.json(salaries);
  } catch (error) {
    console.error("GET salaries error:", error);
    return NextResponse.json({ message: "Error fetching salaries" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const body = await req.json();
  const { id, householdId, period, amount, targetUserId, dummyUserName } = body;

  if (!householdId || !period || amount === undefined) {
    return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
  }

  const isMember = await checkHouseholdMembership(userId, householdId);
  if (!isMember) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    // If id is provided, we update it
    if (id) {
      const salary = await prisma.salary.update({
        where: { id },
        data: {
          amount: Number(amount),
          period,
          userId: targetUserId || null,
          dummyUserName: targetUserId ? null : dummyUserName,
        },
      });
      return NextResponse.json(salary);
    }

    // Otherwise, we check if there's already a salary for this user (or dummy) in this period
    // to perform an upsert (to match Android's guardarSueldo logic)
    const existing = await prisma.salary.findFirst({
      where: {
        householdId,
        period,
        ...(targetUserId ? { userId: targetUserId } : { dummyUserName }),
      },
    });

    if (existing) {
      const salary = await prisma.salary.update({
        where: { id: existing.id },
        data: {
          amount: Number(amount),
        },
      });
      return NextResponse.json(salary);
    }

    const salary = await prisma.salary.create({
      data: {
        householdId,
        period,
        amount: Number(amount),
        userId: targetUserId || null,
        dummyUserName: targetUserId ? null : dummyUserName,
      },
    });

    return NextResponse.json(salary);
  } catch (error) {
    console.error("POST salaries error:", error);
    return NextResponse.json({ message: "Error saving salary" }, { status: 500 });
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
    const salary = await prisma.salary.findUnique({
      where: { id },
    });

    if (!salary) {
      return NextResponse.json({ message: "Salary not found" }, { status: 404 });
    }

    const isMember = await checkHouseholdMembership(userId, salary.householdId);
    if (!isMember) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await prisma.salary.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Salary deleted successfully" });
  } catch (error) {
    console.error("DELETE salary error:", error);
    return NextResponse.json({ message: "Error deleting salary" }, { status: 500 });
  }
}
