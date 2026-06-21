import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function authenticateBasicAuth(req: Request): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) return null;
  
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
          return { id: user.id, email: user.email || "" };
        }
      }
    }
  } catch (err) {
    console.error("Basic Auth parsing error:", err);
  }
  return null;
}
