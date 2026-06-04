import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const commandLogsTable = sqliteTable("command_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  commandType: text("command_type").notNull(),
  success: text("success").notNull().default("true"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertCommandLogSchema = createInsertSchema(commandLogsTable).omit({ id: true, createdAt: true });
export type InsertCommandLog = z.infer<typeof insertCommandLogSchema>;
export type CommandLog = typeof commandLogsTable.$inferSelect;
