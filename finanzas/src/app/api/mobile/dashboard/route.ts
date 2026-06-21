import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateBasicAuth } from "@/lib/basicAuth";
import { TransactionType } from "@prisma/client";

export async function GET(req: Request) {
  const user = await authenticateBasicAuth(req);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const householdId = searchParams.get("householdId");
  const period = searchParams.get("period"); // Expected format: YYYY-MM
  
  if (!householdId) {
    return NextResponse.json({ message: "householdId is required" }, { status: 400 });
  }
  if (!period) {
    return NextResponse.json({ message: "period is required" }, { status: 400 });
  }

  try {
    // 1. Verify membership
    const membership = await prisma.userHousehold.findFirst({
      where: { userId: user.id, householdId },
    });
    if (!membership) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // 2. Fetch all transactions for the period (to compute totals in MySQL)
    // We group by type to get totalIncome and totalExpense
    const totals = await prisma.transaction.groupBy({
      by: ["type"],
      where: {
        householdId,
        billingPeriod: period,
        deletedAt: null,
        ignored: false,
      },
      _sum: {
        amount: true,
      },
    });

    let totalIncome = 0;
    let totalExpense = 0;
    totals.forEach((t) => {
      const amt = Number(t._sum.amount || 0);
      if (t.type === TransactionType.INCOME) totalIncome = amt;
      if (t.type === TransactionType.EXPENSE) totalExpense = amt;
    });

    // 3. Category distribution (Expenses only)
    const categoryTotals = await prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        householdId,
        billingPeriod: period,
        type: TransactionType.EXPENSE,
        deletedAt: null,
        ignored: false,
      },
      _sum: {
        amount: true,
      },
    });

    // Fetch details of those categories
    const categoriesDetails = await prisma.category.findMany({
      where: {
        id: { in: categoryTotals.map((ct) => ct.categoryId).filter(Boolean) as string[] },
      },
    });

    const categorySummary = categoryTotals.map((ct) => {
      const cat = categoriesDetails.find((c) => c.id === ct.categoryId);
      return {
        categoryId: ct.categoryId || "unassigned",
        name: cat?.name || "Sin Categoría",
        color: cat?.color || "#9E9E9E",
        icon: cat?.icon || "",
        amount: Number(ct._sum.amount || 0),
      };
    });

    // 4. Budgets and breaches
    const [yearStr, monthStr] = period.split("-");
    const month = parseInt(monthStr);
    const year = parseInt(yearStr);

    const budgets = await prisma.budget.findMany({
      where: {
        householdId,
        month,
        year,
      },
      include: {
        category: true,
      },
    });

    // For each budget, calculate current expense in that category
    const budgetSummary = await Promise.all(
      budgets.map(async (b) => {
        const sumResult = await prisma.transaction.aggregate({
          where: {
            householdId,
            billingPeriod: period,
            categoryId: b.categoryId,
            type: TransactionType.EXPENSE,
            deletedAt: null,
            ignored: false,
          },
          _sum: {
            amount: true,
          },
        });
        return {
          categoryName: b.category.name,
          limit: Number(b.limit),
          amount: Number(sumResult._sum.amount || 0),
        };
      })
    );

    // 5. Monthly Trend (last 6 periods ending at target period)
    const trends: { period: string; income: number; expense: number }[] = [];
    const dateObj = new Date(year, month - 1, 1);
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(dateObj.getFullYear(), dateObj.getMonth() - i, 1);
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const y = d.getFullYear();
      const p = `${y}-${m}`;

      const tTotals = await prisma.transaction.groupBy({
        by: ["type"],
        where: {
          householdId,
          billingPeriod: p,
          deletedAt: null,
          ignored: false,
        },
        _sum: {
          amount: true,
        },
      });

      let inc = 0;
      let exp = 0;
      tTotals.forEach((t) => {
        const amt = Number(t._sum.amount || 0);
        if (t.type === TransactionType.INCOME) inc = amt;
        if (t.type === TransactionType.EXPENSE) exp = amt;
      });

      trends.push({ period: p, income: inc, expense: exp });
    }

    return NextResponse.json({
      period,
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      categories: categorySummary,
      budgets: budgetSummary,
      trends,
    });
  } catch (error) {
    console.error("Dashboard mobile API error:", error);
    return NextResponse.json({ message: "Failed to generate dashboard statistics" }, { status: 500 });
  }
}
