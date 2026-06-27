import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

// Load environment variables from .env
dotenv.config();

const execFileAsync = promisify(execFile);

// Temporarily mock console.log to avoid debug messages clogging JSON output
import { verifyAndCorrectTransactions } from "../src/lib/ai/groq";

async function run() {
  const pdfPath = "c:\\Users\\arant\\OneDrive\\Desarrollo\\portal\\estado de cuenta lider.pdf";
  const password = "2851";

  console.log("1. Running Python parser on PDF...");
  const scriptPath = path.join(process.cwd(), "src", "services", "lider.py");
  const { stdout, stderr } = await execFileAsync("python", [scriptPath, pdfPath, password]);

  if (stderr) {
    console.error("Python Stderr:", stderr);
  }

  const result = JSON.parse(stdout);
  if (!result.success) {
    console.error("Python parsing failed:", result.error);
    return;
  }

  console.log("First-pass parsing successful.");
  console.log(`Extracted billing period: ${JSON.stringify(result.billingPeriod)}`);
  console.log(`Extracted card number: ${result.cardNumber}`);
  console.log(`Extracted transactions count: ${result.transactions.length}`);

  console.log("2. Running Groq AI verification...");
  const verified = await verifyAndCorrectTransactions(result.rawText, {
    billingPeriod: result.billingPeriod,
    cardNumber: result.cardNumber,
    transactions: result.transactions
  });

  console.log("AI Verification completed!");
  console.log("Verified Billing Period:", verified.billingPeriod);
  console.log("Verified Transactions count:", verified.transactions.length);
  console.log("First few verified transactions:");
  console.log(JSON.stringify(verified.transactions.slice(0, 5), null, 2));

  // Save verified output
  fs.writeFileSync("scratch/verified_output.json", JSON.stringify(verified, null, 2));
  console.log("Saved full verified output to scratch/verified_output.json");
}

run().catch(console.error);
