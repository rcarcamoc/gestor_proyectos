export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { getServerSession } from "next-auth/next";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, session });
}
