import { db, sqlite, settingsTable, setupDb } from "./src/index.js";
import * as sqliteVec from "sqlite-vec";

async function run() {
  console.log("Setting up DB...");
  setupDb();
  
  console.log("sqlite-vec version:", sqlite.prepare("select vec_version() as v").get());

  console.log("Inserting a setting...");
  const res = db.insert(settingsTable).values({
    selectedModel: "llama-3.3-70b-versatile",
  }).returning().get();
  console.log("Inserted setting:", res);

  console.log("Inserting vector...");
  sqlite.exec(`
    INSERT INTO vec_embeddings(rowid, embedding)
    VALUES (1, '[-0.1, 0.2, 0.3]');
  `);

  console.log("Querying vector...");
  const vec = sqlite.prepare(`
    SELECT rowid, distance
    FROM vec_embeddings
    WHERE embedding MATCH '[-0.1, 0.2, 0.3]'
    ORDER BY distance
    LIMIT 1
  `).get();
  console.log("Vector match:", vec);

  console.log("Test complete.");
}

run().catch(console.error);
