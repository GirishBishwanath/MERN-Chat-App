import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import Message from "../models/message.model.js";
import { findMessagePage } from "./message.repository.js";

const firstUser = new Types.ObjectId("507f1f77bcf86cd799439011");
const secondUser = new Types.ObjectId("507f1f77bcf86cd799439012");

const makeMessage = (id: string, createdAt: string, message: string) => ({
  _id: new Types.ObjectId(id),
  senderId: firstUser,
  receiverId: secondUser,
  message,
  createdAt: new Date(createdAt),
  updatedAt: new Date(createdAt),
});

test("message repository returns a bounded newest page in stable ascending order", async () => {
  const rows = [
    makeMessage("507f1f77bcf86cd799439013", "2026-09-14T12:00:00.000Z", "one"),
    makeMessage("507f1f77bcf86cd799439014", "2026-09-14T12:01:00.000Z", "two"),
    makeMessage("507f1f77bcf86cd799439015", "2026-09-14T12:02:00.000Z", "three"),
  ];

  const originalFind = Message.find;
  Message.find = (() => ({
    sort: () => ({ limit: () => ({ exec: async () => rows.slice().reverse() }) }),
  })) as typeof Message.find;

  try {
    const page = await findMessagePage({
      userAId: firstUser,
      userBId: secondUser,
      limit: 2,
    });

    assert.deepEqual(page.messages.map((message) => message.message), ["two", "three"]);
    assert.equal(page.hasMore, true);
  } finally {
    Message.find = originalFind;
  }
});

test("pagination cursor excludes the cursor message and newer messages", async () => {
  const rows = [
    makeMessage("507f1f77bcf86cd799439013", "2026-09-14T12:00:00.000Z", "one"),
    makeMessage("507f1f77bcf86cd799439014", "2026-09-14T12:01:00.000Z", "two"),
    makeMessage("507f1f77bcf86cd799439015", "2026-09-14T12:02:00.000Z", "three"),
  ];

  const originalFind = Message.find;
  Message.find = ((filter: unknown) => ({
    sort: () => ({
      limit: () => ({
        exec: async () => {
          const cursor = (filter as { $and?: unknown[] }).$and?.[1] as
            | { $or?: Array<Record<string, unknown>> }
            | undefined;
          if (!cursor) return rows.slice().reverse();
          return rows
            .filter((row) => row.createdAt < new Date("2026-09-14T12:01:00.000Z"))
            .slice()
            .reverse();
        },
      }),
    }),
  })) as typeof Message.find;

  try {
    const page = await findMessagePage({
      userAId: firstUser,
      userBId: secondUser,
      limit: 2,
      cursor: {
        createdAt: "2026-09-14T12:01:00.000Z",
        id: "507f1f77bcf86cd799439014",
      },
    });

    assert.deepEqual(page.messages.map((message) => message.message), ["one"]);
    assert.equal(page.hasMore, false);
  } finally {
    Message.find = originalFind;
  }
});

test("pagination remains anchored when a newer message is inserted between page reads", async () => {
  const rows = [
    makeMessage("507f1f77bcf86cd799439013", "2026-09-14T12:00:00.000Z", "one"),
    makeMessage("507f1f77bcf86cd799439014", "2026-09-14T12:01:00.000Z", "two"),
    makeMessage("507f1f77bcf86cd799439015", "2026-09-14T12:02:00.000Z", "three"),
  ];
  const inserted = makeMessage("507f1f77bcf86cd799439016", "2026-09-14T12:03:00.000Z", "newer");
  const originalFind = Message.find;
  let includeInserted = false;

  Message.find = ((filter: unknown) => ({
    sort: () => ({
      limit: () => ({
        exec: async () => {
          const source = includeInserted ? [...rows, inserted] : rows;
          const hasCursor = Boolean((filter as { $and?: unknown[] }).$and);
          return (hasCursor
            ? source.filter((row) => row.createdAt < new Date("2026-09-14T12:01:00.000Z"))
            : source
          )
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 3);
        },
      }),
    }),
  })) as typeof Message.find;

  try {
    const firstPage = await findMessagePage({
      userAId: firstUser,
      userBId: secondUser,
      limit: 2,
    });
    includeInserted = true;

    const secondPage = await findMessagePage({
      userAId: firstUser,
      userBId: secondUser,
      limit: 2,
      cursor: {
        createdAt: firstPage.messages[0].createdAt.toISOString(),
        id: firstPage.messages[0]._id.toString(),
      },
    });

    assert.deepEqual(firstPage.messages.map((message) => message.message), ["two", "three"]);
    assert.deepEqual(secondPage.messages.map((message) => message.message), ["one"]);
  } finally {
    Message.find = originalFind;
  }
});
