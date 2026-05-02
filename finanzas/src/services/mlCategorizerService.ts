/**
 * Servicio de categorización basado en Naive Bayes.
 * Utiliza el historial de transacciones ya categorizadas para predecir nuevas.
 */

export interface TrainingData {
  description: string;
  categoryId: string;
}

export interface CategoryMap {
  [id: string]: string;
}

const STOPWORDS = new Set([
  'de', 'la', 'el', 'en', 'y', 'a', 'del', 'con', 'por', 'los', 'las', 'un', 'una', 
  'ltda', 's.a', 'spa', 'cl', 'chile', 'pago', 'compra', 'transf', 'transferencia',
  'webpay', 'tef', 'pago'
]);

/**
 * Tokeniza un texto para el clasificador.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar acentos
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t));
}

/**
 * Entrena y retorna una función de predicción basada en Naive Bayes.
 */
export function trainNaiveBayes(history: TrainingData[]) {
  const freq: Record<string, Record<string, number>> = {}; // [catId][token] = count
  const catTotalTokens: Record<string, number> = {};
  const catDocCount: Record<string, number> = {};
  const vocabulary = new Set<string>();
  
  let totalDocs = 0;

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

  /**
   * Predice la categoría para una nueva descripción.
   */
  return function predict(description: string): string | null {
    if (!description || totalDocs === 0) return null;
    
    const tokens = tokenize(description);
    if (tokens.length === 0) return null;

    let bestCat: string | null = null;
    let bestScore = -Infinity;

    for (const catId of Object.keys(catDocCount)) {
      // Prior probability: P(C)
      let score = Math.log(catDocCount[catId] / totalDocs);
      
      // Likelihood: P(token|C)
      const counts = freq[catId];
      const total = catTotalTokens[catId];
      
      for (const token of tokens) {
        const tokenCount = counts[token] || 0;
        // Laplace smoothing
        score += Math.log((tokenCount + 1) / (total + V));
      }

      if (score > bestScore) {
        bestScore = score;
        bestCat = catId;
      }
    }

    // Umbral de confianza mínimo (opcional)
    // Para simplificar, retornamos la mejor opción si existe historial suficiente
    return bestCat;
  };
}
