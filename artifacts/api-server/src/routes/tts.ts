import { Router } from "express";
import { SynthesizeSpeechBody } from "@workspace/api-zod";
import * as audioService from "../services/audioService.js";

const router = Router();

/**
 * POST /tts
 * Proxies a TTS request to Groq's speech synthesis endpoint using the
 * server-stored Groq API key. Returns raw audio/wav binary data.
 */
router.post("/tts", async (req, res) => {
  try {
    const parsed = SynthesizeSpeechBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
      return;
    }

    const { text, voice = "autumn", model = "canopylabs/orpheus-v1-english" } = parsed.data;

    const audioBuffer = await audioService.synthesizeSpeech(text, voice, model);

    // Stream the audio bytes back to the client
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Length", audioBuffer.length);
    res.send(audioBuffer);
  } catch (err: any) {
    req.log.error({ err }, "TTS route error");
    if (err.message?.includes("not configured")) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message || "Unknown error" });
    }
  }
});

export default router;
