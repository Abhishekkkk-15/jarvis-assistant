import http from "http";
import { WebSocketServer } from "ws";
import app from "./app";
import { logger } from "./lib/logger";
import { setupWsManager } from "./lib/wsManager";

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

server.listen(port, () => {
  logger.info({ port }, "Server listening (HTTP + WebSocket)");
});
