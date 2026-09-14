import { randomUUID } from "node:crypto";

import { postgresPool } from "../../db/pool.js";
import type { PoolClient } from "pg";

export interface PostgresConversation {
  id: string;
  memberAId: string;
  memberBId: string;
  createdAt: Date;
  updatedAt: Date;
}

const mapConversation = (row: Record<string, unknown>): PostgresConversation => ({
  id: String(row.id),
  memberAId: String(row.member_a_id),
  memberBId: String(row.member_b_id),
  createdAt: new Date(String(row.created_at)),
  updatedAt: new Date(String(row.updated_at)),
});

export const canonicalizeMemberPair = (userA: string, userB: string): [string, string] =>
  userA < userB ? [userA, userB] : [userB, userA];

export const findDirectConversation = async (
  userA: string,
  userB: string
): Promise<PostgresConversation | null> => {
  const [memberAId, memberBId] = canonicalizeMemberPair(userA, userB);
  const result = await postgresPool.query(
    `
      SELECT id, member_a_id, member_b_id, created_at, updated_at
      FROM conversations
      WHERE member_a_id = $1 AND member_b_id = $2
    `,
    [memberAId, memberBId]
  );

  return result.rowCount === 0 ? null : mapConversation(result.rows[0]);
};

const ensureMembership = async (
  client: PoolClient,
  conversationId: string,
  userId: string
): Promise<void> => {
  await client.query(
    `
      INSERT INTO conversation_members (conversation_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (conversation_id, user_id) DO NOTHING
    `,
    [conversationId, userId]
  );
};

export const createDirectConversation = async (
  userA: string,
  userB: string
): Promise<PostgresConversation> => {
  const [memberAId, memberBId] = canonicalizeMemberPair(userA, userB);
  const client = await postgresPool.connect();

  try {
    await client.query("BEGIN");

    const insertResult = await client.query(
      `
        INSERT INTO conversations (id, member_a_id, member_b_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (member_a_id, member_b_id) DO NOTHING
        RETURNING id, member_a_id, member_b_id, created_at, updated_at
      `,
      [randomUUID(), memberAId, memberBId]
    );

    let conversation: PostgresConversation;
    if (insertResult.rowCount === 1) {
      conversation = mapConversation(insertResult.rows[0]);
    } else {
      const existingResult = await client.query(
        `
          SELECT id, member_a_id, member_b_id, created_at, updated_at
          FROM conversations
          WHERE member_a_id = $1 AND member_b_id = $2
          FOR UPDATE
        `,
        [memberAId, memberBId]
      );

      if (existingResult.rowCount !== 1) {
        throw new Error("Direct conversation could not be resolved after conflict");
      }
      conversation = mapConversation(existingResult.rows[0]);
    }

    await ensureMembership(client, conversation.id, memberAId);
    await ensureMembership(client, conversation.id, memberBId);

    await client.query("COMMIT");
    return conversation;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const getConversationMembers = async (
  conversationId: string
): Promise<string[]> => {
  const result = await postgresPool.query(
    `
      SELECT user_id
      FROM conversation_members
      WHERE conversation_id = $1
      ORDER BY user_id ASC
    `,
    [conversationId]
  );

  return result.rows.map((row: Record<string, unknown>) => String(row.user_id));
};

export const isConversationMember = async (
  conversationId: string,
  userId: string
): Promise<boolean> => {
  const result = await postgresPool.query(
    `
      SELECT 1
      FROM conversation_members
      WHERE conversation_id = $1 AND user_id = $2
    `,
    [conversationId, userId]
  );

  return result.rowCount === 1;
};
