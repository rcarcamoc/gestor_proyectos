import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { NextResponse } from "next/server";
import { authenticateBasicAuth } from "@/lib/basicAuth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const basicUser = !session?.user ? await authenticateBasicAuth(req) : null;
  const userId = session?.user ? (session.user as any).id : basicUser?.id;
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Only allow specific fields to be updated (not amount, date, description)
  const { status, ignored, scope, userId_internal, categoryId } = body;
  const updateData: Record<string, any> = {};
  if (status !== undefined) updateData.status = status;
  if (ignored !== undefined) updateData.ignored = ignored;
  if (scope !== undefined) updateData.scope = scope;
  if (userId_internal !== undefined) updateData.userId_internal = userId_internal;
  if (categoryId !== undefined) updateData.categoryId = categoryId;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ message: "No valid fields to update" }, { status: 400 });
  }

  try {
    // Verify the user has access to this transaction
    const existing = await prisma.transaction.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [
          { userId },
          { userId_internal: userId },
        ]
      }
    });
    if (!existing) return NextResponse.json({ message: "Not found or unauthorized" }, { status: 404 });

    const transaction = await prisma.transaction.update({
      where: { id },
      data: updateData,
      include: { category: true, account: true }
    });
    return NextResponse.json(transaction);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Error updating transaction" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const basicUser = !session?.user ? await authenticateBasicAuth(req) : null;
  const userId = session?.user ? (session.user as any).id : basicUser?.id;
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const existing = await prisma.transaction.findFirst({
      where: {
        id,
        deletedAt: null
      }
    });
    
    if (!existing) return NextResponse.json({ message: "Not found" }, { status: 404 });

    // Mark as soft deleted
    await prisma.transaction.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error) {
    return NextResponse.json({ message: "Error deleting transaction" }, { status: 500 });
  }
}
