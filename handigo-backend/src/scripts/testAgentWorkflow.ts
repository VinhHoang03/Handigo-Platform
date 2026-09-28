import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import { model } from "mongoose";
import { z } from "zod";
import { SessionService } from "../ai/session/session.service";
import { bookingDraftPatchSchema, updateBookingDraft, readyBookingArguments } from "../ai/agent/booking-draft";
import { agentContext } from "../ai/agent/agent-context";
import { AgentLoop } from "../ai/agent/agent-loop.service";
import { AgentService, sessionView } from "../ai/agent/agent.service";
import { newSession } from "../ai/agent/agent-state";
import type { LLMResponse } from "../ai/llm/llm.interface";
import { bookingFixture, bookingFixtureIds as ids } from "./fixtures/agentBooking.fixture";

async function testBookingContinuation() {
  for (const orderType of ["normal", "scheduled"] as const) {
    for (const interrupted of [false, true]) {
      const fixture = bookingFixture();
      const session = newSession(randomUUID(), "khách");
      const user = { id: "khách", role: "CUSTOMER" as const };
      const context = { user, sessionId: session.id, signal: new AbortController().signal };
      const create = fixture.registry.get("create_booking", context);
      const execute = create.execute;
      create.execute = async (ctx, args) => ({ ...await execute(ctx, args) as object,
        orderCode: "HD-THU", orderType, bookingStatus: orderType === "normal" ? "not_required" : "awaiting_provider",
        paymentMethod: "bank" });
      let payments = 0;
      fixture.registry.register({ name: "create_payment", description: "Xác nhận thanh toán thử nghiệm.",
        roles: ["CUSTOMER"], mutates: true, requiresConfirmation: true,
        inputSchema: z.object({ orderId: z.string(), method: z.enum(["PAYOS", "WALLET", "CASH"]) }),
        preview: async (_ctx, args) => ({ ...args, amount: 150000 }),
        execute: async () => { payments += 1; return {}; },
      });
      let generations = 0;
      const loop = new AgentLoop({ generate: async () => {
        generations += 1;
        return generations === 1
          ? { type: "TOOL_CALL", tool: "update_booking_draft", arguments: { serviceId: ids.other, orderType,
            ...(orderType === "scheduled" ? { scheduledAt: new Date(Date.now() + 86400000).toISOString() } : {}) } }
          : { type: "FINAL", message: "Đơn đã được tạo." };
      } }, fixture.registry, { maxIterations: 8, timeoutMs: 1000, systemPrompt: "Kiểm thử tiếp tục đặt lịch" });
      let interruptNextSave = interrupted;
      const agent = new AgentService({ acquire: async () => ({ session, lockId: "khóa" }),
        save: async () => {
          if (interruptNextSave && session.actions.some((action) => action.tool === "create_booking" && action.status === "SUCCEEDED")) {
            interruptNextSave = false;
            throw new Error("Gián đoạn sau khi lưu kết quả tạo đơn.");
          }
        }, release: async () => {} }, loop);
      await agent.send(user, session.id, { requestId: randomUUID(), message: "Đặt vệ sinh máy lạnh" });
      const input = { requestId: randomUUID(), confirmation: { actionId: session.pendingAction!.id, decision: "CONFIRM" as const } };
      if (interrupted) await assert.rejects(agent.send(user, session.id, input), /Gián đoạn/);
      const result = await agent.send(user, session.id, input);
      assert.equal(fixture.writes(), 1, "Tiếp tục không được tạo đơn lần hai.");
      assert.equal(payments, 0, "Tạo đơn không được tự thực hiện thanh toán.");
      if (orderType === "normal") {
        assert.equal(result.pendingConfirmation?.tool, "create_payment", "Tiếp tục phải khôi phục bước xác nhận thanh toán.");
        assert.deepEqual(session.pendingAction?.arguments, { orderId: ids.order, method: "PAYOS" });
      } else {
        assert.equal(result.pendingConfirmation, null);
        assert.equal(result.payment?.status, "blocked");
        assert.match(result.messages[result.messages.length - 1].content, /chờ chuyên gia xác nhận/);
      }
      assert.equal(generations, 1, "Bước tiếp theo của đơn đã tạo không phụ thuộc thêm một lượt AI.");
      await agent.send(user, session.id, input);
      assert.equal(fixture.writes(), 1);
    }
  }
}

async function main() {
  const quick = bookingFixture();
  quick.services[1].name = "Vệ sinh điều hòa";
  quick.services.push({ ...quick.services[0], name: "Vệ sinh điều hòa và nhà" });
  const quickSession = newSession(randomUUID(), "khách");
  const quickReplies: LLMResponse[] = [{ type: "TOOL_CALL", tool: "update_booking_draft",
    arguments: { serviceQuery: "Vệ sinh điều hòa" } }];
  const quickAgent = new AgentService({ acquire: async () => ({ session: quickSession, lockId: "khóa" }),
    save: async () => {}, release: async () => {} }, new AgentLoop({ generate: async () => {
      const reply = quickReplies.shift(); assert.ok(reply, "Phải gửi form ngay sau khi chuẩn bị nháp."); return reply;
    } }, quick.registry, { maxIterations: 8, timeoutMs: 1000, systemPrompt: "Kiểm thử đặt nhanh" }));
  const quickSend = (message: string) => quickAgent.send({ id: "khách", role: "CUSTOMER" }, quickSession.id,
    { requestId: randomUUID(), message });
  await quickSend("đặt cho tôi đơn vệ sinh điều hòa");
  assert.equal(quickSession.state, "WAITING_CONFIRMATION");
  assert.equal(quickSession.pendingAction?.tool, "create_booking");
  assert.deepEqual(quickSession.bookingDraft?.values, { serviceId: ids.other, addressId: ids.home,
    orderType: "normal", paymentMethod: "bank", selectedOptions: [{ optionId: ids.single, quantity: 1 }] });
  assert.equal(quick.writes(), 0, "Gửi form chưa phải xác nhận tạo đơn.");
  const firstForm = quickSession.pendingAction!.id;
  quickReplies.push({ type: "TOOL_CALL", tool: "update_booking_draft",
    arguments: { addressId: ids.office, quantity: 2, paymentMethod: "wallet" } });
  await quickSend("Đổi sang văn phòng, 2 máy, thanh toán bằng ví");
  assert.equal(quickSession.state, "WAITING_CONFIRMATION");
  assert.notEqual(quickSession.pendingAction?.id, firstForm);
  assert.equal(quickSession.bookingDraft?.values.addressId, ids.office);
  assert.equal(quickSession.bookingDraft?.values.selectedOptions?.[0].quantity, 2);
  assert.equal(quickSession.bookingDraft?.values.paymentMethod, "wallet");
  assert.equal(quick.writes(), 0);

  const fixture = bookingFixture();
  const patch = (value: unknown) => bookingDraftPatchSchema.parse(value);
  const quantityFixture = bookingFixture();
  quantityFixture.services[1].options.push({ ...quantityFixture.services[1].options[0],
    _id: ids.large, name: "Máy âm trần", price: 250000 });
  let quantityDraft = await updateBookingDraft(undefined, patch({ serviceId: ids.other, quantity: 2 }), "khách", quantityFixture.deps);
  quantityDraft = await updateBookingDraft(quantityDraft, patch({ selectedOptions: [{ optionId: ids.single }] }), "khách", quantityFixture.deps);
  assert.equal(readyBookingArguments(quantityDraft)?.selectedOptions?.[0].quantity, 2,
    "Chọn loại máy ở lượt sau phải giữ số lượng khách đã yêu cầu.");
  quantityDraft = await updateBookingDraft(quantityDraft, patch({ selectedOptions: [{ optionId: ids.single, quantity: 3 }] }), "khách", quantityFixture.deps);
  assert.equal(quantityDraft.values.selectedOptions?.[0].quantity, 3);
  quantityDraft = await updateBookingDraft(quantityDraft, patch({ selectedOptions: [{ optionId: ids.single }] }), "khách", quantityFixture.deps);
  assert.equal(quantityDraft.values.selectedOptions?.[0].quantity, 3,
    "Gửi lại tùy chọn không kèm số lượng phải giữ số lượng đã chọn.");
  quantityDraft = await updateBookingDraft(quantityDraft, patch({ selectedOptions: [{ optionId: ids.single, quantity: 1 }] }), "khách", quantityFixture.deps);
  assert.equal(quantityDraft.values.selectedOptions?.[0].quantity, 1, "Khách vẫn được chủ động giảm số lượng về 1.");
  await assert.rejects(updateBookingDraft(quantityDraft, patch({ selectedOptions: [{ optionId: ids.single }, { optionId: ids.large }] }),
    "khách", quantityFixture.deps), /số lượng cho từng tùy chọn/);
  quantityDraft = await updateBookingDraft(quantityDraft, patch({ selectedOptions: [{ optionId: ids.single, quantity: 2 }, { optionId: ids.large, quantity: 3 }] }), "khách", quantityFixture.deps);
  quantityDraft = await updateBookingDraft(quantityDraft, patch({ selectedOptions: [{ optionId: ids.single }, { optionId: ids.large }] }), "khách", quantityFixture.deps);
  assert.deepEqual(quantityDraft.values.selectedOptions?.map((item) => item.quantity), [2, 3]);
  let draft = await updateBookingDraft(undefined, patch({ serviceQuery: "Vệ sinh nhà" }), "khách", fixture.deps);
  assert.equal(draft.values.addressId, ids.home);
  assert.equal(draft.sources.addressId, "default");
  assert.equal(draft.values.paymentMethod, "bank");
  assert.equal(draft.choiceGroups[0].label, "Diện tích");
  assert.equal(draft.choiceGroups[0].multiple, false);
  assert.equal(readyBookingArguments(draft), null);
  draft = await updateBookingDraft(draft, patch({ selectedOptions: [{ optionId: ids.small }], schedulePreference: "sáng mai" }), "khách", fixture.deps);
  assert.equal(draft.values.selectedOptions?.[0].quantity, 1);
  assert.equal(draft.values.orderType, "scheduled");
  assert.equal(draft.values.scheduledAt, undefined);
  assert.equal(readyBookingArguments(draft), null);
  const time = new Date(Date.now() + 86400000).toISOString();
  draft = await updateBookingDraft(draft, patch({ scheduledAt: time }), "khách", fixture.deps);
  assert.equal(readyBookingArguments(draft)?.addressId, ids.home);
  const rescheduled = await updateBookingDraft(draft, patch({ schedulePreference: "sáng ngày kia" }), "khách", fixture.deps);
  assert.equal(rescheduled.scheduleDate, undefined, "Đổi lịch bằng lời không được gợi ý ngày cũ.");
  assert.equal(rescheduled.values.scheduledAt, undefined);
  assert.equal(rescheduled.sources.scheduledAt, undefined);
  assert.ok(!rescheduled.choiceGroups.some((group) => group.label.includes("Giờ hẹn")));
  const newDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const dated = await updateBookingDraft(draft, patch({ schedulePreference: "sáng ngày đã chọn", scheduleDate: newDate, timeWindow: "morning" }), "khách", fixture.deps);
  assert.equal(dated.scheduleDate, newDate);
  assert.equal(dated.timeWindow, "morning");
  assert.ok(dated.choiceGroups.some((group) => group.label.includes("Giờ hẹn")));
  const afternoon = await updateBookingDraft(draft, patch({ timeWindow: "afternoon" }), "khách", fixture.deps);
  assert.equal(afternoon.values.scheduledAt, undefined);
  assert.equal(afternoon.scheduleDate, draft.scheduleDate);
  assert.ok(afternoon.choiceGroups.some((group) => group.options.some((option) => option.includes("14:00"))));
  draft = await updateBookingDraft(draft, patch({ addressPreference: "địa chỉ khác" }), "khách", fixture.deps);
  assert.equal(draft.values.addressId, undefined);
  assert.equal(draft.values.scheduledAt, time);
  assert.equal(draft.values.selectedOptions?.[0].optionId, ids.small);
  draft = await updateBookingDraft(draft, patch({ addressId: ids.office, orderType: "normal" }), "khách", fixture.deps);
  assert.equal(draft.values.scheduledAt, undefined);
  assert.equal(draft.values.addressId, ids.office);
  draft = await updateBookingDraft(draft, patch({ serviceId: ids.other }), "khách", fixture.deps);
  assert.deepEqual(draft.values.selectedOptions, [{ optionId: ids.single, quantity: 1 }]);
  assert.equal(draft.sources.selectedOptions, "default");
  draft = await updateBookingDraft(draft, patch({ selectedOptions: [{ optionId: ids.single, quantity: 2 }] }), "khách", fixture.deps);
  assert.equal(draft.values.selectedOptions?.[0].quantity, 2);
  await assert.rejects(updateBookingDraft(draft, patch({ selectedOptions: [{ optionId: ids.small }] }), "khách", fixture.deps));
  draft = await updateBookingDraft(draft, patch({ mode: "pause" }), "khách", fixture.deps);
  assert.equal(readyBookingArguments(draft), null);
  draft = await updateBookingDraft(draft, patch({ mode: "resume" }), "khách", fixture.deps);
  assert.equal(readyBookingArguments(draft)?.addressId, ids.office);
  await assert.rejects(updateBookingDraft({ ...draft, status: "booked" }, patch({}), "khách", fixture.deps));
  await assert.rejects(updateBookingDraft({ ...draft, status: "booked", orderId: ids.order }, patch({ mode: "pause" }), "khách", fixture.deps));
  await assert.rejects(updateBookingDraft({ ...draft, status: "booked", orderId: ids.order }, patch({ mode: "discard" }), "khách", fixture.deps));
  const preferences = await updateBookingDraft(undefined, patch({ serviceId: ids.other, optionPreference: "2 máy treo tường",
    scheduleDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), timeWindow: "morning" }), "khách", fixture.deps);
  assert.equal(preferences.values.selectedOptions, undefined);
  assert.ok(preferences.choiceGroups.some((group) => group.label.includes("Giờ hẹn")));
  assert.equal(preferences.values.scheduledAt, undefined);
  const fresh = await updateBookingDraft({ ...draft, status: "booked" }, patch({ startNew: true, serviceId: ids.service }), "khách", fixture.deps);
  assert.equal(fresh.values.addressId, ids.home);
  assert.equal(fresh.values.selectedOptions, undefined);
  fixture.addresses.forEach((address) => { address.isDefault = false; });
  assert.equal((await updateBookingDraft(undefined, patch({ serviceId: ids.other }), "khách", fixture.deps)).values.addressId, undefined);
  fixture.addresses.length = 0;
  assert.ok((await updateBookingDraft(undefined, patch({ serviceId: ids.other }), "khách", fixture.deps)).missing.some((item) => item.includes("sổ địa chỉ")));

  const flow = bookingFixture();
  const session = newSession(randomUUID(), "khách");
  const replies: LLMResponse[] = [];
  const loop = new AgentLoop({ generate: async () => { const reply = replies.shift(); assert.ok(reply); return reply; } }, flow.registry,
    { maxIterations: 8, timeoutMs: 1000, systemPrompt: "Kiểm thử hội thoại" });
  let checkpoints = 0;
  const agent = new AgentService({ acquire: async () => ({ session, lockId: "khóa" }),
    save: async () => { checkpoints += 1; }, release: async () => {} }, loop);
  const send = async (message: string, args: Record<string, unknown>) => {
    replies.push({ type: "TOOL_CALL", tool: "update_booking_draft", arguments: args });
    return agent.send({ id: "khách", role: "CUSTOMER" }, session.id, { requestId: randomUUID(), message });
  };
  await send("Đặt vệ sinh nhà", { serviceQuery: "Vệ sinh nhà" });
  assert.equal(session.state, "WAITING_USER_INPUT");
  assert.equal(sessionView(session).messages[1].choiceGroups?.[0].label, "Diện tích");
  await send("Nhà dưới 50 m², đặt sáng mai", { selectedOptions: [{ optionId: ids.small }], schedulePreference: "sáng mai" });
  assert.equal(session.state, "WAITING_USER_INPUT");
  await send("Lúc 9 giờ", { scheduledAt: time });
  const oldAction = session.pendingAction!.id;
  assert.equal(session.state, "WAITING_CONFIRMATION");
  assert.equal(flow.writes(), 0);
  await send("Đổi sang địa chỉ văn phòng", { addressId: ids.office });
  assert.notEqual(session.pendingAction?.id, oldAction);
  assert.equal(session.bookingDraft?.values.scheduledAt, time);
  await assert.rejects(agent.send({ id: "khách", role: "CUSTOMER" }, session.id,
    { requestId: randomUUID(), confirmation: { actionId: oldAction, decision: "CONFIRM" } }));
  replies.push({ type: "TOOL_CALL", tool: "get_service_catalog", arguments: {} }, { type: "FINAL", message: "Handigo có vệ sinh nhà và máy lạnh." });
  await agent.send({ id: "khách", role: "CUSTOMER" }, session.id, { requestId: randomUUID(), message: "Handigo có những dịch vụ gì?" });
  assert.equal(session.pendingAction, null);
  assert.equal(session.bookingDraft?.status, "paused");
  await send("Tiếp tục đơn đang soạn", { mode: "resume" });
  assert.equal(session.bookingDraft?.values.addressId, ids.office);
  assert.equal(session.state, "WAITING_CONFIRMATION");
  assert.equal(flow.writes(), 0);
  assert.ok(checkpoints > 0);
  replies.push({ type: "FINAL", message: "Đã tạo đơn thử nghiệm." });
  const confirmation = { requestId: randomUUID(), confirmation: { actionId: session.pendingAction!.id, decision: "CONFIRM" as const } };
  await agent.send({ id: "khách", role: "CUSTOMER" }, session.id, confirmation);
  assert.equal(flow.writes(), 1);
  assert.equal(session.bookingDraft?.status, "booked");
  await agent.send({ id: "khách", role: "CUSTOMER" }, session.id, confirmation);
  assert.equal(flow.writes(), 1);
  const slow = bookingFixture();
  const abort = new AbortController();
  const draftSession = newSession(randomUUID(), "khách");
  const gate = { finish: () => {} };
  slow.deps.addresses = async () => { await new Promise<void>((resolve) => { gate.finish = resolve; }); return slow.addresses; };
  const toolContext = { session: draftSession, user: { id: "khách", role: "CUSTOMER" as const }, sessionId: draftSession.id, signal: abort.signal };
  const updateTool = slow.registry.get("update_booking_draft", toolContext);
  const operation = updateTool.execute(toolContext, updateTool.inputSchema.parse({ serviceId: ids.other }));
  abort.abort();
  gate.finish();
  await assert.rejects(operation);
  assert.equal(draftSession.bookingDraft, undefined);
  for (let index = 0; index < 80; index += 1) session.conversation.push({ id: String(index), role: "user", content: "Ngữ cảnh thử nghiệm", createdAt: new Date().toISOString() });
  const context = agentContext(session);
  assert.ok(context.conversation.length <= 40);
  assert.equal(context.taskContext.bookingDraft?.values.addressId, ids.office);
  const progressQuery = mock.method(model("AiAgentSession"), "findOne", (filter: { _id: string; userId: string }) => {
    assert.equal(filter._id, session.id);
    return { select: () => ({ lean: async () => filter.userId === session.userId ? { data: {
      state: "EXECUTING_TOOL", activeRequest: { requestId: "lượt-đang-chạy" },
      activity: { requestId: "lượt-đang-chạy", message: "Đang kiểm tra giá", updatedAt: new Date().toISOString() },
    } } : null }) };
  });
  try {
    const progress = await new SessionService().progress(session.id, session.userId);
    assert.equal(progress.requestId, "lượt-đang-chạy");
    assert.equal(progress.activity?.message, "Đang kiểm tra giá");
    await assert.rejects(new SessionService().progress(session.id, "khách-khác"));
  } finally { progressQuery.mock.restore(); }
  await testBookingContinuation();
  console.log("Đã kiểm tra bản nháp, giữ số lượng qua nhiều lượt, đổi lịch, chuyển chủ đề, xác nhận cũ, giới hạn ngữ cảnh và tiếp tục sau khi tạo đơn.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
