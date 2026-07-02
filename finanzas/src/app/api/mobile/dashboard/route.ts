import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateBasicAuth } from "@/lib/basicAuth";
import { TransactionType } from "@/generated/client";

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

    const [yearStr, monthStr] = period.split("-");
    const month = parseInt(monthStr);
    const year = parseInt(yearStr);

    // Get last 6 period strings
    const periods: string[] = [];
    const dateObj = new Date(year, month - 1, 1);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(dateObj.getFullYear(), dateObj.getMonth() - i, 1);
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const y = d.getFullYear();
      periods.push(`${y}-${m}`);
    }

    // 2. Parallel fetch
    const [categoryTotals, budgets, trendsData, categoriesDetails] = await Promise.all([
      // A. Category totals for current period
      prisma.transaction.groupBy({
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
      }),
      // B. Budgets for current month/year
      prisma.budget.findMany({
        where: {
          householdId,
          month,
          year,
        },
        include: {
          category: true,
        },
      }),
      // C. Last 6 months trends (including current period)
      prisma.transaction.groupBy({
        by: ["billingPeriod", "type"],
        where: {
          householdId,
          billingPeriod: { in: periods },
          deletedAt: null,
          ignored: false,
        },
        _sum: {
          amount: true,
        },
      }),
      // D. Categories lookup
      prisma.category.findMany({
        where: {
          OR: [
            { householdId },
            { isDefault: true },
          ],
        },
      }),
    ]);

    // 3. Process totals for current period (from trendsData to save query)
    let totalIncome = 0;
    let totalExpense = 0;
    trendsData.forEach((t) => {
      if (t.billingPeriod === period) {
        const amt = Number(t._sum.amount || 0);
        if (t.type === TransactionType.INCOME) totalIncome = amt;
        if (t.type === TransactionType.EXPENSE) totalExpense = amt;
      }
    });

    // 4. Category distribution
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

    // 5. Budgets summary (0 extra queries - look up in categoryTotals)
    const budgetSummary = budgets.map((b) => {
      const spent = categoryTotals.find((ct) => ct.categoryId === b.categoryId);
      return {
        categoryName: b.category.name,
        limit: Number(b.limit),
        amount: spent ? Number(spent._sum.amount || 0) : 0,
      };
    });

    // 6. Format Trends (fill missing periods with 0)
    const trends = periods.map((p) => {
      let inc = 0;
      let exp = 0;
      trendsData.forEach((t) => {
        if (t.billingPeriod === p) {
          const amt = Number(t._sum.amount || 0);
          if (t.type === TransactionType.INCOME) inc = amt;
          if (t.type === TransactionType.EXPENSE) exp = amt;
        }
      });
      return { period: p, income: inc, expense: exp };
    });

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
