import { db, conversationsTable, messagesTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";

export async function listConversations() {
  const rows = await db
    .select({
      id: conversationsTable.id,
      title: conversationsTable.title,
      createdAt: conversationsTable.createdAt,
      updatedAt: conversationsTable.updatedAt,
      messageCount: count(messagesTable.id),
    })
    .from(conversationsTable)
    .leftJoin(messagesTable, eq(messagesTable.conversationId, conversationsTable.id))
    .groupBy(conversationsTable.id)
    .orderBy(desc(conversationsTable.updatedAt));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    messageCount: Number(r.messageCount),
  }));
}

export async function createConversation(title: string) {
  const [conv] = await db
    .insert(conversationsTable)
    .values({ title })
    .returning();

  return {
    id: conv.id,
    title: conv.title,
    createdAt: conv.createdAt.toISOString(),
    updatedAt: conv.updatedAt.toISOString(),
    messageCount: 0,
  };
}

export async function getConversation(id: number) {
  const [conv] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, id));

  if (!conv) {
    return null;
  }

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conv.id))
    .orderBy(messagesTable.createdAt);

  return {
    id: conv.id,
    title: conv.title,
    createdAt: conv.createdAt.toISOString(),
    updatedAt: conv.updatedAt.toISOString(),
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      conversationId: m.conversationId,
      model: m.model ?? null,
    })),
  };
}

export async function deleteConversation(id: number) {
  await db
    .delete(conversationsTable)
    .where(eq(conversationsTable.id, id));
}
