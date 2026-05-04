export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const userId = (session.user as any).id;
    const { searchParams } = new URL(req.url);
    const householdId = searchParams.get('householdId');

    const categoriesWithCount = await prisma.category.findMany({
      where: {
        OR: [
          { isDefault: true },
          { userId },
          { householdId: householdId || undefined }
        ]
      },
      include: {
        _count: {
          select: { transactions: true }
        }
      }
    });

    // Sort by usage count descending, then alphabetically for ties
    const sorted = categoriesWithCount.sort((a, b) => {
      const diff = (b._count?.transactions ?? 0) - (a._count?.transactions ?? 0);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });

    const categories = sorted.map(({ _count, ...cat }) => cat);
    return NextResponse.json(categories);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Error fetching categories" }, { status: 500 });
  }

}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { name, color, householdId } = await req.json();
    const userId = (session.user as any).id;

    const category = await prisma.category.create({
      data: {
        name,
        color,
        userId,
        householdId: householdId || null,
        isDefault: false
      }
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Error creating category" }, { status: 500 });
  }
}
