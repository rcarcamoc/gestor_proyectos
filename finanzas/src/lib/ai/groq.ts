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
      model: "openai/gpt-oss-120b",
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

      Instructions for mapping:
      1. Analyze the transaction description to identify the merchant/business.
      2. Pay close attention to common local and Chilean merchants to understand their domain:
         - "COPEC", "Shell", "Petrobras", "Pronto", "Upa" are associated with Fuel/Gas/Transportation (e.g., "Combustible", "Transporte", "Vehículo").
         - "Jumbo", "Lider", "Unimarc", "Tottus", "Santa Isabel" are supermarkets/groceries (e.g., "Supermercado", "Alimentos", "Comida", "Hogar").
         - "Enel", "Metrogas", "Aguas Andinas", "Gasco", "Abastible", "VTR", "Movistar", "Entel", "Claro" are utilities/services (e.g., "Servicios", "Servicios Básicos", "Gastos Fijos").
         - "Uber", "Cabify", "Didi", "Metro", "Bip" are transportation (e.g., "Transporte", "Viajes").
         - "Cornershop", "Rappi", "PedidosYa" are delivery/food (e.g., "Comida", "Supermercado", "Delivery").
      3. For any other merchant, use your general knowledge to determine its business type and map it to the closest matching category in the Available Categories list.
      4. Negative amounts are expenses, positive amounts are income.
      5. "sueldo" or similar categories are for salary/income transactions.

      Rules:
      - Return a valid JSON object where keys are the transaction indices as strings ("0", "1", "2"...) and values are the EXACT category names from the list.
      - Do NOT invent categories. Only use names from the Available Categories list.
      - Only return the JSON object, nothing else.
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "qwen/qwen3.6-27b",
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
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
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

export async function verifyAndCorrectTransactions(rawText: string, parsedData: any) {
  return enqueue(async () => {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const prompt = `
      You are an expert financial auditor. Your task is to verify and correct a list of transactions parsed from a PDF credit card statement (Lider Bci, Chile).
      
      We have extracted the raw text from the PDF, and did a first-pass programmatic parsing.
      However, the programmatic parsing might have missed something, or got a detail slightly wrong (like missing a transaction, getting a date wrong, or failing to parse installment purchases correctly).

      Here is the Raw PDF Text:
      """
      ${rawText}
      """

      Here is the First-Pass Parsed Data:
      ${JSON.stringify(parsedData, null, 2)}

      Please audit the transactions.
      Instructions:
      1. Carefully check the "DETALLE" section in the Raw PDF Text (especially under "1. Total Operaciones", "LIDER", "OTROS COMERCIOS", "2. Productos o Servicios Voluntariamente Contratados", and "3. Cargos / Comisiones, Impuestos / Abonos").
      2. Verify each transaction in the "First-Pass Parsed Data" against the Raw PDF Text:
         - Ensure the Date is correct (formatted as "YYYY-MM-DD" in the final output, e.g., "30/05/2026" becomes "2026-05-30").
         - Ensure the Amount is correct: Expenses should be negative numbers, income/abonos/descuentos should be positive numbers.
         - Ensure the Description is cleaned, includes the Lugar if applicable (e.g., "LA REINA HIPER LA REINA., SANTIAGO (T)"), and is readable.
         - For installment purchases (e.g. "TICKETMASTER TC 2... 01/03 $ 92.000"), the amount should reflect the charge of the month (e.g. -92000), not the total amount (e.g. 276000), and description should mention the installment (e.g. "SANTIAGO CL TICKETMASTER TC 2 0,00% (T) (Cuota 01/03)").
      3. Verify that ALL transactions in the statement are captured. If any transaction (including small taxes, commission fees, or credits) is present in the Raw PDF Text but missing in the First-Pass Parsed Data, ADD IT to the transactions list.
      4. Compare the sum of all transactions you parsed against the "Monto Total Facturado" or "Total" in the document if possible. The sum of all actual expense and income transactions for this period (e.g., Lider total + Otros Comercios total + Cargos/Impuestos total) should match the statement total.
      5. Return a JSON object with the audited and corrected data:
         {
           "billingPeriod": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
           "cardNumber": "string",
           "transactions": [
             {
               "date": "YYYY-MM-DD",
               "description": "string",
               "amount": number (integer, e.g. -141621),
               "type": "EXPENSE" | "INCOME"
             }
           ]
         }

      Ensure all transaction dates are converted to "YYYY-MM-DD" format.
      Only respond with the valid JSON object, nothing else.
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "openai/gpt-oss-120b",
      response_format: { type: "json_object" },
    });

    const content = chatCompletion.choices[0]?.message?.content;
    if (!content) return parsedData;

    return JSON.parse(content);
  }).catch(err => {
    console.error("Groq Verification Error (Queued):", err);
    return parsedData;
  });
}



