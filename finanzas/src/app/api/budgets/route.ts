import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { getBudgets, upsertBudget } from "@/services/budgetService";
import { authenticateBasicAuth } from "@/lib/basicAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const basicUser = !session?.user ? await authenticateBasicAuth(req) : null;
  const userId = session?.user ? (session.user as any).id : basicUser?.id;
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const householdId = searchParams.get("householdId") || undefined;

  try {
    const budgets = await getBudgets({ 
        month, 
        year, 
        userId: householdId ? undefined : userId, 
        householdId 
    });
    return NextResponse.json(budgets);
  } catch (error) {
    return NextResponse.json({ message: "Error fetching budgets" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const basicUser = !session?.user ? await authenticateBasicAuth(req) : null;
  const userId = session?.user ? (session.user as any).id : basicUser?.id;
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const data = await req.json();
  const { action, month, year, householdId } = data;

  if (action === "inherit") {
    if (!month || !year) {
      return NextResponse.json({ message: "month and year are required" }, { status: 400 });
    }
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    try {
      const prevBudgets = await getBudgets({
        month: prevMonth,
        year: prevYear,
        userId: householdId ? undefined : userId,
        householdId: householdId || undefined
      });

      if (prevBudgets.length === 0) {
        return NextResponse.json({ message: "No previous budgets found to inherit", count: 0 });
      }

      const inherited = [];
      for (const pb of prevBudgets) {
        const budget = await upsertBudget({
          limit: Number(pb.limit),
          month,
          year,
          categoryId: pb.categoryId,
          userId: householdId ? undefined : userId,
          householdId: householdId || undefined
        });
        inherited.push(budget);
      }

      return NextResponse.json({ message: "Budgets inherited successfully", count: inherited.length });
    } catch (err) {
      console.error("Budget inheritance error:", err);
      return NextResponse.json({ message: "Error inheriting budgets" }, { status: 500 });
    }
  }

  try {
    let categoryId = data.categoryId;
    if (!categoryId && data.categoryName) {
      const trimmedName = data.categoryName.trim();
      const match = await prisma.category.findFirst({
        where: {
          name: trimmedName,
          OR: [
            { householdId: data.householdId || null },
            { isDefault: true }
          ]
        }
      });
      if (match) {
        categoryId = match.id;
      } else {
        const newCat = await prisma.category.create({
          data: {
            name: trimmedName,
            householdId: data.householdId || null,
            isDefault: false
          }
        });
        categoryId = newCat.id;
      }
    }

    if (!categoryId) {
      return NextResponse.json({ message: "categoryId or categoryName is required" }, { status: 400 });
    }

    const budget = await upsertBudget({
      ...data,
      categoryId,
      userId: data.householdId ? undefined : userId,
      limit: parseFloat(data.limit)
    });

    const responsePayload = {
      categoryName: (budget as any).category.name,
      amount: Number(budget.limit),
      period: `${budget.year}-${String(budget.month).padStart(2, "0")}`,
      updatedAt: budget.updatedAt.getTime(),
      scope: budget.userId ? "PERSONAL" : "HOUSEHOLD"
    };

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("Budget POST error:", error);
    return NextResponse.json({ message: "Error saving budget" }, { status: 500 });
  }
}
