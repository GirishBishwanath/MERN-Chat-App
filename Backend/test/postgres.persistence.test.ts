import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  createUser,
  findUserById,
  findUserByEmail,
} from "../repositories/postgres/user.repository.js";
import {
  createDirectConversation,
} from "../repositories/postgres/conversation.repository.js";
import {
  createMessage,
  findMessageById,
  findMessagesByConversation,
} from "../repositories/postgres/message.repository.js";
import {
  createSession,
  findSessionById,
  refreshSession,
  revokeSession,
  revokeAllSessionsForUser,
} from "../repositories/postgres/session.repository.js";
import { postgresPool } from "../db/postgres.js";
import { canonicalizeMemberPair } from "../utils/memberPair.js";
import { runMigrations, rollbackMigrations } from "../db/migrate.js";

test("migration runner is idempotent", async () => {
  await runMigrations();
  await runMigrations();

  const result = await postgresPool.query(
    "SELECT COUNT(*)::int AS count FROM schema_migrations"
  );
  assert.equal(result.rows[0].count, 1);
});

test("migration runner serializes concurrent execution", async () => {
  await Promise.all([runMigrations(), runMigrations(), runMigrations()]);

  const result = await postgresPool.query(
    "SELECT COUNT(*)::int AS count FROM schema_migrations"
  );
  assert.equal(result.rows[0].count, 1);
});

test("migration rollback", async () => {
  await runMigrations();
  await rollbackMigrations();

  const result = await postgresPool.query(
    "SELECT to_regclass('public.messages') AS messages_table"
  );
  assert.equal(result.rows[0].messages_table, null);

  await runMigrations();
});

test("creates and finds a user by id and normalized email", async () => {
  const user = await createUser({
    fullname: "Alice",
    email: "  Alice@Example.COM ",
    passwordHash: "hash",
  });

  assert.equal(typeof user.id, "string");
  assert.equal(user.email, "alice@example.com");
  assert.equal((await findUserById(user.id))?.id, user.id);
  assert.equal((await findUserByEmail("ALICE@EXAMPLE.COM"))?.id, user.id);
});

test("database enforces duplicate email constraint", async () => {
  await createUser({
    fullname: "Alice",
    email: "alice@example.com",
    passwordHash: "hash",
  });

  await assert.rejects(
    () =>
      createUser({
        fullname: "Alice 2",
        email: "alice@example.com",
        passwordHash: "hash",
      }),
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
  );
});

test("creates direct conversation and memberships transactionally", async () => {
  const first = await createUser({
    fullname: "Alice",
    email: "alice@example.com",
    passwordHash: "hash",
  });
  const second = await createUser({
    fullname: "Bob",
    email: "bob@example.com",
    passwordHash: "hash",
  });

  const conversation = await createDirectConversation(first.id, second.id);

  const result = await postgresPool.query(
    "SELECT conversation_id, user_id FROM conversation_members WHERE conversation_id = $1 ORDER BY user_id",
    [conversation.id]
  );
  assert.equal(result.rows.length, 2);
  assert.deepEqual(
    result.rows.map((row) => row.user_id),
    [first.id, second.id].sort()
  );
});

test("symmetric direct conversation canonicalization", async () => {
  const first = await createUser({
    fullname: "Alice",
    email: "alice@example.com",
    passwordHash: "hash",
  });
  const second = await createUser({
    fullname: "Bob",
    email: "bob@example.com",
    passwordHash: "hash",
  });

  const forward = await createDirectConversation(first.id, second.id);
  const reverse = await createDirectConversation(second.id, first.id);

  assert.equal(forward.id, reverse.id);
});

test("concurrent direct conversation creation resolves to one conversation", async () => {
  const first = await createUser({
    fullname: "Alice",
    email: "alice@example.com",
    passwordHash: "hash",
  });
  const second = await createUser({
    fullname: "Bob",
    email: "bob@example.com",
    passwordHash: "hash",
  });

  const conversations = await Promise.all(
    Array.from({ length: 8 }, () =>
      createDirectConversation(first.id, second.id)
    )
  );

  assert.equal(
    new Set(conversations.map((conversation) => conversation.id)).size,
    1
  );
  const result = await postgresPool.query(
    "SELECT COUNT(*)::int AS count FROM conversations WHERE member_a_id = $1 AND member_b_id = $2",
    canonicalizeMemberPair(first.id, second.id)
  );
  assert.equal(result.rows[0].count, 1);
});

test("stores and retrieves messages with stable ordering and bounded result size", async () => {
  const first = await createUser({
    fullname: "Alice",
    email: "alice@example.com",
    passwordHash: "hash",
  });
  const second = await createUser({
    fullname: "Bob",
    email: "bob@example.com",
    passwordHash: "hash",
  });
  const conversation = await createDirectConversation(first.id, second.id);

  const createdIds: string[] = [];
  for (let index = 0; index < 5; index += 1) {
    const message = await createMessage({
      conversationId: conversation.id,
      senderId: index % 2 === 0 ? first.id : second.id,
      content: `message-${index}`,
    });
    createdIds.push(message.id);
  }

  assert.equal((await findMessageById(createdIds[0]))?.id, createdIds[0]);
  const result = await findMessagesByConversation(conversation.id, 3);
  assert.equal(result.messages.length, 3);
  assert.equal(result.hasMore, true);
  assert.deepEqual(
    result.messages.map((message) => message.content),
    ["message-0", "message-1", "message-2"]
  );
});

test("database rejects messages with invalid foreign keys", async () => {
  const sender = await createUser({
    fullname: "Alice",
    email: "alice@example.com",
    passwordHash: "hash",
  });

  await assert.rejects(
    () =>
      createMessage({
        conversationId: randomUUID(),
        senderId: sender.id,
        content: "orphan",
      }),
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23503"
  );
});

test("session lifecycle persists, refreshes, and revokes records", async () => {
  const user = await createUser({
    fullname: "Alice",
    email: "alice@example.com",
    passwordHash: "hash",
  });
  const session = await createSession(user.id, "127.0.0.1");

  assert.equal((await findSessionById(session.id))?.userId, user.id);

  const refreshed = await refreshSession(session.id);
  assert.equal(refreshed?.id, session.id);

  assert.equal(await revokeSession(session.id), true);
  assert.equal((await findSessionById(session.id))?.revokedAt !== null, true);
});

test("revoke all sessions for one user", async () => {
  const user = await createUser({
    fullname: "Alice",
    email: "alice@example.com",
    passwordHash: "hash",
  });
  const other = await createUser({
    fullname: "Bob",
    email: "bob@example.com",
    passwordHash: "hash",
  });

  const first = await createSession(user.id, "127.0.0.1");
  const second = await createSession(user.id, "127.0.0.2");
  const otherSession = await createSession(other.id, "127.0.0.3");

  const count = await revokeAllSessionsForUser(user.id);
  assert.equal(count, 2);
  assert.equal((await findSessionById(first.id))?.revokedAt !== null, true);
  assert.equal((await findSessionById(second.id))?.revokedAt !== null, true);
  assert.equal((await findSessionById(otherSession.id))?.revokedAt, null);
});
