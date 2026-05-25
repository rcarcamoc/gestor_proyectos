export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;

  try {
    const config = await prisma.emailAccount.findFirst({
      where: { userId },
      select: {
        id: true,
        email: true,
        host: true,
        port: true,
        secure: true,
        protocol: true,
        accountId: true,
        isActive: true,
        lastSync: true
        // Exclude password for security in normal GET calls
      }
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error fetching email configuration:", error);
    return NextResponse.json({ message: "Error fetching configuration" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { email, password, host, port, secure, protocol, accountId, isActive } = await req.json();
    const userId = (session.user as any).id;

    if (!email || !password || !host || !port || !accountId) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    const existing = await prisma.emailAccount.findFirst({
      where: { userId }
    });

    let config;
    if (existing) {
      config = await prisma.emailAccount.update({
        where: { id: existing.id },
        data: {
          email,
          password,
          host,
          port: Number(port),
          secure: Boolean(secure),
          protocol,
          accountId,
          isActive: Boolean(isActive)
        }
      });
    } else {
      config = await prisma.emailAccount.create({
        data: {
          email,
          password,
          host,
          port: Number(port),
          secure: Boolean(secure),
          protocol,
          accountId,
          isActive: Boolean(isActive),
          userId
        }
      });
    }

    return NextResponse.json({
      id: config.id,
      email: config.email,
      host: config.host,
      port: config.port,
      secure: config.secure,
      protocol: config.protocol,
      accountId: config.accountId,
      isActive: config.isActive
    });
  } catch (error: any) {
    console.error("Error saving email configuration:", error);
    if (error.code === 'P2002') {
      return NextResponse.json({ message: "This email address is already configured by another user" }, { status: 400 });
    }
    return NextResponse.json({ message: "Error saving configuration" }, { status: 500 });
  }
}
