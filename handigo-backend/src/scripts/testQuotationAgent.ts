import assert from "node:assert/strict";
import { Types } from "mongoose";
import { runQuotationAgent, validateQuotationProposal, parseQuotationPrice } from "../ai/quotation/quotation-agent";
import { quotationAIConfig } from "../ai/quotation/quotation.config";
import { quotationAgentInputSchema, type QuotationAgentInput } from "../validations/quotationAgent.validator";
import { matchQuotationHistory, loadQuotationHistory, type QuotationHistoryItem } from "../services/quotationHistory.service";
import { quotationAgentOrder, transcribeQuotation } from "../services/quotationAgent.service";
import { validQuotationAudio } from "../middlewares/quotationAudioUpload.middleware";
import { Order } from "../models/order.model";
import { Provider } from "../models/provider.model";
import { RepairQuotation } from "../models/repairQuotation.model";
import { RepairQuotationItem } from "../models/repairQuotationItem.model";
import type { LLMProvider, LLMResponse } from "../ai/llm/llm.interface";

const input: QuotationAgentInput = { instruction: "Thay 2 tụ 35uF, mỗi cái 180 nghìn, công thay một trăm nghìn", revision: 3,
  inspectionNote: "Máy yếu lạnh", recommendation: "Kiểm tra tụ", items: [{ rowId: "row-1", title: "", description: "", itemType: "labor", quantity: 1, unitPrice: 0, note: "" }] };
const source: QuotationHistoryItem = { id: "history-1", title: "Tụ 35uF", description: "450V", itemType: "replacement_part", unitPrice: 180000, usedAt: "2026-09-20T00:00:00.000Z" };
const sequence = (responses: LLMResponse[]): LLMProvider => ({ generate: async () => { const reply = responses.shift(); assert.ok(reply); return reply; } });
const signal = () => new AbortController().signal;

async function main() {
  process.env.QUOTATION_AI_API_KEY = "";
  process.env.GEMINI_API_KEY = "khóa-giả-lập-agent-khách";
  process.env.GEMINI_API_KEY_1 = "khóa-giả-lập-cũ";
  assert.throws(quotationAIConfig, /QUOTATION_AI_API_KEY/);
  process.env.QUOTATION_AI_API_KEY = "khóa-giả-lập-báo-giá";
  assert.equal(quotationAIConfig().apiKey, "khóa-giả-lập-báo-giá");
  for (const [phrase, price] of [["180 nghìn", 180000], ["một trăm nghìn", 100000], ["hai triệu ba trăm nghìn", 2300000],
    ["180.000đ", 180000], ["1.800.000", 1800000], ["1,5 triệu", 1500000], ["180k", 180000]] as const) assert.equal(parseQuotationPrice(phrase), price, phrase);
  assert.equal(parseQuotationPrice("giá tùy chọn"), null);
  assert.equal(matchQuotationHistory([source], "tu 35uf").autoFillId, source.id);
  assert.equal(matchQuotationHistory([source, { ...source, id: "old", unitPrice: 170000 }], "tụ 35uf").autoFillId, null);
  assert.equal(matchQuotationHistory([{ ...source, title: "Tụ 350 uF" }], "tụ 35").items.length, 0);
  assert.equal(matchQuotationHistory([source], "máy bơm").items.length, 0);
  assert.equal(quotationAgentInputSchema.safeParse({ ...input, items: [input.items[0], input.items[0]] }).success, false);

  const result = await runQuotationAgent(input, "Sửa điều hòa", sequence([{ type: "TOOL_CALL", tool: "propose_quotation_updates", arguments: {
    message: "Đã chuẩn bị hai hạng mục.", updates: [
      { rowId: "row-1", fields: { title: "Tụ 35uF", quantity: 2, itemType: "replacement_part", unitPrice: 180000 }, priceEvidence: "180 nghìn" },
      { fields: { title: "Công thay", quantity: 1, itemType: "labor", unitPrice: 100000 }, priceEvidence: "một trăm nghìn" },
    ],
  } }]), async () => { throw new Error("Không cần truy vấn lịch sử khi đã đủ giá"); }, signal());
  assert.equal(result.updates.length, 2); assert.equal(result.updates[0].fields.unitPrice, 180000);
  assert.equal(result.inspectionNote, undefined); assert.equal(input.items[0].title, "");
  const edited = validateQuotationProposal({ ...input, instruction: "Đổi thành ba cái", items: [{ ...input.items[0], title: source.title, unitPrice: 180000, quantity: 2 }] },
    { message: "Đã đổi số lượng", updates: [{ rowId: "row-1", fields: { quantity: 3 } }] }, new Map());
  assert.deepEqual(edited.updates[0].fields, { quantity: 3 });
  const invented = validateQuotationProposal(input, { message: "Điền giá", updates: [{ rowId: "row-1", fields: { unitPrice: 999999 }, priceEvidence: "999999" }] }, new Map());
  assert.equal(invented.updates[0].fields.unitPrice, undefined); assert.ok(invented.warnings.length);
  assert.throws(() => validateQuotationProposal(input, { message: "Sai dòng", updates: [{ rowId: "foreign", fields: { quantity: 4 } }] }, new Map()));
  assert.throws(() => validateQuotationProposal(input, { message: "Sai nguồn", updates: [{ rowId: "row-1", historyId: "foreign", fields: {} }] }, new Map()));

  const lookupCalls: string[] = [];
  const historyResult = await runQuotationAgent({ ...input, instruction: "Thay tụ 35uF, lấy giá cũ" }, "Sửa điều hòa", sequence([
    { type: "TOOL_CALL", tool: "search_quotation_history", arguments: { query: "tụ 35uf" } },
    { type: "TOOL_CALL", tool: "propose_quotation_updates", arguments: { message: "Đã lấy giá tham khảo", updates: [{ rowId: "row-1", fields: { title: source.title, quantity: 2 }, historyId: source.id }] } },
  ]), async (query) => { lookupCalls.push(query); return matchQuotationHistory([source], query); }, signal());
  assert.deepEqual(lookupCalls, ["tụ 35uf"]); assert.equal(historyResult.updates[0].fields.unitPrice, source.unitPrice);
  assert.equal(historyResult.sources[0].id, source.id);
  const ambiguous = await runQuotationAgent({ ...input, instruction: "Thay tụ 35uF, lấy giá cũ" }, "Sửa điều hòa", sequence([
    { type: "TOOL_CALL", tool: "search_quotation_history", arguments: { query: "tụ 35uf" } },
    { type: "TOOL_CALL", tool: "propose_quotation_updates", arguments: { message: "Lấy giá", updates: [{ fields: { title: source.title }, historyId: source.id }] } },
  ]), async (query) => matchQuotationHistory([source, { ...source, id: "other", unitPrice: 150000 }], query), signal());
  assert.equal(ambiguous.updates.length, 0); assert.equal(ambiguous.choiceGroups?.[0].options.length, 2);
  await assert.rejects(runQuotationAgent(input, "Sửa điều hòa", sequence([{ type: "TOOL_CALL", tool: "create_booking", arguments: {} }]), async () => matchQuotationHistory([], ""), signal()), /phạm vi/);
  const aborted = new AbortController(); aborted.abort();
  await assert.rejects(runQuotationAgent(input, "Sửa điều hòa", sequence([]), async () => matchQuotationHistory([], ""), aborted.signal));
  await assert.rejects(runQuotationAgent(input, "Sửa điều hòa", { generate: async () => ({ type: "TOOL_CALL", tool: "search_quotation_history", arguments: { query: "tụ" } }) }, async () => matchQuotationHistory([], "tụ"), signal()), /số bước/);

  const orderId = new Types.ObjectId(), providerId = new Types.ObjectId(), serviceId = new Types.ObjectId();
  const originalOrder = Order.findById, originalProvider = Provider.findOne;
  const originalAggregate = RepairQuotation.aggregate, originalItems = RepairQuotationItem.find;
  const originalFetch = globalThis.fetch;
  let currentProviderId = providerId;
  const fakeOrder = { _id: orderId, providerId, serviceId, inspectionRequired: true, status: "accepted", orderType: "normal", isDeleted: false };
  try {
    Order.findById = (() => Promise.resolve(fakeOrder)) as unknown as typeof Order.findById;
    Provider.findOne = ((filter: Record<string, unknown>) => { assert.equal(filter.userId, "provider-user"); return { select: async () => ({ _id: currentProviderId }) }; }) as unknown as typeof Provider.findOne;
    assert.equal((await quotationAgentOrder(String(orderId), "provider-user")).providerId, providerId);
    currentProviderId = new Types.ObjectId();
    await assert.rejects(quotationAgentOrder(String(orderId), "provider-user"), /không phải provider/);
    currentProviderId = providerId;
    fakeOrder.status = "completed";
    await assert.rejects(quotationAgentOrder(String(orderId), "provider-user"), /đang được nhận/);
    fakeOrder.status = "accepted";
    RepairQuotation.aggregate = ((pipeline: Array<Record<string, unknown>>) => {
      assert.deepEqual(pipeline[0].$match, { providerId, status: "approved", isDeleted: { $ne: true } });
      assert.deepEqual(pipeline[4].$match, { "order.serviceId": serviceId, "order.isDeleted": { $ne: true } });
      return { option: async () => [{ _id: orderId, createdAt: new Date(source.usedAt) }] };
    }) as unknown as typeof RepairQuotation.aggregate;
    RepairQuotationItem.find = ((filter: Record<string, unknown>) => {
      assert.deepEqual(filter.quotationId, { $in: [orderId] });
      return { select: () => ({ limit: () => ({ maxTimeMS: () => ({ lean: async () => [{ ...source, _id: providerId, quotationId: orderId, note: "Không được sao chép" }] }) }) }) };
    }) as unknown as typeof RepairQuotationItem.find;
    const history = await loadQuotationHistory(fakeOrder as never);
    assert.equal(history.length, 1); assert.equal("note" in history[0], false);
    globalThis.fetch = async (_url, init) => {
      assert.equal((init?.headers as Record<string, string>)["x-goog-api-key"], "khóa-giả-lập-báo-giá");
      return new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ transcript: input.instruction }) }] } }] }));
    };
    assert.equal((await transcribeQuotation(String(orderId), "provider-user", Buffer.from("âm thanh giả lập"), signal()))?.transcript, input.instruction);
    globalThis.fetch = async () => new Response("Không hiển thị nội dung lỗi riêng tư", { status: 429 });
    await assert.rejects(transcribeQuotation(String(orderId), "provider-user", Buffer.alloc(0), signal()), /hạn mức/);
  } finally {
    Order.findById = originalOrder; Provider.findOne = originalProvider; RepairQuotation.aggregate = originalAggregate;
    RepairQuotationItem.find = originalItems; globalThis.fetch = originalFetch;
  }
  const wav = Buffer.alloc(44 + 32000);
  wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVE", 8); wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(16000, 24);
  wav.writeUInt32LE(32000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(32000, 40);
  assert.equal(validQuotationAudio(wav), true); assert.equal(validQuotationAudio(Buffer.from("âm thanh giả")), false);
  wav.writeUInt32LE(48000, 24); assert.equal(validQuotationAudio(wav), false);
  console.log("Đạt kiểm thử agent báo giá: nhập nhiều dòng, sửa một phần, nguồn giá, lịch sử, phân quyền, giới hạn vòng lặp, key riêng và âm thanh.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
