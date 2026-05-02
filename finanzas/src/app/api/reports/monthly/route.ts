import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { generateMonthlyReport } from "@/services/reportsService";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const householdId = searchParams.get("householdId") || undefined;
  const billingPeriod = searchParams.get("billingPeriod") || undefined;
  
  const userId = (session.user as any).id;

  try {
    const report = await generateMonthlyReport({ 
        month, 
        year, 
        userId, 
        householdId,
        billingPeriod
    });
    return NextResponse.json(report);
  } catch (error) {
    console.error("Report GET error:", error);
    return NextResponse.json({ message: "Error generating report" }, { status: 500 });
  }
}
