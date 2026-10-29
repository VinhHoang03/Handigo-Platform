import { requireActionMatch, type ActionIdentity, type ActionLedger, type ActionRecord } from "../../ai/runtime/action-ledger";

// Chỉ dùng trong bài kiểm thử không gọi database; kiểm chứng Mongo có script Atlas riêng.
export class FixtureActionLedger implements ActionLedger {
  readonly records = new Map<string, ActionRecord>();
  loseResultFor?: string;
  async find(identity: ActionIdentity) {
    const record = this.records.get(identity.id);
    if (!record) return null;
    requireActionMatch(identity, record);
    return structuredClone(record);
  }
  async reserve(identity: ActionIdentity) {
    const record = this.records.get(identity.id);
    if (record) { requireActionMatch(identity, record); return { record: structuredClone(record), inserted: false }; }
    if ([...this.records.values()].some((item) => item.userId === identity.userId && item.sessionId === identity.sessionId && item.active)) {
      throw new Error("Phiên fixture còn hành động chưa rõ.");
    }
    const next: ActionRecord = { ...identity, status: "EXECUTING", active: true, startedAt: new Date().toISOString() };
    this.records.set(identity.id, next);
    return { record: structuredClone(next), inserted: true };
  }
  async settle(identity: ActionIdentity, status: "UNKNOWN" | "SUCCEEDED" | "EXPIRED", result?: unknown) {
    const record = this.records.get(identity.id)!;
    requireActionMatch(identity, record);
    if (!["SUCCEEDED", "EXPIRED"].includes(record.status)) Object.assign(record,
      { status, active: status === "UNKNOWN", ...(result !== undefined ? { result } : {}) });
    if (status === "SUCCEEDED" && identity.tool === this.loseResultFor) {
      this.loseResultFor = undefined;
      throw new Error("Mất phản hồi sau lưu ledger, trước checkpoint phiên.");
    }
    return structuredClone(record);
  }
}
