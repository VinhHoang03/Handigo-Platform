import assert from "node:assert/strict";
import {
  getRefundRetryDecision,
  isPayosPayoutEnabled,
  isRefundLeaseAvailable,
  requiresPayosRefundRecoveryCheck,
} from "../services/refundProcessing";

const now = new Date("2026-07-21T00:00:00.000Z");

assert.equal(isRefundLeaseAvailable(null, now), true);
assert.equal(
  isRefundLeaseAvailable(new Date("2026-07-20T23:59:59.000Z"), now),
  true,
);
assert.equal(
  isRefundLeaseAvailable(new Date("2026-07-21T00:00:01.000Z"), now),
  false,
);

const retry = getRefundRetryDecision(2, 5, now);
assert.equal(retry.status, "failed");
assert.equal(retry.nextRetryAt?.toISOString(), "2026-07-21T00:10:00.000Z");

const manualReview = getRefundRetryDecision(5, 5, now);
assert.equal(manualReview.status, "manual_review");
assert.equal(manualReview.nextRetryAt, null);

assert.equal(isPayosPayoutEnabled(undefined), false);
assert.equal(isPayosPayoutEnabled("false"), false);
assert.equal(isPayosPayoutEnabled(" true "), true);
assert.equal(isPayosPayoutEnabled("TRUE"), true);
assert.equal(requiresPayosRefundRecoveryCheck(null, null, null), false);
assert.equal(
  requiresPayosRefundRecoveryCheck("payos_payout", "source_account", null),
  true,
);
assert.equal(requiresPayosRefundRecoveryCheck(null, null, "payout_123"), true);

console.log("Đã kiểm tra thành công state machine xử lý hoàn tiền PayOS.");
