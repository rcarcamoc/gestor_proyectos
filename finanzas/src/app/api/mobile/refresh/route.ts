import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateBasicAuth } from "@/lib/basicAuth";
import { TransactionType } from "@/generated/client";

export async function GET(req: Request) {
  const user = await authenticateBasicAuth(req);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const householdId = searchParams.get("householdId");
  if (!householdId) {
    return NextResponse.json({ message: "householdId is required" }, { status: 400 });
  }

  // Verify membership
  const membership = await prisma.userHousehold.findFirst({
    where: { userId: user.id, householdId },
  });
  if (!membership) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const overwrite = searchParams.get("overwrite") === "true";
  if (overwrite) {
    await prisma.transaction.deleteMany({ where: { householdId } });
    await prisma.budget.deleteMany({ where: { householdId } });
    await prisma.salary.deleteMany({ where: { householdId } });
    await prisma.autoClassificationPattern.deleteMany({ where: { householdId } });
    await prisma.debt.deleteMany({ where: { householdId } });
  }

  const sinceStr = searchParams.get("since");
  const sinceDate = sinceStr ? new Date(parseInt(sinceStr)) : null;
  const billingPeriod = searchParams.get("billingPeriod");

  const whereCondition = sinceDate
    ? { householdId, updatedAt: { gt: sinceDate } }
    : { householdId };

  // Fetch all related entities in parallel
  const [
    transactions,
    categories,
    budgets,
    salaries,
    patterns,
    debts,
    members
  ] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        deletedAt: null,
        OR: [
          { householdId },
          { userId: user.id }
        ],
        ...(billingPeriod ? { billingPeriod } : {}),
        ...(sinceDate ? { updatedAt: { gt: sinceDate } } : {})
      },
      select: {
        id: true,
        externalId: true,
        amount: true,
        date: true,
        type: true,
        description: true,
        cardType: true,
        billingPeriod: true,
        ignored: true,
        createdAt: true,
        updatedAt: true,
        scope: true,
        userId_internal: true,
        category: {
          select: {
            name: true
          }
        },
        creator: {
          select: {
            name: true,
            email: true
          }
        }
      }
    }),
    prisma.category.findMany({
      where: sinceDate
        ? { householdId, updatedAt: { gt: sinceDate } }
        : { householdId }
    }),
    prisma.budget.findMany({
      where: sinceDate
        ? {
            OR: [
              { householdId, updatedAt: { gt: sinceDate } },
              { userId: user.id, updatedAt: { gt: sinceDate } }
            ]
          }
        : {
            OR: [
              { householdId },
              { userId: user.id }
            ]
          },
      include: { category: true }
    }),
    prisma.salary.findMany({
      where: sinceDate
        ? { householdId, updatedAt: { gt: sinceDate } }
        : { householdId },
      include: { user: { select: { name: true, email: true } } }
    }),
    prisma.autoClassificationPattern.findMany({
      where: sinceDate
        ? { householdId, lastUpdated: { gt: sinceDate } }
        : { householdId },
      include: { category: true }
    }),
    prisma.debt.findMany({
      where: sinceDate
        ? { householdId, updatedAt: { gt: sinceDate } }
        : { householdId }
    }),
    prisma.userHousehold.findMany({
      where: { householdId },
      include: { user: { select: { id: true, name: true, email: true } } }
    })
  ]);

  let deletedIds: string[] = [];
  if (sinceDate) {
    const deletedTransactions = await prisma.transaction.findMany({
      where: {
        deletedAt: { gt: sinceDate },
        OR: [
          { householdId },
          { userId: user.id }
        ],
        ...(billingPeriod ? { billingPeriod } : {})
      },
      select: {
        externalId: true,
        id: true
      }
    });
    deletedIds = deletedTransactions.map(t => t.externalId || t.id);
  }

  const serverTimestamp = Date.now();

  const responsePayload = {
    serverTimestamp,
    transactions: transactions.map(t => ({
      idUnico: t.externalId || t.id,
      amount: Number(t.amount),
      date: t.date.getTime(),
      type: t.type === TransactionType.INCOME ? "INGRESO" : "GASTO",
      description: t.description || "",
      categoryName: t.category?.name || "",
      cardType: t.cardType || "",
      billingPeriod: t.billingPeriod || "",
      ignored: t.ignored,
      createdAt: t.createdAt.getTime(),
      updatedAt: t.updatedAt.getTime(),
      scope: t.scope,
      userId_internal: t.userId_internal,
      userName: t.creator?.name || t.creator?.email || ""
    })),
    categories: categories.map(c => ({
      id: c.id,
      name: c.name,
      icon: c.icon || "",
      color: c.color || "",
      isDefault: c.isDefault,
      updatedAt: c.updatedAt.getTime()
    })),
    budgets: budgets.map(b => ({
      categoryName: b.category.name,
      amount: Number(b.limit),
      period: `${b.year}-${String(b.month).padStart(2, "0")}`,
      updatedAt: b.updatedAt.getTime(),
      scope: b.userId ? "PERSONAL" : "HOUSEHOLD"
    })),
    salaries: salaries.map(s => ({
      nombrePersona: s.dummyUserName || s.user?.name || s.user?.email || "Desconocido",
      periodo: s.period,
      sueldo: Number(s.amount),
      updatedAt: s.updatedAt.getTime()
    })),
    patterns: patterns.map(p => ({
      pattern: p.pattern,
      categoryName: p.category.name,
      confidence: p.confidenceLevel,
      frequency: p.frequency,
      updatedAt: p.lastUpdated.getTime()
    })),
    debts: debts.map(d => ({
      debtorName: d.debtorName,
      creditorName: d.creditorName,
      amount: Number(d.amount),
      reason: d.reason,
      status: d.status,
      billingPeriod: d.billingPeriod || "",
      notes: d.notes || "",
      createdAt: d.createdAt.getTime(),
      updatedAt: d.updatedAt.getTime()
    })),
    users: members.map(m => ({
      id: m.user.id,
      name: m.user.name || m.user.email || m.user.id,
      email: m.user.email
    })),
    deletedIds
  };

  return NextResponse.json(responsePayload);
}
