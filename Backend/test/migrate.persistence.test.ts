process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/mern-chat-app-test";
process.env.JWT_SECRET = "test-only-auth-secret";
process.env.CORS_ORIGINS = "http://localhost:3001";
process.env.POSTGRES_HOST = "127.0.0.1";
process.env.POSTGRES_PORT = "5432";
process.env.POSTGRES_DATABASE = "mern_chat_app_test";
process.env.POSTGRES_USER = "postgres";
process.env.POSTGRES_PASSWORD = "postgres";
process.env.POSTGRES_SSL = "false";

const { postgresPool } = await import("../db/pool.js");
const { runMigrations } = await import("../db/migrate.js");

import assert from "node:assert/strict";
import test from "node:test";

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

test("migration rolls back earlier statements when a migration statement fails", async () => {
  await ensureCleanDatabase();

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
