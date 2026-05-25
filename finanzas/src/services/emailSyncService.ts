import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/prisma";
import { extractTransactionFromEmail } from "@/lib/ai/groq";
import { findDuplicate } from "@/lib/deduplication";
import { formatBillingPeriod } from "@/lib/utils";

export interface SyncResult {
  success: boolean;
  emailsRead: number;
  importedCount: number;
  error?: string;
}

export async function syncEmailAccount(emailAccountId: string): Promise<SyncResult> {
  const emailAccount = await prisma.emailAccount.findUnique({
    where: { id: emailAccountId },
    include: {
      account: true
    }
  });

  if (!emailAccount) {
    return { success: false, emailsRead: 0, importedCount: 0, error: "Email account configuration not found" };
  }

  const client = new ImapFlow({
    host: emailAccount.host,
    port: emailAccount.port,
    secure: emailAccount.secure,
    auth: {
      user: emailAccount.email,
      pass: emailAccount.password
    },
    logger: false
  });

  let emailsRead = 0;
  let importedCount = 0;
  const uidsToMarkAsRead: number[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      // Find all unread messages
      const messages = await client.search({ unseen: true });
      emailsRead = messages.length;

      for (const seq of messages) {
        // Fetch raw mail source and its UID
        const emailSource = await client.fetchOne(seq, { source: true, uid: true });
        if (!emailSource || !emailSource.source) continue;

        const parsed = await simpleParser(emailSource.source);
        const subject = parsed.subject || '';
        const bodyText = parsed.text || parsed.html || '';
        const messageId = parsed.messageId || `email-seq-${seq}-${Date.now()}`;
        const emailDate = parsed.date || new Date();

        // Process the transaction using Groq extraction
        const wasImported = await processEmailTransaction({
          bodyText,
          subject,
          messageId,
          date: emailDate,
          emailAccount
        });

        if (wasImported) {
          importedCount++;
        }

        if (emailSource.uid) {
          uidsToMarkAsRead.push(emailSource.uid);
        }
      }
    } finally {
      lock.release();
    }

    // Mark processed emails as read
    if (uidsToMarkAsRead.length > 0) {
      await client.messageFlagsAdd(uidsToMarkAsRead, ['\\Seen'], { uid: true });
    }

    await client.logout();

    // Update last sync date
    await prisma.emailAccount.update({
      where: { id: emailAccountId },
      data: { lastSync: new Date() }
    });

    return {
      success: true,
      emailsRead,
      importedCount
    };
  } catch (err: any) {
    console.error("Email Sync Error:", err);
    try {
      await client.logout();
    } catch (_) {}
    return {
      success: false,
      emailsRead: 0,
      importedCount: 0,
      error: err.message || "Failed to connect to email server"
    };
  }
}

async function processEmailTransaction({
  bodyText,
  subject,
  messageId,
  date,
  emailAccount
}: {
  bodyText: string;
  subject: string;
  messageId: string;
  date: Date;
  emailAccount: any;
}): Promise<boolean> {
  try {
    // Fetch categories relevant for user/household
    const categories = await prisma.category.findMany({
      where: {
        OR: [
          { userId: emailAccount.userId },
          { householdId: emailAccount.account.householdId },
          { isDefault: true }
        ]
      }
    });

    // Call Groq LLM extraction
    const extracted = await extractTransactionFromEmail(bodyText, categories.map(c => c.name));
    if (!extracted || extracted.confidence < 0.5) {
      console.log(`[Email Sync] Low confidence or failed extraction for message ID: ${messageId}`);
      return false;
    }

    // Determine category
    const category = categories.find(
      c => c.name.toLowerCase() === extracted.category.toLowerCase()
    );

    // Apply Credit Card vs Standard account sign conventions (Android methodology)
    let txType: string;
    let finalAmount: number;

    if (emailAccount.account.type === 'CREDIT_CARD') {
      txType = 'EXPENSE';
      // In BCI email notifications:
      // Purchases (expenses) are extracted as negative. We save them as positive GASTO.
      // Abonos/refunds are extracted as positive. We save them as negative GASTO.
      finalAmount = extracted.amount < 0 ? Math.abs(extracted.amount) : -Math.abs(extracted.amount);
    } else {
      txType = extracted.amount < 0 ? 'EXPENSE' : 'INCOME';
      finalAmount = Math.abs(extracted.amount);
    }

    const txDate = new Date(extracted.date || date);
    const validDate = isNaN(txDate.getTime()) ? date : txDate;

    // Check duplicates
    const duplicate = await findDuplicate({
      amount: finalAmount,
      date: validDate,
      description: extracted.description || subject,
      externalId: messageId,
      accountId: emailAccount.accountId
    });

    if (duplicate?.type === 'EXACT') {
      console.log(`[Email Sync] Duplicate found for message ID: ${messageId}`);
      return false;
    }

    const isProbable = duplicate?.type === 'PROBABLE';
    const status = isProbable ? 'PENDING_REVIEW' : 'CONFIRMED';

    // Create the transaction and update account balance inside a prisma transaction
    await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          amount: finalAmount,
          currency: extracted.currency || emailAccount.account.currency || 'CLP',
          date: validDate,
          type: txType as any,
          description: extracted.description || subject,
          source: 'EMAIL',
          status: status as any,
          categorySource: 'groq',
          aiConfidence: extracted.confidence,
          accountId: emailAccount.accountId,
          categoryId: category?.id || null,
          userId: emailAccount.userId,
          userId_internal: emailAccount.userId,
          householdId: emailAccount.account.householdId,
          externalId: messageId,
          billingPeriod: formatBillingPeriod(validDate),
          metadata: {
            emailSubject: subject,
            groqExtraction: extracted,
            duplicate_type: isProbable ? 'PROBABLE' : null
          }
        }
      });

      // Update account balance
      const multiplier = txType === 'INCOME' ? 1 : -1;
      await tx.account.update({
        where: { id: emailAccount.accountId },
        data: {
          balance: {
            increment: finalAmount * multiplier
          }
        }
      });
    });

    return true;
  } catch (err) {
    console.error(`Failed to process email transaction ${messageId}:`, err);
    return false;
  }
}
