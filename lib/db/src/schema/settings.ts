import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groqApiKey: text("groq_api_key"),
  nvidiaApiKey: text("nvidia_api_key"),
  selectedModel: text("selected_model").notNull().default("llama-3.3-70b-versatile"),
  selectedProvider: text("selected_provider").notNull().default("groq"),
  wakeWord: text("wake_word").notNull().default("hey jarvis"),
  voiceEnabled: integer("voice_enabled", { mode: "boolean" }).notNull().default(true),
  selectedCharacterId: text("selected_character_id").notNull().default("jarvis-bot"),
  miniModeEnabled: integer("mini_mode_enabled", { mode: "boolean" }).notNull().default(false),
  telegramBotToken: text("telegram_bot_token"),
  discordBotToken: text("discord_bot_token"),
  notionApiKey: text("notion_api_key"),
  spotifyClientId: text("spotify_client_id"),
  spotifyClientSecret: text("spotify_client_secret"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
