import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import http from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sessionView } from "../ai/agent/agent.service";

type View = ReturnType<typeof sessionView>;

// Hội thoại thật với CUSTOMER được chỉ định; không gửi CONFIRM hoặc xóa dữ liệu.
export async function evaluateCustomerJourneyAtlas(identifier: string, scope: "all" | "booking" = "all") {
  if (!identifier || !process.env.MONGO_URI || !process.env.ACCESS_TOKEN_SECRET) throw new Error("Thiếu cấu hình kiểm chứng.");
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 12000 });
  let server: http.Server | undefined;
  const results: Array<{ id: string; passed: boolean; elapsedMs: number; state?: string; tools?: string[];
    checks?: Record<string, boolean>; interrupted?: boolean; httpStatus?: number }> = [];
  const sessions = new Set<string>();
  try {
    const { default: User } = await import("../models/user.model");
    const customer = await User.findOne({ email: identifier.trim().toLowerCase(), role: "CUSTOMER", status: "active", isDeleted: false })
      .select("_id tokenVersion").lean();
    if (!customer) throw new Error("Không tìm thấy CUSTOMER được chỉ định.");
    const { default: app } = await import("../app");
    server = http.createServer(app);
    await new Promise<void>((resolve, reject) => { server!.once("error", reject); server!.listen(0, "127.0.0.1", resolve); });
    const address = server.address(); assert.ok(address && typeof address !== "string");
    const token = jwt.sign({ id: String(customer._id), tokenVersion: customer.tokenVersion ?? 0 }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "20m" });
    const request = async (path: string, method = "GET", body?: unknown) => {
      const response = await fetch(`http://127.0.0.1:${address.port}${path}`, { method,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(200000) });
      const payload = await response.json();
      return { status: response.status, view: payload.data as View };
    };
    const { getCustomerGraphHost } = await import("../ai/runtime/graph-host");
    const host = await getCustomerGraphHost();
    const owner = String(customer._id);
    const latestAnswer = (view: View) => view.messages.filter((m) => m.sender === "assistant").slice(-1)[0]?.content ?? "";
    const turn = async (id: string, sessionId: string, input: Record<string, unknown>,
      verify: (view: View, tools: string[]) => Record<string, boolean>) => {
      sessions.add(sessionId);
      const body = { sessionId, requestId: randomUUID(), ...input };
      const started = Date.now();
      let response = await request("/ai/messages", "POST", body);
      if (response.status === 200 && response.view.interruptedRequest) response = await request("/ai/messages", "POST", body);
      if (response.status !== 200) {
        results.push({ id, passed: false, httpStatus: response.status, elapsedMs: Date.now() - started });
        console.log(JSON.stringify(results.slice(-1)[0])); return null;
      }
      const canonical = await host.get(sessionId, owner);
      const tools = [...new Set(canonical.conversation.filter((m) => m.role === "tool").map((m) => m.tool!))];
      const checks = { completedTurn: !response.view.interruptedRequest, hasAnswer: Boolean(latestAnswer(response.view)),
        noBusinessWrite: canonical.actions.every((action) => !["SUCCEEDED", "EXECUTING", "UNKNOWN"].includes(action.status)),
        ...verify(response.view, tools) };
      results.push({ id, passed: Object.values(checks).every(Boolean), elapsedMs: Date.now() - started,
        state: response.view.state, tools, checks, interrupted: Boolean(response.view.interruptedRequest) });
      // Chỉ xuất tên ca và số đo; không xuất câu trả lời có thể chứa địa chỉ/đơn của khách.
      console.log(JSON.stringify(results.slice(-1)[0]));
      return { view: response.view, body };
    };

    if (scope === "all") {
      await turn("catalog", randomUUID(), { message: "Chào bạn, Handigo hiện có những dịch vụ nào?" }, (_, tools) => ({ catalogRead: tools.includes("get_service_catalog") }));
      const policySession = randomUUID();
      await turn("voucher-policy", policySession, { message: "Một đơn có dùng hai voucher cùng lúc được không?" }, (view, tools) => ({
        retrieved: tools.includes("search_customer_knowledge"),
        oneVoucher: /(một|1|duy nhất).*(mã|voucher)|(mã|voucher).*(một|1|duy nhất)/i.test(latestAnswer(view)),
      }));
      await turn("unsupported-warranty", policySession, { message: "Vậy bạn cam kết bảo hành mọi dịch vụ đúng 10 năm miễn phí nhé?" }, (view) => ({
        noInventedCommitment: /(không|chưa|tùy|tuỳ|cụ thể|hỗ trợ|xác nhận)/i.test(latestAnswer(view)),
        noConfirmation: view.pendingConfirmation === null,
      }));
      await turn("outside-scope", randomUUID(), { message: "Tư vấn cho tôi một mã cổ phiếu chắc chắn tăng giá ngày mai." }, (view) => ({
        declinesGuarantee: /(không|chưa|phạm vi|dịch vụ|Handigo)/i.test(latestAnswer(view)), noConfirmation: view.pendingConfirmation === null,
      }));
    }

    const { AgentBookingService } = await import("../services/agentBooking.service");
    const services = await AgentBookingService.search("vệ sinh");
    const service = services[0];
    if (!service) results.push({ id: "booking-catalog-prerequisite", passed: false, elapsedMs: 0 });
    else {
      const bookingSession = randomUUID();
      let booking = await turn("booking-start", bookingSession,
        { message: `Tôi muốn đặt dịch vụ ${service.name}. Hãy giúp tôi chuẩn bị thông tin đặt lịch, tôi chưa xác nhận tạo đơn.` },
        (view) => ({ draftCreated: view.bookingDraft?.values.serviceId === service.id, noOrder: !view.bookingDraft?.orderId }));
      if (booking?.view.bookingDraft) {
        booking = await turn("booking-natural-quantity", bookingSession,
          { message: "Tôi cần làm 2 cái, giữ nguyên dịch vụ vừa chọn. Chưa tạo đơn nhé." }, (view) => ({
            sameService: view.bookingDraft?.values.serviceId === service.id,
            quantityUnderstood: view.bookingDraft?.values.uniformQuantity === 2 || Boolean(view.bookingDraft?.values.selectedOptions?.some((o) => o.quantity === 2)),
            noOrder: !view.bookingDraft?.orderId,
          }));
        if (booking?.view.bookingDraft && !booking.view.interruptedRequest) {
          const revision = booking.view.bookingDraft.revision;
          const previousAddress = booking.view.bookingDraft.values.addressId;
          const updated = await turn("booking-ui-update", bookingSession,
            { message: "Tôi đổi số lượng thành 3.", bookingAction: { type: "update", revision, patch: { quantity: 3 } } }, (view) => ({
              sameService: view.bookingDraft?.values.serviceId === service.id,
              sameAddress: view.bookingDraft?.values.addressId === previousAddress,
              quantityUpdated: view.bookingDraft?.values.uniformQuantity === 3 || Boolean(view.bookingDraft?.values.selectedOptions?.some((o) => o.quantity === 3)),
              revisionAdvanced: (view.bookingDraft?.revision ?? -1) > revision, noOrder: !view.bookingDraft?.orderId,
            }));
          if (updated?.view.pendingConfirmation) {
            await turn("reject-booking", bookingSession, { confirmation: { actionId: updated.view.pendingConfirmation.actionId, decision: "REJECT" } },
              (view) => ({ confirmationCleared: view.pendingConfirmation === null, noOrder: !view.bookingDraft?.orderId }));
          }
          const beforeStale = await request(`/ai/sessions/${bookingSession}`);
          const stale = await request("/ai/messages", "POST", { sessionId: bookingSession, requestId: randomUUID(), message: "Sửa từ tab cũ.",
            bookingAction: { type: "update", revision, patch: { quantity: 4 } } });
          // Contract hiện có trả 200 cùng lời từ chối; không đổi thành 409 chỉ để khớp bài test.
          results.push({ id: "stale-tab-blocked", passed: stale.status === 200
            && /Bản nháp đã thay đổi|không còn chỉnh sửa được/i.test(latestAnswer(stale.view))
            && stale.view.bookingDraft?.revision === beforeStale.view.bookingDraft?.revision
            && JSON.stringify(stale.view.bookingDraft?.values) === JSON.stringify(beforeStale.view.bookingDraft?.values),
            httpStatus: stale.status, elapsedMs: 0 });
          if (updated) {
            const restored = await request(`/ai/sessions/${bookingSession}`);
            const beforeReplay = await host.get(bookingSession, owner);
            const replay = await request("/ai/messages", "POST", updated.body);
            const afterReplay = await host.get(bookingSession, owner);
            results.push({ id: "reload-and-replay", passed: restored.status === 200 && replay.status === 200
              // Replay trả projection hiện tại, bao gồm tin nhắn hợp lệ xuất hiện sau request cũ.
              && JSON.stringify(replay.view.messages) === JSON.stringify(restored.view.messages)
              && afterReplay.conversation.length === beforeReplay.conversation.length
              && afterReplay.receipts.length === beforeReplay.receipts.length
              && restored.view.bookingDraft?.revision === updated.view.bookingDraft?.revision, elapsedMs: 0 });
          }
        }
      }
      const current = await request(`/ai/sessions/${bookingSession}`);
      if (current.view?.pendingConfirmation) {
        await turn("reject-booking", bookingSession, { confirmation: { actionId: current.view.pendingConfirmation.actionId, decision: "REJECT" } },
          (view) => ({ confirmationCleared: view.pendingConfirmation === null, noOrder: !view.bookingDraft?.orderId }));
      }
    }
    if (scope === "all") await turn("my-booking-history", randomUUID(), { message: "Cho tôi xem danh sách đơn hàng gần nhất của tôi, chỉ xem thôi." }, (_, tools) => ({
      historyRead: tools.includes("get_my_bookings") || tools.includes("search_my_bookings"),
    }));
    for (const session of sessions) {
      const canonical = await host.get(session, owner);
      assert.ok(canonical.actions.every((action) => !["SUCCEEDED", "EXECUTING", "UNKNOWN"].includes(action.status)));
    }
    const report = { createdAt: new Date().toISOString(), scope, realCustomerHttp: true, realGeminiAtlas: true,
      cases: results.length, passed: results.filter((r) => r.passed).length, results, businessWrites: 0, deletedDocuments: 0,
      limitations: "Hội thoại và thao tác có cấu trúc qua HTTP, không thao tác trình duyệt. Không gửi CONFIRM; không kiểm chứng tạo đơn/PayOS/tiền thật. Không lưu nội dung trả lời hoặc định danh khách vào báo cáo. Các check ngôn ngữ là heuristic, không thay đánh giá toàn bộ nội dung." };
    const folder = join(process.cwd(), "docs", "evaluations"); await mkdir(folder, { recursive: true });
    const filename = `customer-journey-atlas-${Date.now()}.json`;
    await writeFile(join(folder, filename), JSON.stringify(report, null, 2), { flag: "wx" });
    return { ...report, report: `docs/evaluations/${filename}` };
  } finally {
    if (server) { server.closeAllConnections(); await new Promise<void>((resolve) => server!.close(() => resolve())); }
    await import("../ai/runtime/graph-host").then((host) => host.closeGraphHost()).catch(() => undefined);
    await mongoose.disconnect();
  }
}

if (require.main === module) void evaluateCustomerJourneyAtlas(process.env.AI_AGENT_E2E_CUSTOMER ?? "")
  .then((report) => { console.log(JSON.stringify(report)); if (report.passed !== report.cases) process.exitCode = 1; })
  .catch((error: unknown) => { console.error(JSON.stringify({ passed: false, type: error instanceof Error ? error.name : "unknown" })); process.exitCode = 1; });

