import { Buffer } from "node:buffer";
export interface MessageCursor { createdAt: string; id: string; }
const CURSOR_VERSION = 2;
interface EncodedCursor extends MessageCursor { v: number; }
export const encodeMessageCursor = (cursor: MessageCursor): string =>
  Buffer.from(JSON.stringify({ v: CURSOR_VERSION, createdAt: cursor.createdAt, id: cursor.id }), "utf8").toString("base64url");
export const decodeMessageCursor = (value: string): MessageCursor | null => {
  try {
    if (!value || value.length > 512) return null;
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null) return null;
    const cursor = parsed as Partial<EncodedCursor>;
    if (cursor.v !== CURSOR_VERSION || typeof cursor.createdAt !== "string" || typeof cursor.id !== "string") return null;
    const timestamp = new Date(cursor.createdAt);
    if (Number.isNaN(timestamp.getTime()) || timestamp.toISOString() !== cursor.createdAt) return null;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cursor.id)) return null;
    return { createdAt: cursor.createdAt, id: cursor.id };
  } catch { return null; }
};
