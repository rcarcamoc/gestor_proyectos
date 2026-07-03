/**
 * @deprecated This endpoint is deprecated. Use the new mobile/refresh endpoint instead.
 * Kept for backward compatibility with older APK versions.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkHouseholdMembership, processSync } from "@/services/syncService";

export async function POST(req: Request) {
  let userId: string | null = null;
  const session = await getServerSession(authOptions);
  
  if (session?.user) {
    userId = (session.user as any).id;
  } else {
    // Check Basic Auth header for API sync (from Android client)
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Basic ")) {
      try {
        const base64Credentials = authHeader.split(" ")[1];
        const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
        const [email, password] = credentials.split(":");
        
        if (email && password) {
          const user = await prisma.user.findUnique({
            where: { email: email.trim() }
          });
          if (user && user.passwordHash) {
            const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);
            if (isPasswordCorrect) {
              userId = user.id;
            }
          }
        }
      } catch (err) {
        console.error("Basic Auth parsing error:", err);
      }
    }
  }

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { householdId } = body;

  if (!householdId) {
    return NextResponse.json({ message: "householdId is required" }, { status: 400 });
  }

  const isMember = await checkHouseholdMembership(userId, householdId);
  if (!isMember) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const responsePayload = await processSync(userId, body);
    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("Sync POST error:", error);
    return NextResponse.json({ message: "Sync failed" }, { status: 500 });
  }
}
