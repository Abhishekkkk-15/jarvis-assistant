import { Router } from "express";
import { UpdateSettingsBody } from "@workspace/api-zod";
import * as settingsService from "../services/settingsService.js";

const router = Router();

router.get("/settings", async (req, res) => {
  try {
    const settingsResponse = await settingsService.getSettingsResponse();
    res.json(settingsResponse);
  } catch (err) {
    req.log.error({ err }, "Failed to get settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/settings", async (req, res) => {
  try {
    const parsed = UpdateSettingsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const updatedResponse = await settingsService.updateSettings(parsed.data);
    res.json(updatedResponse);
  } catch (err) {
    req.log.error({ err }, "Failed to update settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
