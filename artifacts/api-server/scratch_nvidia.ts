import { db, settingsTable } from "@workspace/db";
import fetch from "node-fetch";

async function testNvidia() {
  const rows = await db.select().from(settingsTable).limit(1);
  const apiKey = rows[0]?.nvidiaApiKey;
  
  if (!apiKey) {
    console.error("No NVIDIA_API_KEY in db");
    process.exit(1);
  }

  const payload = {
    model: "microsoft/phi-4-multimodal-instruct",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "What is this image?" },
          {
            type: "image_url",
            image_url: {
              url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
            }
          }
        ]
      }
    ],
    max_tokens: 1024,
    temperature: 0
  };

  console.log("Sending payload...");
  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  console.log("Status:", response.status);
  console.log("Response:", text);
  process.exit(0);
}

testNvidia();
