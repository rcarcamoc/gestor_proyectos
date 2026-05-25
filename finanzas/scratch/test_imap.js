const { ImapFlow } = require('imapflow');

async function testImap() {
  const client = new ImapFlow({
    host: 'mail.recc.001webhospedaje.com',
    port: 993,
    secure: true,
    auth: {
      user: 'recibemail@recc.001webhospedaje.com',
      pass: 'chuchuG@to'
    },
    logger: false // Set to true for verbose IMAP protocol logs
  });

  console.log("Connecting to IMAP mail.recc.001webhospedaje.com:993...");
  try {
    await client.connect();
    console.log("✅ Successfully connected and authenticated!");

    // List mailboxes
    const mailboxes = await client.list();
    console.log("Available mailboxes:", mailboxes.map(m => m.path));

    // Select INBOX
    let lock = await client.getMailboxLock('INBOX');
    try {
      console.log("Mailbox status:", {
        exists: client.mailbox.exists,
        unseen: client.mailbox.unseen
      });

      // Search for all messages (or unseen)
      const messages = await client.search({ unseen: false });
      console.log(`Found ${messages.length} messages in INBOX.`);

      if (messages.length > 0) {
        console.log("Fetching headers of the last 3 messages...");
        const lastMessages = messages.slice(-3);
        for (const seq of lastMessages) {
          const msg = await client.fetchOne(seq, { envelope: true });
          console.log(`- Date: ${msg.envelope.date}, Subject: "${msg.envelope.subject}", From: ${msg.envelope.from.map(f => f.address).join(', ')}`);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
    console.log("Logged out successfully.");
  } catch (err) {
    console.error("❌ IMAP Connection Error:", err);
  }
}

testImap();
