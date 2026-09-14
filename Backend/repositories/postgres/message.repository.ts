import { randomUUID } from "node:crypto";

import { postgresPool } from "../../db/pool.js";

export interface PostgresMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const mapMessage = (row: Record<string, unknown>): PostgresMessage => ({
  id: String(row.id),
  conversationId: String(row.conversation_id),
  senderId: String(row.sender_id),
  content: String(row.content),
  createdAt: new Date(String(row.created_at)),
  updatedAt: new Date(String(row.updated_at)),
});

export const createMessage = async (input: {
  conversationId: string;
  senderId: string;
  content: string;
  id?: string;
}): Promise<PostgresMessage> => {
  const result = await postgresPool.query(
    `
      INSERT INTO messages (id, conversation_id, sender_id, content)
      VALUES ($1, $2, $3, $4)
      RETURNING id, conversation_id, sender_id, content, created_at, updated_at
    `,
    [input.id ?? randomUUID(), input.conversationId, input.senderId, input.content]
  );

  return mapMessage(result.rows[0]);
};

export const findMessageById = async (id: string): Promise<PostgresMessage | null> => {
  const result = await postgresPool.query(
    `
      SELECT id, conversation_id, sender_id, content, created_at, updated_at
      FROM messages
      WHERE id = $1
    `,
    [id]
  );
  return result.rowCount === 0 ? null : mapMessage(result.rows[0]);
};

export const findMessagesByConversation = async (
  conversationId: string,
  limit = 50
): Promise<PostgresMessage[]> => {
  const boundedLimit = Math.min(Math.max(limit, 1), 100);
  const result = await postgresPool.query(
    `
      SELECT id, conversation_id, sender_id, content, created_at, updated_at
      FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC, id ASC
      LIMIT $2
    `,
    [conversationId, boundedLimit]
  );

  return result.rows.map((row: Record<string, unknown>) => mapMessage(row));
};
