import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { getBudgets, upsertBudget } from "@/services/budgetService";
import { authenticateBasicAuth } from "@/lib/basicAuth";

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

  try {
    const budget = await upsertBudget({
      ...data,
      userId: data.householdId ? undefined : userId,
      limit: parseFloat(data.limit)
    });
    return NextResponse.json(budget);
  } catch (error) {
    console.error("Budget POST error:", error);
    return NextResponse.json({ message: "Error saving budget" }, { status: 500 });
  }
}
