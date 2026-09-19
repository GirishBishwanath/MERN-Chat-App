import assert from "node:assert/strict";
import test from "node:test";

import { decodeMessageCursor, encodeMessageCursor } from "./messageCursor.js";

const validId = "550e8400-e29b-41d4-a716-446655440000";

test("message cursor round-trips its stable ordering key", () => {
  const cursor = {
    createdAt: "2026-09-14T12:00:00.000Z",
    id: validId,
  };

  const encoded = encodeMessageCursor(cursor);
  assert.deepEqual(decodeMessageCursor(encoded), cursor);
});

test("message cursor rejects malformed and unsupported cursors", () => {
  assert.equal(decodeMessageCursor("not-a-cursor"), null);

  const encoded = Buffer.from(
    JSON.stringify({ v: 2, createdAt: "2026-09-14T12:00:00.000Z", id: validId }),
    "utf8"
  ).toString("base64url");
  assert.equal(decodeMessageCursor(encoded), null);
});
