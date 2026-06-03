import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  groqApiKey: text("groq_api_key"),
  nvidiaApiKey: text("nvidia_api_key"),
  selectedModel: text("selected_model").notNull().default("llama-3.3-70b-versatile"),
  selectedProvider: text("selected_provider").notNull().default("groq"),
  wakeWord: text("wake_word").notNull().default("hey jarvis"),
  voiceEnabled: boolean("voice_enabled").notNull().default(true),
  selectedCharacterId: text("selected_character_id").notNull().default("jarvis-bot"),
  miniModeEnabled: boolean("mini_mode_enabled").notNull().default(false),
  systemPrompt: text("system_prompt").default("You are JARVIS, an advanced AI assistant. You are helpful, precise, and slightly formal — like Tony Stark's AI. Keep responses concise unless detail is requested."),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
