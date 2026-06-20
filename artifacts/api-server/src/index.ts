import "./polyfill.js";
import http from "http";
import { WebSocketServer } from "ws";
import app from "./app";
import { logger } from "./config/logger";
import { setupWsManager } from "./lib/wsManager";
import { initializeScheduler } from "./lib/scheduler.js";
import { integrationsManager } from "./integrations/manager.js";
let rawPort = process.env["PORT"];

if (!rawPort) {
  rawPort = "4444"
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

import { db, settingsTable, setupDb } from "@workspace/db";
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
setupWsManager(wss);

try {
  setupDb();
  logger.info("Database setup complete. Tables initialized.");
} catch (e) {
  logger.error(e, "Failed to setup database tables");
}

export const getWss = () => wss;

async function runStartupNotification() {
  try {
    const rows = await db.select().from(settingsTable).limit(1);
    if (rows.length === 0) return;
    const settings = rows[0];

    if (settings.startupNotificationEnabled && settings.telegramChatId && settings.telegramBotToken) {
      logger.info("Startup notification enabled. Triggering in 5s...");
      
      setTimeout(async () => {
        try {
          const res = await fetch(`http://127.0.0.1:${port}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: `[System Event: System Booted]\n\n${settings.startupNotificationPrompt}`
            })
          });
          const text = await res.text();
          let data: any = {};
          try { data = JSON.parse(text); } catch { /* ignore */ }
          
          if (data.reply) {
            const telegram = integrationsManager.getTelegram();
            if (telegram) {
              await telegram.sendMessage(Number(settings.telegramChatId), `🌅 **System Startup Briefing**\n\n${data.reply}`);
            }
          }
        } catch (err) {
          logger.error(err, "Failed to run startup notification");
        }
      }, 5000);
    }
  } catch (err) {
    logger.error(err, "Failed to check startup notification settings");
  }
}

server.listen(port, () => {
  logger.info({ port }, "Server listening (HTTP + WebSocket)");
  initializeScheduler();
  integrationsManager.start();
  runStartupNotification();
});
