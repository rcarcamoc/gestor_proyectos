export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { NextResponse } from "next/server";
import { syncEmailAccount } from "@/services/emailSyncService";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;

  try {
    const emailAccount = await prisma.emailAccount.findFirst({
      where: { userId }
    });

    if (!emailAccount) {
      return NextResponse.json({ message: "Email account not configured" }, { status: 404 });
    }

    if (!emailAccount.isActive) {
      return NextResponse.json({ message: "Email account integration is inactive" }, { status: 400 });
    }

    const result = await syncEmailAccount(emailAccount.id);

    if (!result.success) {
      return NextResponse.json({ message: result.error || "Sync failed" }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error synchronizing emails:", error);
    return NextResponse.json({ message: error.message || "Error synchronizing emails" }, { status: 500 });
  }
}
