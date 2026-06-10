import { drizzle } from "drizzle-orm/better-sqlite3";
import Database, { type Database as IDatabase } from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import * as schema from "./schema";
import { config } from "dotenv"
config()

import path from "path";
const dbPath = process.env.DB_PATH || process.env.DATABASE_URL?.replace("file:", "") || path.resolve(process.cwd(), "../../sqlite.db");
export const sqlite: IDatabase = new Database(dbPath);
let vecPath = "";
try {
  vecPath = sqliteVec.getLoadablePath();
} catch (e) {
  const os = process.platform === "win32" ? "windows" : process.platform;
  const ext = process.platform === "win32" ? "dll" : process.platform === "darwin" ? "dylib" : "so";
  // fallback for electron app.asar.unpacked
  const path = require("path");
  // In production, __dirname is app.asar/dist/backend/dist or similar
  // We want app.asar/node_modules/sqlite-vec-...
  // Since we don't know exactly how many levels deep __dirname is, we can find app.asar
  const asarIndex = __dirname.indexOf("app.asar");
  if (asarIndex !== -1) {
    vecPath = path.join(__dirname, `vec0.${ext}`);
  } else {
    throw e;
  }
}
const unpackedPath = vecPath.replace("app.asar", "app.asar.unpacked");
sqlite.loadExtension(unpackedPath);
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
    CREATE TABLE IF NOT EXISTS command_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command_type TEXT NOT NULL,
      success TEXT NOT NULL DEFAULT 'true',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      model TEXT,
      tokens_used INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cron_expression TEXT NOT NULL,
      task_description TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      groq_api_key TEXT,
      nvidia_api_key TEXT,
      selected_model TEXT NOT NULL DEFAULT 'llama-3.3-70b-versatile',
      selected_provider TEXT NOT NULL DEFAULT 'groq',
      wake_word TEXT NOT NULL DEFAULT 'hey jarvis',
      voice_enabled INTEGER NOT NULL DEFAULT 1,
      selected_character_id TEXT NOT NULL DEFAULT 'jarvis-bot',
      mini_mode_enabled INTEGER NOT NULL DEFAULT 0,
      telegram_bot_token TEXT,
      discord_bot_token TEXT,
      notion_api_key TEXT,
      spotify_client_id TEXT,
      spotify_client_secret TEXT,
      github_pat TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  const migrations = [
    "ALTER TABLE settings ADD COLUMN notion_api_key TEXT;",
    "ALTER TABLE settings ADD COLUMN spotify_client_id TEXT;",
    "ALTER TABLE settings ADD COLUMN spotify_client_secret TEXT;",
    "ALTER TABLE settings ADD COLUMN github_pat TEXT;",
    "ALTER TABLE messages ADD COLUMN tokens_used INTEGER NOT NULL DEFAULT 0;",
  ];

  for (const query of migrations) {
    try {
      sqlite.exec(query);
    } catch (e: any) {
      if (!e.message.includes("duplicate column name")) {
        console.error("Migration error:", e.message);
      }
    }
  }
}

export * from "./schema";
