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

import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

const { postgresPool } = await import("../db/pool.js");
const { runMigrations } = await import("../db/migrate.js");
const {
  canonicalizeMemberPair,
  createDirectConversation,
  findDirectConversation,
  getConversationMembers,
  isConversationMember,
} = await import("../repositories/postgres/conversation.repository.js");
const {
  createMessage,
  findMessageById,
  findMessagesByConversation,
} = await import("../repositories/postgres/message.repository.js");
const {
  createSession,
  findActiveSessionByTokenHash,
  revokeAllSessionsForUser,
  revokeSessionByTokenHash,
} = await import("../repositories/postgres/session.repository.js");
const {
  createUser,
  findUserById,
  findUserByNormalizedEmail,
} = await import("../repositories/postgres/user.repository.js");

await runMigrations();

const cleanup = async (): Promise<void> => {
  await postgresPool.query(
    "TRUNCATE sessions, messages, conversation_members, conversations, users CASCADE"
  );
};

test.beforeEach(cleanup);
test.after(async () => {
  await cleanup();
  await postgresPool.end();
});

test("creates and finds a user by id and normalized email", async () => {
  const user = await createUser({
    fullname: "Alice Example",
    email: "alice@example.com",
    passwordHash: "hash",
  });

  assert.match(user.id, /^[0-9a-f-]{36}$/);
  assert.equal((await findUserById(user.id))?.id, user.id);
  assert.equal((await findUserByNormalizedEmail("alice@example.com"))?.id, user.id);
});

test("database rejects duplicate user email", async () => {
  await createUser({ fullname: "Alice Example", email: "alice@example.com", passwordHash: "hash" });

  await assert.rejects(
    () => createUser({ fullname: "Other Alice", email: "alice@example.com", passwordHash: "hash" }),
    (error: unknown) =>
      typeof error === "object" && error !== null && "code" in error && error.code === "23505"
  );
});

test("creates a direct conversation transactionally with two memberships", async () => {
  const first = await createUser({ fullname: "Alice", email: "alice@example.com", passwordHash: "hash" });
  const second = await createUser({ fullname: "Bob", email: "bob@example.com", passwordHash: "hash" });

  const conversation = await createDirectConversation(first.id, second.id);
  const members = await getConversationMembers(conversation.id);

  assert.deepEqual(members, [first.id, second.id].sort());
  assert.equal(await isConversationMember(conversation.id, first.id), true);
  assert.equal(await isConversationMember(conversation.id, second.id), true);

  const symmetric = await findDirectConversation(second.id, first.id);
  assert.equal(symmetric?.id, conversation.id);
});

test("canonicalizes direct conversation pairs symmetrically", () => {
  const a = "00000000-0000-0000-0000-000000000001";
  const b = "00000000-0000-0000-0000-000000000002";
  assert.deepEqual(canonicalizeMemberPair(a, b), [a, b]);
  assert.deepEqual(canonicalizeMemberPair(b, a), [a, b]);
});

test("concurrent direct conversation creation resolves to one conversation", async () => {
  const first = await createUser({ fullname: "Alice", email: "alice@example.com", passwordHash: "hash" });
  const second = await createUser({ fullname: "Bob", email: "bob@example.com", passwordHash: "hash" });

  const conversations = await Promise.all(
    Array.from({ length: 8 }, () => createDirectConversation(first.id, second.id))
  );

  assert.equal(new Set(conversations.map((conversation) => conversation.id)).size, 1);
  const result = await postgresPool.query(
    "SELECT COUNT(*)::int AS count FROM conversations WHERE member_a_id = $1 AND member_b_id = $2",
    canonicalizeMemberPair(first.id, second.id)
  );
  assert.equal(result.rows[0].count, 1);
});

test("stores and retrieves messages with stable ordering and bounded result size", async () => {
  const first = await createUser({ fullname: "Alice", email: "alice@example.com", passwordHash: "hash" });
  const second = await createUser({ fullname: "Bob", email: "bob@example.com", passwordHash: "hash" });
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
  const messages = await findMessagesByConversation(conversation.id, 3);
  assert.equal(messages.length, 3);
  assert.deepEqual(messages.map((message) => message.content), ["message-0", "message-1", "message-2"]);
});

test("database rejects messages with invalid foreign keys", async () => {
  const sender = await createUser({ fullname: "Alice", email: "alice@example.com", passwordHash: "hash" });

  await assert.rejects(
    () => createMessage({ conversationId: randomUUID(), senderId: sender.id, content: "orphan" }),
    (error: unknown) =>
      typeof error === "object" && error !== null && "code" in error && error.code === "23503"
  );
});

test("session lifecycle persists, refreshes, and revokes records", async () => {
  const user = await createUser({ fullname: "Alice", email: "alice@example.com", passwordHash: "hash" });
  const tokenHash = "a".repeat(64);
  const created = await createSession({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 60_000),
    lastUsedAt: new Date(),
  });

  assert.equal((await findActiveSessionByTokenHash(tokenHash))?.id, created.id);
  await revokeSessionByTokenHash(tokenHash);
  assert.equal(await findActiveSessionByTokenHash(tokenHash), null);
});

test("revokes all sessions for one user", async () => {
  const user = await createUser({ fullname: "Alice", email: "alice@example.com", passwordHash: "hash" });
  const now = new Date();

  await createSession({ userId: user.id, tokenHash: "a".repeat(64), expiresAt: new Date(now.getTime() + 60_000), lastUsedAt: now });
  await createSession({ userId: user.id, tokenHash: "b".repeat(64), expiresAt: new Date(now.getTime() + 60_000), lastUsedAt: now });

  await revokeAllSessionsForUser(user.id);
  const result = await postgresPool.query("SELECT COUNT(*)::int AS count FROM sessions WHERE user_id = $1", [user.id]);
  assert.equal(result.rows[0].count, 0);
});
