import assert from "node:assert/strict";
import { mock } from "node:test";
import mongoose, { Types } from "mongoose";
import { AuditLog } from "../models/auditLog.model";
import { createConfig, updateConfig, getRefundPolicy, getRewardPolicy } from "../services/systemConfig.service";
import { DEFAULT_REFUND_POLICY, refundPolicySchema } from "../validations/refundPolicy.validator";
import { DEFAULT_REWARD_POLICY, rewardPolicySchema } from "../validations/reward.validator";
import { calculateRefundPolicy, QUOTATION_DEPOSIT_POLICY_VERSION, type RefundPolicyInput } from "../services/refundPolicy.service";
import { getCustomerBookingPolicies } from "../services/bookingPolicy.service";

// Dùng cấu hình và database giả lập, không đọc bí mật hoặc gọi cổng thanh toán.
async function run() {
  const admin = { id: new Types.ObjectId().toString(), role: "ADMIN" as const };
  const customer = { ...admin, role: "CUSTOMER" as const };
  const configs = new Map<string, any>();
  const audits: any[] = [];
  const collection = {
    createIndex: async () => "key_1",
    findOne: async ({ key }: any) => configs.get(key) ?? null,
    insertOne: async (value: any) => {
      const document = { ...value, _id: new Types.ObjectId() };
      configs.set(value.key, document); return { insertedId: document._id };
    },
    updateOne: async ({ key }: any, { $set }: any) => {
      configs.set(key, { ...configs.get(key), ...$set }); return { matchedCount: 1 };
    },
  };
  mock.method(mongoose.connection, "collection", () => collection as never);
  mock.method(AuditLog, "create", async (row: any) => { audits.push(row); return row; });
  try {
    assert.deepEqual(await getRefundPolicy(), DEFAULT_REFUND_POLICY);
    assert.deepEqual(await getRewardPolicy(), DEFAULT_REWARD_POLICY);
    assert.equal((await getCustomerBookingPolicies()).fixedPriceRefund.normalRefundPercent, 70);
    const payload = { key: "REFUND_POLICY", type: "JSON" as const, value: DEFAULT_REFUND_POLICY, isPublic: false };
    await assert.rejects(createConfig(customer, payload), /quản trị viên/);
    await assert.rejects(createConfig(admin, { ...payload, isPublic: true }), /nội bộ/);
    await assert.rejects(createConfig(admin, { ...payload, type: "STRING" }), /JSON/);
    for (const value of [
      { ...DEFAULT_REFUND_POLICY, normalRefundPercent: 101 },
      { ...DEFAULT_REFUND_POLICY, earlyHours: 6 },
      { ...DEFAULT_REFUND_POLICY, lastMinuteRefundPercent: 90 },
      { ...DEFAULT_REFUND_POLICY, middleHours: 0 },
      { ...DEFAULT_REFUND_POLICY, unknown: true },
    ]) {
      assert.equal(refundPolicySchema.safeParse(value).success, false);
      await assert.rejects(createConfig(admin, { ...payload, value }), /không hợp lệ/);
    }
    await createConfig(admin, payload);
    const custom = { ...DEFAULT_REFUND_POLICY, normalRefundPercent: 60,
      missingScheduleRefundPercent: 40, earlyHours: 48, middleHours: 12, lateHours: 3,
      earlyRefundPercent: 95, middleRefundPercent: 75, lateRefundPercent: 45,
      lastMinuteRefundPercent: 10, providerCompensationPercent: 35 };
    await updateConfig(admin, payload.key, { value: custom });
    assert.deepEqual(await getRefundPolicy(), custom);
    configs.set("BOOKING_POLICY", { type: "JSON", value: { paymentHoldMinutes: 20,
      providerCalendars: { [admin.id]: { weekly: { "1": [{ start: 480, end: 1200 }] }, absences: [] } } } });
    configs.set("INITIAL_PROVIDER_RADIUS_KM", { type: "NUMBER", value: 7 });
    configs.set("MAX_PROVIDER_RADIUS_KM", { type: "NUMBER", value: 15 });
    configs.set("MATCHING_EXPAND_AFTER_MINUTES", { type: "NUMBER", value: 2 });
    const customerPolicies = await getCustomerBookingPolicies();
    assert.equal(customerPolicies.paymentHoldMinutes, 20);
    assert.equal(customerPolicies.fixedPriceRefund.normalRefundPercent, 60);
    assert.equal(customerPolicies.fixedPriceRefund.earlyHours, 48);
    assert.equal(customerPolicies.matching.initialRadiusKm, 7);
    assert.equal(customerPolicies.matching.expandedRadiusKm, 15);
    assert.equal(customerPolicies.matching.expandAfterMinutes, 2);
    assert.deepEqual(Object.keys(customerPolicies).sort(), ["fixedPriceRefund", "matching", "paymentHoldMinutes"]);
    assert.equal(JSON.stringify(customerPolicies).includes(admin.id), false, "Không công khai lịch riêng hoặc mã hồ sơ thợ.");
    assert.equal("providerCompensationPercent" in customerPolicies.fixedPriceRefund, false);
    await assert.rejects(updateConfig(customer, payload.key, { value: custom }), /quản trị viên/);
    await assert.rejects(updateConfig(admin, payload.key, { value: custom, isPublic: true }), /nội bộ/);
    const now = new Date("2026-10-15T03:00:00Z");
    const input: RefundPolicyInput = { role: "customer", orderType: "scheduled", orderStatus: "accepted",
      paidAmount: 100000, hasAssignedProvider: true, providerAcceptedAt: now, now };
    for (const orderType of ["scheduled", "recurring"] as const) {
      for (const hours of [49, 48, 47, 12, 11, 3, 2, 0, -1]) {
        const result = calculateRefundPolicy({ ...input, orderType, scheduledAt: new Date(now.getTime() + hours * 3600000) }, await getRefundPolicy());
        assert.equal(result.refundRate, 100);
        assert.equal(result.canCancel, true);
        assert.equal(result.refundAmount, 100000);
        assert.equal(result.providerCompensation, 0);
        assert.equal(result.providerCompensation + result.platformRetainedAmount, result.cancellationFee);
      }
    }
    for (const orderType of ["normal", "urgent"] as const) {
      assert.equal(calculateRefundPolicy({ ...input, orderType }, custom).refundRate, 100);
    }
    assert.equal(calculateRefundPolicy(input, custom).refundRate, 100);
    assert.equal(calculateRefundPolicy({ ...input, now: new Date(now.getTime() + 300001) }, custom).canCancel, false);
    assert.equal(calculateRefundPolicy({ ...input, orderStatus: "in_progress" }, custom).canCancel, false);
    assert.equal(calculateRefundPolicy({ ...input, hasAssignedProvider: false }, custom).refundRate, 100);
    assert.equal(calculateRefundPolicy({ ...input, role: "admin" }, custom).refundRate, 100);
    const deposit = calculateRefundPolicy({ ...input, role: "provider", inspectionRequired: true,
      hasRepairQuotation: true, paidInspectionDeposit: 30000 }, custom);
    assert.equal(deposit.policyVersion, QUOTATION_DEPOSIT_POLICY_VERSION);
    assert.equal(deposit.providerCompensation, 30000);
    assert.equal(deposit.providerCompensationRate, 100);
    assert.equal(calculateRefundPolicy({ ...input, orderType: "normal" }).refundRate, 100);

    const reward = { key: "REWARD_POLICY", type: "JSON" as const, value: DEFAULT_REWARD_POLICY, isPublic: false };
    await createConfig(admin, reward);
    for (const value of [{ amountPerPoint: 0, validityDays: 30 }, { amountPerPoint: 5000, validityDays: 1.5 },
      { amountPerPoint: 5000, validityDays: 0 }, { amountPerPoint: 5000, validityDays: 3651 }]) {
      assert.equal(rewardPolicySchema.safeParse(value).success, false);
      await assert.rejects(updateConfig(admin, reward.key, { value }), /không hợp lệ/);
    }
    await updateConfig(admin, reward.key, { value: { amountPerPoint: 5000, validityDays: 7 } });
    assert.deepEqual(await getRewardPolicy(), { amountPerPoint: 5000, validityDays: 7 });
    assert.equal(audits.length, 4);
    configs.get("REFUND_POLICY").value.normalRefundPercent = -1;
    await assert.rejects(getRefundPolicy(), /không hợp lệ/);
    configs.get("REWARD_POLICY").type = "STRING";
    await assert.rejects(getRewardPolicy(), /không hợp lệ/);
    console.log("Đạt: cấu hình chính sách, phân quyền, kiểm tra dữ liệu, mốc hoàn tiền, bồi thường và giữ mặc định tương thích.");
  } finally { mock.restoreAll(); }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
