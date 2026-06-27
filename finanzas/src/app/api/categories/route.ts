export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { NextResponse } from "next/server";
import { authenticateBasicAuth } from "@/lib/basicAuth";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const basicUser = !session?.user ? await authenticateBasicAuth(req) : null;
  const userId = session?.user ? (session.user as any).id : basicUser?.id;
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
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

    const categories = sorted.map(({ _count, ...cat }) => ({
      ...cat,
      createdAt: cat.createdAt.getTime(),
      updatedAt: cat.updatedAt.getTime()
    }));
    return NextResponse.json(categories);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Error fetching categories" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const basicUser = !session?.user ? await authenticateBasicAuth(req) : null;
  const userId = session?.user ? (session.user as any).id : basicUser?.id;
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { name, color, householdId } = await req.json();
    const trimmedName = name.trim();

    // Check if category already exists (case-insensitive)
    const existing = await prisma.category.findFirst({
      where: {
        name: {
          equals: trimmedName,
          mode: "insensitive"
        },
        OR: [
          { userId },
          { householdId: householdId || null },
          { isDefault: true }
        ]
      }
    });

    if (existing) {
      return NextResponse.json({
        ...existing,
        createdAt: existing.createdAt.getTime(),
        updatedAt: existing.updatedAt.getTime()
      });
    }

    const category = await prisma.category.create({
      data: {
        name: trimmedName,
        color,
        userId,
        householdId: householdId || null,
        isDefault: false
      }
    });

    const mappedCategory = {
      ...category,
      createdAt: category.createdAt.getTime(),
      updatedAt: category.updatedAt.getTime()
    };

    return NextResponse.json(mappedCategory);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Error creating category" }, { status: 500 });
  }
}
