import Groq from "groq-sdk";

// --- QUEUE SYSTEM FOR RATE LIMITING ---
let isProcessing = false;
const queue: { resolve: Function; reject: Function; task: () => Promise<any> }[] = [];
let groqStatus: 'idle' | 'busy' | 'rate_limited' = 'idle';
let nextAvailableTime = 0;

/**
 * Retorna el estado actual del servicio Groq
 */
export function getGroqStatus() {
  return {
    status: groqStatus,
    queueSize: queue.length,
    isAvailable: Date.now() >= nextAvailableTime
  };
}

async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;

  while (queue.length > 0) {
    const now = Date.now();
    if (now < nextAvailableTime) {
      groqStatus = 'rate_limited';
      const wait = nextAvailableTime - now;
      await new Promise(r => setTimeout(r, wait));
    }

    const item = queue.shift();
    if (!item) break;
    const { resolve, reject, task } = item;
    
    groqStatus = 'busy';

    try {
      const result = await task();
      resolve(result);
      groqStatus = 'idle';
      // Reset backoff on success? Maybe not fully, but at least resume
    } catch (error: any) {
      if (error?.status === 429) {
        const retryAfter = parseInt(error.headers?.['retry-after'] || '5');
        console.warn(`Groq Rate Limit hit. Retrying in ${retryAfter}s...`);
        groqStatus = 'rate_limited';
        nextAvailableTime = Date.now() + (retryAfter * 1000);
        queue.unshift({ resolve, reject, task }); // Put it back at the front
        await new Promise(r => setTimeout(r, retryAfter * 1000));
      } else {
        console.error("Groq Task Error:", error);
        reject(error);
        groqStatus = 'idle';
      }
    }
  }

  isProcessing = false;
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    queue.push({ resolve, reject, task });
    processQueue();
  });
}
// --- END QUEUE SYSTEM ---


export async function extractTransactionFromEmail(text: string, categories: string[]) {
  return enqueue(async () => {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const prompt = `
      Extract financial transaction details from the following bank notification email text.
      Return a valid JSON object.

      Email Text:
      """
      ${text}
      """

      Available Categories: [${categories.join(", ")}]

      JSON Schema:
      {
        "amount": number (positive for income, negative for expense),
        "currency": string (3 letter code, e.g. CLP, USD),
        "date": string (ISO 8601 string, including the transaction time if available in the email text, e.g., "YYYY-MM-DDTHH:mm:ss" or "YYYY-MM-DDTHH:mm:ssZ"),
        "description": string (merchant or person name, cleaned of HTML or excess whitespaces),
        "category": string (must be one of the available categories),
        "confidence": number (0 to 1)
      }

      Important instructions:
      - If the email includes a specific date and time for the transaction (e.g. "Fecha: 06/06/2026" and "Hora: 10:18" or similar), combine them into a single ISO 8601 date-time string (e.g. "2026-06-06T10:18:00").
      - Clean the merchant name from HTML tags, newlines, and double spaces.
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
    });

    const content = chatCompletion.choices[0]?.message?.content;
    if (!content) return null;

    return JSON.parse(content);
  }).catch(err => {
    console.error("Groq AI Error (Queued):", err);
    return null;
  });
}

export async function categorizeTransactionsBatch(
  transactions: { description: string; amount: number }[],
  categories: { id: string; name: string }[]
) {
  return enqueue(async () => {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const categoryList = categories.map(c => c.name).join(", ");
    const transactionList = transactions.map((t, i) => `${i}: ${t.description} (${t.amount})`).join("\n");

    const prompt = `
      Categorize the following financial transactions. The category names are in Spanish.
      You MUST use ONLY the exact category names from the Available Categories list.
      
      Available Categories: [${categoryList}]

      Transactions (index: description (amount in CLP)):
      ${transactionList}

      Rules:
      - Match each transaction to the most appropriate Spanish category.
      - Negative amounts are expenses, positive amounts are income.
      - "sueldo" is the category for salary/income transactions.
      - Return a valid JSON object where keys are the transaction indices as strings ("0", "1", "2"...) and values are the EXACT category names from the list.
      - Do NOT invent categories. Only use names from the Available Categories list.
      - Only return the JSON object, nothing else.
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" },
    });

    const content = chatCompletion.choices[0]?.message?.content;
    if (!content) return {};

    return JSON.parse(content);
  }).catch(err => {
    console.error("Groq Batch Categorization Error (Queued):", err);
    return {};
  });
}

export async function parseTransactionsFromImage(base64Image: string, currentYear: number) {
  return enqueue(async () => {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const cleanImage = base64Image.replace(/\s/g, "");

    const prompt = `
      Analiza la siguiente imagen que es una captura de pantalla de movimientos bancarios o de tarjeta de crédito (como Líder Bci).
      Tu tarea es extraer todas las transacciones financieras visibles en la imagen y estructurarlas en formato JSON.

      Instrucciones:
      - Extrae cada transacción visible con su fecha, descripción y monto.
      - Para el monto: debe ser un número entero positivo (por ejemplo, si en la imagen dice "$51.614" o "51.614", debe extraerse como 51614. Si dice "$11.440", debe ser 11440). Limpia el formato de moneda quitando signos de dólar/pesos, puntos de miles y comas.
      - Para la fecha: conviértela a formato ISO estándar "YYYY-MM-DD" (por ejemplo, "04/06/2026" se convierte en "2026-06-04").
      - Si la fecha no incluye el año explícitamente (ej: "Jueves 04 de Junio" o "04 de Junio"), asume que el año de la transacción es ${currentYear}. Si el mes es de fin de año y el año de corte coincide, usa el año correspondiente.
      - Para la descripción: extrae el comercio o detalle de la tienda tal como aparece (ej: "ENEL,SANTIAGO", "ACTUCIA SPA,SANTIAGO").
      - Identifica el tipo de tarjeta (cardType) si aparece en la captura (ej: "Titular", "Adicional", o null si no se especifica).

      Retorna un objeto JSON con el siguiente esquema exacto:
      {
        "transactions": [
          {
            "date": "YYYY-MM-DD",
            "description": "nombre del comercio o descripción",
            "amount": number,
            "cardType": "Titular" | "Adicional" | null
          }
        ]
      }
      
      No inventes datos. Si no hay transacciones visibles, retorna un array vacío. Solo responde con el objeto JSON estructurado, sin texto adicional ni formato markdown.
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: cleanImage
              }
            }
          ]
        }
      ],
      model: "llama-3.2-11b-vision-preview",
      response_format: { type: "json_object" }
    });

    const content = chatCompletion.choices[0]?.message?.content;
    if (!content) return { transactions: [] };

    return JSON.parse(content);
  }).catch(err => {
    console.error("Groq Vision Import Error (Queued):", err);
    return { transactions: [] };
  });
}


