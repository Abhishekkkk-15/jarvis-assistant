import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { db, settingsTable } from "@workspace/db";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";

// Helper to get email settings and throw if missing
async function getEmailSettings() {
  const settingsRows = await db.select().from(settingsTable).limit(1);
  const settings = settingsRows[0];
  if (!settings) throw new Error("No settings found in database.");

  if (!settings.emailAddress || !settings.emailPassword || !settings.emailProvider) {
    throw new Error(
      "Email configuration is incomplete. Please set Email Address, App Password, and Provider in the Settings UI."
    );
  }

  const { emailAddress, emailPassword, emailProvider } = settings;

  let imapConfig = { host: "", port: 993, secure: true };
  let smtpConfig = { host: "", port: 465, secure: true };

  switch (emailProvider.toLowerCase()) {
    case "gmail":
      imapConfig.host = "imap.gmail.com";
      smtpConfig.host = "smtp.gmail.com";
      break;
    case "outlook":
    case "hotmail":
      imapConfig.host = "outlook.office365.com";
      smtpConfig.host = "smtp.office365.com";
      smtpConfig.port = 587;
      smtpConfig.secure = false; // upgraded later with STARTTLS
      break;
    case "yahoo":
      imapConfig.host = "imap.mail.yahoo.com";
      smtpConfig.host = "smtp.mail.yahoo.com";
      break;
    default:
      throw new Error(`Unsupported email provider: ${emailProvider}`);
  }

  return { emailAddress, emailPassword, imapConfig, smtpConfig };
}

async function withImapClient<T>(fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  const { emailAddress, emailPassword, imapConfig } = await getEmailSettings();
  const client = new ImapFlow({
    host: imapConfig.host,
    port: imapConfig.port,
    secure: imapConfig.secure,
    auth: { user: emailAddress, pass: emailPassword },
    logger: false as any,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout();
  }
}

export const emailTools = [
  // Send Email
  tool(
    async ({ to, subject, body, attachments }) => {
      try {
        const { emailAddress, emailPassword, smtpConfig } = await getEmailSettings();

        const transporter = nodemailer.createTransport({
          host: smtpConfig.host,
          port: smtpConfig.port,
          secure: smtpConfig.secure,
          auth: {
            user: emailAddress,
            pass: emailPassword,
          },
        });

        const info = await transporter.sendMail({
          from: emailAddress,
          to,
          subject,
          text: body,
          attachments: attachments?.map((p) => ({ path: p })),
        });

        return `Email successfully sent to ${to}${attachments?.length ? ` with ${attachments.length} attachment(s)` : ""}. Message ID: ${info.messageId}`;
      } catch (err: any) {
        return `Failed to send email: ${err.message}`;
      }
    },
    {
      name: "send_email",
      description: "Send an email to a specific address using the user's configured email account. Always ask for the body and subject if not provided.",
      schema: z.object({
        to: z.string().email().describe("The recipient's email address"),
        subject: z.string().describe("The subject of the email"),
        body: z.string().describe("The plain text body content of the email"),
        attachments: z.array(z.string()).optional().describe("Absolute file paths to attach to the email."),
      }),
    }
  ),

  // Read Recent Emails
  tool(
    async ({ limit, unreadOnly }) => {
      try {
        const results = await withImapClient(async (client) => {
          const lock = await client.getMailboxLock("INBOX");
          try {
            const searchCriteria = unreadOnly ? { seen: false } : { all: true };
            const messages = await client.fetch(searchCriteria, {
              uid: true,
              envelope: true,
              source: false,
            }, { uid: true });

            const msgsArray = [];
            for await (let msg of messages) {
              msgsArray.push(msg);
            }

            msgsArray.sort((a, b) => (b.envelope?.date?.getTime() ?? 0) - (a.envelope?.date?.getTime() ?? 0));
            const limited = msgsArray.slice(0, limit);

            return limited.map((msg) => {
              const subject = msg.envelope?.subject || "(No Subject)";
              const from = msg.envelope?.from ? msg.envelope.from.map(f => f.address).join(", ") : "Unknown";
              const date = msg.envelope?.date ? msg.envelope.date.toLocaleString() : "Unknown";
              // Note: this only returns metadata to keep token count low. Use read_email_body for full content.
              return `[UID: ${msg.uid}] From: ${from} | Date: ${date} | Subject: ${subject}`;
            });
          } finally {
            lock.release();
          }
        });

        if (results.length === 0) return "No emails found matching the criteria.";
        return results.join("\n");
      } catch (err: any) {
        return `Failed to read emails: ${err.message}`;
      }
    },
    {
      name: "read_recent_emails",
      description: "Read the most recent emails from the user's INBOX. Returns metadata (sender, subject, date, UID) of the emails. Use read_email_body to get the full text of a specific email.",
      schema: z.object({
        limit: z.number().default(5).describe("Maximum number of emails to retrieve (max 20)"),
        unreadOnly: z.boolean().default(true).describe("If true, only fetches unread emails"),
      }),
    }
  ),

  // Read full email body
  tool(
    async ({ uid }) => {
      try {
        return await withImapClient(async (client) => {
          const lock = await client.getMailboxLock("INBOX");
          try {
            const msg = await client.fetchOne(String(uid), { source: true, envelope: true }, { uid: true });
            if (!msg || !msg.source) {
              return `No email found with UID ${uid}.`;
            }
            const { simpleParser } = await import("mailparser");
            const parsed = await simpleParser(msg.source);
            const subject = parsed.subject || msg.envelope?.subject || "(No Subject)";
            const from = parsed.from?.text || "Unknown";
            const bodyText = (parsed.text || "").trim();
            const truncated = bodyText.length > 6000 ? `${bodyText.substring(0, 6000)}\n...(truncated)` : bodyText;
            return `From: ${from}\nSubject: ${subject}\n\n${truncated || "(empty body)"}`;
          } finally {
            lock.release();
          }
        });
      } catch (err: any) {
        return `Failed to read email body: ${err.message}`;
      }
    },
    {
      name: "read_email_body",
      description: "Read the full text body of a specific email by its UID (from read_recent_emails or email_search).",
      schema: z.object({
        uid: z.number().describe("The email UID from read_recent_emails or email_search."),
      }),
    }
  ),

  // Search emails
  tool(
    async ({ query, field, limit }) => {
      try {
        const results = await withImapClient(async (client) => {
          const lock = await client.getMailboxLock("INBOX");
          try {
            const criteria: any =
              field === "from" ? { from: query } : field === "body" ? { body: query } : { subject: query };
            const messages = await client.fetch(criteria, { uid: true, envelope: true }, { uid: true });

            const msgsArray = [];
            for await (const msg of messages) msgsArray.push(msg);
            msgsArray.sort((a, b) => (b.envelope?.date?.getTime() ?? 0) - (a.envelope?.date?.getTime() ?? 0));

            return msgsArray.slice(0, limit).map((msg) => {
              const subject = msg.envelope?.subject || "(No Subject)";
              const from = msg.envelope?.from ? msg.envelope.from.map((f: any) => f.address).join(", ") : "Unknown";
              const date = msg.envelope?.date ? msg.envelope.date.toLocaleString() : "Unknown";
              return `[UID: ${msg.uid}] From: ${from} | Date: ${date} | Subject: ${subject}`;
            });
          } finally {
            lock.release();
          }
        });

        if (results.length === 0) return `No emails found matching "${query}" in ${field}.`;
        return results.join("\n");
      } catch (err: any) {
        return `Failed to search emails: ${err.message}`;
      }
    },
    {
      name: "email_search",
      description: "Search the user's INBOX for emails by sender, subject, or body text.",
      schema: z.object({
        query: z.string().describe("The text to search for."),
        field: z.enum(["from", "subject", "body"]).default("subject").describe("Which field to search in."),
        limit: z.number().default(10).describe("Maximum number of results."),
      }),
    }
  ),
];
