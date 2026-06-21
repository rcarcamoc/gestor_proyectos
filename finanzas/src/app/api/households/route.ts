export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { NextResponse } from "next/server";
import { authenticateBasicAuth } from "@/lib/basicAuth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const basicUser = !session?.user ? await authenticateBasicAuth(req) : null;
  const userId = session?.user ? (session.user as any).id : basicUser?.id;
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { name } = await req.json();

    if (!name) {
      return NextResponse.json({ message: "Name is required" }, { status: 400 });
    }

    const household = await prisma.household.create({
      data: {
        name,
        users: {
          create: {
            userId: userId,
            role: "ADMIN",
          },
        },
      },
    });

    return NextResponse.json(household, { status: 201 });
  } catch (error) {
    console.error("Create household error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const basicUser = !session?.user ? await authenticateBasicAuth(req) : null;
  const userId = session?.user ? (session.user as any).id : basicUser?.id;
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const households = await prisma.household.findMany({
      where: {
        users: {
          some: {
            userId: userId,
          },
        },
      },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        invitations: {
          where: {
            status: 'PENDING',
            expiresAt: { gte: new Date() }
          }
        }
      },
    });

    return NextResponse.json(households);
  } catch (error) {
    console.error("Get households error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
