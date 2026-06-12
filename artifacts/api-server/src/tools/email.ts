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

export const emailTools = [
  // Send Email
  tool(
    async ({ to, subject, body }) => {
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
        });

        return `Email successfully sent to ${to}. Message ID: ${info.messageId}`;
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
      }),
    }
  ),

  // Read Recent Emails
  tool(
    async ({ limit, unreadOnly }) => {
      try {
        const { emailAddress, emailPassword, imapConfig } = await getEmailSettings();

        const client = new ImapFlow({
          host: imapConfig.host,
          port: imapConfig.port,
          secure: imapConfig.secure,
          auth: {
            user: emailAddress,
            pass: emailPassword,
          },
          logger: false as any,
        });

        await client.connect();

        const lock = await client.getMailboxLock("INBOX");
        const results = [];

        try {
          const searchCriteria = unreadOnly ? { seen: false } : { all: true };
          // Fetch the latest sequences
          const messages = await client.fetch(searchCriteria, {
            uid: true,
            envelope: true,
            source: false,
          }, { uid: true });

          // ImapFlow streams the fetch, we need to convert to array and slice
          const msgsArray = [];
          for await (let msg of messages) {
            msgsArray.push(msg);
          }

          // Sort by date descending and take limit
          msgsArray.sort((a, b) => b.envelope.date.getTime() - a.envelope.date.getTime());
          const limited = msgsArray.slice(0, limit);

          for (const msg of limited) {
            const subject = msg.envelope.subject || "(No Subject)";
            const from = msg.envelope.from ? msg.envelope.from.map(f => f.address).join(", ") : "Unknown";
            const date = msg.envelope.date ? msg.envelope.date.toLocaleString() : "Unknown";
            
            // Note: to get the body we would need to fetch the body parts, which is complex.
            // For a basic overview tool, we just return the metadata to keep token count low.
            results.push(`[UID: ${msg.uid}] From: ${from} | Date: ${date} | Subject: ${subject}`);
          }
        } finally {
          lock.release();
        }

        await client.logout();

        if (results.length === 0) return "No emails found matching the criteria.";
        return results.join("\n");
      } catch (err: any) {
        return `Failed to read emails: ${err.message}`;
      }
    },
    {
      name: "read_recent_emails",
      description: "Read the most recent emails from the user's INBOX. Returns metadata (sender, subject, date, UID) of the emails.",
      schema: z.object({
        limit: z.number().default(5).describe("Maximum number of emails to retrieve (max 20)"),
        unreadOnly: z.boolean().default(true).describe("If true, only fetches unread emails"),
      }),
    }
  ),
];
