import http from "http";
import { WebSocketServer } from "ws";
import app from "./app";
import { logger } from "./lib/logger";
import { setupWsManager } from "./lib/wsManager";
import { initializeScheduler } from "./lib/scheduler.js";
import { integrationsManager } from "./lib/integrations/manager.js";
let rawPort = process.env["PORT"];

if (!rawPort) {
  rawPort = "4000"
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
setupWsManager(wss);

export const getWss = () => wss;

server.listen(port, () => {
  logger.info({ port }, "Server listening (HTTP + WebSocket)");
  initializeScheduler();
  integrationsManager.start();
});
