import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

const email = process.env.K6_SEED_EMAIL || "phase18-benchmark-alice@example.com";
const receiverEmail = process.env.K6_RECEIVER_EMAIL || "phase18-benchmark-bob@example.com";
const messageCount = Number.parseInt(process.env.K6_MESSAGE_COUNT || "500", 10);
const password = process.env.K6_SEED_PASSWORD || "Phase18BenchmarkPassword!123";

if (!Number.isSafeInteger(messageCount) || messageCount < 1 || messageCount > 10000) {
  throw new Error("K6_MESSAGE_COUNT must be between 1 and 10000");
}

for (const value of [email, receiverEmail]) {
  if (!/^phase18-benchmark-[a-z0-9-]+@example\.com$/.test(value)) {
    throw new Error("Benchmark emails must use the phase18-benchmark-* @example.com namespace");
  }
}

const escape = (value) => value.replaceAll("'", "''");
const hashScript = 'const bcrypt=require("bcryptjs"); bcrypt.hash(process.argv[1],12).then((h)=>process.stdout.write(h));';
const hash = execFileSync(
  "docker",
  ["compose", "run", "--rm", "-T", "backend", "node", "-e", hashScript, password],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
).trim();

const sql = `
CREATE TEMP TABLE phase18_old_conversations (id UUID PRIMARY KEY);

INSERT INTO phase18_old_conversations (id)
SELECT id
FROM conversations
WHERE member_a_id IN (SELECT id FROM users WHERE email IN ('${escape(email)}', '${escape(receiverEmail)}'))
   OR member_b_id IN (SELECT id FROM users WHERE email IN ('${escape(email)}', '${escape(receiverEmail)}'));

DELETE FROM outbox_events
WHERE aggregate_id IN (SELECT id FROM phase18_old_conversations);

DELETE FROM users
WHERE email IN ('${escape(email)}', '${escape(receiverEmail)}');

INSERT INTO users (id, fullname, email, password_hash)
VALUES (gen_random_uuid(), 'Phase 18 Alice', '${escape(email)}', '${escape(hash)}');

INSERT INTO users (id, fullname, email, password_hash)
VALUES (gen_random_uuid(), 'Phase 18 Bob', '${escape(receiverEmail)}', '${escape(hash)}');

WITH selected AS (
  SELECT
    MIN(id) FILTER (WHERE email = '${escape(email)}') AS alice_id,
    MIN(id) FILTER (WHERE email = '${escape(receiverEmail)}') AS bob_id
  FROM users
  WHERE email IN ('${escape(email)}', '${escape(receiverEmail)}')
),
conversation AS (
  INSERT INTO conversations (id, member_a_id, member_b_id)
  SELECT gen_random_uuid(), LEAST(alice_id, bob_id), GREATEST(alice_id, bob_id)
  FROM selected
  RETURNING id, member_a_id, member_b_id
)
INSERT INTO conversation_members (conversation_id, user_id)
SELECT conversation.id, selected.alice_id
FROM conversation CROSS JOIN selected
UNION ALL
SELECT conversation.id, selected.bob_id
FROM conversation CROSS JOIN selected;

WITH selected AS (
  SELECT
    MIN(id) FILTER (WHERE email = '${escape(email)}') AS alice_id,
    MIN(id) FILTER (WHERE email = '${escape(receiverEmail)}') AS bob_id
  FROM users
  WHERE email IN ('${escape(email)}', '${escape(receiverEmail)}')
),
conversation AS (
  SELECT c.id
  FROM conversations c, selected
  WHERE c.member_a_id = LEAST(selected.alice_id, selected.bob_id)
    AND c.member_b_id = GREATEST(selected.alice_id, selected.bob_id)
)
INSERT INTO messages (id, conversation_id, sender_id, content, created_at, updated_at)
SELECT
  gen_random_uuid(),
  conversation.id,
  CASE WHEN n % 2 = 0 THEN selected.alice_id ELSE selected.bob_id END,
  'Synthetic Phase 18 message ' || n,
  NOW() - (n || ' seconds')::interval,
  NOW() - (n || ' seconds')::interval
FROM conversation
CROSS JOIN selected
CROSS JOIN generate_series(1, ${messageCount}) AS n;

SELECT
  (SELECT id FROM users WHERE email = '${escape(email)}') || '|' ||
  (SELECT id FROM users WHERE email = '${escape(receiverEmail)}') || '|' ||
  (SELECT c.id
   FROM conversations c
   JOIN users a ON a.id = c.member_a_id
   JOIN users b ON b.id = c.member_b_id
   WHERE a.email = '${escape(email)}'
     AND b.email = '${escape(receiverEmail)}'
      OR a.email = '${escape(receiverEmail)}'
     AND b.email = '${escape(email)}');
`;

const output = execFileSync(
  "docker",
  [
    "compose", "exec", "-T", "postgres", "psql", "-U", "postgres",
    "-d", process.env.POSTGRES_DATABASE || "mern_chat_app",
    "-v", "ON_ERROR_STOP=1",
  ],
  { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] },
);

const pair = output
  .split(/\r?\n/)
  .map((line) => line.trim())
  .find((line) => /^[0-9a-f-]{36}\|[0-9a-f-]{36}\|[0-9a-f-]{36}$/.test(line));

if (!pair) throw new Error("Could not recover seeded user IDs");

const [seedUserId, seedReceiverId, conversationId] = pair.split("|");

console.log(JSON.stringify({
  email,
  receiverEmail,
  seedUserId,
  seedReceiverId,
  conversationId,
  messageCount,
}, null, 2));
