const https = require("https");
const Database = require("better-sqlite3");

function getNvidiaKey() {
  const db = new Database("../../sqlite.db");
  const row = db.prepare("SELECT * FROM settings LIMIT 1").get();
  db.close();
  return row?.nvidia_api_key;
}

async function run() {
  const apiKey = getNvidiaKey();
  if (!apiKey) {
    console.error("No NVIDIA_API_KEY found in DB.");
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
    max_tokens: 1024,
    temperature: 0
  };

  const data = JSON.stringify(payload);

  const options = {
    hostname: "integrate.api.nvidia.com",
    port: 443,
    path: "/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Content-Length": data.length,
      "Accept": "application/json"
    }
  };

  const req = https.request(options, (res) => {
    let body = "";
    res.on("data", (chunk) => { body += chunk; });
    res.on("end", () => {
      console.log("Status:", res.statusCode);
      console.log("Headers:", res.headers);
      console.log("Body:", body);
    });
  });

  req.on("error", (e) => {
    console.error("Request Error:", e);
  });

  req.write(data);
  req.end();
}

run();
