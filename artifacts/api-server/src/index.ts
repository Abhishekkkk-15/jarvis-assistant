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

import { setupDb } from "@workspace/db";
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

server.listen(port, () => {
  logger.info({ port }, "Server listening (HTTP + WebSocket)");
  initializeScheduler();
  integrationsManager.start();
});
