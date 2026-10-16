import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { AgentLoop } from "../ai/agent/agent-loop.service";
import { ToolRegistry } from "../ai/tools/tool-registry";
import { createUpdateBookingDraftTool } from "../ai/tools/implementations/update-booking-draft.tool";
import { bookingSchema } from "../ai/tools/implementations/booking.schemas";
import { newSession, type AgentSession } from "../ai/agent/agent-state";
import { updateBookingDraft, parseBookingVoucherRequest, type BookingDraftDependencies } from "../ai/agent/booking-draft";

// Chỉ dùng phiên, mã và giá giả lập; không gọi LLM, database hoặc thanh toán thật.
async function run() {
  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  const { AgentService } = await import("../ai/agent/agent.service");
  const user = { id: new Types.ObjectId().toString(), role: "CUSTOMER" as const };
  const serviceId = new Types.ObjectId().toString(), addressId = new Types.ObjectId().toString();
  let vouchers: NonNullable<AgentSession["bookingDraft"]>["availableVouchers"] = [];
  let failLookup = false;
  let modelCalls = 0;
  const deps: BookingDraftDependencies = {
    search: async () => [{ id: serviceId, name: "Sửa chữa điều hòa" }],
    service: async () => ({ id: serviceId, name: "Sửa chữa điều hòa", slug: "dieu-hoa", serviceType: "variable_price", requiresOptionSelection: false, options: [] }),
    addresses: async () => [{ id: addressId, fullAddress: "12 Lê Lợi", ward: "Phường A", province: "Đà Nẵng", isDefault: true }],
    vouchers: async () => { if (failLookup) throw Error("Lỗi tra cứu giả lập"); return vouchers ?? []; },
    voucherFeedback: async (_userId, args) => args.voucherCode === "SAILOAI"
      ? "Mã giảm giá này chỉ áp dụng cho đơn giá cố định. Bạn có thể chọn mã khác hoặc không dùng mã."
      : "Hiện bạn chưa có mã giảm giá còn hiệu lực và còn lượt để sử dụng. Bạn có thể tiếp tục đặt đơn với giá đang hiển thị.",
  };
  const registry = new ToolRegistry().register(createUpdateBookingDraftTool(deps)).register({
    name: "create_booking", description: "Đặt đơn kiểm thử", inputSchema: bookingSchema, roles: ["CUSTOMER"], mutates: true, requiresConfirmation: true,
    preview: async (_context, args) => ({ title: "Đặt dịch vụ", amount: args.voucherCode ? 30000 : 40000, voucherCode: args.voucherCode }),
    execute: async () => { throw Error("Không được tạo đơn trong kiểm thử áp mã."); },
  });
  const loop = new AgentLoop({ generate: async () => { modelCalls++; throw Error("Yêu cầu mã đơn giản không cần gọi LLM."); } },
    registry, { maxIterations: 2, systemPrompt: "Kiểm thử", timeoutMs: 5000 });
  const session = newSession(randomUUID(), user.id);
  session.bookingDraft = await updateBookingDraft(undefined, { mode: "update", serviceId }, user.id, deps);
  const agent = new AgentService({ acquire: async () => ({ session, lockId: "khoa" }), save: async () => {}, release: async () => {} }, loop);
  const send = (message: string) => agent.send(user, session.id, { requestId: randomUUID(), message });
  const pending = () => session.pendingAction;
  await send("Tôi muốn áp mã giảm giá");
  assert.equal(pending()?.tool, "create_booking");
  assert(session.conversation[session.conversation.length - 1].content.includes("chưa có mã giảm giá"));
  assert.equal(session.bookingDraft.values.addressId, addressId);
  vouchers = [{ code: "COC10", name: "Giảm cọc", discountAmount: 10000, finalAmount: 30000 }];
  await send("Tôi muốn áp mã giảm giá");
  assert.equal(pending()?.tool, "create_booking", "Cho chọn voucher sau form với giá chưa giảm.");
  assert.equal((pending()?.preview as { amount: number }).amount, 40000);
  assert.equal(session.conversation[session.conversation.length - 1].confirmationActionId, pending()?.id);
  assert(session.conversation[session.conversation.length - 1].choiceGroups?.some((group) => group.options.includes("COC10 — giảm 10.000 đ")));
  assert(session.bookingDraft.choiceGroups.some((group) => group.options.includes("COC10 — giảm 10.000 đ")));
  assert.equal(session.bookingDraft.values.voucherCode, undefined, "Xin áp mã chưa chỉ định thì cho chọn, không tự áp.");
  await send("Voucher có thể sử dụng: COC10 — giảm 10.000 đ");
  assert.equal(session.bookingDraft.values.voucherCode, "COC10");
  assert.equal((pending()?.preview as { amount: number }).amount, 30000);
  const oldConfirmation = pending()!.id;
  await send("Áp mã SAILOAI");
  assert.equal(pending(), null);
  assert(session.conversation[session.conversation.length - 1].content.includes("chỉ áp dụng cho đơn giá cố định"));
  assert.equal(session.actions.find((action) => action.id === oldConfirmation)?.status, "EXPIRED");
  await send("Không dùng voucher");
  assert.equal(session.bookingDraft.values.voucherCode, undefined);
  assert.equal((pending()?.preview as { amount: number }).amount, 40000);
  await send("Chọn mã giảm giá giảm nhiều nhất");
  assert.equal(session.bookingDraft.values.voucherCode, "COC10");
  failLookup = true;
  await send("Tôi muốn áp mã giảm giá");
  assert.equal(pending(), null);
  assert(session.conversation[session.conversation.length - 1].content.includes("Tạm thời chưa thể kiểm tra voucher"));
  assert(!session.conversation[session.conversation.length - 1].content.includes("chưa có mã giảm giá"), "Lỗi nguồn không được báo thành hết mã.");
  failLookup = false;
  await send("Kiểm tra voucher: Kiểm tra lại voucher");
  assert(session.bookingDraft.choiceGroups.some((group) => group.options.includes("COC10 — giảm 10.000 đ")));
  await send("Voucher có thể sử dụng: Không dùng voucher");
  assert.equal((pending()?.preview as { amount: number }).amount, 40000);
  await send("Tôi muốn áp mã giảm giá");
  assert.equal(pending()?.tool, "create_booking", "Khách từng bỏ mã vẫn mở lại được lựa chọn bên dưới form.");
  session.bookingDraft.status = "booked"; session.bookingDraft.orderId = new Types.ObjectId().toString();
  await send("Tôi muốn áp mã giảm giá");
  assert(session.conversation[session.conversation.length - 1].content.includes("đã được tạo"));
  session.bookingDraft = undefined;
  await send("Tôi muốn áp mã giảm giá");
  assert(session.conversation[session.conversation.length - 1].content.includes("áp mã cho dịch vụ nào"));
  assert.equal(modelCalls, 0);
  assert.deepEqual(parseBookingVoucherRequest("Đổi lịch sang mai và áp mã COC10"), undefined, "Yêu cầu kết hợp vẫn cần xử lý đầy đủ bằng agent.");
  assert.deepEqual(parseBookingVoucherRequest("Tôi muốn áp mã giảm giá"), { voucherPreference: "choose" });
  assert.deepEqual(parseBookingVoucherRequest("Áp mã COC10 cho đơn này"), { voucherCode: "COC10" });
  console.log("Đạt yêu cầu voucher: câu chat thật, không có mã, chọn/áp/bỏ mã, sai loại đơn, form mới, lỗi nguồn và chặn sửa đơn đã tạo.");
}
run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
