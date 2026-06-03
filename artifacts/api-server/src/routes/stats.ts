import { Router } from "express";
import { db, conversationsTable, messagesTable, commandLogsTable } from "@workspace/db";
import { count, gte, desc, sql } from "drizzle-orm";

const router = Router();

router.get("/stats", async (req, res) => {
  try {
    const [[{ total: totalConversations }], [{ total: totalMessages }], todayMsgs, topCmds] =
      await Promise.all([
        db.select({ total: count() }).from(conversationsTable),
        db.select({ total: count() }).from(messagesTable),
        db
          .select({ total: count() })
          .from(messagesTable)
          .where(
            gte(
              messagesTable.createdAt,
              new Date(new Date().setHours(0, 0, 0, 0))
            )
          ),
        db
          .select({
            command: commandLogsTable.commandType,
            count: count(),
          })
          .from(commandLogsTable)
          .groupBy(commandLogsTable.commandType)
          .orderBy(desc(count()))
          .limit(5),
      ]);

    res.json({
      totalConversations: Number(totalConversations),
      totalMessages: Number(totalMessages),
      todayMessages: Number(todayMsgs[0]?.total ?? 0),
      topCommands: topCmds.map((c) => ({
        command: c.command,
        count: Number(c.count),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
