import fetch from "node-fetch";

async function testNvidia() {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    console.error("Please set NVIDIA_API_KEY");
    return;
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
    max_tokens: 4096,
    temperature: 0
  };

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
}

testNvidia();
