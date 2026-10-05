import assert from "node:assert/strict";
import { mock } from "node:test";
import mongoose, { Types } from "mongoose";
import { Order } from "../models/order.model";
import { Provider } from "../models/provider.model";
import { Service } from "../models/service.model";
import { RepairQuotation } from "../models/repairQuotation.model";
import { RepairQuotationItem } from "../models/repairQuotationItem.model";
import { AuditLog } from "../models/auditLog.model";
import { DEFAULT_BOOKING_POLICY } from "../validations/bookingPolicy.validator";
import { completeOrderSchema, updateRepairQuotationSchema } from "../validations/order.validator";

// Cô lập database và dịch vụ ngoài, không nạp cấu hình bí mật.
const stubModule = (path: string, exports: object) => {
  require.cache[require.resolve(path)] = { exports } as NodeModule;
};
const notifications: unknown[] = [];
const events: unknown[] = [];
let scheduleChecks = 0;
let scheduleConflict = false;
let settlementCalls = 0;
let relevanceStatus: "valid" | "warning" | "blocked" = "valid";
stubModule("../configs/payos.config", { payos: {}, payoutPayos: {} });
stubModule("../sockets/socketServer", { emitToUser: (...args: unknown[]) => events.push(args) });
stubModule("../services/notification.service", {
  createNotificationRecord: async (input: unknown) => { notifications.push(input); return input; },
  emitRealtimeNotification: (input: unknown) => events.push(input),
});
stubModule("../services/systemConfig.service", { getBookingPolicy: async () => DEFAULT_BOOKING_POLICY });
stubModule("../services/providerSchedule.service", {
  lockProviderSchedule: async () => provider,
  assertProviderSchedule: async () => {
    scheduleChecks++;
    if (scheduleConflict) throw new Error("Lịch làm việc không đủ thời gian.");
  },
});
stubModule("../services/quotationRelevance.service", {
  evaluateQuotationItemsForOrder: async () => ({ status: relevanceStatus, serviceName: "Sửa chữa" }),
  getBlockedRelevanceItems: () => relevanceStatus === "blocked" ? [{ title: "Hạng mục không phù hợp" }] : [],
});
stubModule("../services/wallet.service", { recordCompletedOrderSettlement: async () => { settlementCalls++; } });
stubModule("../services/reward.service", { earnOrderRewards: async () => {} });
for (const name of ["orderReassignment", "providerWalletEligibility", "dispatch", "address", "matching", "voucher"]) {
  stubModule(`../services/${name}.service`, {});
}
const { AssignmentService } = require("../services/assignment.service") as typeof import("../services/assignment.service");
const { OrderService } = require("../services/order.service") as typeof import("../services/order.service");

const provider = new Provider({ userId: new Types.ObjectId(), verified: true });
const customerId = new Types.ObjectId();
let order: InstanceType<typeof Order>;
let quotation: InstanceType<typeof RepairQuotation> | null = null;
let items: InstanceType<typeof RepairQuotationItem>[] = [];
let auditLogs: Record<string, unknown>[] = [];
let failInsert = false;
const cloneOrder = () => new Order(order.toObject());
const cloneQuotation = () => quotation ? new RepairQuotation(quotation.toObject()) : null;
const cloneItems = () => items.map((item) => new RepairQuotationItem(item.toObject()));

const query = (value: unknown): any => ({
  then: (resolve: (data: unknown) => unknown) => Promise.resolve(value).then(resolve),
  session: () => query(value), select: () => query(value),
  lean: () => query(Array.isArray(value)
    ? value.map((item) => item.toObject?.() ?? item)
    : (value as { toObject?: () => unknown } | null)?.toObject?.() ?? value),
});

const reset = () => {
  order = new Order({
    customerId, providerId: provider._id, serviceId: new Types.ObjectId(),
    orderCode: "DON-KIEM-THU", status: "accepted", orderType: "normal",
    inspectionRequired: true, depositAmount: 40000, depositPaidAt: new Date(),
    paymentMethod: "bank", paymentStatus: "partially_paid",
    pricing: { bookingAmount: 40000, platformCommissionRate: 0, platformCommissionAmount: 0,
      providerEarningAmount: 0, totalPaidAmount: 40000 },
  });
  quotation = null; items = []; auditLogs = [];
  notifications.length = 0; events.length = 0;
  scheduleChecks = 0; scheduleConflict = false; failInsert = false; settlementCalls = 0;
  relevanceStatus = "valid";
};

const payload = () => ({
  orderId: order.id, estimatedDurationMinutes: 60, inspectionNote: "Kết quả khảo sát",
  items: [{ title: "Công sửa chữa", itemType: "labor" as const, quantity: 1, unitPrice: 100000 }],
});
const save = () => AssignmentService.createRepairQuotation(payload(), provider.userId.toString());
const update = (overrides: Partial<import("../services/assignment.service").UpdateQuotationPayload> = {}) =>
  AssignmentService.updateRepairQuotation({ ...payload(), quotationId: quotation!.id,
    expectedRevision: quotation!.revision ?? 0, ...overrides }, provider.userId.toString());

async function run() {
  mock.method(Order, "findOne", () => query(cloneOrder()));
  mock.method(Order, "findById", () => query(cloneOrder()));
  mock.method(Order, "exists", () => query(null));
  mock.method(Provider, "findOne", () => query(provider));
  mock.method(Provider, "findById", () => query(provider));
  mock.method(Service, "findById", () => query({ serviceType: "variable_price" }));
  mock.method(RepairQuotation, "findOne", (filter: any) => {
    const matchesStatus = !filter.$or || filter.$or.some((condition: Record<string, unknown>) =>
      Object.entries(condition).every(([key, value]) => quotation?.get(key) === value));
    return query(matchesStatus ? cloneQuotation() : null);
  });
  mock.method(Provider.prototype, "save", async function (this: InstanceType<typeof Provider>) { return this; });
  mock.method(RepairQuotationItem, "find", () => query(cloneItems().filter((item) => !item.isDeleted)));
  mock.method(Order.prototype, "save", async function (this: InstanceType<typeof Order>) {
    order = new Order(this.toObject()); return this;
  });
  mock.method(RepairQuotation.prototype, "save", async function (this: InstanceType<typeof RepairQuotation>) {
    quotation = new RepairQuotation(this.toObject()); return this;
  });
  mock.method(RepairQuotationItem, "updateMany", async () => {
    items.forEach((item) => { item.isDeleted = true; }); return {};
  });
  mock.method(RepairQuotationItem, "insertMany", async (rows: object[]) => {
    if (failInsert) throw new Error("Lỗi lưu hạng mục kiểm thử.");
    const docs = rows.map((row) => new RepairQuotationItem(row));
    items.push(...docs); return docs;
  });
  mock.method(AuditLog, "create", async (rows: Record<string, unknown>[]) => {
    auditLogs.push(...rows); return rows;
  });
  mock.method(mongoose, "startSession", async () => ({
    withTransaction: async (operation: () => Promise<unknown>) => {
      const before = { order: cloneOrder(), quotation: cloneQuotation(), items: cloneItems(),
        auditLogs: [...auditLogs], notifications: [...notifications] };
      try { return await operation(); }
      catch (error) {
        order = before.order; quotation = before.quotation; items = before.items; auditLogs = before.auditLogs;
        notifications.splice(0, notifications.length, ...before.notifications);
        throw error;
      }
    },
    endSession: async () => {},
  } as any));

  reset();
  relevanceStatus = "blocked";
  await assert.rejects(save(), /không phù hợp/);
  assert.equal(quotation, null);
  relevanceStatus = "warning";
  const warningQuotation = await save();
  assert.equal(warningQuotation.status, "saved");
  const warningUpdate = await update({ inspectionNote: "Đã bổ sung thông tin" });
  assert.equal(warningUpdate.revision, 2);
  relevanceStatus = "blocked";
  await assert.rejects(update(), /không phù hợp/);
  assert.equal(quotation!.revision, 2);

  reset();
  const first = await save();
  assert.equal(first.status, "saved");
  assert.equal(first.revision, 1);
  assert.equal(first.customerConfirmed, false);
  assert.equal(order.currentQuotationId?.toString(), first.id);
  assert.equal(notifications.length, 1);
  assert.equal(auditLogs.length, 1);
  await assert.rejects(save(), /đã có báo giá/);
  const second = await update({ items: [...payload().items,
    { title: "Thay linh kiện", itemType: "replacement_part", quantity: 2, unitPrice: 50000 }], discountAmount: 10000 });
  assert.equal(second.id, first.id);
  assert.equal(second.quotationCode, first.quotationCode);
  assert.equal(second.finalAmount, 190000);
  assert.equal(second.revision, 2);
  assert.equal(items.filter((item) => !item.isDeleted).length, 2);
  assert.equal((auditLogs[1].oldValue as { finalAmount: number }).finalAmount, 100000);
  assert.equal(notifications.length, 2);
  const detail = await AssignmentService.getQuotationByOrder(order.id, customerId.toString(), "CUSTOMER");
  assert.equal(detail?.items.length, 2);
  assert.equal(detail?.quotation.finalAmount, 190000);
  await assert.rejects(update({ expectedRevision: 1 }), /phiên khác/);
  await assert.rejects(update({ quotationId: new Types.ObjectId().toString() }), /bản hiện tại/);
  const activeItems = items.filter((item) => !item.isDeleted).length;
  failInsert = true;
  await assert.rejects(update(), /Lỗi lưu hạng mục/);
  assert.equal(quotation!.revision, 2);
  assert.equal(items.filter((item) => !item.isDeleted).length, activeItems);
  assert.equal(auditLogs.length, 2);
  assert.equal(notifications.length, 2);
  failInsert = false;
  for (const status of ["pending", "rejected", "expired", "cancelled"] as const) {
    quotation!.status = status;
    await assert.rejects(update(), /Chỉ được chỉnh sửa báo giá/);
  }
  quotation!.status = "saved";
  order.providerId = new Types.ObjectId();
  await assert.rejects(update(), /không phải thợ/);
  order.providerId = provider._id as Types.ObjectId;
  for (const status of ["completed", "cancelled"] as const) {
    order.status = status;
    await assert.rejects(update(), /đã nhận hoặc đang thực hiện/);
  }

  reset();
  await save();
  quotation!.status = "approved";
  quotation!.customerConfirmed = true;
  quotation!.set("revision", undefined);
  const legacy = await update({ expectedRevision: 0 });
  assert.equal(legacy.status, "saved");
  assert.equal(legacy.revision, 1);
  order.status = "in_progress";
  const start = new Date();
  order.schedule = { durationMinutes: 60, bufferMinutes: 15, travelMinutes: 30,
    expectedStartAt: start, expectedEndAt: new Date(start.getTime() + 60 * 60000) };
  await update({ estimatedDurationMinutes: 120 });
  assert.equal(order.schedule?.durationMinutes, 120);
  assert.equal(order.schedule?.expectedEndAt?.getTime(), start.getTime() + 120 * 60000);
  assert.equal(scheduleChecks, 1);
  scheduleConflict = true;
  const revision = quotation!.revision;
  await assert.rejects(update({ estimatedDurationMinutes: 180 }), /Lịch làm việc/);
  assert.equal(quotation!.revision, revision);
  assert.equal(order.schedule?.durationMinutes, 120);
  scheduleConflict = false;
  await assert.rejects(OrderService.completeOrder(order.id, provider.userId.toString(),
    ["https://example.com/bang-chung.jpg"], undefined,
    { quotationId: quotation!.id, revision: revision - 1 }), /Báo giá đã thay đổi/);
  assert.equal(settlementCalls, 0);
  await OrderService.completeOrder(order.id, provider.userId.toString(),
    ["https://example.com/bang-chung.jpg"], undefined,
    { quotationId: quotation!.id, revision: revision });
  assert.equal(order.status, "completed");
  assert.equal(settlementCalls, 1);
  await assert.rejects(update(), /đã nhận hoặc đang thực hiện/);

  reset();
  order.schedule = { durationMinutes: 60, bufferMinutes: 15, travelMinutes: 30 };
  await save();
  await OrderService.startOrder(order.id, provider.userId.toString());
  assert.equal(order.status, "in_progress");
  await update({ items: [{ ...payload().items[0], quantity: 2 }] });
  assert.equal(quotation!.finalAmount, 200000);
  assert.equal(order.status, "in_progress");

  reset();
  for (const amount of [39999, 40000]) {
    await assert.rejects(AssignmentService.createRepairQuotation({ ...payload(),
      items: [{ ...payload().items[0], unitPrice: amount }] }, provider.userId.toString()), /lớn hơn tiền cọc/);
  }
  assert.equal(updateRepairQuotationSchema.safeParse({ ...payload(), quotationId: new Types.ObjectId().toString(), expectedRevision: -1 }).success, false);
  assert.equal(updateRepairQuotationSchema.safeParse({ ...payload(), quotationId: new Types.ObjectId().toString() }).success, false);
  assert.equal(completeOrderSchema.safeParse({ completionEvidenceImages: ["https://example.com/anh.jpg"], expectedQuotationId: new Types.ObjectId().toString() }).success, false);
  console.log("Đạt: lưu/sửa báo giá, tổng tiền, lịch sử, phiên bản, quyền sở hữu, khóa khi kết thúc, tương thích bản cũ, lịch làm việc và kiểm tra trước hoàn thành.");
}

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => mock.restoreAll());
