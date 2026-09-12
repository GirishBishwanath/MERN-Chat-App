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

For direct conversations, `conversations` also stores the two member IDs in canonical order. This small amount of deliberate denormalization makes the "one conversation per unordered pair" invariant enforceable with a normal unique constraint while `conversation_members` remains the normalized membership and authorization relationship.

Messages belong to a conversation and reference their sender. The receiver is derivable from the two-member conversation and therefore is not stored as a second relationship that can drift from membership state.

Refresh sessions remain a separate table because they are independently created, revoked, expired, and queried by user.

## Proposed schema

### `users`

```sql
CREATE TABLE users (
    id            UUID PRIMARY KEY,
    fullname      VARCHAR(100) NOT NULL,
    email         VARCHAR(320) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    id           UUID PRIMARY KEY,
    member_a_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    member_b_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT conversations_members_distinct
        CHECK (member_a_id <> member_b_id),
    CONSTRAINT conversations_members_canonical
        CHECK (member_a_id < member_b_id),
    CONSTRAINT conversations_direct_pair_unique
        UNIQUE (member_a_id, member_b_id)
);
```

`updated_at` represents conversation activity and can later support conversation-list ordering without deriving that value from an unbounded message collection.

The canonical pair is always stored as the lower UUID in `member_a_id` and the higher UUID in `member_b_id`. The uniqueness constraint therefore represents an unordered user pair deterministically:

```text
(A, B) == (B, A)
```

The application does not need a separate "conversation already exists" record to establish uniqueness under concurrent requests; the database constraint is the final authority.

### `conversation_members`

```sql
CREATE TABLE conversation_members (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id)
);
```

Required access index:

```sql
CREATE INDEX conversation_members_user_id_idx
    ON conversation_members (user_id, conversation_id);
```

The composite primary key prevents duplicate membership rows.

The current product only supports direct conversations, so each conversation must have exactly two corresponding membership rows, matching `member_a_id` and `member_b_id`. A row-level `CHECK` constraint cannot enforce that cross-row cardinality by itself; Phase 07 must create the conversation and its two membership rows transactionally and validate that both canonical members are inserted.

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

The current MongoDB lookup searches for a conversation whose member array contains both users. In PostgreSQL, the primary direct-conversation identity is the canonical pair on `conversations`.

The caller normalizes the two UUIDs into `(member_a_id, member_b_id)` and performs a direct indexed lookup:

```sql
SELECT id
FROM conversations
WHERE member_a_id = $1
  AND member_b_id = $2;
```

Because the pair is canonicalized before the query, the lookup is symmetric for the two users and the unique constraint guarantees at most one matching conversation.

The membership table remains useful for authorization and member retrieval:

```sql
SELECT user_id
FROM conversation_members
WHERE conversation_id = $1;
```

Phase 07 must populate both the canonical pair columns and the two membership rows in the same transaction.

## Direct conversation creation and concurrency

The critical invariant is:

```text
one direct conversation per unordered pair of users
```

The preferred implementation is to canonicalize the pair in application code and rely on:

```sql
UNIQUE (member_a_id, member_b_id)
```

as the database-level guard.

This is stronger than a read-then-insert sequence on `conversation_members` alone because two concurrent requests can both observe no existing conversation. The unique constraint turns that race into a deterministic database conflict that the service can handle.

The normalized `conversation_members` table remains the source for member-based joins and authorization. The pair columns exist specifically to enforce direct-conversation identity.

This is a deliberate tradeoff: two redundant UUID columns are small and stable, while they make a critical concurrency invariant easy to enforce and reason about.

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
| Find conversation by user pair | `conversations(member_a_id, member_b_id)` unique |
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
  canonicalize the two user IDs
  find or create the unique direct conversation pair
  ensure both membership rows exist
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
- `member_a_id` and `member_b_id` are distinct and stored in canonical order
- there is at most one direct conversation for a given unordered pair of users
- a session token hash is unique
- a session always belongs to an existing user
- timestamps are stored with timezone information

## Migration implications for Phase 07

The existing MongoDB conversation document contains a potentially unbounded `messages` array. Migration must therefore be performed as separate relational writes:

1. migrate users
2. create one PostgreSQL conversation row for each MongoDB conversation, deriving canonical member IDs
3. create two membership rows for each direct conversation
4. migrate each message as an independent row linked to its conversation
5. migrate session rows while preserving token hashes and expiration timestamps
6. validate counts, canonical-pair uniqueness, and relationship integrity before switching reads/writes

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
