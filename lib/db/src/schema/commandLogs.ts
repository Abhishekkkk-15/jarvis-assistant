import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const commandLogsTable = pgTable("command_logs", {
  id: serial("id").primaryKey(),
  commandType: text("command_type").notNull(),
  success: text("success").notNull().default("true"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCommandLogSchema = createInsertSchema(commandLogsTable).omit({ id: true, createdAt: true });
export type InsertCommandLog = z.infer<typeof insertCommandLogSchema>;
export type CommandLog = typeof commandLogsTable.$inferSelect;
