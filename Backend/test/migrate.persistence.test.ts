process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-auth-secret";
process.env.CORS_ORIGINS = "http://localhost:3001";
process.env.POSTGRES_HOST = "127.0.0.1";
process.env.POSTGRES_PORT = "5432";
process.env.POSTGRES_DATABASE = "mern_chat_app_test";
process.env.POSTGRES_USER = "postgres";
process.env.POSTGRES_PASSWORD = "postgres";
process.env.POSTGRES_SSL = "false";

import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";

const { config } = await import("../config/env.js");
const { postgresPool } = await import("../db/pool.js");
const { runMigrations } = await import("../db/migrate.js");

const migrationSchema = `phase12_migration_${process.pid}_${Math.random().toString(36).slice(2)}`;

await postgresPool.query(`CREATE SCHEMA "${migrationSchema}"`);

const migrationPool = new Pool({
  ...config.postgres,
  max: 2,
  idleTimeoutMillis: 5_000,
  connectionTimeoutMillis: 5_000,
  options: `-c search_path="${migrationSchema}"`,
});

const ensureCleanDatabase = async (): Promise<void> => {
  await migrationPool.query(
    "DROP TABLE IF EXISTS notifications, sessions, messages, conversation_members, conversations, users CASCADE"
  );
  await migrationPool.query("DROP TABLE IF EXISTS schema_migrations");
};

test.after(async () => {
  await migrationPool.end();
  await postgresPool.query(`DROP SCHEMA "${migrationSchema}" CASCADE`);
  await postgresPool.end();
});

test("migration runner is idempotent", async () => {
  await ensureCleanDatabase();

  await runMigrations(migrationPool);
  const firstResult = await migrationPool.query(
    "SELECT version FROM schema_migrations ORDER BY version"
  );

  await runMigrations(migrationPool);
  const secondResult = await migrationPool.query(
    "SELECT version FROM schema_migrations ORDER BY version"
  );

  assert.deepEqual(secondResult.rows, firstResult.rows);
  assert.deepEqual(firstResult.rows, [
    { version: "001_initial_schema" },
    { version: "002_notifications" },
  ]);
});

test("migration runner serializes concurrent execution", async () => {
  await ensureCleanDatabase();

  const results = await Promise.allSettled([
    runMigrations(migrationPool),
    runMigrations(migrationPool),
    runMigrations(migrationPool),
  ]);

  for (const result of results) {
    assert.equal(result.status, "fulfilled");
  }

  const applied = await migrationPool.query(
    "SELECT version FROM schema_migrations ORDER BY version"
  );
  assert.deepEqual(applied.rows, [
    { version: "001_initial_schema" },
    { version: "002_notifications" },
  ]);
});

test("migration rolls back earlier statements when a migration statement fails", async () => {
  await ensureCleanDatabase();

  await migrationPool.query(`
    CREATE TABLE messages (
      id UUID PRIMARY KEY
    )
  `);

  await assert.rejects(
    runMigrations(migrationPool),
    (error: unknown) => {
      assert.equal((error as { code?: string }).code, "42P07");
      return true;
    }
  );

  const migrationResult = await migrationPool.query(
    "SELECT version FROM schema_migrations WHERE version = $1",
    ["001_initial_schema"]
  );
  assert.equal(migrationResult.rowCount, 0);

  const rolledBackTables = await migrationPool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_name = ANY($2::text[])
    ORDER BY table_name
  `, [migrationSchema, ["users", "conversations", "conversation_members", "sessions"]]);
  assert.deepEqual(rolledBackTables.rows, []);

  const preservedConflict = await migrationPool.query(
    "SELECT to_regclass($1) AS table_name",
    [`${migrationSchema}.messages`]
  );
  assert.equal(preservedConflict.rows[0]?.table_name, "messages");
});
