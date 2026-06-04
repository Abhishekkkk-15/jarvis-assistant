import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const scheduledTasksTable = sqliteTable("scheduled_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cronExpression: text("cron_expression").notNull(),
  taskDescription: text("task_description").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});
