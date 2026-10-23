import type { ClientSession } from "mongoose";
import { setTimeout as delay } from "node:timers/promises";
import { createLogger } from "./logger";

const transactionLogger = createLogger("Transaction");

// Một số lỗi WriteConflict không có nhãn tạm thời nên driver không tự thử lại.
export async function withTransactionRetry<T>(session: ClientSession, operation: (session: ClientSession) => Promise<T>) {
  const startedAt = Date.now();
  for (let attempt = 1; ; attempt++) {
    try { return await session.withTransaction(operation); }
    catch (error) {
      const failure = error as { code?: number; codeName?: string; errorLabels?: string[]; hasErrorLabel?: (label: string) => boolean } | null;
      const unknownCommit = failure?.errorLabels?.includes("UnknownTransactionCommitResult")
        || failure?.hasErrorLabel?.("UnknownTransactionCommitResult");
      const conflict = failure?.code === 112 || failure?.codeName === "WriteConflict";
      if (!conflict || unknownCommit || attempt >= 3 || Date.now() - startedAt >= 5000) throw error;
      transactionLogger.warn("Xung đột ghi, đang thử lại toàn bộ giao dịch.", {
        attempt, code: failure?.code, codeName: failure?.codeName, errorLabels: failure?.errorLabels,
      });
      await delay(25 * attempt + Math.floor(Math.random() * 50));
    }
  }
}

export const buildTransactionCode = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
