CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT notifications_type_check CHECK (type = 'message'),
    CONSTRAINT notifications_recipient_message_type_unique UNIQUE (recipient_id, message_id, type)
);

CREATE INDEX notifications_recipient_created_at_idx
    ON notifications (recipient_id, created_at DESC, id DESC);
