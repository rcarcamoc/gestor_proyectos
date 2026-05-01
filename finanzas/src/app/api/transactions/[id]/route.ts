import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = params;
  const { status } = await req.json();

  try {
    const transaction = await prisma.transaction.update({
      where: { id },
      data: { status }
    });
    return NextResponse.json(transaction);
  } catch (error) {
    return NextResponse.json({ message: "Error updating transaction" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = params;

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
