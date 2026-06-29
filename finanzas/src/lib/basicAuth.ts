import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Cache for Basic Auth credentials to avoid running bcrypt.compare (which takes ~100ms) on every request.
// Cache entry: key = authHeader string, value = { user: { id, email }, expiresAt }
interface CachedUser {
  id: string;
  email: string;
}
const authCache = new Map<string, { user: CachedUser; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

export async function authenticateBasicAuth(req: Request): Promise<CachedUser | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) return null;

  // Check cache first
  const now = Date.now();
  const cached = authCache.get(authHeader);
  if (cached && cached.expiresAt > now) {
    return cached.user;
  }
  
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
          const authenticatedUser = { id: user.id, email: user.email || "" };
          // Cache successful authentication
          authCache.set(authHeader, {
            user: authenticatedUser,
            expiresAt: Date.now() + CACHE_TTL_MS
          });
          return authenticatedUser;
        }
      }
    }
  } catch (err) {
    console.error("Basic Auth parsing error:", err);
  }
  return null;
}
