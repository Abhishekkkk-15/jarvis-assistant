import { db, settingsTable } from "@workspace/db";

// Get the underlying better-sqlite3 client from Drizzle's $client property
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getSqlite = () => (db as any).$client as any;

export async function generateEmbedding(text: string, inputType: "passage" | "query" = "passage"): Promise<Float32Array> {
  const rows = await db.select().from(settingsTable).limit(1);
  const settings = rows[0] ?? null;

  if (!settings?.nvidiaApiKey) {
    throw new Error("Nvidia API key is not configured in settings. Cannot generate embeddings.");
  }

  const response = await fetch('https://integrate.api.nvidia.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.nvidiaApiKey}`
    },
    body: JSON.stringify({
      input: [text],
      model: "nvidia/nv-embedqa-e5-v5",
      input_type: inputType,
      encoding_format: "float"
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate embedding: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as { data: Array<{ embedding: number[] }> };
  const embedding = data.data[0].embedding;
  return new Float32Array(embedding);
}

export async function saveMemory(textContent: string, metadata: string = ""): Promise<number> {
  const raw = getSqlite();

  // Ensure tables are set up (idempotent)
  raw.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(
      embedding float[1024]
    );
    CREATE TABLE IF NOT EXISTS document_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text_content TEXT NOT NULL,
      metadata TEXT
    );
  `);

  const embedding = await generateEmbedding(textContent);

  const insertChunk = raw.prepare(`
    INSERT INTO document_chunks (text_content, metadata) 
    VALUES (?, ?)
  `);

  const insertVec = raw.prepare(`
    INSERT INTO vec_embeddings (rowid, embedding)
    VALUES (?, ?)
  `);

  let newId: bigint = 0n;
  const transaction = raw.transaction(() => {
    const info = insertChunk.run(textContent, metadata);
    newId = BigInt(info.lastInsertRowid);
    insertVec.run(newId, new Uint8Array(embedding.buffer));
  });

  transaction();
  return Number(newId);
}

export async function searchMemory(query: string, limit: number = 3) {
  const raw = getSqlite();
  const queryEmbedding = await generateEmbedding(query, "query");

  const searchStmt = raw.prepare(`
    SELECT 
      d.id, 
      d.text_content, 
      d.metadata,
      vec_distance_cosine(v.embedding, ?) as distance
    FROM vec_embeddings v
    JOIN document_chunks d ON v.rowid = d.id
    ORDER BY distance ASC
    LIMIT ?
  `);

  return searchStmt.all(new Uint8Array(queryEmbedding.buffer), limit) as Array<{
    id: number;
    text_content: string;
    metadata: string;
    distance: number;
  }>;
}

export function listAllMemories() {
  const raw = getSqlite();
  const stmt = raw.prepare(`
    SELECT id, text_content, metadata
    FROM document_chunks
    ORDER BY id DESC
  `);
  return stmt.all() as Array<{ id: number; text_content: string; metadata: string }>;
}

export function forgetMemory(id: number) {
  const raw = getSqlite();
  raw.transaction(() => {
    raw.prepare(`DELETE FROM document_chunks WHERE id = ?`).run(id);
    raw.prepare(`DELETE FROM vec_embeddings WHERE rowid = ?`).run(BigInt(id));
  })();
}
