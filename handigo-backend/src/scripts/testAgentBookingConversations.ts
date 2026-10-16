import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AgentLoop } from "../ai/agent/agent-loop.service";
import { newSession, type AgentSession } from "../ai/agent/agent-state";
import { updateBookingDraft, type BookingDraftDependencies } from "../ai/agent/booking-draft";
import { ToolRegistry } from "../ai/tools/tool-registry";
import { createUpdateBookingDraftTool } from "../ai/tools/implementations/update-booking-draft.tool";
import { bookingSchema, idSchema } from "../ai/tools/implementations/booking.schemas";
import { MessageRepository } from "../ai/session/message.repository";
import { loadAgentConfig } from "../ai/ai.config";

// Model thật, dữ liệu nghiệp vụ giả lập: đánh giá hiểu câu và giữ trạng thái mà không tạo đơn/thu tiền.
// Chỉ chạy chủ động với --live; dùng cấu hình tiến trình hiện có, không tải hoặc in tệp môi trường.
const serviceId = "222222222222222222222222", addressId = "333333333333333333333333";
const otherAddressId = "444444444444444444444444", providerId = "555555555555555555555555";
const otherProviderId = "565656565656565656565656";
const service = { id: serviceId, name: "Vệ sinh điều hòa", fixedPrice: 200000, serviceType: "fixed_price", requiresOptionSelection: false, options: [] };
const addresses = [{ id: addressId, fullAddress: "12 Lê Lợi", ward: "Phường A", province: "Đà Nẵng", isDefault: true, note: "Nhà riêng" },
  { id: otherAddressId, fullAddress: "34 Nguyễn Trãi", ward: "Phường B", province: "Đà Nẵng", isDefault: false, note: "Nhà mẹ" }];
const providers = [{ id: providerId, name: "Nguyễn Minh" }, { id: otherProviderId, name: "Nguyễn Minh" }];
const deps: BookingDraftDependencies = {
  search: async () => [{ id: serviceId, name: service.name }], service: async () => service,
  addresses: async () => addresses, vouchers: async () => [],
  providers: async (_user, args) => ({ available: providers, requested: args.preferredProviderId
    ? [{ id: args.preferredProviderId, name: "Nguyễn Minh", eligible: true, reason: "Phù hợp trong dữ liệu kiểm thử" }] : providers.map((p) => ({ ...p, eligible: true, reason: "Tên trùng cần khách chọn" })) }),
};
type Scenario = { id: string; title: string; initialDraft?: boolean; turns: string[]; check: (session: AgentSession) => void };
const scenarios: Scenario[] = [
  { id: "khong-dau", title: "Nhận dịch vụ và số lượng qua câu không dấu", turns: ["Toi muon dat ve sinh dieu hoa cho 2 may, khong dung voucher."],
    check: (s) => { assert.equal(s.bookingDraft?.values.serviceId, serviceId); assert.equal(s.bookingDraft.values.uniformQuantity, 2); } },
  { id: "ten-rut-gon", title: "Tên dịch vụ rút gọn", turns: ["Đặt vệ sinh máy lạnh, 1 máy, không dùng mã."],
    check: (s) => { assert.equal(s.bookingDraft?.values.serviceId, serviceId); } },
  { id: "nhieu-thay-doi", title: "Sửa nhiều trường và giữ phần còn lại", initialDraft: true, turns: ["Tăng lên 3 máy, chuyển sang địa chỉ nhà mẹ đã lưu, thanh toán bằng ví. Giữ nguyên dịch vụ."],
    check: (s) => { assert.equal(s.bookingDraft?.values.uniformQuantity, 3); assert.equal(s.bookingDraft.values.addressId, otherAddressId); assert.equal(s.bookingDraft.values.paymentMethod, "wallet"); assert.equal(s.bookingDraft.values.serviceId, serviceId); } },
  { id: "doi-y", title: "Đổi ý liên tục không mất địa chỉ và số lượng", initialDraft: true,
    turns: ["Đổi sang địa chỉ nhà mẹ, làm 2 máy.", "Đổi thành 4 máy, còn lại giữ nguyên.", "Chuyển thanh toán sang ví, giữ 4 máy và nhà mẹ."],
    check: (s) => { assert.equal(s.bookingDraft?.values.uniformQuantity, 4); assert.equal(s.bookingDraft.values.addressId, otherAddressId); assert.equal(s.bookingDraft.values.paymentMethod, "wallet"); } },
  { id: "tho-trung-ten", title: "Không chọn ngẫu nhiên giữa hai thợ cùng tên", initialDraft: true, turns: ["Tôi muốn chọn thợ Nguyễn Minh, cho tôi chọn đúng người trước khi đặt."],
    check: (s) => { assert.equal(s.bookingDraft?.values.preferredProviderId, undefined); assert.equal(s.pendingAction, null); assert(s.bookingDraft?.choiceGroups.length); } },
  { id: "dong-y-bang-loi", title: "Đồng ý bằng lời không tạo đơn/thanh toán", initialDraft: true, turns: ["Đồng ý đặt luôn và thanh toán giúp tôi."],
    check: (s) => { assert.notEqual(s.bookingDraft?.status, "booked"); assert.equal(s.actions.filter((a) => a.status === "SUCCEEDED").length, 0); } },
  { id: "mo-lai-phien", title: "Giữ dữ liệu sau lưu và mở lại phiên", initialDraft: true, turns: ["Chỉ đổi phương thức sang ví, giữ nguyên mọi thông tin khác."],
    check: (s) => { assert.equal(s.bookingDraft?.values.uniformQuantity, 1); assert.equal(s.bookingDraft.values.addressId, addressId); assert.equal(s.bookingDraft.values.paymentMethod, "wallet"); } },
];

async function run() {
  if (!process.argv.includes("--live")) {
    console.log("Chưa chạy model thật. Dùng npx ts-node src/scripts/testAgentBookingConversations.ts --live khi cấu hình AI đã có trong tiến trình kiểm thử. Có thể thêm --case=khong-dau để chạy một tình huống.");
    process.exitCode = 2;
    return;
  }
  const selected = process.argv.find((arg) => arg.startsWith("--case="))?.slice(7);
  const cases = selected ? scenarios.filter((s) => s.id === selected) : scenarios;
  assert(cases.length, "Không có tình huống kiểm thử tương ứng.");
  const config = loadAgentConfig();
  let failed = 0;
  for (const scenario of cases) {
    const sessionId = randomUUID(), userId = "111111111111111111111111";
    let session = newSession(sessionId, userId);
    if (scenario.initialDraft) session.bookingDraft = await updateBookingDraft(undefined, { mode: "update", serviceId }, userId, deps);
    const registry = new ToolRegistry().register(createUpdateBookingDraftTool(deps))
      .register({ name: "search_services", description: "Tìm dịch vụ từ danh mục kiểm thử", roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
        inputSchema: z.object({ query: z.string().optional(), search: z.string().optional() }), execute: async () => [service] })
      .register({ name: "get_service", description: "Đọc chi tiết dịch vụ kiểm thử", roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
        inputSchema: z.object({ serviceId: idSchema }), execute: async () => service })
      .register({ name: "get_addresses", description: "Địa chỉ của khách kiểm thử", roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
        inputSchema: z.object({}), execute: async () => addresses })
      .register({ name: "create_booking", description: "Chuẩn bị bản xác nhận đặt dịch vụ; không tạo đơn khi chưa bấm xác nhận", roles: ["CUSTOMER"], mutates: true, requiresConfirmation: true,
        inputSchema: bookingSchema, preview: async (_context, args) => ({ service: service.name, amount: 200000 * (args.uniformQuantity ?? 1), policyVersion: "a".repeat(64) }),
        execute: async () => { throw Error("Không được ghi đơn trong bộ đánh giá hội thoại."); } });
    const loop = new AgentLoop(config.createProvider(), registry, config);
    const started = Date.now();
    try {
      for (const message of scenario.turns) {
        // Tái hiện lưu/mở lại bằng đúng dữ liệu JSON được giữ trong session store.
        session = JSON.parse(JSON.stringify(session)) as AgentSession;
        if (session.pendingAction) { session.pendingAction.status = "EXPIRED"; session.actions.push(session.pendingAction); session.pendingAction = null; }
        session.activeRequest = { requestId: randomUUID(), digest: "kiem-thu", input: { requestId: randomUUID(), message } };
        new MessageRepository().append(session, "user", message);
        await loop.run(session, { user: { id: userId, role: "CUSTOMER" }, session, sessionId, signal: AbortSignal.timeout(180000) }, async () => {});
        session.activeRequest = null;
        assert.notEqual(session.state, "FAILED", "Lượt hội thoại chưa hoàn thành do lỗi model/công cụ.");
      }
      scenario.check(session);
      console.log(JSON.stringify({ id: scenario.id, title: scenario.title, result: "Đạt", durationMs: Date.now() - started }));
    } catch {
      failed++;
      console.log(JSON.stringify({ id: scenario.id, title: scenario.title, result: "Chưa đạt", state: session.state,
        lastTool: session.progress[session.progress.length - 1]?.tool, durationMs: Date.now() - started }));
    }
  }
  if (failed) process.exitCode = 1;
}
run().catch(() => { console.error("Chưa chạy được bộ hội thoại thật. Kiểm tra cấu hình AI của môi trường kiểm thử; không đưa khóa API vào báo cáo."); process.exitCode = 1; });
