import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import * as schema from "./schema";
import { config } from "dotenv"
config()

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const sqlite = new Database(process.env.DATABASE_URL.replace("file:", ""));
sqliteVec.load(sqlite);
export const db = drizzle(sqlite, { schema });

export function setupDb() {
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(
      embedding float[1024]
    );
    CREATE TABLE IF NOT EXISTS document_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text_content TEXT NOT NULL,
      metadata TEXT
    );
  `);
}

export * from "./schema";
