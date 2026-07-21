export type RefundRetryStatus = "failed" | "manual_review";

const BASE_RETRY_DELAY_MS = 5 * 60_000;
const MAX_RETRY_DELAY_MS = 60 * 60_000;

export const isPayosPayoutEnabled = (value: string | undefined) =>
  value?.trim().toLowerCase() === "true";

export const requiresPayosRefundRecoveryCheck = (
  channel: string | null | undefined,
  destination: string | null | undefined,
  payoutId: string | null | undefined,
) =>
  Boolean(payoutId) ||
  channel === "payos_payout" ||
  destination === "source_account";

export const isRefundLeaseAvailable = (
  leaseExpiresAt: Date | null | undefined,
  now = new Date(),
) => !leaseExpiresAt || leaseExpiresAt <= now;

export const getRefundRetryDecision = (
  attemptCount: number,
  maxAttempts: number,
  now = new Date(),
): { status: RefundRetryStatus; nextRetryAt: Date | null } => {
  if (attemptCount >= maxAttempts) {
    return { status: "manual_review", nextRetryAt: null };
  }

  const retryDelayMs = Math.min(
    Math.max(attemptCount, 1) * BASE_RETRY_DELAY_MS,
    MAX_RETRY_DELAY_MS,
  );
  return {
    status: "failed",
    nextRetryAt: new Date(now.getTime() + retryDelayMs),
  };
};
