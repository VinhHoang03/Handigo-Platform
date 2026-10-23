import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import { Types } from "mongoose";
import { AgentLoop } from "../ai/agent/agent-loop.service";
import { ToolRegistry } from "../ai/tools/tool-registry";
import { newSession } from "../ai/agent/agent-state";
import { createUpdateBookingDraftTool } from "../ai/tools/implementations/update-booking-draft.tool";
import { bookingSchema } from "../ai/tools/implementations/booking.schemas";
import type { BookingDraftDependencies } from "../ai/agent/booking-draft";
import type { BookingSearch } from "../services/agentBookingHistory.service";

// Phản hồi AI cố tình sai định dạng; các nút tra/chọn thợ phải xử lý được mà không gọi model.
async function run() {
  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  const { AgentService } = await import("../ai/agent/agent.service");
  const { AgentBookingHistoryService } = await import("../services/agentBookingHistory.service");
  const { getPreviousProvidersTool } = await import("../ai/tools/implementations/booking-history.tools");
  const user = { id: new Types.ObjectId().toString(), role: "CUSTOMER" as const };
  const serviceId = new Types.ObjectId().toString(), addressId = new Types.ObjectId().toString();
  const providerId = new Types.ObjectId().toString(), orderId = new Types.ObjectId().toString();
  const otherProviderId = new Types.ObjectId().toString(), otherOrderId = new Types.ObjectId().toString();
  let modelCalls = 0, empty = false, failed = false, eligible = true, providerChecks = 0;
  const calls: BookingSearch[] = [];
  const item = { orderId, orderCode: "HD-THO-CU", status: "completed" as const, serviceId, service: "Vệ sinh điều hòa",
    serviceType: "fixed_price" as const, hasQuotation: false, address: null, providerId, provider: "Nguyễn Minh",
    createdAt: new Date(), scheduledAt: null, paymentStatus: "paid" as const, options: [] };
  const other = { ...item, orderId: otherOrderId, orderCode: "HD-THO-CU-2", providerId: otherProviderId };
  mock.method(AgentBookingHistoryService, "previousProviders", async (owner: string, args: BookingSearch) => {
    assert.equal(owner, user.id); calls.push(args);
    if (failed) throw Error("Lỗi tra cứu giả lập");
    return { items: empty ? [] : args.page === 1 ? [item, other] : [other], pagination: { page: args.page, limit: args.limit, total: empty ? 0 : 6, totalPages: empty ? 0 : 2 }, note: "Kiểm thử" };
  });
  const deps: BookingDraftDependencies = {
    search: async () => [{ id: serviceId, name: item.service }],
    service: async () => ({ id: serviceId, name: item.service, serviceType: "fixed_price", fixedPrice: 200000, requiresOptionSelection: false, options: [] }),
    addresses: async () => [{ id: addressId, fullAddress: "12 Lê Lợi", ward: "Phường A", province: "Đà Nẵng", isDefault: true }],
    vouchers: async () => [],
    providers: async (_owner, args) => {
      providerChecks++;
      return { available: eligible ? [{ id: providerId, name: item.provider }] : [], requested: args.preferredProviderId
        ? [{ id: args.preferredProviderId, name: item.provider, eligible, reason: eligible ? "Phù hợp" : "Chuyên gia đang ngoại tuyến hoặc bận." }] : [] };
    },
  };
  const registry = new ToolRegistry().register(getPreviousProvidersTool).register(createUpdateBookingDraftTool(deps)).register({
    name: "create_booking", description: "Đặt đơn kiểm thử", roles: ["CUSTOMER"], inputSchema: bookingSchema, mutates: true, requiresConfirmation: true,
    preview: async () => ({ title: "Tạo đơn", amount: 200000 }),
    execute: async () => { throw Error("Không được tạo đơn trong kiểm thử chọn thợ."); },
  });
  const loop = new AgentLoop({ generate: async () => { modelCalls++; throw new SyntaxError("Phản hồi giả lập không phải JSON."); } }, registry,
    { maxIterations: 2, timeoutMs: 3000, systemPrompt: "Kiểm thử" });
  const session = newSession(randomUUID(), user.id);
  const agent = new AgentService({ acquire: async () => ({ session, lockId: "khoa" }), save: async () => {}, release: async () => {} }, loop);
  const send = (message: string) => agent.send(user, session.id, { requestId: randomUUID(), message });
  try {
    const response = await send("Tôi muốn chọn lại thợ từng phục vụ. Hãy tra lịch sử đơn đã hoàn thành và cho tôi chọn đúng người trước khi kiểm tra khả dụng.");
    assert.equal(response.state, "WAITING_USER_INPUT", "Bấm Thợ từng đặt không phụ thuộc phản hồi JSON của model.");
    assert.equal(modelCalls, 0);
    assert.equal(response.messages[response.messages.length - 1].bookingSearch?.kind, "previous_providers");
    assert.equal(Boolean(session.bookingDraft), false, "Xem danh sách chưa tạo bản nháp hoặc chọn thợ.");
    assert.equal(providerChecks, 0);
    assert.equal(calls[0].status, "completed");
    session.state = "FAILED";
    await send("Tiếp tục yêu cầu.");
    assert.equal(session.state, "WAITING_USER_INPUT", "Lượt tra thợ từng lỗi được tiếp tục bằng nhánh tra cứu trực tiếp.");
    await send("Xem trang 2 của danh sách thợ từng đặt.");
    assert.equal(calls[calls.length - 1].page, 2);
    assert.equal(calls[calls.length - 1].status, "completed");
    empty = true;
    const noHistory = await send("Thợ từng đặt");
    assert.equal(noHistory.messages[noHistory.messages.length - 1].bookingSearch?.items.length, 0);
    assert(noHistory.messages[noHistory.messages.length - 1].content.includes("Chưa tìm thấy thợ"));
    failed = true;
    const failedHistory = await send("Thợ từng đặt");
    assert.equal(failedHistory.messages[failedHistory.messages.length - 1].bookingSearch, undefined);
    assert(!failedHistory.messages[failedHistory.messages.length - 1].content.includes("Chưa tìm thấy thợ"), "Lỗi nguồn không được báo là khách chưa có lịch sử.");
    failed = false; empty = false;
    await send("Tôi muốn chọn lại thợ từng phục vụ.");
    const choose = `Chọn thợ từ đơn ${otherOrderId} (HD-THO-CU-2).`;
    const request = { requestId: randomUUID(), message: choose };
    await agent.send(user, session.id, request);
    assert.equal(session.bookingDraft?.values.preferredProviderId, otherProviderId, "Thợ trùng tên vẫn chọn đúng người từ đơn được bấm.");
    assert.equal(session.bookingDraft?.values.serviceId, serviceId);
    assert(providerChecks > 0); assert.equal(session.pendingAction?.tool, "create_booking");
    const revision = session.bookingDraft?.revision;
    await agent.send(user, session.id, request);
    assert.equal(session.bookingDraft?.revision, revision, "Thử lại request không chọn hoặc tạo nháp lặp.");
    assert(session.bookingDraft);
    const draft = session.bookingDraft;
    draft.values.uniformQuantity = 3; draft.values.paymentMethod = "wallet"; draft.values.problemDescription = "Giữ nguyên yêu cầu cũ";
    const keptValues = structuredClone(draft.values);
    const oldConfirmation = session.pendingAction!.id;
    await send(`Tôi muốn chọn lại thợ từng phục vụ cho dịch vụ ${serviceId}. Tra lịch sử đơn đã hoàn thành và cho tôi chọn đúng người; giữ các thông tin khác của bản nháp.`);
    assert.equal(calls[calls.length - 1].serviceId, serviceId);
    assert.deepEqual(session.bookingDraft?.values, keptValues, "Tra lịch sử không đổi thông tin đặt dịch vụ.");
    assert.equal(session.actions.find((entry) => entry.id === oldConfirmation)?.status, "EXPIRED");
    await send(choose);
    assert.deepEqual(session.bookingDraft?.values, keptValues, "Chọn lại thợ giữ số lượng, địa chỉ, thanh toán và mô tả.");
    eligible = false;
    const unavailable = await send(choose);
    assert.equal(session.pendingAction, null);
    assert.equal(session.bookingDraft?.values.preferredProviderId, otherProviderId, "Thợ không còn phù hợp không được tự thay người.");
    assert(unavailable.messages[unavailable.messages.length - 1].content.includes("ngoại tuyến"));
    const before = structuredClone(session.bookingDraft);
    await send(`Chọn thợ từ đơn ${new Types.ObjectId()} (KHONG-THUOC-LICH-SU) trong lịch sử thợ từng đặt.`);
    assert.deepEqual(session.bookingDraft, before, "Không chọn thợ từ ID khách tự tạo ngoài lịch sử.");
    const previousOrderId = new Types.ObjectId().toString();
    session.bookingDraft!.status = "booked"; session.bookingDraft!.orderId = previousOrderId;
    eligible = true;
    await send(choose);
    assert.equal(session.bookingDraft!.status, "active");
    assert.equal(session.bookingDraft!.orderId, undefined, "Chọn thợ sau đơn đã tạo phải chuẩn bị bản nháp mới, không sửa đơn cũ.");
    assert.equal(modelCalls, 0);
    assert(!session.actions.some((entry) => entry.status === "SUCCEEDED"), "Chọn thợ chưa tạo đơn hay thanh toán.");
    console.log("Đạt Thợ từng đặt: bỏ qua model sai định dạng, chỉ tra đơn hoàn thành, phân trang, rỗng/lỗi nguồn, thợ trùng tên, giữ bản nháp, kiểm tra khả dụng và thử lại an toàn.");
  } finally { mock.restoreAll(); }
}
run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
