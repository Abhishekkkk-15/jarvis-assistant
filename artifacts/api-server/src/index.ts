import http from "http";
import { WebSocketServer } from "ws";
import app from "./app";
import { logger } from "./lib/logger";
import { setupWsManager } from "./lib/wsManager";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
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
