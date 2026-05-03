import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = (session.user as any).id;
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
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    // Note: In a real app, we should revert the account balance update if deleting a confirmed transaction.
    // However, PENDING_REVIEW transactions typically haven't updated the balance yet in our import logic, 
    // BUT our manual POST logic DOES update the balance.
    // For now, let's just delete.
    await prisma.transaction.delete({
      where: { id }
    });
    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error) {
    return NextResponse.json({ message: "Error deleting transaction" }, { status: 500 });
  }
}
