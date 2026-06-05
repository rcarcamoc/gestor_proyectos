import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { TransactionType, TransactionSource, TransactionStatus, DebtStatus } from "@prisma/client";

import bcrypt from "bcryptjs";

// Helper to check if user belongs to the household
async function checkHouseholdMembership(userId: string, householdId: string) {
  const membership = await prisma.userHousehold.findFirst({
    where: { userId, householdId },
  });
  return !!membership;
}

export async function POST(req: Request) {
  let userId: string | null = null;
  const session = await getServerSession(authOptions);
  
  if (session?.user) {
    userId = (session.user as any).id;
  } else {
    // Check Basic Auth header for API sync (from Android client)
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
        console.error("Basic Auth parsing error:", err);
      }
    }
  }

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    householdId,
    lastSyncTimestamp = 0,
    overwrite = false,
    transactions = [],
    budgets = [],
    salaries = [],
    patterns = [],
    debts = []
  } = body;

  if (!householdId) {
    return NextResponse.json({ message: "householdId is required" }, { status: 400 });
  }

  const isMember = await checkHouseholdMembership(userId, householdId);
  if (!isMember) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const lastSyncDate = new Date(Number(lastSyncTimestamp));
    const serverTimestamp = Date.now();

    // 0. If overwrite is requested, wipe out current server data for this household first
    if (overwrite) {
      await prisma.transaction.deleteMany({ where: { householdId } });
      await prisma.budget.deleteMany({ where: { householdId } });
      await prisma.salary.deleteMany({ where: { householdId } });
      await prisma.autoClassificationPattern.deleteMany({ where: { householdId } });
      await prisma.debt.deleteMany({ where: { householdId } });
    }

    // 1. Get or create a default account for the household
    let defaultAccount = await prisma.account.findFirst({
      where: { householdId, isArchived: false }
    });
    if (!defaultAccount) {
      defaultAccount = await prisma.account.create({
        data: {
          name: "Cuenta Principal",
          type: "CHECKING",
          balance: 0,
          currency: "CLP",
          householdId
        }
      });
    }

    // 2. Fetch all categories of this household & defaults to match by name
    const categories = await prisma.category.findMany({
      where: {
        OR: [
          { householdId },
          { isDefault: true }
        ]
      }
    });

    const getCategoryIdByName = (name?: string) => {
      if (!name) return null;
      const match = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
      return match ? match.id : null;
    };

    // 3. Process incoming Transactions
    for (const tx of transactions) {
      const catId = getCategoryIdByName(tx.categoryName);
      const amount = Math.abs(Number(tx.amount));
      const type = tx.type === "INGRESO" || tx.type === "INCOME" ? TransactionType.INCOME : TransactionType.EXPENSE;

      // Find if transaction already exists by externalId (idUnico from Android)
      const existingTx = await prisma.transaction.findFirst({
        where: { externalId: tx.idUnico, householdId }
      });

      if (existingTx) {
        // Simple conflict resolution: if android is newer than web, update it
        const androidUpdated = tx.updatedAt ? new Date(tx.updatedAt) : new Date();
        if (androidUpdated > existingTx.updatedAt) {
          await prisma.transaction.update({
            where: { id: existingTx.id },
            data: {
              amount,
              type,
              date: new Date(tx.date),
              description: tx.description,
              categoryId: catId,
              cardType: tx.cardType || null,
              billingPeriod: tx.billingPeriod,
              ignored: !!tx.ignored,
              updatedAt: androidUpdated
            }
          });
        }
      } else {
        await prisma.transaction.create({
          data: {
            amount,
            currency: "CLP",
            date: new Date(tx.date),
            type,
            description: tx.description,
            source: TransactionSource.MANUAL,
            status: TransactionStatus.CONFIRMED,
            accountId: defaultAccount.id,
            categoryId: catId,
            userId,
            userId_internal: userId,
            householdId,
            externalId: tx.idUnico,
            billingPeriod: tx.billingPeriod,
            cardType: tx.cardType || null,
            ignored: !!tx.ignored,
            createdAt: tx.createdAt ? new Date(tx.createdAt) : new Date(),
            updatedAt: tx.updatedAt ? new Date(tx.updatedAt) : new Date()
          }
        });
      }
    }

    // 4. Process incoming Budgets
    for (const b of budgets) {
      const catId = getCategoryIdByName(b.categoryName);
      if (!catId) continue;

      const [yearStr, monthStr] = b.period.split("-");
      const month = parseInt(monthStr);
      const year = parseInt(yearStr);

      const existingBudget = await prisma.budget.findFirst({
        where: { categoryId: catId, month, year, householdId }
      });

      if (existingBudget) {
        const androidUpdated = b.updatedAt ? new Date(b.updatedAt) : new Date();
        if (androidUpdated > existingBudget.updatedAt) {
          await prisma.budget.update({
            where: { id: existingBudget.id },
            data: {
              limit: Number(b.amount),
              updatedAt: androidUpdated
            }
          });
        }
      } else {
        await prisma.budget.create({
          data: {
            limit: Number(b.amount),
            period: "MONTHLY",
            month,
            year,
            categoryId: catId,
            householdId,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }
    }

    // 5. Process incoming Salaries
    for (const s of salaries) {
      const existingSalary = await prisma.salary.findFirst({
        where: { householdId, period: s.periodo, dummyUserName: s.nombrePersona }
      });

      if (existingSalary) {
        const androidUpdated = s.updatedAt ? new Date(s.updatedAt) : new Date();
        if (androidUpdated > existingSalary.updatedAt) {
          await prisma.salary.update({
            where: { id: existingSalary.id },
            data: {
              amount: Number(s.sueldo),
              updatedAt: androidUpdated
            }
          });
        }
      } else {
        await prisma.salary.create({
          data: {
            householdId,
            dummyUserName: s.nombrePersona,
            amount: Number(s.sueldo),
            period: s.periodo,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }
    }

    // 6. Process incoming Auto-Classification Patterns
    for (const p of patterns) {
      const catId = getCategoryIdByName(p.categoryName);
      if (!catId) continue;

      const existingPattern = await prisma.autoClassificationPattern.findFirst({
        where: { householdId, pattern: p.pattern, categoryId: catId }
      });

      if (existingPattern) {
        const androidUpdated = p.updatedAt ? new Date(p.updatedAt) : new Date();
        if (androidUpdated > existingPattern.lastUpdated) {
          await prisma.autoClassificationPattern.update({
            where: { id: existingPattern.id },
            data: {
              confidenceLevel: Number(p.confidence),
              frequency: Number(p.frequency),
              lastUpdated: androidUpdated
            }
          });
        }
      } else {
        await prisma.autoClassificationPattern.create({
          data: {
            householdId,
            pattern: p.pattern,
            categoryId: catId,
            confidenceLevel: Number(p.confidence),
            frequency: Number(p.frequency),
            lastUpdated: new Date()
          }
        });
      }
    }

    // 7. Process incoming Debts
    for (const d of debts) {
      const androidStatus = d.status === "COBRADO" ? DebtStatus.COBRADO : d.status === "CANCELADO" ? DebtStatus.CANCELADO : DebtStatus.PENDIENTE;
      
      const existingDebt = await prisma.debt.findFirst({
        where: {
          householdId,
          debtorName: d.debtorName,
          creditorName: d.creditorName,
          reason: d.reason,
          amount: Number(d.amount),
          createdAt: {
            gte: new Date(new Date(d.createdAt).getTime() - 5000), // 5s tolerance
            lte: new Date(new Date(d.createdAt).getTime() + 5000)
          }
        }
      });

      if (existingDebt) {
        const androidUpdated = d.updatedAt ? new Date(d.updatedAt) : new Date();
        if (androidUpdated > existingDebt.updatedAt) {
          await prisma.debt.update({
            where: { id: existingDebt.id },
            data: {
              status: androidStatus,
              notes: d.notes,
              updatedAt: androidUpdated
            }
          });
        }
      } else {
        await prisma.debt.create({
          data: {
            householdId,
            debtorName: d.debtorName,
            creditorName: d.creditorName,
            amount: Number(d.amount),
            reason: d.reason,
            status: androidStatus,
            billingPeriod: d.billingPeriod || null,
            notes: d.notes,
            createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
            updatedAt: d.updatedAt ? new Date(d.updatedAt) : new Date()
          }
        });
      }
    }

    // -------------------------------------------------------------
    // 8. Gather changes from Web to send back to Android
    // -------------------------------------------------------------
    const webTransactions = await prisma.transaction.findMany({
      where: {
        householdId,
        updatedAt: { gt: lastSyncDate }
      },
      include: { category: true }
    });

    const webBudgets = await prisma.budget.findMany({
      where: {
        householdId,
        updatedAt: { gt: lastSyncDate }
      },
      include: { category: true }
    });

    const webSalaries = await prisma.salary.findMany({
      where: {
        householdId,
        updatedAt: { gt: lastSyncDate }
      },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    const webPatterns = await prisma.autoClassificationPattern.findMany({
      where: {
        householdId,
        lastUpdated: { gt: lastSyncDate }
      },
      include: { category: true }
    });

    const webDebts = await prisma.debt.findMany({
      where: {
        householdId,
        updatedAt: { gt: lastSyncDate }
      }
    });

    // Format output payload for Android client
    const responsePayload = {
      serverTimestamp,
      transactions: webTransactions.map(t => ({
        idUnico: t.externalId || t.id,
        amount: Number(t.amount),
        date: t.date.toISOString(),
        type: t.type === TransactionType.INCOME ? "INGRESO" : "GASTO",
        description: t.description || "",
        categoryName: t.category?.name || "",
        cardType: t.cardType || "",
        billingPeriod: t.billingPeriod || "",
        ignored: t.ignored,
        createdAt: t.createdAt.getTime(),
        updatedAt: t.updatedAt.getTime()
      })),
      budgets: webBudgets.map(b => ({
        categoryName: b.category.name,
        amount: Number(b.limit),
        period: `${b.year}-${String(b.month).padStart(2, "0")}`,
        updatedAt: b.updatedAt.getTime()
      })),
      salaries: webSalaries.map(s => ({
        nombrePersona: s.dummyUserName || s.user?.name || s.user?.email || "Desconocido",
        periodo: s.period,
        sueldo: Number(s.amount),
        updatedAt: s.updatedAt.getTime()
      })),
      patterns: webPatterns.map(p => ({
        pattern: p.pattern,
        categoryName: p.category.name,
        confidence: p.confidenceLevel,
        frequency: p.frequency,
        updatedAt: p.lastUpdated.getTime()
      })),
      debts: webDebts.map(d => ({
        debtorName: d.debtorName,
        creditorName: d.creditorName,
        amount: Number(d.amount),
        reason: d.reason,
        status: d.status,
        billingPeriod: d.billingPeriod || "",
        notes: d.notes || "",
        createdAt: d.createdAt.getTime(),
        updatedAt: d.updatedAt.getTime()
      }))
    };

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("Sync POST error:", error);
    return NextResponse.json({ message: "Sync failed" }, { status: 500 });
  }
}
