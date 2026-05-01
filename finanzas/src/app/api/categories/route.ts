export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const householdId = searchParams.get('householdId');
  const userId = (session.user as any).id;

  try {
    const categories = await prisma.category.findMany({
      where: {
        OR: [
          { isDefault: true },
          { userId },
          { householdId: householdId || undefined }
        ]
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(categories);
  } catch (error) {
    return NextResponse.json({ message: "Error fetching categories" }, { status: 500 });
  }
}
