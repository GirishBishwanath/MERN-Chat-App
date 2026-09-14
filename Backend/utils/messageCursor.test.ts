import assert from "node:assert/strict";
import test from "node:test";

import { decodeMessageCursor, encodeMessageCursor } from "./messageCursor.js";

test("message cursor round-trips its stable ordering key", () => {
  const cursor = {
    createdAt: "2026-09-14T12:00:00.000Z",
    id: "507f1f77bcf86cd799439011",
  };

  const encoded = encodeMessageCursor(cursor);
  assert.deepEqual(decodeMessageCursor(encoded), cursor);
});

test("message cursor rejects malformed and unsupported cursors", () => {
  assert.equal(decodeMessageCursor("not-a-cursor"), null);

  const encoded = Buffer.from(
    JSON.stringify({ v: 2, createdAt: "2026-09-14T12:00:00.000Z", id: "507f1f77bcf86cd799439011" }),
    "utf8"
  ).toString("base64url");
  assert.equal(decodeMessageCursor(encoded), null);
});
