import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { householdId } = await request.json();

  if (!householdId) {
    return NextResponse.json({ error: 'Household ID required' }, { status: 400 });
  }

  // Verify user is member of household
  const membership = await prisma.userHousehold.findFirst({
    where: { householdId, userId: session.user.id, role: 'ADMIN' }
  });

  if (!membership) {
    return NextResponse.json({ error: 'Unauthorized. Only admins can invite.' }, { status: 403 });
  }

  // Generate code
  const code = nanoid(8).toUpperCase();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  const invitation = await prisma.invitation.create({
    data: {
      code,
      householdId,
      expiresAt,
      email: '', // Not used for code-only invite
    }
  });

  return NextResponse.json(invitation);
}
