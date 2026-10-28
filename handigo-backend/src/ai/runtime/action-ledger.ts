import { createHash } from "node:crypto";
import type { PendingAction } from "../agent/agent-state";
import { AppError } from "../../utils/appError";

export type ActionDomain = "booking" | "payment" | "customer-care";
export interface ActionIdentity {
  id: string;
  userId: string;
  sessionId: string;
  actionId: string;
  digest: string;
  domain: ActionDomain;
  tool: string;
}
export interface ActionRecord extends ActionIdentity {
  status: "EXECUTING" | "UNKNOWN" | "SUCCEEDED" | "EXPIRED";
  active: boolean;
  startedAt: string;
  result?: unknown;
}
export interface ActionLedger {
  find(identity: ActionIdentity): Promise<ActionRecord | null>;
  // Chỉ lời gọi chèn thành công được phép gọi service ghi một lần.
  reserve(identity: ActionIdentity): Promise<{ record: ActionRecord; inserted: boolean }>;
  settle(identity: ActionIdentity, status: "UNKNOWN" | "SUCCEEDED" | "EXPIRED", result?: unknown): Promise<ActionRecord>;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
}

export function actionIdentity(userId: string, sessionId: string, domain: ActionDomain, action: PendingAction): ActionIdentity {
  const payload = JSON.parse(JSON.stringify({ domain, tool: action.tool, taskVersion: action.taskVersion,
    arguments: action.arguments, preview: action.preview, policyConsent: action.policyConsent,
    createdAt: action.createdAt, expiresAt: action.expiresAt }));
  return { userId, sessionId, domain, actionId: action.id, tool: action.tool,
    id: createHash("sha256").update(JSON.stringify([userId, sessionId, action.id])).digest("hex"),
    digest: createHash("sha256").update(canonical(payload)).digest("hex") };
}

export function requireActionMatch(identity: ActionIdentity, record: ActionRecord) {
  if (identity.id !== record.id || identity.userId !== record.userId || identity.sessionId !== record.sessionId
    || identity.actionId !== record.actionId || identity.digest !== record.digest
    || identity.domain !== record.domain || identity.tool !== record.tool) {
    throw new AppError("Hành động đã được ghi nhận với thông tin khác. Vui lòng tải lại phiên.", 409);
  }
}
