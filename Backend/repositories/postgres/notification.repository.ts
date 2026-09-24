import { postgresPool } from "../../db/pool.js";

export interface PostgresNotification {
  id: string;
  recipientId: string;
  messageId: string;
  type: string;
  createdAt: Date;
}

export const countNotificationsForMessage = async (
  recipientId: string,
  messageId: string
): Promise<number> => {
  const result = await postgresPool.query(
    "SELECT COUNT(*)::int AS count FROM notifications WHERE recipient_id = $1 AND message_id = $2 AND type = 'message'",
    [recipientId, messageId]
  );
  return Number(result.rows[0]?.count ?? 0);
};
