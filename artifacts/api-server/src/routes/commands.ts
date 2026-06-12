import { Router } from "express";
import { ExecuteCommandBody } from "@workspace/api-zod";
import { z } from "zod";
import * as commandsService from "../services/commandsService.js";

const router = Router();

router.post("/commands/approval", (req, res) => {
  const schema = z.object({
    requestId: z.string(),
    decision: z.enum(["approved", "denied"])
  });
  
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  
  const success = commandsService.handleCommandApproval(parsed.data.requestId, parsed.data.decision);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Approval request not found or expired" });
  }
});

router.get("/commands/suggestions", async (_req, res) => {
  res.json(commandsService.COMMAND_CATEGORIES);
});

router.post("/commands/execute", async (req, res) => {
  try {
    const parsed = ExecuteCommandBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const { type, payload } = parsed.data;
    const result = await commandsService.executeCommand(type, payload);

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Command execution failed");
    res.status(500).json({ error: "Command failed" });
  }
});

export default router;
