import assert from "node:assert/strict";
import { z } from "zod";
import { newSession } from "../ai/agent/agent-state";
import { AgentLoop } from "../ai/agent/agent-loop.service";
import { llmResponseSchema, type LLMResponse } from "../ai/llm/llm.interface";
import { ToolRegistry } from "../ai/tools/tool-registry";
import type { ToolContext } from "../ai/tools/tool.interface";

// Cô lập dữ liệu dịch vụ: không đọc .env, kết nối DB hoặc gọi nhà cung cấp AI.
const serviceId = "111111111111111111111111";
let addresses = [{ id: "địa-chỉ-nhà", isDefault: true }, { id: "văn-phòng", isDefault: false }];
const moduleId = require.resolve("../services/agentBooking.service");
require.cache[moduleId] = { id: moduleId, filename: moduleId, loaded: true, exports: {
  AgentBookingService: {
    service: async (id: string) => {
      assert.equal(id, serviceId);
      return { id, name: "Vệ sinh máy lạnh", options: [{ name: "Máy treo tường", allowsQuantity: true }] };
    },
    addresses: async (owner: string) => { assert.equal(owner, "khách-hàng"); return addresses; },
  },
} } as NodeModule;

async function main() {
  const { getServiceTool } = await import("../ai/tools/implementations/get-service.tool");
  const context: ToolContext = { user: { id: "khách-hàng", role: "CUSTOMER" }, sessionId: "phiên-thử",
    signal: new AbortController().signal };
  const getContext = async () => await getServiceTool.execute(context, { serviceId }) as {
    defaults: { addressId: string | null; paymentMethod: string; orderType: string };
  };
  assert.deepEqual((await getContext()).defaults, { addressId: "địa-chỉ-nhà", paymentMethod: "bank", orderType: "normal" });
  addresses = [{ id: "duy-nhất", isDefault: false }];
  assert.equal((await getContext()).defaults.addressId, "duy-nhất");
  addresses = [{ id: "nhà", isDefault: false }, { id: "văn-phòng", isDefault: false }];
  assert.equal((await getContext()).defaults.addressId, null);
  addresses = [];
  assert.equal((await getContext()).defaults.addressId, null);

  const choiceGroups = [
    { label: "Loại máy", multiple: false, options: ["Máy treo tường", "Máy âm trần"] },
    { label: "Số lượng", multiple: false, options: ["1 máy", "2 máy"] },
  ];
  assert.ok(llmResponseSchema.safeParse({ type: "MESSAGE", message: "Chọn thông tin còn thiếu", choiceGroups }).success);
  assert.ok(llmResponseSchema.safeParse({ type: "MESSAGE", message: "Tin nhắn cũ" }).success);
  assert.equal(llmResponseSchema.safeParse({ type: "MESSAGE", message: "Chọn", choiceGroups: [{ label: "Loại", options: [] }] }).success, false);

  const registry = new ToolRegistry().register(getServiceTool);
  let writes = 0;
  registry.register({ name: "create_booking", description: "Tạo đơn thử nghiệm", roles: ["CUSTOMER"],
    inputSchema: z.object({ serviceId: z.string(), quantity: z.number(), addressId: z.string() }),
    mutates: true, requiresConfirmation: true,
    preview: async (_ctx, args) => ({ ...args, amount: 200000 }),
    execute: async () => { writes += 1; return {}; },
  });
  const session = newSession(context.sessionId, context.user.id);
  let responses: LLMResponse[] = [
    { type: "TOOL_CALL", tool: "get_service", arguments: { serviceId } },
    { type: "MESSAGE", message: "Bạn chọn loại máy và số lượng cùng lúc nhé.", choiceGroups },
  ];
  const loop = new AgentLoop({ generate: async () => {
    const next = responses.shift(); assert.ok(next); return next;
  } }, registry, { maxIterations: 8, timeoutMs: 1000, systemPrompt: "Kiểm thử" });
  await loop.run(session, context, async () => {});
  assert.equal(session.state, "WAITING_USER_INPUT");
  assert.deepEqual(session.conversation[session.conversation.length - 1]?.choiceGroups, choiceGroups);
  assert.ok(session.collectedInformation.get_service);
  // Một lượt bổ sung đủ nhiều trường đi thẳng tới bản xem trước, chưa ghi đơn.
  responses = [{ type: "TOOL_CALL", tool: "create_booking", arguments: { serviceId, quantity: 2, addressId: "nhà" } }];
  await loop.run(session, context, async () => {});
  assert.equal(session.state, "WAITING_CONFIRMATION");
  assert.equal(writes, 0);
  assert.deepEqual(session.pendingAction?.arguments, { serviceId, quantity: 2, addressId: "nhà" });
  assert.equal(session.conversation[session.conversation.length - 1]?.choiceGroups, undefined);
  console.log("Đã kiểm tra mặc định đặt lịch, nhóm lựa chọn, xử lý nhiều thông tin và chặn tạo đơn trước xác nhận.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
