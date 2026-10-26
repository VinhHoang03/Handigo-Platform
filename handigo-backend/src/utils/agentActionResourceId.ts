import { createHash } from "node:crypto";
import { Types } from "mongoose";

// ID nội bộ giúp tra đúng kết quả ghi khi phản hồi của hành động bị gián đoạn.
export const agentActionResourceId = (userId: string, sessionId: string, actionId: string) => new Types.ObjectId(
  createHash("sha256").update(JSON.stringify([userId, sessionId, actionId])).digest("hex").slice(0, 24),
);
