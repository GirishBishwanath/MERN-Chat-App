import { postgresPool } from "../db/pool.js";
import { runMigrations } from "../db/migrate.js";

await postgresPool.query(
  "DROP TABLE IF EXISTS sessions, messages, conversation_members, conversations, users CASCADE"
);
await postgresPool.query("DROP TABLE IF EXISTS schema_migrations");
await runMigrations();
await postgresPool.end();
