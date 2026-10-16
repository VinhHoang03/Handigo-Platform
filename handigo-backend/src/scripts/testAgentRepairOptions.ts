import assert from "node:assert/strict";
import { Types } from "mongoose";
import { readyBookingArguments, updateBookingDraft, isAirConditionerRepair, type DraftService, type BookingDraftDependencies } from "../ai/agent/booking-draft";
import { AgentLoop } from "../ai/agent/agent-loop.service";
import { ToolRegistry } from "../ai/tools/tool-registry";
import { createUpdateBookingDraftTool } from "../ai/tools/implementations/update-booking-draft.tool";
import { bookingSchema } from "../ai/tools/implementations/booking.schemas";
import { newSession } from "../ai/agent/agent-state";
import { z } from "zod";

// Dữ liệu danh mục giả lập; không gọi LLM hoặc database.
async function run() {
  const userId = new Types.ObjectId().toString(), serviceId = new Types.ObjectId().toString();
  const addressId = new Types.ObjectId().toString(), groupId = new Types.ObjectId().toString();
  const wallId = new Types.ObjectId().toString(), ceilingId = new Types.ObjectId().toString(), extraId = new Types.ObjectId().toString();
  const service: DraftService = { id: serviceId, name: "Sửa chữa điều hòa", serviceType: "variable_price", requiresOptionSelection: true,
    optionGroups: [{ _id: groupId, name: "Loại điều hòa", selectionMode: "single", isRequired: true }],
    options: [
      { _id: wallId, groupId, name: "Điều hòa treo tường", optionType: "other", price: 0, allowsQuantity: true, selectionMode: "single", selectionGroup: "Loại điều hòa" },
      { _id: ceilingId, groupId, name: "Điều hòa âm trần", optionType: "other", price: 0, allowsQuantity: true, selectionMode: "single", selectionGroup: "Loại điều hòa" },
      { _id: extraId, name: "Gói bổ sung", optionType: "add_on", price: 50000, allowsQuantity: false, selectionMode: "multiple" },
    ] };
  const deps: BookingDraftDependencies = { search: async () => [{ id: serviceId, name: service.name }], service: async () => service,
    addresses: async () => [{ id: addressId, fullAddress: "12 Lê Lợi", ward: "Phường A", province: "Đà Nẵng", isDefault: true }] };
  const initial = await updateBookingDraft(undefined, { mode: "update", serviceId }, userId, deps);
  const changed = await updateBookingDraft(initial, { mode: "update", optionPreference: "Điều hòa âm trần" }, userId, deps);
  assert.deepEqual(initial.values.selectedOptions, [{ optionId: wallId, quantity: 1 }]);
  assert.equal(initial.sources.selectedOptions, "default");
  assert.equal(initial.choiceGroups.length, 0, "Không hiện gói/loại hoặc add-on khi chưa yêu cầu đổi.");
  assert(readyBookingArguments(initial));
  assert.deepEqual(changed.values.selectedOptions, [{ optionId: ceilingId, quantity: 1 }]);
  assert.equal(changed.optionPreference, undefined);
  assert.equal(changed.choiceGroups.length, 0, "Đã chọn đúng loại thì không hỏi chọn lại.");
  const noAccents = await updateBookingDraft(initial, { mode: "update", optionPreference: "Toi chon dieu hoa am tran" }, userId, deps);
  assert.equal(noAccents.values.selectedOptions?.[0].optionId, ceilingId);
  const ambiguous = await updateBookingDraft(initial, { mode: "update", optionPreference: "Điều hòa âm trần" }, userId,
    { ...deps, service: async () => ({ ...service, options: [...service.options, { ...service.options[1], _id: new Types.ObjectId().toString() }] }) });
  assert.equal(readyBookingArguments(ambiguous), null, "Trùng tên không tự chọn sai ID.");
  const resumed = await updateBookingDraft(changed, { mode: "resume", quantity: 2, paymentMethod: "wallet" }, userId, deps);
  assert.deepEqual(resumed.values.selectedOptions, [{ optionId: ceilingId, quantity: 2 }]);
  assert(readyBookingArguments(resumed));
  const choosing = await updateBookingDraft(resumed, { mode: "update", optionPreference: "Tôi muốn đổi loại điều hòa" }, userId, deps);
  assert.equal(readyBookingArguments(choosing), null);
  assert.equal(choosing.choiceGroups.length, 1);
  assert(!choosing.choiceGroups.some((group) => group.options.some((option) => option.includes("Gói bổ sung"))));
  const chosen = await updateBookingDraft(choosing, { mode: "update", optionPreference: "Loại điều hòa · Bắt buộc: Điều hòa treo tường" }, userId, deps);
  assert.deepEqual(chosen.values.selectedOptions, [{ optionId: wallId, quantity: 2 }]);
  assert(readyBookingArguments(chosen));
  const withExtra = await updateBookingDraft(chosen, { mode: "update", optionPreference: "Gói bổ sung" }, userId, deps);
  assert.deepEqual(withExtra.values.selectedOptions, [{ optionId: wallId, quantity: 2 }, { optionId: extraId, quantity: 1 }]);
  const knownId = await updateBookingDraft(withExtra, { mode: "update", selectedOptions: [{ optionId: ceilingId, quantity: 3 }] }, userId, deps);
  assert(readyBookingArguments(knownId)); assert.equal(knownId.choiceGroups.length, 0);
  const legacy = { ...service, optionGroups: [], options: service.options.map((option) => ({ ...option, groupId: undefined })) };
  const catalogService = { ...legacy, name: "Sửa Chữa Điều Hòa", slug: "dieu-hoa", requiresOptionSelection: false };
  const catalogDraft = await updateBookingDraft(undefined, { mode: "update", serviceId }, userId,
    { ...deps, service: async () => catalogService });
  assert.deepEqual(catalogDraft.values.selectedOptions, [{ optionId: wallId, quantity: 1 }], "Danh mục thực tế dùng slug dieu-hoa vẫn phải mặc định treo tường.");
  const generalRequest = "đặt dịch vụ sửa chữa điều hòa";
  const generatedPreference = await updateBookingDraft(undefined, { mode: "update", serviceId,
    optionPreference: "Chọn loại điều hòa", selectedOptions: [{ optionId: ceilingId }] }, userId,
    { ...deps, service: async () => catalogService }, generalRequest);
  assert.deepEqual(generatedPreference.values.selectedOptions, [{ optionId: wallId, quantity: 1 }]);
  assert.equal(generatedPreference.choiceGroups.length, 0, "Yêu cầu đặt chung không bị chặn bởi tùy chọn do model tự thêm.");
  const repeatGeneral = await updateBookingDraft(changed, { mode: "update", optionPreference: "Chọn loại điều hòa" }, userId,
    { ...deps, service: async () => catalogService }, generalRequest);
  assert.equal(repeatGeneral.values.selectedOptions?.[0].optionId, ceilingId, "Đặt tiếp không xóa loại khách đã chọn.");
  assert.equal(repeatGeneral.choiceGroups.length, 0);
  assert.deepEqual((await updateBookingDraft(undefined, { mode: "update", serviceId }, userId,
    { ...deps, service: async () => legacy })).values.selectedOptions, [{ optionId: wallId, quantity: 1 }]);
  for (const other of [{ ...service, name: "Sửa chữa tủ lạnh" }, { ...service, serviceType: "fixed_price" },
    { ...service, options: service.options.filter((option) => option._id !== wallId) }]) {
    const draft = await updateBookingDraft(undefined, { mode: "update", serviceId }, userId, { ...deps, service: async () => other });
    assert.equal(draft.values.selectedOptions, undefined, "Không gán mặc định cho dịch vụ khác hoặc khi không có loại treo tường.");
    assert.equal(readyBookingArguments(draft), null);
  }
  const registry = new ToolRegistry().register(createUpdateBookingDraftTool(deps)).register({
    name: "create_booking", description: "Đặt đơn kiểm thử", inputSchema: bookingSchema, roles: ["CUSTOMER"],
    mutates: true, requiresConfirmation: true,
    preview: async (_context, args) => ({ title: "Đặt sửa điều hòa", options: args.selectedOptions }),
    execute: async () => { throw Error("Không được tạo đơn khi chưa xác nhận."); },
  });
  const session = newSession("phien-sua-dieu-hoa", userId);
  const pendingTool = () => session.pendingAction?.tool;
  let argumentsToSend: Record<string, unknown> = { serviceId };
  let modelCalls = 0;
  const loop = new AgentLoop({ generate: async () => {
    modelCalls++;
    return { type: "TOOL_CALL", tool: "update_booking_draft", arguments: argumentsToSend };
  } }, registry, { maxIterations: 2, systemPrompt: "Kiểm thử", timeoutMs: 5000 });
  const context = { session, user: { id: userId, role: "CUSTOMER" as const }, sessionId: session.id, signal: AbortSignal.timeout(5000) };
  await loop.run(session, context, async () => {});
  assert.equal(session.pendingAction?.tool, "create_booking", "Lượt đầu đi thẳng tới form, không bắt chọn loại.");
  session.pendingAction!.status = "EXPIRED";
  session.actions.push(session.pendingAction!); session.pendingAction = null;
  argumentsToSend = { optionPreference: "Đổi loại điều hòa" };
  await loop.run(session, context, async () => {});
  assert.equal(session.pendingAction, null);
  assert.equal(session.conversation[session.conversation.length - 1].choiceGroups?.length, 1);
  argumentsToSend = { optionPreference: "Loại điều hòa: Điều hòa âm trần" };
  await loop.run(session, context, async () => {});
  assert.equal(pendingTool(), "create_booking", "Chọn loại xong lập form mới ngay trong cùng lượt.");
  assert.equal(session.bookingDraft?.values.selectedOptions?.[0].optionId, ceilingId);
  assert.equal(session.conversation[session.conversation.length - 1].choiceGroups, undefined);
  assert.equal(modelCalls, 3, "Không cần lượt LLM tiếp để hỏi chọn lại loại đã xác định.");
  const readRegistry = new ToolRegistry().register(createUpdateBookingDraftTool({ ...deps, service: async () => catalogService }))
    .register(registry.get("create_booking", context))
    .register({ name: "get_service", description: "Đọc danh mục kiểm thử", inputSchema: z.object({ serviceId: z.string() }),
      roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false, execute: async () => catalogService });
  const readSession = newSession("phien-doc-dich-vu-truoc", userId);
  readSession.conversation.push({ id: "yeu-cau", role: "user", content: generalRequest, createdAt: new Date().toISOString() });
  let readModelCalls = 0;
  const readLoop = new AgentLoop({ generate: async () => ++readModelCalls === 1
    ? { type: "TOOL_CALL", tool: "get_service", arguments: { serviceId } }
    : { type: "MESSAGE", message: "Bạn muốn loại điều hòa nào?", choiceGroups: [{ label: "Loại điều hòa", multiple: false, options: ["Điều hòa treo tường", "Điều hòa âm trần"] }] }
  }, readRegistry, { maxIterations: 3, systemPrompt: "Kiểm thử", timeoutMs: 5000 });
  await readLoop.run(readSession, { ...context, session: readSession, sessionId: readSession.id }, async () => {});
  assert.equal(readSession.pendingAction?.tool, "create_booking", "Đọc get_service trước vẫn tự nối form đặt đơn.");
  assert.equal(readSession.bookingDraft?.values.selectedOptions?.[0].optionId, wallId);
  assert.equal(readModelCalls, 1, "Không trả lượt chọn loại về cho model khi backend đã có mặc định.");
  const infoSession = newSession("phien-hoi-thong-tin", userId);
  infoSession.conversation.push({ id: "cau-hoi", role: "user", content: "Sửa điều hòa có những loại nào?", createdAt: new Date().toISOString() });
  readModelCalls = 0;
  await readLoop.run(infoSession, { ...context, session: infoSession, sessionId: infoSession.id }, async () => {});
  assert.equal(infoSession.bookingDraft, undefined, "Câu hỏi tham khảo không tự bắt đầu đặt đơn.");
  if (process.argv.includes("--local-catalog")) {
    // Chỉ đọc API danh mục công khai; địa chỉ và bản nháp đều giả lập, không lưu phiên hoặc đặt đơn thật.
    const response = await fetch("http://localhost:5000/services?isActive=true&limit=100");
    assert(response.ok);
    const catalog = await response.json() as { data: { items: Array<Omit<DraftService, "id" | "options"> & { _id: string }> } };
    const repairService = catalog.data.items.find(isAirConditionerRepair);
    assert(repairService, "Phải có dịch vụ sửa điều hòa trong danh mục đang chạy.");
    const optionResponse = await fetch(`http://localhost:5000/services/${repairService._id}/options`);
    assert(optionResponse.ok);
    const optionData = await optionResponse.json() as { data: DraftService["options"] };
    const actualService = { ...repairService, id: repairService._id, options: optionData.data };
    const actual = await updateBookingDraft(undefined, { mode: "update", serviceId: actualService.id, optionPreference: "Chọn loại điều hòa" }, userId,
      { ...deps, service: async () => actualService }, generalRequest);
    assert.equal(actual.choiceGroups.length, 0);
    assert(readyBookingArguments(actual));
    assert.equal(actualService.options.find((option) => String(option._id) === actual.values.selectedOptions?.[0].optionId)?.name, "Điều hòa treo tường");
    console.log("Đạt kiểm tra với API danh mục thực tế: chọn treo tường, không hỏi loại, chưa tạo đơn.");
  }
  console.log("Đạt sửa điều hòa: mặc định treo tường, chỉ mở loại khi yêu cầu, chọn tên/ID không lặp, giữ số lượng và không tự thêm gói bổ sung.");
}
run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
