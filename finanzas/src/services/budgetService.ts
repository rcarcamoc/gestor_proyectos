import { prisma } from "@/lib/prisma";

export interface BudgetInput {
  limit: number;
  month: number;
  year: number;
  categoryId: string;
  userId?: string;
  householdId?: string;
}

/**
 * Obtiene todos los presupuestos de un usuario o hogar para un mes y año específicos.
 */
export async function getBudgets(params: { month: number; year: number; userId?: string; householdId?: string }) {
  const { month, year, userId, householdId } = params;
  
  return prisma.budget.findMany({
    where: {
      month,
      year,
      OR: [
        userId ? { userId } : {},
        householdId ? { householdId } : {}
      ]
    },
    include: {
      category: true
    }
  });
}

/**
 * Crea o actualiza un presupuesto (Upsert).
 */
export async function upsertBudget(data: BudgetInput) {
  const { categoryId, month, year, userId, householdId, limit } = data;

  const where = userId 
    ? { categoryId_month_year_userId: { categoryId, month, year, userId } }
    : { categoryId_month_year_householdId: { categoryId, month, year, householdId: householdId! } };

  return prisma.budget.upsert({
    where: where as any,
    update: { limit },
    create: {
      limit,
      month,
      year,
      categoryId,
      userId,
      householdId
    }
  });
}

/**
 * Elimina un presupuesto por ID.
 */
export async function deleteBudget(id: string) {
  return prisma.budget.delete({
    where: { id }
  });
}
