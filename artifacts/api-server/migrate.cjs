const Database = require("better-sqlite3");

const db = new Database("../../sqlite.db");

try {
  db.prepare("ALTER TABLE settings ADD COLUMN vision_model text NOT NULL DEFAULT 'llama-3.2-90b-vision-preview'").run();
  console.log("Added vision_model column.");
} catch (e) {
  console.error("Error adding vision_model:", e.message);
}

try {
  db.prepare("ALTER TABLE settings ADD COLUMN vision_provider text NOT NULL DEFAULT 'groq'").run();
  console.log("Added vision_provider column.");
} catch (e) {
  console.error("Error adding vision_provider:", e.message);
}

db.close();
