import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import { Types } from "mongoose";
import { Order } from "../models/order.model";
import { AgentLoop } from "../ai/agent/agent-loop.service";
import { ToolRegistry } from "../ai/tools/tool-registry";
import { newSession } from "../ai/agent/agent-state";
import { BOOKING_HISTORY_REQUEST } from "../ai/agent/booking-history";
import type { LLMResponse } from "../ai/llm/llm.interface";
import { AppError } from "../utils/appError";
import type { BookingSearch } from "../services/agentBookingHistory.service";
const last = <T>(items: T[]) => items[items.length - 1];

// Giữ công cụ/luồng thật; giả lập collection và LLM, không tạo đơn hoặc giao dịch thật.
async function run() {
  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  const { AgentService, sessionView } = await import("../ai/agent/agent.service");
  const { AgentBookingService } = await import("../services/agentBooking.service");
  const { AgentBookingHistoryService, bookingSearchSchema } = await import("../services/agentBookingHistory.service");
  const { AgentQuotationService } = await import("../services/agentQuotation.service");
  const { searchMyBookingsTool, rebookBookingTool, getBookingRefundsTool } = await import("../ai/tools/implementations/booking-history.tools");
  const { getBookingQuotationTool } = await import("../ai/tools/implementations/quotation.tools");
  const user = { id: new Types.ObjectId().toString(), role: "CUSTOMER" as const };
  const serviceId = new Types.ObjectId().toString(), addressId = new Types.ObjectId().toString(), providerId = new Types.ObjectId().toString();
  const orderId = new Types.ObjectId().toString(), secondId = new Types.ObjectId().toString();
  const address = { fullAddress: "12 Lê Lợi", ward: "Phường A", province: "Đà Nẵng" };
  const item = { orderId, orderCode: "HD-CU-1", status: "completed" as const, serviceId, service: "Vệ sinh điều hòa",
    serviceType: "fixed_price" as const, hasQuotation: false, address, providerId, provider: "Nguyễn Minh",
    createdAt: new Date(), scheduledAt: null, paymentStatus: "paid" as const, options: [] };
  let failSearch = false, owned = true;
  const searches: unknown[] = [], quotations: string[] = [], refunds: string[] = [];
  let orderReads = 0, modelCalls = 0;
  const responses: LLMResponse[] = [];
  mock.method(AgentBookingHistoryService, "search", async (owner: string, args: BookingSearch) => {
    assert.equal(owner, user.id); searches.push(args);
    if (failSearch) throw Error("Lỗi tra cứu giả lập");
    return { items: args.page === 1 ? [item] : [{ ...item, orderId: secondId, orderCode: "HD-CU-2", status: "cancelled" as const,
      serviceType: "variable_price" as const, hasQuotation: true, paymentStatus: "refunded" as const }],
      pagination: { page: args.page, limit: args.limit, total: 7, totalPages: 2 }, note: "Kiểm thử" };
  });
  mock.method(AgentQuotationService, "get", async (owner: string, id: string) => {
    assert.equal(owner, user.id); quotations.push(id);
    return { orderId: id, orderCode: "HD-CU-2", quotation: null, note: "Đơn chưa có báo giá hiện tại." };
  });
  mock.method(AgentBookingHistoryService, "refunds", async (owner: string, id: string) => {
    assert.equal(owner, user.id); refunds.push(id);
    return { orderId: id, orderCode: "HD-CU-2", refunds: [], walletTransactions: [], payments: [], policy: null, note: "Chưa có khoản hoàn." } as never;
  });
  const oldOrder = { _id: new Types.ObjectId(orderId), orderCode: item.orderCode, status: "completed", serviceId: new Types.ObjectId(serviceId),
    addressId: new Types.ObjectId(addressId), providerId: new Types.ObjectId(providerId), addressSnapshot: address,
    selectedOptionsSnapshot: [{ optionId: null, name: "Giá chung", quantity: 2 }], paymentMethod: "bank" };
  mock.method(Order, "findOne", (filter: { customerId?: unknown; _id?: unknown }) => {
    assert.equal(filter.customerId, user.id); assert.equal(String(filter._id), orderId); orderReads++;
    return { lean: async () => owned ? oldOrder : null } as never;
  });
  mock.method(AgentBookingService, "service", async () => ({ id: serviceId, name: item.service,
    serviceType: "fixed_price", fixedPrice: 200000, requiresOptionSelection: false, options: [] }));
  mock.method(AgentBookingService, "addresses", async () => [{ id: addressId, ...address, isDefault: true }]);
  mock.method(AgentBookingService, "vouchers", async () => []);
  try {
    const registry = new ToolRegistry().register(searchMyBookingsTool).register(rebookBookingTool).register(getBookingRefundsTool).register(getBookingQuotationTool);
    const loop = new AgentLoop({ generate: async () => { modelCalls++; return responses.shift() ?? { type: "MESSAGE", message: "Đã đọc dữ liệu của đúng đơn đã chọn." }; } }, registry,
      { maxIterations: 3, systemPrompt: "Kiểm thử", timeoutMs: 5000 });
    const session = newSession(randomUUID(), user.id);
    session.bookingDraft = { status: "active", revision: 1, values: { serviceId }, sources: {}, summary: [], missing: [], choiceGroups: [] };
    const originalDraft = structuredClone(session.bookingDraft);
    const agent = new AgentService({ acquire: async () => ({ session, lockId: "khoa" }), save: async () => {}, release: async () => {} }, loop);
    const send = (message: string) => agent.send(user, session.id, { requestId: randomUUID(), message });
    await send("Tôi muốn tìm đơn cũ.");
    assert.equal(modelCalls, 0);
    assert.deepEqual(session.bookingDraft, originalDraft, "Tìm đơn không thay bản nháp đang đặt.");
    assert.equal(last(sessionView(session).messages)?.bookingSearch?.items[0].orderId, orderId);
    assert(!JSON.stringify(last(sessionView(session).messages)?.bookingSearch).includes('"query"'), "Không gửi bộ lọc nội bộ trong thẻ kết quả.");
    const criteria = bookingSearchSchema.parse({ service: "Điều hòa", address: "Nhà mẹ", status: "completed",
      from: "2026-09-01T00:00:00+07:00", to: "2026-09-30T23:59:59+07:00" });
    responses.push({ type: "TOOL_CALL", tool: "search_my_bookings", arguments: criteria }, { type: "MESSAGE", message: "Chọn đơn cần xử lý." });
    await send("Tìm đơn điều hòa tháng 9 ở nhà mẹ");
    assert(last(sessionView(session).messages)?.bookingSearch, "Tìm bằng câu tự nhiên cũng có thẻ thao tác.");
    await send("Xem trang 2 của kết quả tìm đơn cũ.");
    assert.deepEqual(last(searches), { ...criteria, page: 2 }, "Phân trang giữ đầy đủ bộ lọc đã xác định.");
    const previousSearchCount = searches.length;
    await send("Xem trang 3 của kết quả tìm đơn cũ.");
    assert.equal(searches.length, previousSearchCount);
    failSearch = true;
    await send("Xem trang 1 của kết quả tìm đơn cũ.");
    assert.equal(last(sessionView(session).messages)?.bookingSearch, undefined, "Lỗi tra cứu không được giả làm kết quả rỗng.");
    failSearch = false;
    await send("Xem trang 1 của kết quả tìm đơn cũ.");
    assert.deepEqual(last(searches), criteria);
    await send(`Xem báo giá đơn ${secondId} (HD-CU-2) từ kết quả tìm đơn cũ.`);
    assert.deepEqual(quotations, [secondId]);
    await send(`Tra hoàn tiền đơn ${secondId} (HD-CU-2).`);
    assert.deepEqual(refunds, [secondId]);
    await send(`Xem báo giá đơn ${new Types.ObjectId()} (KHONG-THUOC-KET-QUA) từ kết quả tìm đơn cũ.`);
    assert.equal(quotations.length, 1);
    const request = { requestId: randomUUID(), message: `Đặt lại cùng thợ cũ đơn ${orderId} (HD-CU-1) từ kết quả tìm đơn cũ.` };
    await agent.send(user, session.id, request);
    assert.deepEqual(session.bookingDraft, originalDraft, "Đặt lại chưa thay bản nháp khi khách chưa chọn chuyển.");
    assert(session.rebookProposal);
    await agent.send(user, session.id, { requestId: randomUUID(), message: "Chuyển sang đặt lại đơn cũ.",
      bookingAction: { type: "rebook_decision", proposalId: session.rebookProposal.id, accept: true } });
    assert.equal(session.bookingDraft.values.preferredProviderId, providerId);
    assert.equal(session.bookingDraft.values.uniformQuantity, 2);
    assert.equal(session.bookingDraft.values.scheduledAt, undefined);
    assert.equal(session.bookingDraft.orderId, undefined);
    assert.equal(session.pendingAction, null, "Chưa đủ lịch mới thì chưa gửi xác nhận tạo đơn.");
    const version = session.taskVersion, reads = orderReads;
    await agent.send(user, session.id, request);
    assert.equal(session.taskVersion, version); assert.equal(orderReads, reads, "Thử lại request không tạo thêm bản nháp.");
    owned = false;
    const before = structuredClone(session.bookingDraft);
    await send(`Đặt lại đơn ${orderId} (HD-CU-1) từ kết quả tìm đơn cũ.`);
    assert.deepEqual(session.bookingDraft, before, "Đơn không còn thuộc khách thì không thay bản nháp.");
    assert(last(session.conversation)?.content.includes("Không tìm thấy đơn hàng của bạn"));
    owned = true;
    mock.method(AgentBookingService, "service", async () => { throw new AppError("Dịch vụ hiện không còn hoạt động.", 409); });
    await send(`Đặt lại đơn ${orderId} (HD-CU-1) từ kết quả tìm đơn cũ.`);
    await agent.send(user, session.id, { requestId: randomUUID(), message: "Chuyển sang đặt lại đơn cũ.",
      bookingAction: { type: "rebook_decision", proposalId: session.rebookProposal!.id, accept: true } });
    assert.deepEqual(session.bookingDraft, before);
    assert(last(session.conversation)?.content.includes("không còn hoạt động"));
    assert.equal(session.actions.length, 0, "Tra cứu/đặt lại bản nháp không tạo đơn hoặc thanh toán.");
    const lockedSession = newSession(randomUUID(), user.id);
    lockedSession.conversation.push({ id: randomUUID(), role: "user", content: BOOKING_HISTORY_REQUEST, createdAt: new Date().toISOString() });
    const lockedLoop = new AgentLoop({ generate: async () => { throw Error("Không gọi AI khi công cụ bị khóa."); } },
      new ToolRegistry({ search_my_bookings: { enabled: false } }).register(searchMyBookingsTool), { maxIterations: 1, systemPrompt: "Kiểm thử", timeoutMs: 2000 });
    const callsBeforeLock = searches.length;
    await lockedLoop.run(lockedSession, { user, sessionId: lockedSession.id, signal: new AbortController().signal }, async () => {});
    assert.equal(searches.length, callsBeforeLock, "Đường dẫn nút thao tác vẫn tôn trọng cấu hình khóa công cụ.");
    await loop.run(lockedSession, { user: { ...user, role: "PROVIDER" }, sessionId: lockedSession.id, signal: new AbortController().signal }, async () => {});
    assert.equal(searches.length, callsBeforeLock, "Đường dẫn trực tiếp không vượt quyền CUSTOMER.");
    console.log("Đạt thao tác tìm đơn cũ: thẻ từ kết quả công cụ, chọn đúng đơn, giữ bộ lọc/phân trang, lỗi nguồn, đặt lại/cùng thợ, lịch mới, quyền sở hữu và thử lại an toàn.");
  } finally { mock.restoreAll(); }
}
run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
