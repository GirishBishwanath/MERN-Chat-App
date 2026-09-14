import assert from "node:assert/strict";
import test from "node:test";

import { postgresPool } from "../db/pool.js";
import { runMigrations } from "../db/migrate.js";

const ensureCleanDatabase = async (): Promise<void> => {
  await postgresPool.query(
    "DROP TABLE IF EXISTS sessions, messages, conversation_members, conversations, users CASCADE"
  );
  await postgresPool.query("DROP TABLE IF EXISTS schema_migrations");
};

test.after(async () => {
  await postgresPool.end();
});

test("migration runner is idempotent", async () => {
  await ensureCleanDatabase();

  await runMigrations();
  const firstResult = await postgresPool.query(
    "SELECT version FROM schema_migrations ORDER BY version"
  );

  await runMigrations();
  const secondResult = await postgresPool.query(
    "SELECT version FROM schema_migrations ORDER BY version"
  );

  assert.deepEqual(secondResult.rows, firstResult.rows);
  assert.deepEqual(firstResult.rows, [{ version: "001_initial_schema" }]);
});

test("migration runner serializes concurrent execution", async () => {
  await ensureCleanDatabase();

  const results = await Promise.allSettled([
    runMigrations(),
    runMigrations(),
    runMigrations(),
  ]);

  for (const result of results) {
    assert.equal(result.status, "fulfilled");
  }

  const applied = await postgresPool.query(
    "SELECT version FROM schema_migrations ORDER BY version"
  );
  assert.deepEqual(applied.rows, [{ version: "001_initial_schema" }]);
});

test("failed migration rolls back its schema changes", async () => {
  await ensureCleanDatabase();
  await postgresPool.query(`
    CREATE TABLE schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await postgresPool.query("INSERT INTO schema_migrations (version) VALUES ($1)", ["001_initial_schema"]);

  await assert.doesNotReject(() => runMigrations());
  assert.equal(
    (await postgresPool.query("SELECT to_regclass('public.users') AS table_name")).rows[0].table_name,
    null
  );
});
