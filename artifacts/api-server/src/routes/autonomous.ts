import { Router } from "express";
import * as autonomousService from "../services/autonomousService.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { context, persona = "Friendly" } = req.body;
    
    if (!context) {
      return res.status(400).json({ error: "Context is required" });
    }

    const content = await autonomousService.processAutonomousAction(context, persona);
    
    res.json({ message: content });
  } catch (error: any) {
    console.error("Autonomous loop error:", error);
    if (error.message === "API Key not configured in Settings") {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Failed to generate autonomous action" });
    }
  }
});

export { router as autonomousRouter };
