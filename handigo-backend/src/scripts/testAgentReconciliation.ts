import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import { Types } from "mongoose";
import { Order } from "../models/order.model";
import { OrderAssignment } from "../models/orderAssignment.model";
import { RepairQuotation } from "../models/repairQuotation.model";
import { Address } from "../models/address.model";
import { AgentLoop } from "../ai/agent/agent-loop.service";
import { newSession } from "../ai/agent/agent-state";
import { ToolRegistry } from "../ai/tools/tool-registry";

async function run() {
  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  const { AgentService } = await import("../ai/agent/agent.service");
  const { AgentBookingService } = await import("../services/agentBooking.service");
  const { AgentOrderProviderService } = await import("../services/agentOrderProvider.service");
  const { AgentQuotationService } = await import("../services/agentQuotation.service");
  const { AgentAddressService } = await import("../services/agentAddress.service");
  const { cancelBookingTool } = await import("../ai/tools/implementations/cancel-booking.tool");
  const { saveBookingAddressTool } = await import("../ai/tools/implementations/booking-extras.tools");
  const { selectOrderProviderTool, respondProviderReassignmentTool } = await import("../ai/tools/implementations/order-provider.tools");
  const { rejectBookingQuotationTool } = await import("../ai/tools/implementations/quotation.tools");
  const id = () => new Types.ObjectId().toString();
  const user = { id: id(), role: "CUSTOMER" as const }, orderId = id(), providerId = id(), quotationId = id();
  const started = new Date(Date.now() - 1000).toISOString();
  const policy = { paidAmount: 200000, refundAmount: 150000, cancellationFee: 50000 };
  const order = new Order({ _id: orderId, customerId: user.id, orderCode: "HD-DOI-SOAT", status: "cancelled",
    pricing: { bookingAmount: 200000 }, cancellation: { cancelledBy: user.id, cancelledByRole: "customer", reason: "Khách đổi ý",
      cancelledAt: new Date(), refundPolicy: policy } });
  const assignment = new OrderAssignment({ orderId, providerId, assignmentType: "appointment", assignedAt: new Date() });
  const quotation = new RepairQuotation({ _id: quotationId, orderId, customerId: user.id, revision: 3,
    status: "rejected", rejectedAt: new Date(), rejectionReason: "Giá vượt ngân sách" });
  const payload = { fullAddress: "12 Lê Lợi", ward: "Phường Hải Châu", province: "Thành phố Đà Nẵng",
    recipientName: "Nguyễn An", recipientPhone: "0912345678", isDefault: false };
  const address = new Address({ ...payload, userId: user.id, createdAt: new Date(), updatedAt: new Date() });
  let owned = true, duplicate = false, sourceFails = false;
  mock.method(Order, "findOne", async (filter: { customerId?: string }) => {
    assert.equal(filter.customerId, user.id);
    if (sourceFails) throw new Error("Nguồn đối soát đang lỗi");
    return owned ? order : null;
  });
  mock.method(OrderAssignment, "findOne", async (filter: { providerId: string; orderId: string }) => {
    assert.equal(filter.providerId, providerId); assert.equal(filter.orderId, orderId); return assignment;
  });
  mock.method(RepairQuotation, "findOne", async (filter: { customerId: string; _id: string }) => {
    assert.equal(filter.customerId, user.id); assert.equal(filter._id, quotationId); return quotation;
  });
  mock.method(Address, "find", (filter: { userId: string }) => {
    assert.equal(filter.userId, user.id); return { limit: async () => owned ? duplicate ? [address, address] : [address] : [] } as never;
  });
  try {
    assert(await AgentBookingService.reconcileCancellation(user.id, orderId, "Khách đổi ý", policy, started));
    assert.equal(await AgentBookingService.reconcileCancellation(user.id, orderId, "Lý do khác", policy, started), null);
    assert.equal(await AgentBookingService.reconcileCancellation(user.id, orderId, "Khách đổi ý", { ...policy, refundAmount: 0 }, started), null);
    assert.equal(await AgentBookingService.reconcileCancellation(user.id, orderId, "Khách đổi ý", policy, "sai-ngay"), null);
    assert.equal(await AgentOrderProviderService.reconcileSelection(user.id, orderId, providerId, new Date(Date.now() + 60000).toISOString()), null);
    const addressArgs = { fullAddress: payload.fullAddress, useForBooking: false };
    const addressPreview = { payload, coordinates: {} };
    assert(await AgentAddressService.reconcile(user.id, addressArgs, addressPreview, started));
    duplicate = true;
    assert.equal(await AgentAddressService.reconcile(user.id, addressArgs, addressPreview, started), null);
    duplicate = false;
    address.recipientName = "Nguyễn Bình";
    assert.equal(await AgentAddressService.reconcile(user.id, addressArgs, addressPreview, started), null);
    address.recipientName = payload.recipientName;
    let writes = 0;
    const fixtures = [
      { tool: cancelBookingTool.name, args: { orderId, reason: "Khách đổi ý" }, preview: policy },
      { tool: saveBookingAddressTool.name, args: addressArgs, preview: addressPreview },
      { tool: selectOrderProviderTool.name, args: { orderId, providerId }, preview: {} },
      { tool: respondProviderReassignmentTool.name, args: { orderId, decision: "accept" }, preview: { responseDeadline: new Date(Date.now() + 60000).toISOString() } },
      { tool: rejectBookingQuotationTool.name, args: { orderId, reason: quotation.rejectionReason! }, preview: { ...policy, quotationId, quotationRevision: 3 } },
    ];
    const registry = new ToolRegistry().register(cancelBookingTool).register(saveBookingAddressTool).register(selectOrderProviderTool)
      .register(respondProviderReassignmentTool).register(rejectBookingQuotationTool);
    for (const fixture of fixtures) {
      if (fixture.tool === "respond_provider_reassignment") order.reassignment = { status: "matching", automatic: false,
        expiresAt: new Date((fixture.preview as { responseDeadline: string }).responseDeadline), respondedAt: new Date(),
        requestedAt: new Date(Date.now() - 2000), requestedByProviderId: new Types.ObjectId(providerId), previousProviderIds: [], reason: "Thợ từ chối" };
      if (fixture.tool === "reject_booking_quotation") order.cancellation!.reason = `Từ chối báo giá sửa chữa: ${quotation.rejectionReason}`;
      const session = newSession(randomUUID(), user.id);
      session.requiresReconciliation = true;
      session.actions.push({ id: randomUUID(), taskVersion: 0, tool: fixture.tool, arguments: fixture.args, preview: fixture.preview,
        status: "UNKNOWN", createdAt: started, executionStartedAt: started, expiresAt: started });
      const context = { user, sessionId: session.id, session, signal: AbortSignal.timeout(5000) };
      mock.method(registry.get(fixture.tool, context), "execute", async () => { writes++; return {}; });
      const agent = new AgentService({ acquire: async () => ({ session, lockId: "khoa" }), save: async () => {}, release: async () => {} },
        new AgentLoop({ generate: async () => ({ type: "MESSAGE", message: "Đang kiểm tra." }) }, registry,
          { maxIterations: 1, timeoutMs: 1000, systemPrompt: "Kiểm thử" }));
      await agent.send(user, session.id, { requestId: randomUUID(), message: "Kiểm tra kết quả trước đó." });
      assert.equal(session.requiresReconciliation, false, fixture.tool);
      assert.equal(session.actions[0].status, "SUCCEEDED", fixture.tool);
    }
    assert.equal(writes, 0, "Đối soát chỉ đọc, không gọi lại thao tác ghi.");
    owned = false;
    assert.equal(await AgentOrderProviderService.reconcileSelection(user.id, orderId, providerId, started), null);
    assert.equal(await AgentAddressService.reconcile(user.id, addressArgs, addressPreview, started), null);
    owned = true; sourceFails = true;
    await assert.rejects(() => AgentBookingService.reconcileCancellation(user.id, orderId, "Khách đổi ý", policy, started));
    console.log("Đạt đối soát 5 tool: kiểm tra chủ sở hữu, thời điểm, nội dung, kết quả mơ hồ và không thực thi lại.");
  } finally { mock.restoreAll(); }
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
