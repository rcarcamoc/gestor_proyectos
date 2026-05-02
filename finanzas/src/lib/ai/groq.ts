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
        "date": string (ISO 8601),
        "description": string (merchant or person),
        "category": string (must be one of the available categories),
        "confidence": number (0 to 1)
      }
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-70b-8192",
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
      Categorize the following financial transactions.
      Available Categories: [${categoryList}]

      Transactions:
      ${transactionList}

      Return a valid JSON object where keys are the indices (0, 1, 2...) and values are the EXACT category names from the available list.
      Only return the JSON.
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

