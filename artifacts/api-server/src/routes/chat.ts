import { Router } from "express";
import { SendChatBody } from "@workspace/api-zod";
import { processChatRequest } from "../services/chatService.js";

const router = Router();

router.post("/chat", async (req, res) => {
  try {
    const parsed = SendChatBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    // Extend timeout to 5 minutes to allow time for WebSocket human approval
    req.setTimeout(300_000);
    res.setTimeout(300_000);

    const result = await processChatRequest(parsed.data);
    res.json(result);
  } catch (err: any) {
    req.log.error({ err }, "Chat request failed");
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

router.post("/chat/stop", async (req, res) => {
  try {
    const { conversationId } = req.body;
    if (typeof conversationId !== "number") {
      res.status(400).json({ error: "Invalid conversationId" });
      return;
    }
    const { abortChatRequest } = await import("../services/chatService.js");
    const stopped = abortChatRequest(conversationId);
    if (stopped) {
      res.json({ message: "Execution stopped successfully" });
    } else {
      res.status(404).json({ error: "No active execution found for this conversation" });
    }
  } catch (err: any) {
    req.log.error({ err }, "Stop chat request failed");
    res.status(500).json({ error: "Unknown error" });
  }
});

export default router;
