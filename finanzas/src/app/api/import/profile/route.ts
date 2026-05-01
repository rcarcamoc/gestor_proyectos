import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;

  try {
    const profiles = await prisma.excelProfile.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });
    return NextResponse.json(profiles);
  } catch (error) {
    return NextResponse.json({ message: "Error fetching profiles" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;

  try {
    const { name, mapping } = await req.json();
    
    const profile = await prisma.excelProfile.create({
      data: {
        name,
        userId,
        mapping
      }
    });

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Error saving profile" }, { status: 500 });
  }
}
