import { randomUUID } from "node:crypto";
import { postgresPool } from "../../db/pool.js";
import type { MessageCursor } from "../../utils/messageCursor.js";

export interface PostgresMessage {
  id: string; conversationId: string; senderId: string; content: string; createdAt: Date; updatedAt: Date;
}
const mapMessage = (row: Record<string, unknown>): PostgresMessage => ({
  id: String(row.id), conversationId: String(row.conversation_id), senderId: String(row.sender_id),
  content: String(row.content), createdAt: new Date(String(row.created_at)), updatedAt: new Date(String(row.updated_at)),
});

export const createMessage = async (input: {
  conversationId: string; senderId: string; content: string; id?: string;
}): Promise<PostgresMessage> => {
  const result = await postgresPool.query(`
    INSERT INTO messages (id, conversation_id, sender_id, content)
    VALUES ($1, $2, $3, $4)
    RETURNING id, conversation_id, sender_id, content, created_at, updated_at
  `, [input.id ?? randomUUID(), input.conversationId, input.senderId, input.content]);
  return mapMessage(result.rows[0]);
};

export const findMessageById = async (id: string): Promise<PostgresMessage | null> => {
  const result = await postgresPool.query(
    `SELECT id, conversation_id, sender_id, content, created_at, updated_at FROM messages WHERE id = $1`, [id]);
  return result.rowCount === 0 ? null : mapMessage(result.rows[0]);
};

export const findMessagesByConversation = async (
  conversationId: string, limit = 50, cursor?: MessageCursor
): Promise<{ messages: PostgresMessage[]; hasMore: boolean }> => {
  const boundedLimit = Math.min(Math.max(limit, 1), 100);
  const params: unknown[] = [conversationId];
  let where = "conversation_id = $1";
  if (cursor) {
    params.push(new Date(cursor.createdAt), cursor.id);
    where += " AND (created_at, id) < ($2, $3)";
  }
  params.push(boundedLimit + 1);
  const result = await postgresPool.query(`
    SELECT id, conversation_id, sender_id, content, created_at, updated_at
    FROM messages WHERE ${where}
    ORDER BY created_at DESC, id DESC LIMIT $${params.length}
  `, params);
  const rows = result.rows.map((row: Record<string, unknown>) => mapMessage(row));
  const hasMore = rows.length > boundedLimit;
  return { messages: (hasMore ? rows.slice(0, boundedLimit) : rows).reverse(), hasMore };
};
