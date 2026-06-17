import { db, conversationsTable, messagesTable, commandLogsTable } from "@workspace/db";
import { count, gte, desc, sql } from "drizzle-orm";

export async function getStats() {
  const [[{ total: totalConversations }], [{ total: totalMessages }], todayMsgs, topCmds, [{ totalTokens }]] =
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
      db
        .select({ totalTokens: sql<number>`COALESCE(SUM(${messagesTable.tokensUsed}), 0)`.mapWith(Number) })
        .from(messagesTable)
        .where(
          gte(
            messagesTable.createdAt,
            new Date(new Date().setHours(0, 0, 0, 0))
          )
        ),
    ]);

  return {
    totalConversations: Number(totalConversations),
    totalMessages: Number(totalMessages),
    todayMessages: Number(todayMsgs[0]?.total ?? 0),
    totalTokens: Number(totalTokens),
    topCommands: topCmds.map((c) => ({
      command: c.command,
      count: Number(c.count),
    })),
  };
}
