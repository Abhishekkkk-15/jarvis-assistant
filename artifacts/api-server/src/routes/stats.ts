import { Router } from "express";
import * as statsService from "../services/statsService.js";

const router = Router();

router.get("/stats", async (req, res) => {
  try {
    const stats = await statsService.getStats();
    res.json(stats);
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
