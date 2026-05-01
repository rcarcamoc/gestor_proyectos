export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { householdId, email } = await req.json();

    if (!householdId || !email) {
      return NextResponse.json({ message: "Household ID and email are required" }, { status: 400 });
    }

    const userId = (session.user as any).id;

    // Check if user is admin of the household
    const userHousehold = await prisma.userHousehold.findFirst({
      where: {
        householdId,
        userId,
        role: "ADMIN",
      },
    });

    if (!userHousehold) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const code = nanoid(8).toUpperCase();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await prisma.invitation.create({
      data: {
        householdId,
        email,
        code,
        expiresAt,
      },
    });

    // In a real app, send email here
    console.log(`Invitation created for ${email} with code ${code}`);

    return NextResponse.json({ message: "Invitation sent", code }, { status: 201 });
  } catch (error) {
    console.error("Invite error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
