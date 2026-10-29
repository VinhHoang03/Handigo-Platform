import assert from "node:assert/strict";
import { mock } from "node:test";
import { randomUUID } from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import { MemorySaver } from "@langchain/langgraph";
import { z } from "zod";
import { newSession, type AgentSession } from "../ai/agent/agent-state";
import type { SessionEngine } from "../ai/session/session.service";
import { AppError } from "../utils/appError";
import { FixtureActionLedger } from "./fixtures/action-ledger.fixture";
import { AGENT_HTTP_TIMEOUT_MS } from "../ai/agent/runtime-limits";
import { actionIdentity } from "../ai/runtime/action-ledger";

async function run() {
  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  // Khóa JWT chỉ dành cho tiến trình test này; không đọc cấu hình hoặc credential thật.
  const testSecret = "khoa-jwt-fixture-chi-danh-cho-kiem-thu-loopback";
  process.env.ACCESS_TOKEN_SECRET = testSecret;
  const userId = "1".repeat(24), otherId = "2".repeat(24), providerId = "3".repeat(24);
  process.env.AI_AGENT_CUSTOMER_ROLLOUT = "all";
  delete process.env.AI_AGENT_CUSTOMER_NEW_SESSIONS;
  delete process.env.AI_AGENT_CUSTOMER_PILOT_USERS;
  const { default: User } = await import("../models/user.model");
  const penalties = await import("../services/penaltyPolicy.service");
  const limits = await import("../middlewares/rateLimit.middleware");
  const upload = await import("../middlewares/orderAttachmentUpload.middleware");
  const hosts = await import("../ai/runtime/graph-host");
  const { SessionService } = await import("../ai/session/session.service");
  const { CustomerWorkflowRuntime, buildCustomerSessionGraph } = await import("../ai/runtime/customer-workflow-runtime");
  const { InProcessGraphPilotAccess } = await import("../ai/runtime/agent-runtime");
  const { ToolRegistry } = await import("../ai/tools/tool-registry");
  const rows = new Map<string, { owner: string; engine: SessionEngine; data: AgentSession; lock?: string; deleted?: boolean }>();
  const row = (id: string, owner: string) => {
    const value = rows.get(id);
    if (!value || value.owner !== owner || value.deleted) throw new AppError("Không tìm thấy cuộc trò chuyện.", 404);
    return value;
  };
  mock.method(User, "findOne", async (query: { _id: string }) => ([userId, otherId, providerId].includes(query._id) ? {
    _id: query._id, email: "fixture@example.invalid", role: query._id === providerId ? "PROVIDER" : "CUSTOMER", status: "active", tokenVersion: 0,
  } : null) as never);
  mock.method(penalties, "refreshAccountLock", async () => false);
  mock.method(limits, "chatbotRateLimit", (_req: express.Request, _res: express.Response, next: express.NextFunction) => next());
  mock.method(SessionService.prototype, "resolveEngine", async (id: string, owner: string, create?: SessionEngine | (() => SessionEngine)) => {
    if (!rows.has(id) && create) rows.set(id, { owner, engine: typeof create === "function" ? create() : create, data: newSession(id, owner) });
    return row(id, owner).engine;
  });
  mock.method(SessionService.prototype, "acquireEngine", async (id: string, owner: string, engine: SessionEngine) => {
    const value = row(id, owner);
    if (value.engine !== engine || value.lock) throw new AppError("Phiên đang xử lý.", 409);
    value.lock = randomUUID(); return { session: value.data, lockId: value.lock };
  });
  mock.method(SessionService.prototype, "release", async (id: string, lockId: string) => { if (rows.get(id)?.lock === lockId) delete rows.get(id)!.lock; });
  mock.method(SessionService.prototype, "saveGraphProjection", async (session: AgentSession, lockId: string, engine?: SessionEngine) => {
    const value = row(session.id, session.userId); assert.equal(value.lock, lockId); assert.equal(value.engine, engine);
    value.data = structuredClone(session);
  });
  mock.method(SessionService.prototype, "archiveGraph", async (id: string, owner: string, lockId: string) => {
    const value = row(id, owner); assert.equal(value.lock, lockId); value.deleted = true;
  });
  mock.method(SessionService.prototype, "listDirectory", async (owner: string, page: number, limit: number) => {
    const values = [...rows.values()].filter((value) => value.owner === owner && !value.deleted);
    return { items: values.map((value) => ({ sessionId: value.data.id, engine: value.engine, title: "Cache fixture",
      state: value.data.state, needsAttention: false, updatedAt: new Date() })), pagination: { page, limit, total: values.length, totalPages: 1 } };
  });
  mock.method(SessionService.prototype, "latest", async (owner: string) => [...rows.values()].reverse().find((value) => value.owner === owner && !value.deleted)?.data ?? null);
  const saver = new MemorySaver(), baseAccess = new InProcessGraphPilotAccess(), threads = new Map<string, string>();
  const access = { exclusive: <T>(user: { id: string; role: "CUSTOMER" | "PROVIDER" | "ADMIN" }, id: string, runExclusive: (thread: string) => Promise<T>) =>
    baseAccess.exclusive(user, id, (thread) => { threads.set(id, thread); return runExclusive(thread); }) };
  let writes = 0, uploads = 0;
  let retryMode: "none" | "timeout" | "done" = "none";
  const image = "https://example.invalid/anh-http.jpg";
  const registry = new ToolRegistry().register({ name: "create_support_ticket", description: "Gửi hỗ trợ fixture sau xác nhận.",
    inputSchema: z.object({ subject: z.string(), customerAttachments: z.array(z.string()).optional() }).strict(),
    roles: ["CUSTOMER"], mutates: true, requiresConfirmation: true, preview: async (_context, args) => args,
    execute: async (_context, args) => { writes++; assert.deepEqual(args.customerAttachments, [image]); return { id: "fixture-http", statusLabel: "Mới tiếp nhận" }; },
    reply: () => ({ state: "COMPLETED", message: "Đã gửi hỗ trợ fixture." }),
  });
  const ledger = new FixtureActionLedger();
  const runtime = new CustomerWorkflowRuntime({ access, ledger, checkpointer: saver, registry,
    assertWriteAccess: async () => {}, mergeMessages: async (session) => session,
    config: { maxIterations: 3, timeoutMs: 2000, systemPrompt: "Kiểm thử HTTP." },
    provider: { generate: async () => {
      if (retryMode === "timeout") throw new DOMException("Timeout HTTP fixture.", "TimeoutError");
      if (retryMode === "done") return { type: "FINAL", message: "Đã tiếp tục lượt HTTP." };
      return { type: "TOOL_CALL", tool: "create_support_ticket", arguments: { subject: "Hỗ trợ fixture" } };
    } },
  });
  mock.method(hosts, "getCustomerGraphHost", async () => ({
    exclusive: <T>(user: Parameters<typeof access.exclusive>[0], id: string, callback: () => Promise<T>) => access.exclusive(user, id, () => callback()),
    async get(id: string, owner: string) {
      row(id, owner); const thread = threads.get(id);
      const data = thread ? (await buildCustomerSessionGraph(saver).getState({ configurable: { thread_id: thread } })).values.data : undefined;
      return data ? structuredClone(data.session) : newSession(id, owner);
    },
    send: runtime.send.bind(runtime), requireAttachmentSupport: runtime.requireAttachmentSupport.bind(runtime), registerAttachment: runtime.registerAttachment.bind(runtime),
    hasActionRecord: runtime.hasActionRecord.bind(runtime),
  }));
  mock.method(upload, "uploadOrderAttachmentImage", (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    uploads++; res.locals.imageUrl = image; next();
  });
  const { default: router } = await import("../ai/ai.routes");
  let messageSocketTimeout: number | undefined;
  const app = express(); app.use(express.json());
  app.use((req, res, next) => {
    const sendJson = res.json.bind(res);
    res.json = (body) => {
      if (req.originalUrl.split("?")[0] === "/ai/messages") messageSocketTimeout = req.socket.timeout;
      return sendJson(body);
    };
    next();
  });
  app.use("/ai", router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  try {
    const address = server.address(); assert.ok(address && typeof address !== "string");
    const token = (id: string, secret = testSecret) => jwt.sign({ id, role: "CUSTOMER", tokenVersion: 0 }, secret, { expiresIn: "5m" });
    const request = (path: string, method = "GET", body?: unknown, bearer: string | null = token(userId)) => fetch(`http://127.0.0.1:${address.port}/ai${path}`, {
      method, headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(5000),
    });
    const id = randomUUID();
    assert.equal((await request("/sessions/latest", "GET", undefined, null)).status, 401);
    assert.equal((await request("/sessions/latest", "GET", undefined, token(userId, "chu-ky-sai"))).status, 401);
    assert.equal((await request("/sessions/latest", "GET", undefined, token(providerId))).status, 403, "Role phải lấy từ user database, không tin role của JWT fixture.");
    assert.equal((await request(`/sessions/${id}/attachments`, "POST")).status, 200);
    assert.equal(uploads, 1);
    const message = { sessionId: id, requestId: randomUUID(), message: "Gửi hỗ trợ kèm ảnh.", customerAttachments: [image] };
    const prepared = await request("/messages", "POST", message); assert.equal(prepared.status, 200);
    const preview = await prepared.json(); assert.equal(preview.success, true); assert.equal(preview.data.state, "WAITING_CONFIRMATION");
    assert.equal(messageSocketTimeout, AGENT_HTTP_TIMEOUT_MS, "Socket không được cắt trước deadline runtime của agent.");
    assert.deepEqual(Object.keys(preview).sort(), ["data", "message", "success"]);
    assert.equal(writes, 0); assert.equal(rows.get(id)?.engine, "langgraph-customer");
    assert.equal((await request(`/sessions/${id}/attachments`, "POST")).status, 409); assert.equal(uploads, 1);
    assert.equal((await request(`/sessions/${id}`, "GET", undefined, token(otherId))).status, 404);
    assert.equal((await request("/sessions/reset", "POST", { sessionId: id })).status, 200);
    assert.equal((await request("/messages", "POST", { ...message, engine: "legacy" })).status, 400);
    const confirmation = { sessionId: id, requestId: randomUUID(), confirmation: { actionId: preview.data.pendingConfirmation.actionId, decision: "CONFIRM" } };
    const confirmed = await request("/messages", "POST", confirmation); assert.equal(confirmed.status, 200);
    const result = await confirmed.json(); assert.equal(result.data.state, "COMPLETED"); assert.equal(result.data.pendingConfirmation, null); assert.equal(writes, 1);
    assert.ok(!("engine" in result.data)); assert.ok("orderActions" in result.data);
    assert.equal((await request("/messages", "POST", confirmation)).status, 200); assert.equal(writes, 1);
    const otherSessionId = randomUUID();
    const otherPrepared = await request("/messages", "POST", { sessionId: otherSessionId, requestId: randomUUID(), message: "Cần hỗ trợ tài khoản khác." }, token(otherId));
    assert.equal(otherPrepared.status, 200);
    assert.equal(rows.get(otherSessionId)?.engine, "langgraph-customer", "Chế độ all không cần thêm ID khách thứ hai vào cấu hình.");
    assert.equal((await request(`/sessions/${id}`)).status, 200);
    assert.equal((await request("/sessions/latest")).status, 200);
    assert.equal((await request(`/sessions/${id}/progress`)).status, 200);
    assert.equal((await request("/sessions")).status, 200);
    assert.equal((await request("/sessions/reset", "POST", { sessionId: id })).status, 200);
    assert.equal((await request(`/sessions/${id}`, "DELETE")).status, 200);
    assert.equal((await request(`/sessions/${id}`)).status, 404);
    const retryId = randomUUID();
    const retryInput = { sessionId: retryId, requestId: randomUUID(), message: "Tra cứu thông tin đang cần hỗ trợ." };
    retryMode = "timeout";
    const waiting = await request("/messages", "POST", retryInput);
    assert.equal(waiting.status, 200);
    const paused = (await waiting.json()).data;
    assert.equal(paused.state, "FAILED");
    assert.deepEqual(paused.interruptedRequest, { requestId: retryInput.requestId, message: retryInput.message });
    assert.equal((await request(`/sessions/${retryId}`, "DELETE", undefined, token(otherId))).status, 404);
    assert.equal((await request("/sessions/reset", "POST", { sessionId: retryId })).status, 200);
    assert.equal((await request(`/sessions/${retryId}/attachments`, "POST")).status, 200);
    assert.equal((await request("/messages", "POST", { ...retryInput, message: "Nội dung khác dùng trùng mã." })).status, 409);
    const waitingGet = await request(`/sessions/${retryId}`);
    assert.deepEqual((await waitingGet.json()).data.interruptedRequest, paused.interruptedRequest);
    retryMode = "done";
    const resumed = await request("/messages", "POST", retryInput);
    assert.equal(resumed.status, 200);
    const resumedView = (await resumed.json()).data;
    assert.equal(resumedView.interruptedRequest, null);
    assert.equal(resumedView.state, "COMPLETED");
    assert.equal(writes, 1); assert.equal(uploads, 2);
    retryMode = "none";
    const discardId = randomUUID();
    const discardView = (await (await request("/messages", "POST", { sessionId: discardId, requestId: randomUUID(), message: "Soạn yêu cầu rồi bỏ." })).json()).data;
    assert.ok(discardView.pendingConfirmation);
    assert.equal((await request(`/sessions/${discardId}`, "DELETE")).status, 200);
    assert.equal((await request("/messages", "POST", { sessionId: discardId, requestId: randomUUID(), confirmation: {
      actionId: discardView.pendingConfirmation.actionId, decision: "CONFIRM" } })).status, 404);
    assert.equal(writes, 1, "Xác nhận từ phiên đã xóa không thực hiện service.");
    const unknownId = randomUUID();
    await request("/messages", "POST", { sessionId: unknownId, requestId: randomUUID(), message: "Kiểm thử ledger chưa đồng bộ." });
    const stale = (await buildCustomerSessionGraph(saver).getState({ configurable: { thread_id: threads.get(unknownId)! } })).values.data.session as AgentSession;
    await ledger.reserve(actionIdentity(userId, unknownId, "customer-care", stale.pendingAction!));
    assert.equal((await request(`/sessions/${unknownId}`, "DELETE")).status, 409, "Ledger đã nhận thao tác dù checkpoint còn chờ xác nhận.");
    assert.equal((await request("/sessions/reset", "POST", { sessionId: unknownId })).status, 200);
    assert.equal((await request(`/sessions/${unknownId}`)).status, 200, "Tạo phiên mới giữ phiên đối soát cũ.");
    const failedId = randomUUID();
    retryMode = "timeout";
    assert.equal((await request("/messages", "POST", { sessionId: failedId, requestId: randomUUID(), message: "Tra cứu để kiểm thử xóa sau lỗi AI." })).status, 200);
    assert.equal((await request(`/sessions/${failedId}`, "DELETE")).status, 200);
    assert.equal((await request(`/sessions/${failedId}`)).status, 404);
    assert.equal(writes, 1, "Xóa cuộc trò chuyện lỗi AI không thực hiện thao tác nghiệp vụ.");
    console.log("Đạt HTTP engine nghiệp vụ: JWT thật bằng khóa test, role từ user fixture, router/controller/façade/runtime thật, upload, xác nhận, replay và lifecycle; model/database/service giả lập.");
  } finally {
    server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); mock.restoreAll();
    delete process.env.ACCESS_TOKEN_SECRET; delete process.env.AI_AGENT_CUSTOMER_ROLLOUT;
  }
}
void run().catch((error: unknown) => { mock.restoreAll(); console.error(error); process.exitCode = 1; });
