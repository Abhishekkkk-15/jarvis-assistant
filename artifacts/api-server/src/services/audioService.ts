import { db, settingsTable } from "@workspace/db";

export async function transcribeAudio(audioBase64: string, mimeType: string = "audio/webm") {
  const rows = await db.select().from(settingsTable).limit(1);
  const settings = rows[0];
  
  if (!settings?.groqApiKey) {
    throw new Error("Groq API key not configured. Please add it in Settings.");
  }

  const audioBuffer = Buffer.from(audioBase64, "base64");
  const boundary = `----FormBoundary${Date.now()}`;

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

  const parts: Buffer[] = [];
  const addField = (name: string, value: string) => {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    );
  };
  addField("model", "whisper-large-v3");
  addField("response_format", "json");

  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
    ),
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
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Transcription failed: ${errText}`);
  }

  const data = (await response.json()) as { text?: string };
  return { text: data.text ?? "", confidence: null };
}

export async function synthesizeSpeech(text: string, voice: string = "autumn", model: string = "canopylabs/orpheus-v1-english") {
  const rows = await db.select().from(settingsTable).limit(1);
  const settings = rows[0];
  if (!settings?.groqApiKey) {
    throw new Error("Groq API key not configured. Please add it in Settings.");
  }

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
    throw new Error(`TTS failed: ${errText}`);
  }

  const audioBuffer = Buffer.from(await groqRes.arrayBuffer());
  return audioBuffer;
}
