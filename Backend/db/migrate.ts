import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Pool, PoolClient } from "pg";

import { postgresPool } from "./pool.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.join(currentDirectory, "migrations");
const MIGRATION_LOCK_KEY = 7071001;

const ensureMigrationsTable = async (client: PoolClient): Promise<void> => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

const getDatabaseErrorDetails = (error: unknown): Record<string, unknown> => {
  if (typeof error !== "object" || error === null) {
    return { errorName: "UnknownError" };
  }

  const databaseError = error as Record<string, unknown>;
  return {
    errorName: typeof databaseError.name === "string" ? databaseError.name : "DatabaseError",
    errorCode: typeof databaseError.code === "string" ? databaseError.code : undefined,
    message: typeof databaseError.message === "string" ? databaseError.message : undefined,
    detail: typeof databaseError.detail === "string" ? databaseError.detail : undefined,
    hint: typeof databaseError.hint === "string" ? databaseError.hint : undefined,
    constraint:
      typeof databaseError.constraint === "string" ? databaseError.constraint : undefined,
    table: typeof databaseError.table === "string" ? databaseError.table : undefined,
    column: typeof databaseError.column === "string" ? databaseError.column : undefined,
  };
};

const applyMigration = async (
  client: PoolClient,
  version: string,
  sql: string
): Promise<void> => {
  await client.query("BEGIN");
  try {
    const result = await client.query(
      "SELECT 1 FROM schema_migrations WHERE version = $1",
      [version]
    );

    if (result.rowCount !== 0) {
      await client.query("COMMIT");
      return;
    }

    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (version) VALUES ($1)",
      [version]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
};

export const runMigrations = async (pool: Pool = postgresPool): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
    try {
      await ensureMigrationsTable(client);

      const files = (await readdir(migrationsDirectory))
        .filter((file) => file.endsWith(".sql"))
        .sort();

      for (const file of files) {
        const version = file.replace(/\.sql$/, "");
        const sql = await readFile(path.join(migrationsDirectory, file), "utf8");
        await applyMigration(client, version, sql);
      }
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(async () => {
      await postgresPool.end();
    })
    .catch(async (error: unknown) => {
      console.error("postgres_migration_failed", getDatabaseErrorDetails(error));
      await postgresPool.end();
      process.exitCode = 1;
    });
}
