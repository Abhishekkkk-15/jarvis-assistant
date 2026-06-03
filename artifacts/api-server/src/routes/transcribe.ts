import { Router } from "express";
import { db, settingsTable } from "@workspace/db";
import { TranscribeAudioBody } from "@workspace/api-zod";

const router = Router();

router.post("/transcribe", async (req, res) => {
  try {
    const parsed = TranscribeAudioBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    // Get Groq API key from settings
    const rows = await db.select().from(settingsTable).limit(1);
    const settings = rows[0];
    if (!settings?.groqApiKey) {
      res.status(400).json({
        error: "Groq API key not configured. Please add it in Settings.",
      });
      return;
    }

    // Decode base64 audio
    const audioBuffer = Buffer.from(parsed.data.audioBase64, "base64");

    // Build multipart form data for Groq Whisper API
    const boundary = `----FormBoundary${Date.now()}`;
    const mimeType = parsed.data.mimeType || "audio/webm";

    // Determine file extension from mime type
    const extMap: Record<string, string> = {
      "audio/webm": "webm",
      "audio/wav": "wav",
      "audio/mp4": "mp4",
      "audio/mpeg": "mp3",
      "audio/ogg": "ogg",
      "audio/flac": "flac",
    };
    const ext = extMap[mimeType] ?? "webm";
    const filename = `audio.${ext}`;

    // Build multipart body manually
    const parts: Buffer[] = [];
    const addField = (name: string, value: string) => {
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
        )
      );
    };
    addField("model", "whisper-large-v3");
    addField("response_format", "json");

    // File part
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
      )
    );
    parts.push(audioBuffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    const response = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.groqApiKey}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": String(body.length),
        },
        body,
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      req.log.error({ status: response.status, err: errText }, "Groq Whisper error");
      res.status(500).json({ error: `Transcription failed: ${errText}` });
      return;
    }

    const data = (await response.json()) as { text?: string };
    res.json({ text: data.text ?? "", confidence: null });
  } catch (err) {
    req.log.error({ err }, "Transcription failed");
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
