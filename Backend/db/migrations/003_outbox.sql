CREATE TABLE outbox_events (
    id UUID PRIMARY KEY,
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(150) NOT NULL,
    event_version INTEGER NOT NULL CHECK (event_version > 0),
    topic VARCHAR(249) NOT NULL,
    partition_key VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    headers JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'published', 'dead_lettered')),
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_until TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    CONSTRAINT outbox_processing_lock_check
        CHECK (
            (status = 'processing' AND locked_until IS NOT NULL)
            OR status <> 'processing'
        ),
    CONSTRAINT outbox_published_at_check
        CHECK (
            (status = 'published' AND published_at IS NOT NULL)
            OR status <> 'published'
        )
);

CREATE INDEX outbox_pending_claim_idx
    ON outbox_events (available_at, created_at, id)
    WHERE status IN ('pending', 'processing');

CREATE INDEX outbox_aggregate_order_idx
    ON outbox_events (aggregate_id, created_at, id);

CREATE INDEX outbox_status_created_idx
    ON outbox_events (status, created_at, id);
