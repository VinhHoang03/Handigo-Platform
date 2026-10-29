import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import mongoose, { Types } from "mongoose";
import { Order } from "../models/order.model";
import { Service } from "../models/service.model";
import { Address } from "../models/address.model";
import { Provider } from "../models/provider.model";
import User from "../models/user.model";
import { Payment } from "../models/payment.model";
import { Refund } from "../models/refund.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { RepairQuotation } from "../models/repairQuotation.model";
import { bookingAttachmentsSchema, requireBookingAttachments } from "../ai/agent/booking-attachments";
import { newSession } from "../ai/agent/agent-state";
import { readyBookingArguments, updateBookingDraft } from "../ai/agent/booking-draft";
import type { BookingDraftDependencies } from "../ai/agent/booking-draft";
import type { ToolContext } from "../ai/tools/tool.interface";

// Cô lập cổng thanh toán và thông báo; không đọc .env, gọi LLM hoặc kết nối database.
require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
require.cache[require.resolve("../configs/cloudinary")] = { exports: { default: {} } } as NodeModule;
require.cache[require.resolve("../services/notification.service")] = { exports: { createNotificationRecord: async () => {}, emitRealtimeNotification: () => {} } } as NodeModule;
const { AgentBookingHistoryService, bookingSearchSchema } = require("../services/agentBookingHistory.service") as typeof import("../services/agentBookingHistory.service");
const { AgentBookingService } = require("../services/agentBooking.service") as typeof import("../services/agentBooking.service");
const { AgentQuotationService } = require("../services/agentQuotation.service") as typeof import("../services/agentQuotation.service");
const { AssignmentService } = require("../services/assignment.service") as typeof import("../services/assignment.service");
const { OrderService } = require("../services/order.service") as typeof import("../services/order.service");
const { rebookBookingTool, getPreviousProvidersTool } = require("../ai/tools/implementations/booking-history.tools") as typeof import("../ai/tools/implementations/booking-history.tools");
const { createUpdateBookingDraftTool } = require("../ai/tools/implementations/update-booking-draft.tool") as typeof import("../ai/tools/implementations/update-booking-draft.tool");
const { AgentService, sessionView } = require("../ai/agent/agent.service") as typeof import("../ai/agent/agent.service");
const { AgentLoop } = require("../ai/agent/agent-loop.service") as typeof import("../ai/agent/agent-loop.service");
const { ToolRegistry } = require("../ai/tools/tool-registry") as typeof import("../ai/tools/tool-registry");
const { rejectBookingQuotationTool } = require("../ai/tools/implementations/quotation.tools") as typeof import("../ai/tools/implementations/quotation.tools");
const { cancelOrderWithSettlement } = require("../services/orderCancellation.service") as typeof import("../services/orderCancellation.service");

function query(value: unknown, trace?: { skip?: number; limit?: number }) {
  const result = { then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) => Promise.resolve(value).then(resolve, reject),
    select: () => result, sort: () => result, skip: (value: number) => { if (trace) trace.skip = value; return result; },
    limit: (value: number) => { if (trace) trace.limit = value; return result; },
    populate: () => result, session: () => result, lean: () => result };
  return result as never;
}
const userId = new Types.ObjectId().toString();
const serviceId = new Types.ObjectId().toString();
const addressId = new Types.ObjectId().toString();
const providerId = new Types.ObjectId().toString();
const oldPreferredId = new Types.ObjectId().toString();
const orderId = new Types.ObjectId().toString();
const quotationId = new Types.ObjectId().toString();
const image = "https://res.cloudinary.com/kiem-thu/image/upload/anh-hien-trang.png";
const oldOrder = {
  _id: new Types.ObjectId(orderId), customerId: new Types.ObjectId(userId), serviceId: new Types.ObjectId(serviceId),
  addressId: new Types.ObjectId(addressId), providerId: new Types.ObjectId(providerId), preferredProviderId: new Types.ObjectId(oldPreferredId),
  orderCode: "HD-CU", status: "completed", isDeleted: false, orderType: "scheduled", scheduledAt: new Date("2025-01-01T02:00:00Z"),
  addressSnapshot: { fullAddress: "12 Lê Lợi", ward: "Phường A", province: "Hà Nội", recipientName: "An", recipientPhone: "0912345678" },
  selectedOptionsSnapshot: [{ optionId: null, name: "Giá chung", quantity: 2, price: 100000 }],
  pricing: { bookingAmount: 200000, totalPaidAmount: 200000 }, paymentMethod: "wallet", problemDescription: "Vệ sinh máy",
  voucherSnapshot: { code: "MA-CU" }, customerAttachments: [image], currentQuotationId: new Types.ObjectId(quotationId), depositAmount: 100000,
};
const addresses = [{ id: addressId, isDefault: true, ...oldOrder.addressSnapshot }];
const deps: BookingDraftDependencies = {
  search: async () => [{ id: serviceId, name: "Vệ sinh điều hòa" }],
  service: async () => ({ id: serviceId, name: "Vệ sinh điều hòa", serviceType: "fixed_price", fixedPrice: 250000, requiresOptionSelection: false, options: [] }),
  addresses: async () => addresses,
  vouchers: async () => [],
  providers: async () => ({ available: [{ id: providerId, name: "Minh" }], requested: [{ id: providerId, name: "Minh", eligible: true, reason: "Phù hợp" }] }),
};
const context = (): ToolContext => ({ session: newSession(randomUUID(), userId), user: { id: userId, role: "CUSTOMER" }, sessionId: randomUUID(), signal: new AbortController().signal });

async function run() {
  assert(!bookingSearchSchema.safeParse({ from: "2026-02-02T00:00:00+07:00", to: "2026-02-01T00:00:00+07:00" }).success);
  assert(!bookingSearchSchema.safeParse({ userId: oldPreferredId }).success);
  assert(!bookingSearchSchema.safeParse({ page: 0 }).success);
  assert(!bookingSearchSchema.safeParse({ limit: 100 }).success);
  const filters: unknown[] = [];
  const trace: { skip?: number; limit?: number } = {};
  mock.method(Service, "find", () => query([{ _id: serviceId }]));
  mock.method(Address, "find", () => query([{ _id: addressId }]));
  mock.method(User, "find", () => query([{ _id: userId }]));
  mock.method(Provider, "find", () => query([{ _id: providerId }]));
  mock.method(Order, "find", (filter: unknown) => {
    filters.push(filter);
    return query([{ ...oldOrder, serviceId: { _id: serviceId, name: "Vệ sinh" },
      addressId: { fullAddress: "Địa chỉ hiện đã đổi", ward: "B", province: "Hà Nội" },
      providerId: { _id: providerId, userId: { fullName: "Minh" } } }], trace);
  });
  mock.method(Order, "countDocuments", () => query(12));
  const args = bookingSearchSchema.parse({ service: "Điều hòa", address: "Nhà mẹ", provider: "Minh", search: "HD.*", status: "completed", page: 2,
    from: "2026-09-01T00:00:00+07:00", to: "2026-09-30T23:59:59+07:00" });
  const found = await AgentBookingHistoryService.search(userId, args);
  assert.equal(found.pagination.page, 2); assert.equal(found.pagination.totalPages, 3);
  assert.equal(trace.skip, 5); assert.equal(trace.limit, 5);
  assert.equal(found.items[0].address?.fullAddress, "12 Lê Lợi");
  assert.equal(found.items[0].providerId, providerId);
  assert(JSON.stringify(filters[0]).includes(userId));
  assert(JSON.stringify(filters[0]).includes(JSON.stringify("HD\\.\\*").slice(1, -1)));
  assert(JSON.stringify(filters[0]).includes("2026-08-31T17:00:00.000Z"));
  await getPreviousProvidersTool.execute(context(), bookingSearchSchema.parse({ status: "cancelled" }));
  assert(JSON.stringify(filters[filters.length - 1]).includes('"status":"completed"'));
  assert(JSON.stringify(filters[filters.length - 1]).includes('"providerId":{"$ne":null}'));
  mock.restoreAll();

  mock.method(Order, "findOne", (filter: { customerId?: unknown }) => query(String(filter.customerId) === userId ? oldOrder : null));
  mock.method(AgentBookingService, "service", deps.service as never);
  mock.method(AgentBookingService, "addresses", deps.addresses as never);
  mock.method(AgentBookingService, "vouchers", deps.vouchers as never);
  mock.method(AgentBookingService, "providers", deps.providers as never);
  const ctx = context();
  await rebookBookingTool.execute(ctx, { orderId, useSameProvider: true });
  const draft = ctx.session!.bookingDraft!;
  assert.equal(draft.values.uniformQuantity, 2);
  assert.equal(draft.values.preferredProviderId, providerId);
  assert.equal(draft.values.addressId, addressId);
  assert.equal(draft.values.scheduledAt, undefined);
  assert.equal(draft.values.customerAttachments, undefined);
  assert.equal(draft.orderId, undefined);
  assert.equal(readyBookingArguments(draft), null);
  assert.equal(ctx.session!.taskVersion, 1);
  const expiredVoucher = await updateBookingDraft(draft, { mode: "update", scheduledAt: "2099-09-01T09:00:00+07:00" }, userId, deps);
  assert(expiredVoucher.missing.some((item) => item.includes("Voucher đã chọn")));
  assert.equal(readyBookingArguments(expiredVoucher), null);
  const updated = await updateBookingDraft(draft, { mode: "update", scheduledAt: "2099-09-01T09:00:00+07:00", voucherCode: null }, userId, deps);
  assert.equal(readyBookingArguments(updated)?.uniformQuantity, 2);
  assert(updated.summary.some((line) => line.includes("250.000")));
  const offline = await updateBookingDraft(updated, { mode: "resume" }, userId, { ...deps,
    providers: async () => ({ available: [], requested: [{ id: providerId, name: "Minh", eligible: false, reason: "Đang ngoại tuyến" }] }) });
  assert.equal(offline.values.preferredProviderId, providerId); assert.equal(readyBookingArguments(offline), null);
  const before = structuredClone(ctx.session!.bookingDraft);
  ctx.user.id = oldPreferredId;
  await assert.rejects(() => rebookBookingTool.execute(ctx, { orderId, useSameProvider: true }), /Không tìm thấy/);
  assert.deepEqual(ctx.session!.bookingDraft, before);
  ctx.user.id = userId;
  mock.method(AgentBookingService, "addresses", async () => [{ ...addresses[0], recipientName: "Người nhận mới" }]);
  await rebookBookingTool.execute({ ...ctx, replaceBookingDraft: true }, { orderId, useSameProvider: false });
  assert.equal(ctx.session!.bookingDraft!.values.addressId, undefined);
  assert(ctx.session!.bookingDraft!.missing.some((item) => item.includes("người nhận")));
  mock.method(AgentBookingService, "addresses", deps.addresses as never);
  mock.method(Order, "findOne", () => query({ ...oldOrder,
    selectedOptionsSnapshot: [{ optionId: new Types.ObjectId(), name: "Gói không còn hoạt động", quantity: 3 }],
  }));
  await rebookBookingTool.execute({ ...ctx, replaceBookingDraft: true }, { orderId, useSameProvider: false });
  const changedPackage = ctx.session!.bookingDraft!;
  assert.equal(changedPackage.rebookNeedsOptionReview, true);
  const unchangedPackage = await updateBookingDraft(changedPackage, { mode: "update", scheduledAt: "2099-09-01T09:00:00+07:00", voucherCode: null }, userId, deps);
  assert.equal(readyBookingArguments(unchangedPackage), null);
  const reviewedPackage = await updateBookingDraft(unchangedPackage, { mode: "update", quantity: 3 }, userId, deps);
  assert.equal(readyBookingArguments(reviewedPackage)?.uniformQuantity, 3);
  mock.restoreAll();

  mock.method(Order, "findOne", () => query({ ...oldOrder, status: "cancelled", cancellation: { refundPolicy: { paidAmount: 100000, refundAmount: 100000, cancellationFee: 0, policyReason: "Hoàn toàn bộ" } } }));
  mock.method(Refund, "find", () => query([{ _id: quotationId, paymentId: orderId, amount: 100000, status: "succeeded", channel: "handigo_wallet", destination: "handigo_wallet", lastError: "Nội bộ", providerResponse: { bankAccount: "Không được lộ" } }]));
  mock.method(WalletTransaction, "find", () => query([{ _id: addressId, relatedPaymentId: orderId, amount: 100000, status: "success", transactionCode: "HOAN-01", balanceAfter: 999999, metadata: { secret: "Không được lộ" } }]));
  mock.method(Payment, "find", () => query([{ _id: orderId, amount: 100000, method: "payos", status: "refunded", metadata: { refund: { amount: 100000, status: "succeeded", destination: "handigo_wallet", privateField: "Không được lộ" } } }]));
  const refund = await AgentBookingHistoryService.refunds(userId, orderId);
  assert.equal(refund.refunds[0].destination, "handigo_wallet");
  assert.equal(refund.walletTransactions[0].transactionCode, "HOAN-01");
  assert(!JSON.stringify(refund).includes("Không được lộ"));
  assert(!JSON.stringify(refund).includes("balanceAfter"));
  mock.method(Order, "findOne", () => query(null));
  await assert.rejects(() => AgentBookingHistoryService.refunds(oldPreferredId, orderId), /Không tìm thấy/);
  mock.restoreAll();

  const quote = { _id: quotationId, quotationCode: "BG-01", revision: 1, status: "pending", finalAmount: 500000,
    subtotalAmount: 550000, discountAmount: 50000, directPaymentConfirmedAt: null, directPaymentConfirmedAmount: null };
  mock.method(Order, "findOne", () => query({ ...oldOrder, status: "accepted", depositPaidAt: new Date(), pricing: { ...oldOrder.pricing, baseAmount: 100000, totalPaidAmount: 90000 } }));
  mock.method(AssignmentService, "getQuotationByOrder", async () => ({ quotation: quote, items: [{ title: "Công sửa", quantity: 2, unitPrice: 275000, totalPrice: 550000, itemType: "labor" }] }) as never);
  mock.method(Payment, "find", () => query([{ amount: 90000 }]));
  const detail = await AgentQuotationService.get(userId, orderId);
  assert.equal(detail.quotation?.paidDeposit, 90000); assert.equal(detail.quotation?.directPaymentAmount, 410000);
  mock.method(OrderService, "previewCancellation", async () => ({ canCancel: true, paidAmount: 90000, refundAmount: 90000,
    cancellationFee: 0, providerCompensation: 0, policyVersion: "KIEM-THU", items: [{ policyReason: "Hoàn vào ví" }] }) as never);
  const preview = await AgentQuotationService.previewReject(userId, orderId, "Giá vượt ngân sách");
  assert.equal(preview.refundAmount, 90000); assert(preview.title.includes("hủy đơn"));
  const confirm = new (require("../ai/agent/confirmation.service").ConfirmationService)();
  const pending = await confirm.prepare(rejectBookingQuotationTool, context(), { orderId, reason: "Giá vượt ngân sách" });
  quote.revision++;
  assert.equal(await confirm.unchanged(rejectBookingQuotationTool, context(), pending), false);
  quote.status = "saved";
  await assert.rejects(() => AgentQuotationService.previewReject(userId, orderId, "Không sửa"), /không thể từ chối/);
  mock.method(AssignmentService, "getQuotationByOrder", async () => null);
  assert.equal((await AgentQuotationService.get(userId, orderId)).quotation, null);
  mock.restoreAll();

  const transaction = { withTransaction: async (callback: () => Promise<unknown>) => callback(), endSession: async () => {} };
  mock.method(mongoose, "startSession", async () => transaction as never);
  mock.method(Order, "findById", () => query({ ...oldOrder, status: "accepted" }));
  let guarded = false;
  mock.method(RepairQuotation, "findOneAndUpdate", (filter: { revision?: number }, _patch: unknown, options?: { session?: unknown; runValidators?: boolean }) => {
    assert.equal(filter.revision, 2); assert.equal(options?.session, transaction); assert.equal(options?.runValidators, true);
    guarded = true; return query(null);
  });
  await assert.rejects(() => cancelOrderWithSettlement({ orderId, actorId: userId, role: "customer", reason: "Từ chối báo giá",
    quotationRejection: { quotationId, revision: 2 } }), /Báo giá đã thay đổi/);
  assert(guarded);
  mock.restoreAll();

  assert(!bookingAttachmentsSchema.safeParse(Array(5).fill(image)).success);
  assert(!bookingAttachmentsSchema.safeParse(["http://khong-hop-le/anh.png"]).success);
  assert(!bookingAttachmentsSchema.safeParse([image, image]).success);
  const session = newSession(randomUUID(), userId);
  assert.throws(() => requireBookingAttachments(session, [image]), /đúng|chưa được tải/);
  session.uploadedAttachments = [image];
  requireBookingAttachments(session, [image]);
  assert.throws(() => requireBookingAttachments(newSession(randomUUID(), userId), [image]), /chưa được tải/);
  const { SessionService } = require("../ai/session/session.service") as typeof import("../ai/session/session.service");
  const store = new SessionService();
  let savedUploads = 0;
  mock.method(store, "acquire", async () => ({ session, lockId: "khoa" }));
  mock.method(store, "save", async () => { savedUploads++; });
  mock.method(store, "release", async () => {});
  await store.registerAttachment(session.id, userId, image + "-2");
  assert.equal(savedUploads, 1);
  session.uploadedAttachments = Array.from({ length: 20 }, (_, index) => image + index);
  await assert.rejects(() => store.registerAttachment(session.id, userId, image + "-21"), /giới hạn/);
  assert.equal(savedUploads, 1);
  session.uploadedAttachments = [image];
  mock.restoreAll();
  const registry = new ToolRegistry().register(createUpdateBookingDraftTool(deps));
  const loop = new AgentLoop({ generate: async () => ({ type: "TOOL_CALL", tool: "update_booking_draft", arguments: { serviceId, startNew: true, mode: "update", scheduledAt: undefined } }) }, registry, { maxIterations: 2, systemPrompt: "Kiểm thử", timeoutMs: 2000 });
  // Thiếu voucher/lịch sẽ trả lựa chọn; không tạo đơn hoặc thanh toán trong kiểm thử ảnh.
  const service = new AgentService({ acquire: async () => ({ session, lockId: "khoa" }), save: async () => {}, release: async () => {} }, loop);
  const request = { requestId: randomUUID(), message: "Vệ sinh 2 máy kèm ảnh", customerAttachments: [image] };
  const response = await service.send({ id: userId, role: "CUSTOMER" }, session.id, request);
  assert.deepEqual(response.bookingDraft?.values.customerAttachments, [image]);
  assert.deepEqual(response.messages.find((item) => item.sender === "user")?.customerAttachments, [image]);
  assert(!JSON.stringify(sessionView(session)).includes("uploadedAttachments"));
  const revision = session.bookingDraft!.revision;
  await service.send({ id: userId, role: "CUSTOMER" }, session.id, request);
  assert.equal(session.bookingDraft!.revision, revision);
  await assert.rejects(() => service.send({ id: userId, role: "CUSTOMER" }, session.id,
    { requestId: randomUUID(), message: "Ảnh khác", customerAttachments: [image + "gia-mao"] }), /chưa được tải/);
  assert.equal(session.activeRequest, null);
  const { registerTools } = require("../ai/tools/register-tools") as typeof import("../ai/tools/register-tools");
  const tools = registerTools({ reject_booking_quotation: { requiresConfirmation: false } });
  assert(tools.needsConfirmation(tools.get("reject_booking_quotation", context())));
  for (const name of ["search_my_bookings", "rebook_booking", "get_previous_providers", "get_booking_quotation", "reject_booking_quotation", "get_booking_refunds"]) {
    assert(tools.list(context()).some((item) => item.name === name));
    assert.throws(() => tools.get(name, { ...context(), user: { id: userId, role: "PROVIDER" } }), /quyền/);
  }
  console.log("Đạt mục 9–14: tìm đơn nhiều tiêu chí/phân trang/quyền sở hữu, đặt lại giá và lịch mới, thợ thực tế/ngoại tuyến, báo giá/cọc/phiên bản, hoàn tiền an toàn, ảnh đúng phiên và thử lại không lặp.");
}
run().catch((error: unknown) => { mock.restoreAll(); console.error(error); process.exitCode = 1; });
