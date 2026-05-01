import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function extractTransactionFromEmail(text: string, categories: string[]) {
  const prompt = `
    Extract financial transaction details from the following bank notification email text.
    Return a valid JSON object.

    Email Text:
    """
    \${text}
    """

    Available Categories: [\${categories.join(", ")}]

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

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-70b-8192",
      response_format: { type: "json_object" },
    });

    const content = chatCompletion.choices[0]?.message?.content;
    if (!content) return null;

    return JSON.parse(content);
  } catch (error) {
    console.error("Groq AI Error:", error);
    return null;
  }
}

export async function categorizeTransactionsBatch(
  transactions: { description: string; amount: number }[],
  categories: { id: string; name: string }[]
) {
  const categoryList = categories.map(c => c.name).join(", ");
  const transactionList = transactions.map((t, i) => `\${i}: \${t.description} (\${t.amount})`).join("\n");

  const prompt = `
    Categorize the following financial transactions.
    Available Categories: [\${categoryList}]

    Transactions:
    \${transactionList}

    Return a valid JSON object where keys are the indices (0, 1, 2...) and values are the EXACT category names from the available list.
    Only return the JSON.
  `;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.1-8b-instant", // Using a faster model for simple categorization
      response_format: { type: "json_object" },
    });

    const content = chatCompletion.choices[0]?.message?.content;
    if (!content) return {};

    return JSON.parse(content);
  } catch (error) {
    console.error("Groq Batch Categorization Error:", error);
    return {};
  }
}

