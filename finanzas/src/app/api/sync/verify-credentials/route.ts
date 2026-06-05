import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim() }
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json({ message: "Usuario no encontrado o credenciales inválidas" }, { status: 401 });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordCorrect) {
      return NextResponse.json({ message: "Contraseña incorrecta" }, { status: 401 });
    }

    return NextResponse.json({ success: true, userId: user.id });
  } catch (error) {
    console.error("Verify credentials error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
