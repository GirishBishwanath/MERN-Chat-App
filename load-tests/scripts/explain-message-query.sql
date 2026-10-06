-- Run against the local synthetic Phase 18 dataset.
-- Replace the placeholders with the IDs printed by load-tests/scripts/seed.mjs.
-- This is diagnostic only; it does not modify data.

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, conversation_id, sender_id, content, created_at, updated_at
FROM messages
WHERE conversation_id = '<conversation-uuid>'::uuid
ORDER BY created_at DESC, id DESC
LIMIT 51;

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, member_a_id, member_b_id
FROM conversations
WHERE member_a_id = LEAST('<sender-uuid>'::uuid, '<receiver-uuid>'::uuid)
  AND member_b_id = GREATEST('<sender-uuid>'::uuid, '<receiver-uuid>'::uuid)
LIMIT 1;

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, fullname, email
FROM users
WHERE id = '<receiver-uuid>'::uuid
LIMIT 1;
