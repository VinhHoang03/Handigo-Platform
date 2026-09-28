import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AgentLoop } from "../ai/agent/agent-loop.service";
import { AgentService } from "../ai/agent/agent.service";
import { newSession, type AgentSession } from "../ai/agent/agent-state";
import { AGENT_PROMPT } from "../ai/agent/agent-prompt";
import type { LLMProvider, LLMResponse } from "../ai/llm/llm.interface";
import { bookingFixture, bookingFixtureIds as ids } from "./fixtures/agentBooking.fixture";

type Turn = { message: string; calls: LLMResponse[]; check(session: AgentSession): void };
type Scenario = { name: string; configure?: (fixture: ReturnType<typeof bookingFixture>) => void; turns: Turn[] };
const draftCall = (args: Record<string, unknown>): LLMResponse => ({ type: "TOOL_CALL", tool: "update_booking_draft", arguments: args });

async function main() {
  const live = process.argv.includes("--live");
  let liveProvider: LLMProvider | undefined;
  if (live) {
    try {
      // Chỉ dùng cấu hình đã được tiến trình cấp; tuyệt đối không tự nạp file .env.
      const { loadAgentConfig } = await import("../ai/ai.config");
      liveProvider = loadAgentConfig().createProvider();
    } catch {
      console.error("Chưa chạy đánh giá AI thật: tiến trình chưa được cấp cấu hình AI hợp lệ. Không đọc .env hoặc in credential.");
      process.exitCode = 2;
      return;
    }
  }
  const day = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const time = `${day}T09:00:00+07:00`;
  const scenarios: Scenario[] = [
    { name: "Các loại máy đồng giá không buộc khách chọn loại", configure: (fixture) => {
      fixture.services[1].options.push({ ...fixture.services[1].options[0], _id: "999999999999999999999999", name: "Máy âm trần" });
    }, turns: [
      { message: "Đặt vệ sinh 2 máy lạnh, địa chỉ mặc định, làm ngay", calls: [draftCall({ serviceQuery: "Vệ sinh máy lạnh", quantity: 2 })],
        check: (session) => { assert.equal(session.state, "WAITING_CONFIRMATION"); assert.equal(session.bookingDraft?.values.uniformQuantity, 2);
          assert.equal(session.bookingDraft?.values.selectedOptions?.length ?? 0, 0); } },
      { message: "Đổi thành 3 máy", calls: [draftCall({ quantity: 3 })],
        check: (session) => { assert.equal(session.state, "WAITING_CONFIRMATION"); assert.equal(session.bookingDraft?.values.uniformQuantity, 3); } },
    ] },
    { name: "Yêu cầu chung, dùng mặc định và hỏi đúng gói còn thiếu", turns: [
      { message: "Đặt cho tôi đơn vệ sinh nhà", calls: [draftCall({ serviceQuery: "Vệ sinh nhà" })], check: (session) => {
        assert.equal(session.state, "WAITING_USER_INPUT"); assert.equal(session.bookingDraft?.values.addressId, ids.home);
        assert.ok(session.bookingDraft?.missing.some((field) => field.includes("gói")));
      } },
      { message: "Nhà dưới 50 m²", calls: [draftCall({ selectedOptions: [{ optionId: ids.small }] })], check: (session) => {
        assert.equal(session.state, "WAITING_CONFIRMATION"); assert.equal(session.bookingDraft?.values.selectedOptions?.[0].optionId, ids.small);
      } },
    ] },
    { name: "Một câu đủ gói, địa chỉ, giờ và thanh toán", turns: [
      { message: `Đặt vệ sinh nhà dưới 50 m² lúc 9 giờ ngày ${day}, ở địa chỉ mặc định, chuyển khoản.`,
        calls: [draftCall({ serviceId: ids.service, selectedOptions: [{ optionId: ids.small }], scheduledAt: time, paymentMethod: "bank" })],
        check: (session) => { assert.equal(session.state, "WAITING_CONFIRMATION"); assert.equal(Date.parse(session.bookingDraft?.values.scheduledAt ?? ""), Date.parse(time)); } },
      { message: "Đổi sang địa chỉ 20 Đường Mẫu, giữ các thông tin khác", calls: [draftCall({ addressId: ids.office })],
        check: (session) => { assert.equal(session.state, "WAITING_CONFIRMATION"); assert.equal(session.bookingDraft?.values.addressId, ids.office);
          assert.equal(Date.parse(session.bookingDraft?.values.scheduledAt ?? ""), Date.parse(time)); } },
    ] },
    { name: "Thiếu giờ không tự chuyển thành đặt ngay", turns: [
      { message: `Đặt vệ sinh nhà dưới 50 m² vào buổi sáng ngày ${day}, chưa chọn giờ.`,
        calls: [draftCall({ serviceId: ids.service, selectedOptions: [{ optionId: ids.small }], scheduleDate: day, schedulePreference: "buổi sáng", timeWindow: "morning" })],
        check: (session) => { assert.equal(session.state, "WAITING_USER_INPUT"); assert.equal(session.bookingDraft?.values.orderType, "scheduled");
          assert.equal(session.bookingDraft?.values.scheduledAt, undefined); } },
    ] },
    { name: "Chuyển chủ đề rồi tiếp tục bản nháp", turns: [
      { message: "Đặt vệ sinh nhà", calls: [draftCall({ serviceQuery: "Vệ sinh nhà" })], check: (session) => assert.equal(session.state, "WAITING_USER_INPUT") },
      { message: "Khoan đặt, cho tôi biết Handigo có những dịch vụ gì", calls: [
        { type: "TOOL_CALL", tool: "get_service_catalog", arguments: {} }, { type: "FINAL", message: "Có vệ sinh nhà và vệ sinh máy lạnh." },
      ], check: (session) => { assert.equal(session.pendingAction, null); assert.ok(session.bookingDraft); } },
      { message: "Tiếp tục đơn vệ sinh nhà đang soạn, chọn nhà dưới 50 m²", calls: [draftCall({ mode: "resume", selectedOptions: [{ optionId: ids.small }] })],
        check: (session) => { assert.equal(session.state, "WAITING_CONFIRMATION"); assert.equal(session.bookingDraft?.values.serviceId, ids.service); } },
    ] },
    { name: "Số lượng trong lời khách phải được giữ", turns: [
      { message: "Đặt vệ sinh 2 máy lạnh treo tường, làm ngay, địa chỉ mặc định", calls: [draftCall({ serviceId: ids.other, selectedOptions: [{ optionId: ids.single, quantity: 2 }] })],
        check: (session) => { assert.equal(session.state, "WAITING_CONFIRMATION"); assert.equal(session.bookingDraft?.values.selectedOptions?.[0].quantity, 2); } },
    ] },
  ];
  const reports = [];
  for (const scenario of scenarios) {
    const fixture = bookingFixture();
    scenario.configure?.(fixture);
    let session = newSession(randomUUID(), "khách-đánh-giá");
    let calls = 0;
    let queue: LLMResponse[] = [];
    const provider: LLMProvider = { generate: async (request) => {
      calls += 1;
      if (calls > 24) throw new Error("Đã đạt giới hạn lượt gọi của kịch bản.");
      if (liveProvider) return liveProvider.generate(request);
      const response = queue.shift(); assert.ok(response); return response;
    } };
    const agent = new AgentService({ acquire: async () => ({ session, lockId: "khóa-đánh-giá" }),
      save: async (saved) => { session = saved; }, release: async () => {} },
    new AgentLoop(provider, fixture.registry, { maxIterations: 8, timeoutMs: 20000, systemPrompt: AGENT_PROMPT }));
    const start = Date.now();
    let passedTurns = 0;
    let questions = 0;
    let failed = false;
    for (const turn of scenario.turns) {
      queue = [...turn.calls];
      try {
        await agent.send({ id: session.userId, role: "CUSTOMER" }, session.id, { requestId: randomUUID(), message: turn.message });
        turn.check(session);
        if (session.state === "WAITING_USER_INPUT") questions += 1;
        assert.equal(fixture.writes(), 0);
        passedTurns += 1;
        session = JSON.parse(JSON.stringify(session));
      } catch { failed = true; break; }
    }
    reports.push({ kichBan: scenario.name, dat: !failed, luotDat: passedTurns, tongLuot: scenario.turns.length,
      soLanGoiModel: calls, soLuotHoiThem: questions,
      thoiGianMs: Date.now() - start, soLanGhiDon: fixture.writes(), trangThai: session.state });
  }
  console.log(JSON.stringify({ cheDo: live ? "AI thật, dữ liệu nghiệp vụ giả lập" : "Mô phỏng xác định, không đánh giá chất lượng model",
    tyLeDat: reports.filter((item) => item.dat).length / reports.length, ketQua: reports }, null, 2));
  if (reports.some((item) => !item.dat)) process.exitCode = 1;
}
main().catch(() => { console.error("Đánh giá chưa hoàn tất; không ghi dữ liệu đơn hàng thật."); process.exitCode = 1; });
