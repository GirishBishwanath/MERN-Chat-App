# Phase 06 — PostgreSQL Data Model Design

## Scope

Design the PostgreSQL data model that will replace the current MongoDB persistence model without implementing the database migration yet.

The design is driven by the application's actual access patterns:

- authenticate users by normalized email
- look up a user by ID
- list users other than the authenticated user
- identify the direct conversation between two users
- create a direct conversation when one does not exist
- create messages with sender, receiver, content, and timestamps
- fetch messages for a conversation in chronological order
- persist refresh-session hashes, expiry, and last-used timestamps

Phase 06 is a schema and access-pattern design phase. PostgreSQL runtime adoption and MongoDB-to-PostgreSQL migration belong to Phase 07.

## Problem

The current MongoDB model stores conversation membership as an array and stores message IDs in a conversation document. That representation is convenient for a small prototype but creates an unbounded relationship and makes message growth part of the conversation document's size and update path.

For a production chat system, users, direct conversations, conversation membership, messages, and refresh sessions should have independent relational rows with explicit foreign keys and indexes.

## Decision

Use the following relational entities:

1. `users`
2. `conversations`
3. `conversation_members`
4. `messages`
5. `sessions`

A direct conversation has exactly two members in the current product model. The membership relationship is normalized into `conversation_members` rather than storing user IDs in an array column.

Messages belong to a conversation and reference their sender. The receiver is derivable from the two-member conversation and therefore is not stored as a second relationship that can drift from membership state.

Refresh sessions remain a separate table because they are independently created, revoked, expired, and queried by user.

## Proposed schema

### `users`

```sql
CREATE TABLE users (
    id          UUID PRIMARY KEY,
    fullname    VARCHAR(100) NOT NULL,
    email       VARCHAR(320) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Notes:

- `email` is normalized to lowercase before persistence.
- `email` is unique at the database level; application checks are not sufficient by themselves under concurrency.
- Passwords are stored only as password hashes.
- The UUID choice keeps identifiers independent from MongoDB ObjectIds and gives the relational schema a stable application-level identifier.

### `conversations`

```sql
CREATE TABLE conversations (
    id         UUID PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`updated_at` represents conversation activity and can later support conversation-list ordering without deriving that value from an unbounded message collection.

### `conversation_members`

```sql
CREATE TABLE conversation_members (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id)
);
```

Required access indexes:

```sql
CREATE INDEX conversation_members_user_id_idx
    ON conversation_members (user_id, conversation_id);
```

The composite primary key prevents duplicate membership rows.

For the current direct-message product, application/domain logic must enforce exactly two members. PostgreSQL does not have a simple row-level `CHECK` constraint that enforces a two-row cardinality across this table, so the invariant belongs in the transaction that creates a conversation. Phase 07 must preserve that invariant when the migration is implemented.

### `messages`

```sql
CREATE TABLE messages (
    id              UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Primary access index for message history:

```sql
CREATE INDEX messages_conversation_created_at_idx
    ON messages (conversation_id, created_at DESC, id DESC);
```

The `id` tie-breaker makes ordering deterministic when two messages have the same timestamp. This index is intentionally designed for the cursor pagination that will be implemented in Phase 08.

### `sessions`

```sql
CREATE TABLE sessions (
    id           UUID PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   CHAR(64) NOT NULL UNIQUE,
    expires_at   TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Required access indexes:

```sql
CREATE INDEX sessions_user_id_idx
    ON sessions (user_id, created_at DESC);

CREATE INDEX sessions_expires_at_idx
    ON sessions (expires_at);
```

`token_hash` stores the SHA-256 representation of the opaque refresh token rather than the raw token.

PostgreSQL itself does not provide MongoDB TTL-index semantics, so session expiry requires application cleanup or a scheduled database cleanup job. Expired sessions must also be rejected by the authorization path even before cleanup removes them.

## Direct conversation lookup

The current MongoDB lookup searches for a conversation whose member array contains both users. In PostgreSQL, the equivalent access pattern must avoid scanning all memberships.

The design uses the indexed membership table for lookup and keeps the operation transactional.

For two known user IDs, the logical query is:

```sql
SELECT c.id
FROM conversations AS c
JOIN conversation_members AS cm
    ON cm.conversation_id = c.id
WHERE cm.user_id IN ($1, $2)
GROUP BY c.id
HAVING COUNT(DISTINCT cm.user_id) = 2
   AND COUNT(*) = 2;
```

This query identifies a direct conversation containing exactly the two requested members in the current two-person model.

During Phase 07, conversation creation and this lookup should execute inside a transaction so concurrent sends cannot create two conversations for the same pair.

## Stronger uniqueness for direct conversations

A plain membership table cannot express "there is exactly one conversation for this unordered pair of users" with a simple unique constraint.

The preferred Phase 07 implementation is to introduce canonical pair columns on `conversations` for direct conversations:

```text
member_a_id
member_b_id
```

with the invariant:

```text
member_a_id < member_b_id
```

and a unique constraint:

```sql
UNIQUE (member_a_id, member_b_id)
```

This makes the direct-message identity database-enforceable and removes a race where two concurrent requests could both observe "no conversation" and create separate conversations.

The normalized `conversation_members` table remains the source for membership joins and authorization. The canonical pair columns exist specifically to make the direct-conversation uniqueness invariant explicit and enforceable.

This is a deliberate tradeoff: two small redundant UUID columns simplify a critical uniqueness constraint and make the concurrency behavior much easier to reason about than attempting to derive pair uniqueness from an arbitrary set of membership rows.

## Message model decision

Do not keep a `messages` array on `conversations`.

The current MongoDB model does this:

```text
conversation
  └── messages[] → message IDs
```

The PostgreSQL model instead does:

```text
conversations
  └──< messages
```

This keeps conversation rows bounded and allows message history to grow independently. It also permits an index specifically optimized for chronological or cursor-based message retrieval.

## Message receiver decision

The current API accepts a receiver user ID when sending a message. The persisted relational model does not need a duplicated `receiver_id` column because a direct conversation has exactly two members and the sender is known.

The receiver can therefore be derived as:

```sql
SELECT cm.user_id
FROM conversation_members AS cm
WHERE cm.conversation_id = $1
  AND cm.user_id <> $2;
```

This avoids storing two independent user relationships that could disagree.

When the product later supports group conversations, the API/domain model should move away from a receiver-specific concept rather than extending this column into a group-chat table that cannot represent the semantics cleanly.

## Access-pattern summary

| Operation | Primary index / constraint |
|---|---|
| Register by email | `users.email` unique |
| Get user by ID | `users.id` primary key |
| List users except current user | `users.id` primary key; add ordering index later if required |
| Find conversation by user pair | `conversations` canonical pair unique constraint + `conversation_members_user_id_idx` |
| Get conversation members | `conversation_members` primary key |
| Send message | `messages.conversation_id` foreign key + conversation membership lookup |
| Read message history | `messages_conversation_created_at_idx` |
| Find sessions for user | `sessions_user_id_idx` |
| Reject/cleanup expired sessions | `sessions_expires_at_idx` |

## Transaction boundaries

Phase 07 must make these operations transactional:

### Create direct conversation + first message

```text
BEGIN
  verify receiver exists
  find or create canonical conversation pair
  insert message
  update conversation.updated_at
COMMIT
```

If any step fails, neither the conversation nor the message should be partially persisted.

### Refresh session update

Updating `last_used_at` and issuing the corresponding access credential must retain the existing session lifecycle contract. Revocation and expiry checks must remain authoritative in the database-backed session record.

## Constraints and integrity rules

The PostgreSQL implementation must preserve these invariants:

- user email is unique and normalized
- message sender must reference an existing user
- message conversation must exist
- conversation membership must reference existing users and conversations
- the same user cannot be added twice to one conversation
- a direct conversation contains exactly two distinct members
- there is at most one direct conversation for a given unordered pair of users
- a session token hash is unique
- a session always belongs to an existing user
- timestamps are stored with timezone information

## Migration implications for Phase 07

The existing MongoDB conversation document contains a potentially unbounded `messages` array. Migration must therefore be performed as separate relational writes:

1. migrate users
2. create one PostgreSQL conversation row for each MongoDB conversation
3. create two membership rows for each direct conversation
4. migrate each message as an independent row linked to its conversation
5. migrate session rows while preserving token hashes and expiration timestamps
6. validate counts and relationship integrity before switching reads/writes

No destructive MongoDB operation belongs in Phase 06.

## Deliberately not introduced in Phase 06

- PostgreSQL runtime dependency in the application
- ORM or query builder
- migration runner
- MongoDB data migration code
- Redis
- Kafka
- outbox tables
- message cursor API implementation
- optimistic message state

Those concerns belong to later phases and should not be coupled to the schema design unnecessarily.

## Quality gate

Phase 06 is complete when the repository contains:

- an explicit relational schema
- documented constraints and foreign keys
- indexes justified by actual access patterns
- a clear direct-conversation uniqueness strategy
- a cursor-friendly message index
- documented transaction boundaries
- migration implications for Phase 07
- no premature runtime database migration
