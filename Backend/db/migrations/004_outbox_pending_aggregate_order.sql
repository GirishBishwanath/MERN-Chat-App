CREATE INDEX outbox_aggregate_pending_order_idx
    ON outbox_events (aggregate_id, sequence_number)
    WHERE status IN ('pending', 'processing');
