import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groqApiKey: text("groq_api_key"),
  nvidiaApiKey: text("nvidia_api_key"),
  openaiApiKey: text("openai_api_key"),
  anthropicApiKey: text("anthropic_api_key"),
  mistralApiKey: text("mistral_api_key"),
  openrouterApiKey: text("openrouter_api_key"),
  geminiApiKey: text("gemini_api_key"),
  customTextApiUrl: text("custom_text_api_url"),
  customTextApiKey: text("custom_text_api_key"),
  customVisionApiUrl: text("custom_vision_api_url"),
  customVisionApiKey: text("custom_vision_api_key"),
  selectedModel: text("selected_model").notNull().default("llama-3.3-70b-versatile"),
  selectedProvider: text("selected_provider").notNull().default("groq"),
  visionModel: text("vision_model").notNull().default("llama-3.2-90b-vision-preview"),
  visionProvider: text("vision_provider").notNull().default("groq"),
  wakeWord: text("wake_word").notNull().default("hey jarvis"),
  voiceEnabled: integer("voice_enabled", { mode: "boolean" }).notNull().default(true),
  selectedCharacterId: text("selected_character_id").notNull().default("jarvis-bot"),
  miniModeEnabled: integer("mini_mode_enabled", { mode: "boolean" }).notNull().default(false),
  telegramBotToken: text("telegram_bot_token"),
  discordBotToken: text("discord_bot_token"),
  notionApiKey: text("notion_api_key"),
  spotifyClientId: text("spotify_client_id"),
  spotifyClientSecret: text("spotify_client_secret"),
  githubPat: text("github_pat"),
  emailAddress: text("email_address"),
  emailPassword: text("email_password"),
  emailProvider: text("email_provider"),
  googleClientId: text("google_client_id"),
  googleClientSecret: text("google_client_secret"),
  googleRefreshToken: text("google_refresh_token"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
