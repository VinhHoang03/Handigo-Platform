import assert from "node:assert/strict";
import Module from "node:module";
import { mock } from "node:test";
import { Types } from "mongoose";
import { z } from "zod";
import { Order } from "../models/order.model";
import { Address } from "../models/address.model";
import { Payment } from "../models/payment.model";
import { AgentLoop } from "../ai/agent/agent-loop.service";
import { AgentService } from "../ai/agent/agent.service";
import { newSession, type AgentSession } from "../ai/agent/agent-state";
import { ToolRegistry } from "../ai/tools/tool-registry";
import { bookingSchema } from "../ai/tools/implementations/booking.schemas";
import { updateBookingDraft, readyBookingArguments } from "../ai/agent/booking-draft";
import { AgentPaymentService, createAgentPaymentService } from "../services/agentPayment.service";
import * as services from "../services/service.service";
import * as pricing from "../services/servicePricing.service";
import * as addresses from "../services/address.service";
import { AppError } from "../utils/appError";

// Chỉ dùng dữ liệu trong bộ nhớ; không kết nối database, LLM hoặc cổng thanh toán thật.
async function run() {
  const gatewayPath = require.resolve("../configs/payos.config");
  const previousGateway = require.cache[gatewayPath];
  const gateway = new Module(gatewayPath);
  gateway.exports = { payos: {}, payoutPayos: {} };
  require.cache[gatewayPath] = gateway;
  try {
    const { AgentBookingService } = await import("../services/agentBooking.service");
    const { OrderService } = await import("../services/order.service");
    const { MatchingService } = await import("../services/matching.service");
    const { getAvailableTimesTool } = await import("../ai/tools/implementations/get-available-times.tool");
    const user = { id: new Types.ObjectId().toString(), role: "CUSTOMER" as const };
    const serviceId = new Types.ObjectId().toString();
    const addressId = new Types.ObjectId().toString();
    const optionId = new Types.ObjectId().toString();
    const day = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const args = { serviceId, addressId, orderType: "normal" as const, paymentMethod: "bank" as const };
    const context = { user, sessionId: "phien-khoi-phuc", signal: AbortSignal.timeout(60000) };
    const draftDeps = {
      search: async () => [],
      service: async () => ({ id: serviceId, name: "Dịch vụ kiểm thử", serviceType: "fixed_price",
        fixedPrice: 200000, requiresOptionSelection: false, options: [] }),
      addresses: async () => [{ id: addressId, fullAddress: "12 Lê Lợi", ward: "Phường A", province: "Hà Nội", isDefault: true }],
    };
    for (const hour of [7, 22]) {
      const scheduledAt = `${day}T${String(hour).padStart(2, "0")}:00:00+07:00`;
      assert.equal(bookingSchema.safeParse({ ...args, orderType: "scheduled", scheduledAt }).success, false);
      const draft = await updateBookingDraft(undefined, { mode: "update", serviceId, scheduledAt, quantity: 2 }, user.id, draftDeps);
      assert.equal(readyBookingArguments(draft), null);
      assert.equal(draft.values.uniformQuantity, 2, "Sửa lịch không làm mất số lượng.");
      assert(draft.missing.some((item) => item.includes("08:00 đến 21:00")));
    }
    assert(bookingSchema.safeParse({ ...args, orderType: "scheduled", scheduledAt: `${day}T21:00:00+07:00` }).success);

    let stored: InstanceType<typeof Order> | null = null;
    mock.method(Order, "findOne", async (query: { _id: Types.ObjectId; customerId: string }) =>
      stored && String(stored._id) === String(query._id) && query.customerId === user.id ? stored : null);
    let writes = 0;
    let rejectBeforeWrite = true;
    mock.method(OrderService, "createOrder", async (_payload: unknown, id?: Types.ObjectId) => {
      if (rejectBeforeWrite) throw new AppError("Chưa có chuyên gia phù hợp.", 409);
      writes++;
      stored = new Order({ _id: id, customerId: user.id, serviceId, addressId, orderCode: "ORD-KHOI-PHUC",
        status: "created", bookingStatus: "not_required", paymentStatus: "unpaid", orderType: "normal",
        paymentMethod: "bank", pricing: { bookingAmount: 200000, totalPaidAmount: 200000 } });
      throw new Error("Mất kết nối sau khi đã ghi đơn.");
    });
    const registry = new ToolRegistry().register({
      name: "create_booking", description: "Đặt đơn kiểm thử", inputSchema: bookingSchema,
      mutates: true, requiresConfirmation: true, roles: ["CUSTOMER"],
      preview: async () => ({ amount: 200000, addressVersion: "kiem-thu" }),
      execute: (toolContext, values) => AgentBookingService.create(user.id, values,
        { amount: 200000, addressVersion: "kiem-thu" }, toolContext.sessionId, toolContext.actionId),
      reconcile: (toolContext) => AgentBookingService.reconcileBooking(user.id, toolContext.sessionId, toolContext.actionId!),
    });
    const loop = new AgentLoop({ generate: async () => { throw new Error("Không gọi LLM khi đối soát."); } }, registry,
      { maxIterations: 1, systemPrompt: "Kiểm thử", timeoutMs: 5000 });
    const session = newSession(context.sessionId, user.id);
    const tool = registry.get("create_booking", context);
    session.pendingAction = await loop.confirmation.prepare(tool, context, args);
    await loop.execute(session, context, tool, args, async () => {}, session.pendingAction);
    assert.equal(session.actions[0].status, "EXPIRED");
    assert.equal(session.requiresReconciliation, false, "Từ chối trước khi ghi không được khóa phiên.");
    assert.equal(writes, 0);

    rejectBeforeWrite = false;
    session.pendingAction = await loop.confirmation.prepare(tool, context, args);
    const actionId = session.pendingAction.id;
    await loop.execute(session, context, tool, args, async () => {}, session.pendingAction);
    assert.equal(session.actions[1].status, "UNKNOWN");
    assert.equal(session.requiresReconciliation, true);
    const agentFor = (value: AgentSession) => new AgentService({ acquire: async () => ({ session: value, lockId: "khoa" }),
      save: async () => {}, release: async () => {} }, loop);
    const savedOrder = stored;
    stored = null;
    await agentFor(session).send(user, session.id, { requestId: "chua-co-bang-chung", message: "Kiểm tra lại" });
    assert.equal(session.requiresReconciliation, true, "Không tự tạo lại đơn khi chưa tìm thấy kết quả.");
    assert.equal(writes, 1);
    stored = savedOrder;
    await agentFor(session).send(user, session.id, { requestId: "tim-thay-don", message: "Kiểm tra lại" });
    assert.equal(session.requiresReconciliation, false);
    assert.equal(session.actions[1].status, "SUCCEEDED");
    const recovered = await AgentBookingService.create(user.id, args, { amount: 200000, addressVersion: "kiem-thu" }, session.id, actionId);
    assert.equal(recovered.orderCode, "ORD-KHOI-PHUC");
    assert.equal(writes, 1, "Cùng xác nhận chỉ tạo một đơn.");
    assert.equal(await AgentBookingService.reconcileBooking(new Types.ObjectId().toString(), session.id, actionId), null);

    const orderId = recovered.orderId;
    const startedAt = new Date(Date.now() - 10000);
    const payment = new Payment({ _id: new Types.ObjectId(), orderId, customerId: user.id, amount: 200000,
      paymentType: "full", method: "payos", status: "failed", createdAt: new Date(startedAt.getTime() - 1000) });
    const paymentService = createAgentPaymentService({ order: async () => new Order({ orderCode: "ORD-KHOI-PHUC", status: "created", orderType: "normal" }),
      payments: async () => [payment], reconcile: async () => ({} as never),
      preview: async () => { throw new Error("Không tạo thanh toán khi đối soát."); },
      create: async () => { throw new Error("Không tạo thanh toán khi đối soát."); } });
    mock.method(AgentPaymentService, "failureConfirmed", paymentService.failureConfirmed);
    registry.register({ name: "get_payment_status", description: "Đối soát kiểm thử", inputSchema: z.object({ orderId: z.string() }),
      mutates: false, requiresConfirmation: false, roles: ["CUSTOMER"], execute: () => paymentService.status(user, orderId, false) });
    for (const status of ["failed", "refunded"] as const) {
      payment.status = status;
      payment.createdAt = new Date(startedAt.getTime() - 1000);
      const blocked = newSession(`phien-${status}`, user.id);
      blocked.requiresReconciliation = true;
      blocked.actions.push({ id: "thanh-toan", tool: "create_payment", taskVersion: 0, arguments: { orderId, method: "PAYOS" },
        preview: { amount: 200000, paymentType: "full" }, createdAt: startedAt.toISOString(), expiresAt: startedAt.toISOString(), status: "UNKNOWN" });
      await agentFor(blocked).send(user, blocked.id, { requestId: "giao-dich-cu", paymentStatus: { orderId } });
      assert.equal(blocked.requiresReconciliation, true, "Giao dịch cũ không phải bằng chứng của lượt đang đối soát.");
      payment.createdAt = new Date(startedAt.getTime() + 1000);
      await agentFor(blocked).send(user, blocked.id, { requestId: "giao-dich-dung-luot", paymentStatus: { orderId } });
      assert.equal(blocked.requiresReconciliation, false);
      assert.equal(blocked.actions[0].status, "EXPIRED");
    }

    mock.method(services, "getServiceById", async () => ({ _id: new Types.ObjectId(serviceId), isActive: true, categoryId: { isActive: true } } as never));
    mock.method(Address, "findOne", async () => new Address({ userId: user.id, latitude: 21, longitude: 105, fullAddress: "12 Lê Lợi", ward: "Phường A", province: "Hà Nội" }));
    mock.method(addresses, "ensureAddressCoordinates", async (value: Parameters<typeof addresses.ensureAddressCoordinates>[0]) => value);
    mock.method(pricing, "buildServicePricingSnapshot", async (_service: unknown, _ids: unknown, selected: unknown) => {
      assert.deepEqual(selected, [{ optionId, quantity: 2 }]);
      return { optionIds: [], selectedOptionsSnapshot: [], bookingAmount: 200000, baseAmount: 200000,
        depositAmount: 0, minAdvanceMinutes: 0, paymentHoldMinutes: 15,
        schedule: { durationMinutes: 180, bufferMinutes: 15, travelMinutes: 20 } };
    });
    let checked = 0;
    const chosenProviderId = new Types.ObjectId().toString();
    mock.method(MatchingService, "findNearestProviders", async (options: Parameters<typeof MatchingService.findNearestProviders>[0]) => {
      checked++;
      assert.equal(String(options.onlyProviderId), chosenProviderId, "Chỉ kiểm tra lịch của đúng thợ khách chọn.");
      assert.equal(options.requireOnline, true, "Giữ nguyên nghiệp vụ yêu cầu thợ trực tuyến.");
      const interval = options.scheduleIntervals![0];
      assert.equal(interval.end - interval.start, 180 * 60000);
      return [];
    });
    const draft = newSession("phien-lich", user.id);
    draft.bookingDraft = { revision: 1, status: "active", values: { ...args, preferredProviderId: chosenProviderId, selectedOptions: [{ optionId, quantity: 2 }] },
      sources: {}, missing: [], summary: [], choiceGroups: [] };
    await getAvailableTimesTool.execute({ ...context, session: draft }, { serviceId, addressId, times: [`${day}T09:00:00+07:00`] });
    assert.equal(checked, 1);
    await assert.rejects(() => AgentBookingService.availableTimes(user.id, { serviceId, addressId,
      selectedOptions: [{ optionId, quantity: 2 }], times: [`${day}T22:00:00+07:00`] }), /08:00 đến 21:00/);
    assert.equal(checked, 1, "Không tìm thợ cho giờ ngoài khung phục vụ.");
    console.log("Đạt: giờ hẹn, thời lượng tùy chọn, lỗi trước ghi, khôi phục đơn không tạo trùng và đối soát thất bại/hoàn tiền đúng lượt.");
  } finally {
    mock.restoreAll();
    if (previousGateway) require.cache[gatewayPath] = previousGateway;
    else delete require.cache[gatewayPath];
  }
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
