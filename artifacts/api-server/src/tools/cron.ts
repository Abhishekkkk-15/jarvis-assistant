import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "@workspace/db";
import { scheduledTasksTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { scheduleTaskInMemory, cancelTaskInMemory } from "../lib/scheduler.js"; // We will build this

export const cronTools = [
  new DynamicStructuredTool({
    name: "schedule_task",
    description: "Schedule a task to run automatically in the background using a cron expression. Use this when the user asks you to remind them or do something proactively on a schedule (e.g. 'check my email every hour', 'remind me to drink water every 30 mins'). The task description must be clear and actionable.",
    schema: z.object({
      cronExpression: z.string().describe("A standard cron expression (e.g. '*/30 * * * *' for every 30 mins, '0 * * * *' for every hour)."),
      taskDescription: z.string().describe("A very explicit command for JARVIS to execute when the cron triggers (e.g. 'Search the web for news and summarize it')."),
    }),
    func: async ({ cronExpression, taskDescription }) => {
      try {
        const [inserted] = await db.insert(scheduledTasksTable).values({
          cronExpression,
          taskDescription
        }).returning();
        
        scheduleTaskInMemory(inserted.id, cronExpression, taskDescription);
        
        return `Task successfully scheduled with ID ${inserted.id} on schedule '${cronExpression}'.`;
      } catch (err: any) {
        return `Failed to schedule task: ${err.message}`;
      }
    },
  }),
  
  new DynamicStructuredTool({
    name: "list_scheduled_tasks",
    description: "List all currently active scheduled background tasks.",
    schema: z.object({}),
    func: async () => {
      const tasks = await db.select().from(scheduledTasksTable);
      if (tasks.length === 0) return "No scheduled tasks are currently active.";
      return tasks.map(t => `ID: ${t.id} | Schedule: ${t.cronExpression} | Task: ${t.taskDescription}`).join("\\n");
    },
  }),

  new DynamicStructuredTool({
    name: "cancel_scheduled_task",
    description: "Cancel a running scheduled background task by its ID.",
    schema: z.object({
      taskId: z.number().describe("The ID of the task to cancel."),
    }),
    func: async ({ taskId }) => {
      try {
        await db.delete(scheduledTasksTable).where(eq(scheduledTasksTable.id, taskId));
        cancelTaskInMemory(taskId);
        return `Successfully cancelled scheduled task ID ${taskId}.`;
      } catch (err: any) {
        return `Failed to cancel task: ${err.message}`;
      }
    },
  })
];
