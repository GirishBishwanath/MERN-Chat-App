import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

const email = process.env.K6_SEED_EMAIL || "phase18-benchmark-alice@example.com";
const receiverEmail = process.env.K6_RECEIVER_EMAIL || "phase18-benchmark-bob@example.com";
const messageCount = Number.parseInt(process.env.K6_MESSAGE_COUNT || "500", 10);
if (!Number.isSafeInteger(messageCount) || messageCount < 1 || messageCount > 10000) {
  throw new Error("K6_MESSAGE_COUNT must be between 1 and 10000");
}

const password = process.env.K6_SEED_PASSWORD || "Phase18BenchmarkPassword!123";
const hashScript = `const bcrypt=require("bcryptjs"); bcrypt.hash(process.argv[1],12).then((h)=>process.stdout.write(h));`;
const hash = execFileSync("docker", ["compose","run","--rm","-T","backend","node","-e",hashScript,password], { encoding:"utf8", stdio:["ignore","pipe","inherit"] }).trim();
const aliceId = randomUUID();
const bobId = randomUUID();
const conversationId = randomUUID();

const sql = `
INSERT INTO users (id, fullname, email, password_hash)
VALUES ('${aliceId}','Phase 18 Alice','${email.replaceAll("'","''")}','${hash}')
ON CONFLICT (email) DO UPDATE SET fullname=EXCLUDED.fullname, password_hash=EXCLUDED.password_hash;

INSERT INTO users (id, fullname, email, password_hash)
VALUES ('${bobId}','Phase 18 Bob','${receiverEmail.replaceAll("'","''")}','${hash}')
ON CONFLICT (email) DO UPDATE SET fullname=EXCLUDED.fullname, password_hash=EXCLUDED.password_hash;

INSERT INTO conversations (id, member_a_id, member_b_id)
VALUES ('${conversationId}','${aliceId > bobId ? bobId : aliceId}','${aliceId > bobId ? aliceId : bobId}')
ON CONFLICT (member_a_id, member_b_id) DO NOTHING;

WITH target AS (
  SELECT id FROM conversations
  WHERE member_a_id='${aliceId > bobId ? bobId : aliceId}' AND member_b_id='${aliceId > bobId ? aliceId : bobId}'
)
INSERT INTO conversation_members (conversation_id,user_id)
SELECT id, value::uuid FROM target, UNNEST(ARRAY['${aliceId}','${bobId}']) AS value;

WITH target AS (
  SELECT id FROM conversations
  WHERE member_a_id='${aliceId > bobId ? bobId : aliceId}' AND member_b_id='${aliceId > bobId ? aliceId : bobId}'
)
INSERT INTO messages (id,conversation_id,sender_id,content,created_at,updated_at)
SELECT gen_random_uuid(), id, CASE WHEN n % 2 = 0 THEN '${aliceId}'::uuid ELSE '${bobId}'::uuid END,
       'Synthetic Phase 18 message ' || n,
       NOW() - (n || ' seconds')::interval,
       NOW() - (n || ' seconds')::interval
FROM target, generate_series(1,${messageCount}) AS n;

SELECT '${aliceId}|${bobId}' AS ids;
`;

const out = execFileSync("docker",[
  "compose","exec","-T","postgres","psql","-U","postgres","-d",
  process.env.POSTGRES_DATABASE || "mern_chat_app","-v","ON_ERROR_STOP=1"
],{input:sql,encoding:"utf8",stdio:["pipe","pipe","inherit"]});

const pair = out.split(/?\n/).map((line)=>line.trim()).find((line)=>/^[0-9a-f-]{36}\|[0-9a-f-]{36}$/.test(line));
if (!pair) throw new Error("Could not recover seeded user IDs");
const [seedUserId,seedReceiverId]=pair.split("|");
console.log(JSON.stringify({email,receiverEmail,password,seedUserId,seedReceiverId,messageCount},null,2));
