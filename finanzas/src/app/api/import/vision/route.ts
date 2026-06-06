import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { parseTransactionsFromImage } from "@/lib/ai/groq";

export async function POST(req: Request) {
  let userId: string | null = null;
  const session = await getServerSession(authOptions);

  if (session?.user) {
    userId = (session.user as any).id;
  } else {
    // Check Basic Auth header for API import (from Android client)
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
        console.error("Basic Auth parsing error in Vision API:", err);
      }
    }
  }

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { image, currentYear = new Date().getFullYear() } = await req.json();

    if (!image) {
      return NextResponse.json({ message: "Image data is required" }, { status: 400 });
    }

    // Call Groq Vision API
    const result = await parseTransactionsFromImage(image, currentYear);

    // Pre-classify transactions using the database categories
    const categories = await prisma.category.findMany({
      where: {
        OR: [
          { userId },
          // Also fetch household categories if user has a household
          {
            household: {
              users: {
                some: {
                  userId
                }
              }
            }
          },
          { isDefault: true }
        ]
      }
    });

    const enrichedTransactions = (result.transactions || []).map((tx: any) => {
      // Find matching category by name if possible (the LLM can sometimes return a categoryName suggestion)
      let suggestedCategoryId: string | null = null;
      let suggestedCategoryName: string | null = null;
      
      if (tx.categoryName) {
        const match = categories.find(c => c.name.toLowerCase() === tx.categoryName.toLowerCase());
        if (match) {
          suggestedCategoryId = match.id;
          suggestedCategoryName = match.name;
        }
      }
      
      // Basic keyword matching as fallback
      if (!suggestedCategoryId) {
        const descLower = (tx.description || "").toLowerCase();
        const match = categories.find(c => descLower.includes(c.name.toLowerCase()));
        if (match) {
          suggestedCategoryId = match.id;
          suggestedCategoryName = match.name;
        }
      }

      return {
        date: tx.date || new Date().toISOString().split('T')[0],
        description: tx.description || "Transacción escaneada",
        amount: Math.abs(Number(tx.amount)) || 0,
        cardType: tx.cardType || null,
        suggestedCategoryId,
        suggestedCategoryName
      };
    });

    return NextResponse.json({ transactions: enrichedTransactions });
  } catch (error) {
    console.error("Vision import endpoint error:", error);
    return NextResponse.json({ message: "Error processing image" }, { status: 500 });
  }
}
