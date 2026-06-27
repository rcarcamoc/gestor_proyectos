import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { verifyAndCorrectTransactions } from "@/lib/ai/groq";

const execFileAsync = promisify(execFile);

// Helper to authenticate requests (handles both NextAuth session and Basic Auth for APK)
async function authenticateRequest(req: Request): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    return (session.user as any).id;
  }

  // Basic Auth (for APK/mobile app client)
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
            return user.id;
          }
        }
      }
    } catch (err) {
      console.error("Basic Auth parsing error in PDF API:", err);
    }
  }

  return null;
}

export async function POST(req: Request) {
  const userId = await authenticateRequest(req);
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let tempFilePath = "";
  try {
    let password = "";
    let fileBuffer: Buffer | null = null;
    let fileName = "statement.pdf";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      password = (formData.get("password") as string) || "";
      if (!file) {
        return NextResponse.json({ message: "File is required" }, { status: 400 });
      }
      fileName = file.name;
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      const base64File = body.file; // base64 encoded PDF
      password = body.password || "";
      if (!base64File) {
        return NextResponse.json({ message: "File (base64) is required" }, { status: 400 });
      }
      fileBuffer = Buffer.from(base64File, "base64");
    } else {
      return NextResponse.json({ message: "Unsupported content type" }, { status: 400 });
    }

    // Write file to scratch/temp folder
    const scratchDir = path.join(process.cwd(), "scratch");
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir);
    }
    const tempFileName = `temp_${Date.now()}_${fileName}`;
    tempFilePath = path.join(scratchDir, tempFileName);
    fs.writeFileSync(tempFilePath, fileBuffer);

    // Run Python parser
    const pythonScript = path.join(process.cwd(), "src", "services", "lider.py");
    const { stdout, stderr } = await execFileAsync("python", [pythonScript, tempFilePath, password]);

    // Cleanup temp file immediately
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      tempFilePath = "";
    }

    if (stderr && !stdout) {
      console.error("Python parser stderr:", stderr);
      return NextResponse.json({ message: "Parser script error", details: stderr }, { status: 500 });
    }

    const firstPassResult = JSON.parse(stdout);
    if (!firstPassResult.success) {
      return NextResponse.json({ message: "Failed to decrypt or parse PDF", error: firstPassResult.error }, { status: 400 });
    }

    // AI Verification
    console.log("Calling Groq AI to verify and correct parsed transactions...");
    const verifiedResult = await verifyAndCorrectTransactions(firstPassResult.rawText, {
      billingPeriod: firstPassResult.billingPeriod,
      cardNumber: firstPassResult.cardNumber,
      transactions: firstPassResult.transactions
    });

    // Fetch categories for this user to enrich transactions with suggestions
    const categories = await prisma.category.findMany({
      where: {
        OR: [
          { userId },
          {
            household: {
              users: {
                some: {
                  id: userId
                }
              }
            }
          },
          { isDefault: true }
        ]
      }
    });

    const txsToEnrich = verifiedResult.transactions || firstPassResult.transactions || [];
    const enrichedTransactions = txsToEnrich.map((tx: any) => {
      let suggestedCategoryName: string | null = null;
      
      // Basic keyword matching
      const descLower = (tx.description || "").toLowerCase();
      const match = categories.find(c => descLower.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(descLower));
      if (match) {
        suggestedCategoryName = match.name;
      }

      return {
        ...tx,
        suggestedCategoryName
      };
    });

    return NextResponse.json({
      success: true,
      billingPeriod: verifiedResult.billingPeriod || firstPassResult.billingPeriod,
      cardNumber: verifiedResult.cardNumber || firstPassResult.cardNumber,
      transactions: enrichedTransactions
    });

  } catch (error: any) {
    console.error("PDF Import Endpoint Error:", error);
    // Ensure cleanup of temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    return NextResponse.json({ message: "Error processing PDF", error: error.message }, { status: 500 });
  }
}
