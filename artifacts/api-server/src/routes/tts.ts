import { Router } from "express";
import { db, settingsTable } from "@workspace/db";
import { SynthesizeSpeechBody } from "@workspace/api-zod";

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

    // Read Groq API key from DB — never exposed to frontend
    const rows = await db.select().from(settingsTable).limit(1);
    const settings = rows[0];
    if (!settings?.groqApiKey) {
      res.status(400).json({
        error: "Groq API key not configured. Please add it in Settings.",
      });
      return;
    }

    const { text, voice = "autumn", model = "canopylabs/orpheus-v1-english" } = parsed.data;

    const groqRes = await fetch("https://api.groq.com/openai/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: text,
        voice,
        response_format: "wav",
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      req.log.error({ status: groqRes.status, err: errText }, "Groq TTS error");
      res.status(500).json({ error: `TTS failed: ${errText}` });
      return;
    }

    // Stream the audio bytes back to the client
    const audioBuffer = Buffer.from(await groqRes.arrayBuffer());
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Length", audioBuffer.length);
    res.send(audioBuffer);
  } catch (err) {
    req.log.error({ err }, "TTS route error");
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
