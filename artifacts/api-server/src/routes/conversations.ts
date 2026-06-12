import { Router } from "express";
import {
  CreateConversationBody,
  GetConversationParams,
  DeleteConversationParams,
} from "@workspace/api-zod";
import * as conversationsService from "../services/conversationsService.js";

const router = Router();

router.get("/conversations", async (req, res) => {
  try {
    const list = await conversationsService.listConversations();
    res.json(list);
  } catch (err) {
    req.log.error({ err }, "Failed to list conversations");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/conversations", async (req, res) => {
  try {
    const parsed = CreateConversationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const conv = await conversationsService.createConversation(parsed.data.title);
    res.status(201).json(conv);
  } catch (err) {
    req.log.error({ err }, "Failed to create conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/conversations/:id", async (req, res) => {
  try {
    const params = GetConversationParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const conv = await conversationsService.getConversation(params.data.id);
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    res.json(conv);
  } catch (err) {
    req.log.error({ err }, "Failed to get conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/conversations/:id", async (req, res) => {
  try {
    const params = DeleteConversationParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    await conversationsService.deleteConversation(params.data.id);
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
