import { Router } from "express";
import { TranscribeAudioBody } from "@workspace/api-zod";
import * as audioService from "../services/audioService.js";

const router = Router();

router.post("/transcribe", async (req, res) => {
  try {
    const parsed = TranscribeAudioBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const result = await audioService.transcribeAudio(parsed.data.audioBase64, parsed.data.mimeType);
    res.json(result);
  } catch (err: any) {
    req.log.error({ err }, "Transcription failed");
    if (err.message?.includes("not configured")) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message || "Unknown error" });
    }
  }
});

export default router;
