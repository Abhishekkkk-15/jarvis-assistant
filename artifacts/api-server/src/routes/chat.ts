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

    const result = await processChatRequest(parsed.data);
    res.json(result);
  } catch (err: any) {
    req.log.error({ err }, "Chat request failed");
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
