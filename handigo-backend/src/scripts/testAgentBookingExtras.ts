import assert from "node:assert/strict";
import { mock } from "node:test";
import { Types } from "mongoose";
import { updateBookingDraft, readyBookingArguments, bookingAddressLabel, type BookingDraftDependencies } from "../ai/agent/booking-draft";
import { AgentLoop } from "../ai/agent/agent-loop.service";
import { AgentService } from "../ai/agent/agent.service";
import { ToolRegistry } from "../ai/tools/tool-registry";
import { createUpdateBookingDraftTool } from "../ai/tools/implementations/update-booking-draft.tool";
import { bookingSchema } from "../ai/tools/implementations/booking.schemas";
import { newSession } from "../ai/agent/agent-state";
import { AgentAddressService, agentAddressSchema } from "../services/agentAddress.service";
import * as addressService from "../services/address.service";
import * as geocoding from "../services/reverseGeocoding.service";
import User from "../models/user.model";
import { Address } from "../models/address.model";
import { searchCustomerKnowledge } from "../ai/knowledge/customer-knowledge";

// Không kết nối database, không gọi LLM, PayOS hoặc dịch vụ bản đồ thật.
async function run() {
  const userId = new Types.ObjectId().toString();
  const serviceId = new Types.ObjectId().toString();
  const addressId = new Types.ObjectId().toString();
  const providerId = new Types.ObjectId().toString();
  const alternateId = new Types.ObjectId().toString();
  let voucherActive = true;
  let online = true;
  let duplicateName = false;
  let savedAddressId: string | undefined;
  const deps: BookingDraftDependencies = {
    search: async () => [{ id: serviceId, name: "Vệ sinh điều hòa" }],
    service: async () => ({ id: serviceId, name: "Vệ sinh điều hòa", serviceType: "fixed_price",
      requiresOptionSelection: false, fixedPrice: 200000, options: [] }),
    addresses: async () => [{ id: addressId, fullAddress: "12 Nguyễn Trãi", ward: "Phường A", province: "Hà Nội", isDefault: true },
      ...(savedAddressId ? [{ id: savedAddressId, fullAddress: "34 Lê Lợi", ward: "Phường B", province: "Hà Nội", isDefault: false }] : [])],
    vouchers: async (_user, args) => voucherActive && (args.uniformQuantity ?? 1) < 3
      ? [{ code: "GIAM30", name: "Mã của khách", discountAmount: 30000, finalAmount: 200000 * (args.uniformQuantity ?? 1) - 30000 }] : [],
    providers: async (_user, args) => ({
      requested: args.providerQuery || args.preferredProviderId ? [
        { id: providerId, name: "Nguyễn Hùng", eligible: online, reason: online ? "Đang phù hợp" : "Đang ngoại tuyến" },
        ...(duplicateName ? [{ id: alternateId, name: "Nguyễn Hùng", eligible: true, reason: "Đang phù hợp" }] : []),
      ] : [],
      available: [{ id: alternateId, name: "Trần Minh" }],
    }),
  };
  const draft = await updateBookingDraft(undefined, { mode: "update", serviceQuery: "Vệ sinh điều hòa" }, userId, deps);
  assert.equal(draft.values.addressId, addressId);
  const duplicates = { ...deps, addresses: async () => [
    { id: addressId, fullAddress: "12 Nguyễn Trãi", ward: "Phường A", province: "Hà Nội", isDefault: false },
    { id: alternateId, fullAddress: " 12 Nguyễn Trãi ", ward: "Phường A", province: "Hà Nội", isDefault: false },
  ] };
  const duplicateDraft = await updateBookingDraft(undefined, { mode: "update", serviceId }, userId, duplicates);
  assert.equal(bookingAddressLabel({ id: addressId, fullAddress: "12 Nguyễn Trãi, Phường A, Hà Nội",
    ward: "Phường A", province: "Hà Nội", isDefault: false }), "12 Nguyễn Trãi, Phường A, Hà Nội");
  assert.equal(duplicateDraft.values.addressId, addressId);
  assert(!duplicateDraft.choiceGroups.some((group) => group.label === "Địa chỉ"));
  const keepSelected = await updateBookingDraft({ ...duplicateDraft, values: { ...duplicateDraft.values, addressId: alternateId } },
    { mode: "update", quantity: 2 }, userId, duplicates);
  assert.equal(keepSelected.values.addressId, alternateId);
  const differentRecipients = { ...deps, addresses: async () => [
    { id: addressId, fullAddress: "12 Nguyễn Trãi", ward: "Phường A", province: "Hà Nội", isDefault: false, recipientName: "An" },
    { id: alternateId, fullAddress: "12 Nguyễn Trãi", ward: "Phường A", province: "Hà Nội", isDefault: false, recipientName: "Bình" },
  ] };
  const recipientsDraft = await updateBookingDraft(undefined, { mode: "update", serviceId }, userId, differentRecipients);
  const addressChoices = recipientsDraft.choiceGroups.find((group) => group.label === "Địa chỉ")!;
  assert.equal(new Set(addressChoices.options).size, 2);
  const chosenRecipient = await updateBookingDraft(recipientsDraft,
    { mode: "update", addressPreference: addressChoices.options[1] }, userId, differentRecipients);
  assert.equal(chosenRecipient.values.addressId, alternateId);
  assert.equal(draft.values.voucherCode, undefined);
  assert.equal(readyBookingArguments(draft), null);
  assert(draft.choiceGroups.some((group) => group.options.includes("Không dùng voucher")));
  const chosen = await updateBookingDraft(draft, { mode: "update", voucherCode: "giam30" }, userId, deps);
  assert.equal(readyBookingArguments(chosen)?.voucherCode, "GIAM30");
  const declined = await updateBookingDraft(draft, { mode: "update", voucherCode: null }, userId, deps);
  assert(readyBookingArguments(declined));
  const stillDeclined = await updateBookingDraft(declined, { mode: "update", serviceId: new Types.ObjectId().toString() }, userId, deps);
  assert.equal(stillDeclined.voucherDecision, "declined");
  assert(!stillDeclined.choiceGroups.some((group) => group.label.includes("Voucher")));
  const reopened = await updateBookingDraft(declined, { mode: "update", voucherPreference: "choose" }, userId, deps);
  assert.equal(readyBookingArguments(reopened), null);
  const bestDeps: BookingDraftDependencies = { ...deps, vouchers: async () => [
    { code: "GIAM30", name: "Giảm 30", discountAmount: 30000, finalAmount: 170000, endAt: "2027-01-01T00:00:00Z" },
    { code: "GIAM50SAU", name: "Giảm 50", discountAmount: 50000, finalAmount: 150000, endAt: "2027-02-01T00:00:00Z" },
    { code: "GIAM50SOM", name: "Giảm 50", discountAmount: 50000, finalAmount: 150000, endAt: "2027-01-01T00:00:00Z" },
  ] };
  const best = await updateBookingDraft(declined, { mode: "update", voucherPreference: "best" }, userId, bestDeps);
  assert.equal(readyBookingArguments(best)?.voucherCode, "GIAM50SOM");
  const manual = await updateBookingDraft(best, { mode: "update", voucherCode: "GIAM30" }, userId, bestDeps);
  assert.equal(manual.voucherPreference, undefined);
  assert.equal(readyBookingArguments(manual)?.voucherCode, "GIAM30");
  const noVouchers = await updateBookingDraft(best, { mode: "resume" }, userId, { ...deps, vouchers: async () => [] });
  assert.equal(readyBookingArguments(noVouchers)?.voucherCode, undefined);
  assert(noVouchers.summary.some((line) => line.includes("không có voucher")));
  const changed = await updateBookingDraft(chosen, { mode: "update", quantity: 3 }, userId, deps);
  assert.equal(readyBookingArguments(changed), null);
  assert.equal(changed.values.voucherCode, "GIAM30");
  voucherActive = false;
  assert.equal(readyBookingArguments(await updateBookingDraft(chosen, { mode: "resume" }, userId, deps)), null);

  online = false;
  const offline = await updateBookingDraft(declined, { mode: "update", providerPreference: "Nguyễn Hùng" }, userId, deps);
  assert.equal(readyBookingArguments(offline), null);
  assert.equal(offline.values.preferredProviderId, undefined);
  assert(offline.summary.some((line) => line.includes("ngoại tuyến")));
  assert(offline.providerCandidates?.some((item) => item.id === alternateId));
  online = true;
  const named = await updateBookingDraft(offline, { mode: "resume" }, userId, deps);
  assert.equal(readyBookingArguments(named)?.preferredProviderId, providerId);
  online = false;
  const unavailable = await updateBookingDraft(named, { mode: "resume" }, userId, deps);
  assert.equal(readyBookingArguments(unavailable), null);
  assert.equal(unavailable.values.preferredProviderId, providerId);
  const automatic = await updateBookingDraft(unavailable, { mode: "update", preferredProviderId: null }, userId, deps);
  assert.equal(readyBookingArguments(automatic)?.preferredProviderId, undefined);
  online = true; duplicateName = true;
  assert.equal(readyBookingArguments(await updateBookingDraft(declined,
    { mode: "update", providerPreference: "Nguyễn Hùng" }, userId, deps)), null);
  const newAddressDraft = await updateBookingDraft(chosen,
    { mode: "update", addressPreference: "34 Lê Lợi, Phường B, Hà Nội" }, userId, deps);
  assert.equal(newAddressDraft.values.addressId, undefined);
  assert.equal(newAddressDraft.values.voucherCode, "GIAM30");
  assert.equal(newAddressDraft.availableVouchers?.length, 0, "Không giữ danh sách voucher cũ khi thiếu thông tin giá/địa chỉ.");
  const reusedAddress = await updateBookingDraft(declined, { mode: "update", addressPreference: "12 nguyen trai" }, userId, deps);
  assert.equal(reusedAddress.values.addressId, addressId);
  const ambiguousAddress = await updateBookingDraft(declined, { mode: "update", addressPreference: "12 Nguyễn Trãi" }, userId,
    { ...deps, addresses: async () => [{ id: addressId, fullAddress: "12 Nguyễn Trãi", ward: "Phường A", province: "Hà Nội", isDefault: true },
      { id: alternateId, fullAddress: "12 Nguyễn Trãi", ward: "Phường B", province: "Đà Nẵng", isDefault: false }] });
  assert.equal(ambiguousAddress.values.addressId, undefined);
  assert.equal(readyBookingArguments(ambiguousAddress), null);
  const nearId = new Types.ObjectId().toString();
  const rankedCandidates = [
    { id: providerId, name: "Nguyễn Hùng", averageRating: 4, distanceMeters: 300, totalCompletedOrders: 50 },
    { id: alternateId, name: "Trần Minh", averageRating: 5, distanceMeters: 800, totalCompletedOrders: 200 },
    { id: nearId, name: "Lê An", averageRating: 4.5, distanceMeters: 50, totalCompletedOrders: 10 },
  ];
  const rankedDeps: BookingDraftDependencies = { ...deps, providers: async (_user, args) => ({
    available: rankedCandidates, requested: rankedCandidates.filter((item) => item.id === args.preferredProviderId)
      .map((item) => ({ ...item, eligible: true, reason: "Đang phù hợp" })),
  }) };
  const nearest = await updateBookingDraft(declined, { mode: "update", providerCriteria: "nearest" }, userId, rankedDeps);
  assert.equal(readyBookingArguments(nearest)?.preferredProviderId, nearId);
  assert.equal(readyBookingArguments(await updateBookingDraft(declined,
    { mode: "update", providerCriteria: "highest_rating" }, userId, rankedDeps))?.preferredProviderId, alternateId);
  assert.equal(readyBookingArguments(await updateBookingDraft(declined,
    { mode: "update", providerCriteria: "most_completed" }, userId, rankedDeps))?.preferredProviderId, alternateId);
  const browse = await updateBookingDraft(nearest, { mode: "update", providerCriteria: "choose" }, userId, rankedDeps);
  assert.equal(browse.values.preferredProviderId, undefined);
  assert.equal(readyBookingArguments(browse), null);
  assert(browse.choiceGroups.some((group) => group.options.some((option) => option.includes("5 sao") && option.includes("200 đơn hoàn thành"))));
  const rankedUnavailable = await updateBookingDraft(nearest, { mode: "resume" }, userId,
    { ...rankedDeps, providers: async () => ({ available: rankedCandidates.slice(0, 2),
      requested: [{ id: nearId, name: "Lê An", eligible: false, reason: "Đang bận" }] }) });
  assert.equal(rankedUnavailable.values.preferredProviderId, nearId);
  assert.equal(readyBookingArguments(rankedUnavailable), null);
  assert.equal(readyBookingArguments(await updateBookingDraft(declined, { mode: "update", providerCriteria: "nearest" }, userId,
    { ...rankedDeps, providers: async () => ({ available: [{ id: providerId, name: "Nguyễn Hùng" }], requested: [] }) })), null);
  const providerFailure = await updateBookingDraft(nearest, { mode: "update", quantity: 2 }, userId,
    { ...rankedDeps, providers: async () => { throw new Error("Lỗi tra cứu giả lập"); } });
  assert.equal(providerFailure.values.uniformQuantity, 2);
  assert.equal(providerFailure.values.preferredProviderId, nearId);
  assert.equal(providerFailure.providerCandidates?.length, 0);
  assert.equal(readyBookingArguments(providerFailure), null);
  const voucherFailure = await updateBookingDraft(chosen, { mode: "update", quantity: 2 }, userId,
    { ...deps, vouchers: async () => { throw new Error("Lỗi tra cứu giả lập"); } });
  assert.equal(voucherFailure.values.uniformQuantity, 2);
  assert.equal(voucherFailure.values.voucherCode, "GIAM30");
  assert.equal(voucherFailure.availableVouchers?.length, 0);
  assert.equal(readyBookingArguments(voucherFailure), null);
  assert.equal(readyBookingArguments(await updateBookingDraft(voucherFailure, { mode: "resume" }, userId, bestDeps))?.voucherCode, "GIAM30");
  assert(readyBookingArguments(await updateBookingDraft(declined, { mode: "resume" }, userId,
    { ...deps, vouchers: async () => { throw new Error("Không được tra lại khi khách đã từ chối voucher"); } })));
  assert.equal(searchCustomerKnowledge("mã").articles[0].title, "Chọn voucher và thay đổi mã giảm giá");
  assert(searchCustomerKnowledge("thợ gần nhất đánh giá", "booking").articles.some((article) => article.title.includes("tiêu chí")));
  assert(searchCustomerKnowledge("địa chỉ người nhận không lưu", "account").articles.some((article) => article.title.includes("người nhận")));

  // Agent phải dừng hỏi chọn voucher, không lập form tạo đơn khi thiếu quyết định.
  voucherActive = true;
  let previews = 0;
  const registry = new ToolRegistry().register(createUpdateBookingDraftTool(deps)).register({
    name: "create_booking", description: "Tạo đơn kiểm thử", inputSchema: bookingSchema,
    mutates: true, requiresConfirmation: true, roles: ["CUSTOMER"],
    preview: async (_context, args) => { previews++; return { title: "Tạo đơn", amount: args.voucherCode ? 170000 : 200000 }; },
    execute: async () => { throw new Error("Không được tạo đơn trước xác nhận"); },
  });
  const session = newSession("phien-kiem-thu", userId);
  const context = { user: { id: userId, role: "CUSTOMER" as const }, sessionId: session.id, signal: AbortSignal.timeout(20000) };
  let toolArguments: Record<string, unknown> = { serviceQuery: "Vệ sinh điều hòa" };
  const loop = new AgentLoop({ generate: async () => ({ type: "TOOL_CALL" as const,
    tool: "update_booking_draft", arguments: toolArguments }) }, registry,
    { maxIterations: 2, systemPrompt: "Kiểm thử", timeoutMs: 5000 });
  await loop.run(session, context, async () => {});
  assert.equal(previews, 0);
  assert.equal(session.state, "WAITING_USER_INPUT");
  const firstReply = session.conversation[session.conversation.length - 1].content;
  assert(firstReply.includes("Vệ sinh điều hòa"));
  toolArguments = { quantity: 2 };
  await loop.run(session, context, async () => {});
  const nextReply = session.conversation[session.conversation.length - 1].content;
  assert(!nextReply.includes("Địa chỉ:"));
  assert(!nextReply.includes("Thời gian:"));
  assert.equal(session.bookingDraft?.values.addressId, addressId);
  toolArguments = { voucherCode: "GIAM30" };
  await loop.run(session, context, async () => {});
  assert.equal(session.state, "WAITING_CONFIRMATION");
  assert.equal((session.pendingAction?.preview as { amount: number }).amount, 170000);
  assert.equal(registry.list({ ...context, user: { id: userId, role: "PROVIDER" } }).length, 0);

  // Hai bước đọc địa chỉ trong cùng lượt dùng chung kết quả; lượt mới phải đọc lại.
  let addressReads = 0;
  const cachedDeps = { ...deps, addresses: async (owner: string) => { addressReads++; return deps.addresses(owner); } };
  const cacheRegistry = new ToolRegistry().register(createUpdateBookingDraftTool(cachedDeps));
  const cacheSession = newSession("phien-cache-dia-chi", userId);
  const cacheContext = { ...context, session: cacheSession, bookingAddressLookup: {} };
  const cacheTool = cacheRegistry.get("update_booking_draft", cacheContext);
  await cacheTool.execute(cacheContext, { mode: "update", serviceId });
  await cacheTool.execute(cacheContext, { mode: "update", quantity: 2 });
  assert.equal(addressReads, 1);
  await cacheTool.execute({ ...cacheContext, bookingAddressLookup: {} }, { mode: "resume" });
  assert.equal(addressReads, 2);

  // Sau xác nhận lưu địa chỉ, backend phải tự nối tới form đặt đơn, không cần lượt LLM tiếp.
  voucherActive = false;
  const addressSession = newSession("phien-dia-chi", userId);
  addressSession.bookingDraft = await updateBookingDraft(declined,
    { mode: "update", addressPreference: "34 Lê Lợi, Phường B, Hà Nội" }, userId, deps);
  registry.register({ name: "save_booking_address", description: "Lưu địa chỉ kiểm thử",
    inputSchema: agentAddressSchema, mutates: true, requiresConfirmation: true, roles: ["CUSTOMER"],
    preview: async (_toolContext, args) => ({ title: "Thêm địa chỉ", address: `${args.fullAddress}, ${args.ward}, ${args.province}` }),
    execute: async (toolContext) => {
      savedAddressId = new Types.ObjectId().toString();
      toolContext.session!.bookingDraft!.values.addressId = savedAddressId;
      toolContext.session!.bookingDraft!.addressPreference = undefined;
      return { addressId: savedAddressId };
    },
  });
  const addressContext = { ...context, sessionId: addressSession.id };
  addressSession.pendingAction = await loop.confirmation.prepare(registry.get("save_booking_address", addressContext),
    addressContext, agentAddressSchema.parse({ fullAddress: "34 Lê Lợi", province: "Hà Nội", ward: "Phường B" }));
  addressSession.state = "WAITING_CONFIRMATION";
  const directLoop = new AgentLoop({ generate: async () => { throw new Error("Không cần gọi LLM sau khi lưu địa chỉ"); } },
    registry, { maxIterations: 2, systemPrompt: "Kiểm thử", timeoutMs: 5000 });
  const agent = new AgentService({ acquire: async () => ({ session: addressSession, lockId: "khoa-kiem-thu" }),
    save: async () => {}, release: async () => {} }, directLoop);
  await agent.send(context.user, addressSession.id, { requestId: "xac-nhan-dia-chi",
    confirmation: { actionId: addressSession.pendingAction.id, decision: "CONFIRM" } });
  assert.equal(addressSession.actions[0].tool, "save_booking_address");
  assert.equal(addressSession.actions[0].status, "SUCCEEDED");
  assert.equal(addressSession.pendingAction?.tool, "create_booking");
  assert.equal((addressSession.pendingAction?.arguments as { addressId: string }).addressId, savedAddressId);
  assert.equal(addressSession.bookingDraft.values.addressId, savedAddressId);
  const firstAddressSession = newSession("phien-dia-chi-moi", userId);
  let step = 0;
  const firstAddressLoop = new AgentLoop({ generate: async () => ++step === 1
    ? { type: "TOOL_CALL" as const, tool: "update_booking_draft", arguments: { serviceQuery: "Vệ sinh điều hòa", quantity: 2,
      addressPreference: "78 Hai Bà Trưng, Phường C, Hà Nội", providerPreference: "Nguyễn Hùng" } }
    : { type: "TOOL_CALL" as const, tool: "save_booking_address", arguments: { fullAddress: "78 Hai Bà Trưng", ward: "Phường C", province: "Hà Nội" } } },
    registry, { maxIterations: 2, systemPrompt: "Kiểm thử", timeoutMs: 5000 });
  await firstAddressLoop.run(firstAddressSession, { ...context, sessionId: firstAddressSession.id }, async () => {});
  assert.equal(firstAddressSession.pendingAction?.tool, "save_booking_address");
  assert.equal(firstAddressSession.bookingDraft?.values.addressId, undefined);
  assert.equal(firstAddressSession.bookingDraft?.values.uniformQuantity, 2);
  assert.equal(firstAddressSession.bookingDraft?.providerPreference, "Nguyễn Hùng");

  // Địa chỉ: quyền sở hữu, bổ sung dữ liệu từ hồ sơ, chống trùng và xác nhận cũ.
  const current = { _id: new Types.ObjectId(addressId), userId, fullAddress: "12 Nguyễn Trãi", ward: "Phường A",
    province: "Hà Nội", recipientName: "Nguyễn An", recipientPhone: "0912345678", note: null,
    isDefault: true, latitude: 21, longitude: 105, updatedAt: new Date("2026-01-01T00:00:00Z") };
  mock.method(addressService, "getUserAddresses", async () => [current]);
  mock.method(User, "findById", () => ({ select: () => ({ lean: async () => ({ fullName: "Nguyễn An", phone: "0912345678" }) }) }));
  mock.method(geocoding, "geocodeSavedAddress", async () => ({ latitude: 21.1, longitude: 105.1 }));
  let saves = 0;
  mock.method(addressService, "createAddress", async (owner: string, payload: Record<string, unknown>) => {
    saves++; assert.equal(owner, userId); assert.equal(payload.latitude, 21.1);
    return { ...current, ...payload, _id: new Types.ObjectId() };
  });
  mock.method(Address, "findOne", async () => current);
  const add = agentAddressSchema.parse({ fullAddress: "34 Lê Lợi", ward: "Phường B", province: "Hà Nội" });
  const preview = await AgentAddressService.preview(userId, add);
  assert.equal(preview.recipientPhone, "0912345678");
  assert.equal(saves, 0);
  await AgentAddressService.save(userId, add, JSON.parse(JSON.stringify(preview)));
  assert.equal(saves, 1);
  await assert.rejects(() => AgentAddressService.save(userId, add, { ...preview, recipientPhone: "0900000000" }));
  const same = agentAddressSchema.parse({ fullAddress: "12 Nguyễn Trãi", ward: "Phường A", province: "Hà Nội" });
  const reusedPreview = await AgentAddressService.preview(userId, same);
  const reused = await AgentAddressService.save(userId, same, JSON.parse(JSON.stringify(reusedPreview)));
  assert.equal(reused.addressId, addressId);
  assert.equal(reused.reused, true);
  assert.equal(saves, 1);
  await assert.rejects(() => AgentAddressService.preview(userId, agentAddressSchema.parse({ addressId: new Types.ObjectId().toString(), note: "Sửa" })));
  await assert.rejects(() => AgentAddressService.preview(userId, agentAddressSchema.parse({ fullAddress: "34 Lê Lợi" })));
  assert.equal(agentAddressSchema.safeParse({ ...add, latitude: 0, userId: "khach-khac" }).success, false);
  let updates = 0;
  mock.method(addressService, "updateAddress", async (id: string, owner: string, payload: Record<string, unknown>, version: string) => {
    updates++; assert.equal(id, addressId); assert.equal(owner, userId); assert.equal(version, current.updatedAt.toISOString());
    return { ...current, ...payload };
  });
  const edit = agentAddressSchema.parse({ addressId, fullAddress: "56 Trần Phú" });
  const editPreview = await AgentAddressService.preview(userId, edit);
  await AgentAddressService.save(userId, edit, JSON.parse(JSON.stringify(editPreview)));
  assert.equal(updates, 1);
  current.updatedAt = new Date("2026-01-02T00:00:00Z");
  await assert.rejects(() => AgentAddressService.save(userId, edit, JSON.parse(JSON.stringify(editPreview))));
  assert.equal(updates, 1);
  mock.restoreAll();
  console.log("Đã kiểm tra voucher, chọn thợ, xác nhận bản nháp và thêm/sửa địa chỉ của agent.");
}
run().catch((error: unknown) => { mock.restoreAll(); console.error(error); process.exitCode = 1; });
