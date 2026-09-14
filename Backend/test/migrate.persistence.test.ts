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

test("migration bookkeeping is not recorded when a migration statement fails", async () => {
  await ensureCleanDatabase();

  await postgresPool.query(`
    CREATE TABLE schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Force the migration to fail after earlier statements have executed inside
  // the migration transaction. The conflicting table must survive while all
  // tables created earlier in the same migration are rolled back.
  await postgresPool.query(`
    CREATE TABLE messages (
      id UUID PRIMARY KEY
    )
  `);

  await assert.rejects(
    runMigrations(),
    (error: unknown) => {
      assert.equal((error as { code?: string }).code, "42P07");
      return true;
    }
  );

  const migrationResult = await postgresPool.query(
    "SELECT version FROM schema_migrations WHERE version = $1",
    ["001_initial_schema"]
  );
  assert.equal(migrationResult.rowCount, 0);

  const rolledBackTables = await postgresPool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY($1::text[])
    ORDER BY table_name
  `, [["users", "conversations", "conversation_members", "sessions"]]);
  assert.deepEqual(rolledBackTables.rows, []);

  const preservedConflict = await postgresPool.query(
    "SELECT to_regclass('public.messages') AS table_name"
  );
  assert.equal(preservedConflict.rows[0]?.table_name, "messages");
});
