import assert from "node:assert/strict";
import { calculateRefundPolicy } from "../services/refundPolicy.service";

const now = new Date("2026-07-20T00:00:00.000Z");
const scheduledAt = (hours: number) =>
  new Date(now.getTime() + hours * 3_600_000);

const scheduledPolicy = (hours: number) =>
  calculateRefundPolicy({
    role: "customer",
    orderType: "scheduled",
    orderStatus: "accepted",
    scheduledAt: scheduledAt(hours),
    hasAssignedProvider: true,
    paidAmount: 500_000,
    now,
  });

assert.equal(scheduledPolicy(24).refundRate, 100);
assert.equal(scheduledPolicy(6).refundRate, 80);
assert.equal(scheduledPolicy(2).refundRate, 50);
assert.equal(scheduledPolicy(1).refundRate, 20);
assert.equal(scheduledPolicy(0).canCancel, false);

const normalPolicy = calculateRefundPolicy({
  role: "customer",
  orderType: "normal",
  orderStatus: "accepted",
  hasAssignedProvider: true,
  paidAmount: 500_000,
  now,
});
assert.equal(normalPolicy.refundRate, 70);
assert.equal(normalPolicy.refundAmount, 350_000);
assert.equal(normalPolicy.cancellationFee, 150_000);
assert.equal(normalPolicy.providerCompensation, 120_000);
assert.equal(normalPolicy.platformRetainedAmount, 30_000);

const unassignedPolicy = calculateRefundPolicy({
  role: "customer",
  orderType: "urgent",
  orderStatus: "created",
  hasAssignedProvider: false,
  paidAmount: 500_000,
  now,
});
assert.equal(unassignedPolicy.refundRate, 100);

const providerPolicy = calculateRefundPolicy({
  role: "provider",
  orderType: "scheduled",
  orderStatus: "accepted",
  scheduledAt: scheduledAt(1),
  hasAssignedProvider: true,
  paidAmount: 500_000,
  now,
});
assert.equal(providerPolicy.refundRate, 100);
assert.equal(providerPolicy.providerCompensation, 0);

console.log("Đã kiểm tra thành công chính sách hoàn tiền Handigo V1.");
