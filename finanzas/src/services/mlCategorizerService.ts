/**
 * Servicio de clasificación ML basado en Naive Bayes Multinomial.
 * 
 * CÓMO APRENDE:
 * - Se entrena con el historial de transacciones ya categorizadas del usuario.
 * - Cada vez que el usuario corrige una categoría, esa corrección se incorpora
 *   al historial y el modelo mejora en la siguiente llamada.
 * - Nunca llama a ninguna API externa (cero costo, latencia ~0ms).
 * 
 * INTEGRACIÓN EN LA CASCADA:
 *   1. Keywords  → Reglas estáticas (más rápido, sin IA)
 *   2. Naive Bayes (este módulo) → Aprende del historial del usuario
 *   3. Groq LLM → Solo si el ML tiene baja confianza (umbral configurable)
 */

export interface TrainingData {
  description: string;
  categoryId: string;
}

export interface PredictionResult {
  categoryId: string | null;
  confidence: number;   // 0.0 – 1.0
  method: 'ml';
}

/** Tokens comunes que no aportan información de categoría */
const STOPWORDS = new Set([
  'de', 'la', 'el', 'en', 'y', 'a', 'del', 'con', 'por', 'los', 'las', 'un', 'una',
  'ltda', 'spa', 'cl', 'chile', 'pago', 'compra', 'transf', 'transferencia',
  'webpay', 'tef', 'via', 'suc', 'sucursal', 'num', 'nro', 'ref',
]);

/** Preprocesa un texto para el clasificador (normaliza, tokeniza, elimina stopwords) */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // Quitar acentos
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t));
}

/** 
 * Convierte un array de log-probabilidades a probabilidades normalizadas (softmax).
 * Necesario para calcular confianza comparable entre categorías.
 */
function softmax(scores: Record<string, number>): Record<string, number> {
  const vals = Object.values(scores);
  const max = Math.max(...vals); // Estabilidad numérica
  const exps = vals.map(v => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  const keys = Object.keys(scores);
  const result: Record<string, number> = {};
  keys.forEach((k, i) => { result[k] = exps[i] / sum; });
  return result;
}

/**
 * Entrena el clasificador Naive Bayes y retorna una función de predicción.
 * 
 * La función retornada incluye:
 * - La categoría predicha (o null si no hay historial)
 * - La confianza normalizada (0–1) para decidir si escalar a Groq
 * 
 * @param history Historial de transacciones ya categorizadas
 * @param minConfidence Umbral mínimo de confianza para retornar resultado (default 0.35)
 */
export function trainNaiveBayes(
  history: TrainingData[],
  minConfidence = 0.35
) {
  // Modelo interno
  const freq: Record<string, Record<string, number>> = {};  // [catId][token] = count
  const catTotalTokens: Record<string, number> = {};
  const catDocCount: Record<string, number> = {};
  const vocabulary = new Set<string>();
  let totalDocs = 0;

  // --- ENTRENAMIENTO ---
  for (const { description, categoryId } of history) {
    if (!description || !categoryId) continue;

    const tokens = tokenize(description);
    if (tokens.length === 0) continue;

    totalDocs++;
    catDocCount[categoryId] = (catDocCount[categoryId] || 0) + 1;
    if (!freq[categoryId]) freq[categoryId] = {};

    for (const token of tokens) {
      freq[categoryId][token] = (freq[categoryId][token] || 0) + 1;
      catTotalTokens[categoryId] = (catTotalTokens[categoryId] || 0) + 1;
      vocabulary.add(token);
    }
  }

  const V = vocabulary.size;
  const categories = Object.keys(catDocCount);

  // --- PREDICCIÓN ---
  return function predict(description: string): PredictionResult {
    const noResult: PredictionResult = { categoryId: null, confidence: 0, method: 'ml' };

    if (!description || totalDocs < 5) return noResult; // Necesita al menos 5 ejemplos

    const tokens = tokenize(description);
    if (tokens.length === 0) return noResult;

    const rawScores: Record<string, number> = {};

    for (const catId of categories) {
      // Prior: P(C) — con suavizado para evitar log(0)
      rawScores[catId] = Math.log((catDocCount[catId] + 1) / (totalDocs + categories.length));

      // Likelihood: P(token|C) con Laplace smoothing
      const counts = freq[catId] || {};
      const total = catTotalTokens[catId] || 0;

      for (const token of tokens) {
        const tokenCount = counts[token] || 0;
        rawScores[catId] += Math.log((tokenCount + 1) / (total + V + 1));
      }
    }

    // Normalizar a probabilidades para medir confianza real
    const probs = softmax(rawScores);

    // Ordenar por probabilidad
    const sorted = Object.entries(probs).sort((a, b) => b[1] - a[1]);
    const [bestCatId, bestProb] = sorted[0];

    // Solo retornar si la confianza supera el umbral
    if (bestProb < minConfidence) return noResult;

    return {
      categoryId: bestCatId,
      confidence: Math.round(bestProb * 100) / 100,
      method: 'ml',
    };
  };
}
