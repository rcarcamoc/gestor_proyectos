import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

// Helper to convert "YYYY-MM" to "Month - YYYY" (e.g. "2026-06" to "Junio - 2026")
function formatBillingPeriodForTx(period: string): string {
  const parts = period.split("-");
  if (parts.length !== 2) return period;
  const year = parts[0];
  const monthIdx = parseInt(parts[1]) - 1;
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  if (monthIdx < 0 || monthIdx > 11) return period;
  return `${monthNames[monthIdx]} - ${year}`;
}

// Helper to check if user belongs to the household
async function checkHouseholdMembership(userId: string, householdId: string) {
  const membership = await prisma.userHousehold.findFirst({
    where: { userId, householdId },
  });
  return !!membership;
}

// Helper to sync associated INCOME transaction to the ledger
async function syncSalaryTransaction(
  householdId: string,
  userId: string, // active user ID (responsible for the API call)
  period: string, // format YYYY-MM
  amount: number,
  targetUserId: string | null,
  dummyUserName: string | null
) {
  // 1. Get or create category named "Salario" or "Sueldo"
  let categorySalario = await prisma.category.findFirst({
    where: {
      householdId,
      name: { in: ["Salario", "Sueldo", "salario", "sueldo"] }
    }
  });

  if (!categorySalario) {
    categorySalario = await prisma.category.findFirst({
      where: {
        isDefault: true,
        name: { in: ["Salario", "Sueldo", "salario", "sueldo"] }
      }
    });
  }

  if (!categorySalario) {
    categorySalario = await prisma.category.create({
      data: {
        name: "Salario",
        isDefault: false,
        householdId,
        color: "#4CAF50"
      }
    });
  }

  // 2. Get or create a default account for the household
  let defaultAccount = await prisma.account.findFirst({
    where: { householdId, isArchived: false }
  });
  if (!defaultAccount) {
    defaultAccount = await prisma.account.create({
      data: {
        name: "Cuenta Principal",
        type: "CHECKING",
        balance: 0,
        currency: "CLP",
        householdId
      }
    });
  }

  // 3. Determine name for externalId
  let name = dummyUserName || "";
  if (!name && targetUserId) {
    const u = await prisma.user.findUnique({ where: { id: targetUserId } });
    name = u?.name || u?.email || "Integrante";
  }
  if (!name) name = "Integrante";

  const externalId = `sueldo_${name}_${period}`;

  // 4. Upsert transaction
  const existingTx = await prisma.transaction.findFirst({
    where: { externalId, householdId }
  });

  const billingPeriod = formatBillingPeriodForTx(period);

  const txData = {
    amount: amount,
    currency: "CLP",
    date: new Date(),
    type: "INCOME" as const,
    description: `Sueldo de ${name}`,
    source: "MANUAL" as const,
    status: "CONFIRMED" as const,
    accountId: defaultAccount.id,
    categoryId: categorySalario.id,
    userId: targetUserId || userId, // if targetUserId is null, use active user's ID as owner
    userId_internal: userId,
    householdId,
    externalId,
    billingPeriod,
    updatedAt: new Date()
  };

  if (existingTx) {
    await prisma.transaction.update({
      where: { id: existingTx.id },
      data: {
        amount: txData.amount,
        description: txData.description,
        userId: txData.userId,
        userId_internal: txData.userId_internal,
        updatedAt: new Date()
      }
    });
  } else {
    await prisma.transaction.create({
      data: {
        ...txData,
        createdAt: new Date()
      }
    });
  }
}

// Helper to delete associated transaction
async function deleteSalaryTransaction(
  householdId: string,
  period: string,
  targetUserId: string | null,
  dummyUserName: string | null
) {
  let name = dummyUserName || "";
  if (!name && targetUserId) {
    const u = await prisma.user.findUnique({ where: { id: targetUserId } });
    name = u?.name || u?.email || "Integrante";
  }
  if (!name) name = "Integrante";

  const externalId = `sueldo_${name}_${period}`;

  await prisma.transaction.deleteMany({
    where: { externalId, householdId }
  });
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
    let salary;

    // If id is provided, we update it
    if (id) {
      salary = await prisma.salary.update({
        where: { id },
        data: {
          amount: Number(amount),
          period,
          userId: targetUserId || null,
          dummyUserName: targetUserId ? null : dummyUserName,
        },
      });
    } else {
      // Otherwise, perform upsert (to match Android's guardarSueldo logic)
      const existing = await prisma.salary.findFirst({
        where: {
          householdId,
          period,
          ...(targetUserId ? { userId: targetUserId } : { dummyUserName }),
        },
      });

      if (existing) {
        salary = await prisma.salary.update({
          where: { id: existing.id },
          data: {
            amount: Number(amount),
          },
        });
      } else {
        salary = await prisma.salary.create({
          data: {
            householdId,
            period,
            amount: Number(amount),
            userId: targetUserId || null,
            dummyUserName: targetUserId ? null : dummyUserName,
          },
        });
      }
    }

    // Automatically sync associated INCOME transaction to the ledger
    await syncSalaryTransaction(
      householdId,
      userId,
      salary.period,
      Number(salary.amount),
      salary.userId,
      salary.dummyUserName
    );

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

    // Automatically delete associated transaction
    await deleteSalaryTransaction(
      salary.householdId,
      salary.period,
      salary.userId,
      salary.dummyUserName
    );

    await prisma.salary.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Salary deleted successfully" });
  } catch (error) {
    console.error("DELETE salary error:", error);
    return NextResponse.json({ message: "Error deleting salary" }, { status: 500 });
  }
}
