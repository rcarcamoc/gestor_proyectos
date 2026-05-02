import { NextResponse } from "next/server";
import { getGroqStatus } from "@/lib/ai/groq";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = getGroqStatus();
  return NextResponse.json(status);
}
