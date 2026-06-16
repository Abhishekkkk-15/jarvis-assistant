import { Router } from "express";
import { SendChatBody } from "@workspace/api-zod";
import { processChatRequest, processChatRequestStream, abortChatRequest } from "../services/chatService.js";

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

router.post("/chat/stream", async (req, res) => {
  const parsed = SendChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  req.setTimeout(300_000);
  res.setTimeout(300_000);

  let conversationId: number | null = parsed.data.conversationId ?? null;
  let clientClosed = false;

  req.on("close", () => {
    clientClosed = true;
    if (conversationId) abortChatRequest(conversationId);
  });

  try {
    const stream = processChatRequestStream(parsed.data);
    for await (const event of stream) {
      if (clientClosed) break;
      const payload = event as any;
      if (payload.type === "started" && payload.conversationId) {
        conversationId = payload.conversationId;
      }
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (err: any) {
    if (!clientClosed) {
      res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
    }
  } finally {
    if (!clientClosed) res.end();
  }
});

router.post("/chat/stop", async (req, res) => {
  try {
    const { conversationId } = req.body;
    if (typeof conversationId !== "number") {
      res.status(400).json({ error: "Invalid conversationId" });
      return;
    }
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
