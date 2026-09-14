import assert from "node:assert/strict";
import test from "node:test";

import { encodeMessageCursor } from "../utils/messageCursor.js";
import {
  getMessagePageOptions,
  getMessageSchema,
  sendMessageSchema,
} from "./message.schemas.js";

const validId = "507f1f77bcf86cd799439011";

const request = (input: {
  id?: string;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
}) => ({
  params: { id: input.id ?? validId },
  query: input.query ?? {},
  body: input.body ?? {},
}) as never;

test("message validation accepts defaults and bounded limits", () => {
  const result = getMessageSchema(request({ query: { limit: "100" } }));
  assert.equal(result.valid, true);
  assert.deepEqual(getMessagePageOptions(request({})), { limit: 50, cursor: undefined });
  assert.deepEqual(getMessagePageOptions(request({ query: { limit: "25" } })), {
    limit: 25,
    cursor: undefined,
  });
});

test("message validation rejects missing, zero, and oversized limits", () => {
  for (const limit of ["0", "101", "1.5", "abc"]) {
    const result = getMessageSchema(request({ query: { limit } }));
    assert.equal(result.valid, false);
    assert.equal(result.errors.limit !== undefined, true);
  }
});

test("message validation accepts and rejects cursors", () => {
  const validCursor = encodeMessageCursor({
    createdAt: "2026-09-14T12:00:00.000Z",
    id: validId,
  });

  assert.equal(getMessageSchema(request({ query: { cursor: validCursor } })).valid, true);
  assert.equal(getMessageSchema(request({ query: { cursor: "invalid" } })).valid, false);
});

test("send validation enforces receiver id and message length", () => {
  assert.equal(sendMessageSchema(request({ body: { message: "hello" } })).valid, true);
  assert.equal(sendMessageSchema(request({ body: { message: "   " } })).valid, false);
  assert.equal(
    sendMessageSchema(request({ body: { message: "x".repeat(5001) } })).valid,
    false
  );
  assert.equal(
    sendMessageSchema(request({ id: "not-an-object-id", body: { message: "hello" } })).valid,
    false
  );
});
