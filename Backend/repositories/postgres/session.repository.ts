import { randomUUID } from "node:crypto";

import { postgresPool } from "../../db/pool.js";

export interface PostgresSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const mapSession = (row: Record<string, unknown>): PostgresSession => ({
  id: String(row.id),
  userId: String(row.user_id),
  tokenHash: String(row.token_hash),
  expiresAt: new Date(String(row.expires_at)),
  lastUsedAt: new Date(String(row.last_used_at)),
  createdAt: new Date(String(row.created_at)),
  updatedAt: new Date(String(row.updated_at)),
});

export const createSession = async (input: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  lastUsedAt: Date;
}): Promise<PostgresSession> => {
  const result = await postgresPool.query(
    `
      INSERT INTO sessions (id, user_id, token_hash, expires_at, last_used_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, token_hash, expires_at, last_used_at, created_at, updated_at
    `,
    [randomUUID(), input.userId, input.tokenHash, input.expiresAt, input.lastUsedAt]
  );

  return mapSession(result.rows[0]);
};

export const findActiveSessionByTokenHash = async (
  tokenHash: string,
  now = new Date()
): Promise<PostgresSession | null> => {
  const result = await postgresPool.query(
    `
      UPDATE sessions
      SET last_used_at = $2, updated_at = $2
      WHERE token_hash = $1
        AND expires_at > $2
      RETURNING id, user_id, token_hash, expires_at, last_used_at, created_at, updated_at
    `,
    [tokenHash, now]
  );

  return result.rowCount === 0 ? null : mapSession(result.rows[0]);
};

export const revokeSessionByTokenHash = async (tokenHash: string): Promise<void> => {
  await postgresPool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
};

export const revokeAllSessionsForUser = async (userId: string): Promise<void> => {
  await postgresPool.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
};
