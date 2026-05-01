export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { code } = await req.json();

    if (!code) {
      return NextResponse.json({ message: "Code is required" }, { status: 400 });
    }

    const invitation = await prisma.invitation.findUnique({
      where: { code },
      include: { household: true },
    });

    if (!invitation) {
      return NextResponse.json({ message: "Invalid code" }, { status: 404 });
    }

    if (invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
      return NextResponse.json({ message: "Invitation expired or already used" }, { status: 400 });
    }

    const userId = (session.user as any).id;

    // Check if already in household
    const existingMember = await prisma.userHousehold.findUnique({
      where: {
        userId_householdId: {
          userId,
          householdId: invitation.householdId,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json({ message: "Already a member of this household" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.userHousehold.create({
        data: {
          userId,
          householdId: invitation.householdId,
          role: "MEMBER",
        },
      }),
      prisma.invitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          usedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({ message: "Joined household successfully", household: invitation.household });
  } catch (error) {
    console.error("Join household error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
