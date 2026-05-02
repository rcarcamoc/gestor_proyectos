export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { NextResponse } from "next/server";
import { categorizeTransactionsBatch } from "@/lib/ai/groq";
import { categorizeByKeywords } from "@/services/categorizerService";
import { trainNaiveBayes } from "@/services/mlCategorizerService";

/**
 * GET /api/classify
 * Retorna estadísticas del estado de clasificación del usuario:
 * - Total sin categoría (needs_review)
 * - % clasificadas por capa (keyword / ml / groq / manual)
 * - Tamaño del dataset de entrenamiento ML
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;

  const [total, byCategorySource, trainingSize] = await Promise.all([
    prisma.transaction.count({ where: { userId } }),
    prisma.transaction.groupBy({
      by: ["categorySource"],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.transaction.count({
      where: { userId, categoryId: { not: null } },
    }),
  ]);

  const needsReview = await prisma.transaction.count({
    where: {
      userId,
      OR: [
        { categorySource: "needs_review" },
        { categoryId: null },
      ],
    },
  });

  const stats: Record<string, number> = {};
  for (const row of byCategorySource) {
    stats[row.categorySource ?? "none"] = row._count._all;
  }

  return NextResponse.json({
    total,
    needsReview,
    trainingDataSize: trainingSize,
    bySource: stats,
  });
}

/**
 * POST /api/classify
 * Ejecuta la cascada completa (Keywords → ML → Groq) sobre transacciones sin categoría.
 * Marca como 'needs_review' las que ninguna capa puede clasificar con suficiente confianza.
 * 
 * Body: { batchSize?: number }  (default 50)
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const { batchSize = 50 } = await req.json().catch(() => ({}));

  // Obtener transacciones pendientes de clasificar
  const unclassified = await prisma.transaction.findMany({
    where: {
      userId,
      categoryId: null,
    },
    select: { id: true, description: true, amount: true },
    take: batchSize,
  });

  if (unclassified.length === 0) {
    return NextResponse.json({ message: "No hay transacciones sin categoría.", processed: 0 });
  }

  // Cargar categorías y historial para ML
  const [categories, history] = await Promise.all([
    prisma.category.findMany({
      where: { OR: [{ userId }, { isDefault: true }] },
    }),
    prisma.transaction.findMany({
      where: { userId, categoryId: { not: null } },
      select: { description: true, categoryId: true },
      take: 2000,
    }),
  ]);

  const mlPredictor = trainNaiveBayes(
    history.map((h) => ({ description: h.description || "", categoryId: h.categoryId! }))
  );

  const results = {
    keyword: 0,
    ml: 0,
    groq: 0,
    needs_review: 0,
  };

  type UpdateBatch = { id: string; categoryId: string | null; categorySource: string; aiConfidence: number | null };
  const updates: UpdateBatch[] = [];
  const groqQueue: { idx: number; id: string; description: string; amount: number }[] = [];

  for (let i = 0; i < unclassified.length; i++) {
    const tx = unclassified[i];
    let categoryId: string | null = null;
    let catSource = "needs_review";
    let confidence: number | null = null;

    // Capa 1: Keywords
    categoryId = categorizeByKeywords(tx.description || "", categories);
    if (categoryId) {
      catSource = "keyword";
      confidence = 1.0;
      results.keyword++;
    }

    // Capa 2: Naive Bayes ML
    if (!categoryId) {
      const mlResult = mlPredictor(tx.description || "");
      if (mlResult.categoryId) {
        categoryId = mlResult.categoryId;
        catSource = "ml";
        confidence = mlResult.confidence;
        results.ml++;
      }
    }

    // Capa 3: Groq (batch)
    if (!categoryId) {
      groqQueue.push({ idx: i, id: tx.id, description: tx.description || "", amount: Number(tx.amount) });
    }

    updates.push({ id: tx.id, categoryId, categorySource: catSource, aiConfidence: confidence });
  }

  // Procesar Groq en batch (una sola llamada a la API)
  if (groqQueue.length > 0 && process.env.GROQ_API_KEY) {
    const aiSuggestions = await categorizeTransactionsBatch(
      groqQueue.map((t) => ({ description: t.description, amount: t.amount })),
      categories.map((c) => ({ id: c.id, name: c.name }))
    );

    Object.entries(aiSuggestions).forEach(([aiIdx, categoryName]) => {
      const queueItem = groqQueue[parseInt(aiIdx)];
      if (!queueItem) return;
      const category = categories.find(
        (c) => c.name.toLowerCase() === (categoryName as string).toLowerCase()
      );
      if (category) {
        const upd = updates[queueItem.idx];
        upd.categoryId = category.id;
        upd.categorySource = "groq";
        upd.aiConfidence = 0.8;
        results.groq++;
      } else {
        // Groq no pudo → pedir asistencia al usuario
        results.needs_review++;
      }
    });
  } else {
    // Sin Groq → todas las que llegaron aquí necesitan revisión del usuario
    results.needs_review += groqQueue.length;
  }

  // Aplicar actualizaciones en base de datos
  await Promise.all(
    updates.map((u) =>
      prisma.transaction.update({
        where: { id: u.id },
        data: {
          categoryId: u.categoryId,
          categorySource: u.categorySource,
          aiConfidence: u.aiConfidence,
        },
      })
    )
  );

  return NextResponse.json({ processed: unclassified.length, ...results });
}

/**
 * PATCH /api/classify
 * Retroalimentación: el usuario corrige la categoría de una transacción.
 * Esto actualiza la BD y la próxima vez que se entrene el ML, este ejemplo se incluye.
 * 
 * Body: { transactionId: string, categoryId: string }
 */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { transactionId, categoryId } = await req.json();
  const userId = (session.user as any).id;

  // Verificar pertenencia
  const tx = await prisma.transaction.findFirst({
    where: { id: transactionId, userId },
  });
  if (!tx) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const updated = await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      categoryId,
      categorySource: "manual",  // Corrección del usuario = dato de entrenamiento confiable
      aiConfidence: null,
    },
  });

  return NextResponse.json(updated);
}
