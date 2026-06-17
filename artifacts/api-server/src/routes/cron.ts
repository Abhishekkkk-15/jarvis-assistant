import { Router } from "express";
import { CreateScheduledTaskBody, DeleteScheduledTaskParams } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { scheduledTasksTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { scheduleTaskInMemory, cancelTaskInMemory } from "../lib/scheduler.js";

const router = Router();

router.get("/cron", async (req, res) => {
  try {
    const list = await db.select().from(scheduledTasksTable);
    res.json(list);
  } catch (err) {
    req.log.error({ err }, "Failed to list scheduled tasks");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/cron", async (req, res) => {
  try {
    const parsed = CreateScheduledTaskBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const [task] = await db.insert(scheduledTasksTable).values({
      cronExpression: parsed.data.cronExpression,
      taskDescription: parsed.data.taskDescription,
    }).returning();

    scheduleTaskInMemory(task.id, task.cronExpression, task.taskDescription);

    res.status(201).json(task);
  } catch (err) {
    req.log.error({ err }, "Failed to create scheduled task");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/cron/:id", async (req, res) => {
  try {
    const params = DeleteScheduledTaskParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    await db.delete(scheduledTasksTable).where(eq(scheduledTasksTable.id, params.data.id));
    cancelTaskInMemory(params.data.id);

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete scheduled task");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
