import { randomUUID } from "node:crypto";

import { postgresPool } from "../../db/pool.js";

export interface PostgresUser {
  id: string;
  fullname: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const mapUser = (row: Record<string, unknown>): PostgresUser => ({
  id: String(row.id),
  fullname: String(row.fullname),
  email: String(row.email),
  passwordHash: String(row.password_hash),
  createdAt: new Date(String(row.created_at)),
  updatedAt: new Date(String(row.updated_at)),
});

export const createUser = async (input: {
  fullname: string;
  email: string;
  passwordHash: string;
}): Promise<PostgresUser> => {
  const result = await postgresPool.query(
    `
      INSERT INTO users (id, fullname, email, password_hash)
      VALUES ($1, $2, $3, $4)
      RETURNING id, fullname, email, password_hash, created_at, updated_at
    `,
    [randomUUID(), input.fullname, input.email, input.passwordHash]
  );

  return mapUser(result.rows[0]);
};

export const findUserById = async (id: string): Promise<PostgresUser | null> => {
  const result = await postgresPool.query(
    `
      SELECT id, fullname, email, password_hash, created_at, updated_at
      FROM users
      WHERE id = $1
    `,
    [id]
  );

  return result.rowCount === 0 ? null : mapUser(result.rows[0]);
};

export const findUserByNormalizedEmail = async (
  email: string
): Promise<PostgresUser | null> => {
  const result = await postgresPool.query(
    `
      SELECT id, fullname, email, password_hash, created_at, updated_at
      FROM users
      WHERE email = $1
    `,
    [email]
  );

  return result.rowCount === 0 ? null : mapUser(result.rows[0]);
};

export const listUsersExcept = async (userId: string): Promise<Array<Pick<PostgresUser, "id" | "fullname" | "email">>> => {
  const result = await postgresPool.query(
    `
      SELECT id, fullname, email
      FROM users
      WHERE id <> $1
      ORDER BY created_at ASC, id ASC
    `,
    [userId]
  );

  return result.rows.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    fullname: String(row.fullname),
    email: String(row.email),
  }));
};
