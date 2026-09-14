import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { PoolClient } from "pg";

import { postgresPool } from "./pool.js";

const migrationsDirectory = path.dirname(fileURLToPath(import.meta.url)) + "/migrations";

const ensureMigrationsTable = async (client: PoolClient): Promise<void> => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

export const runMigrations = async (): Promise<void> => {
  const client = await postgresPool.connect();
  try {
    await ensureMigrationsTable(client);

    const files = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      const result = await client.query(
        "SELECT 1 FROM schema_migrations WHERE version = $1",
        [version]
      );

      if (result.rowCount !== 0) {
        continue;
      }

      const sql = await readFile(path.join(migrationsDirectory, file), "utf8");
      await client.query("BEGIN");
      try {
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
      console.error("postgres_migration_failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      await postgresPool.end();
      process.exitCode = 1;
    });
}
