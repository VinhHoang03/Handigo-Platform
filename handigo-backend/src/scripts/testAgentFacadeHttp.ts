import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import express from "express";
import { newSession, type AgentInput } from "../ai/agent/agent-state";
import type { RequestUser } from "../middlewares/authContext";
import { AppError } from "../utils/appError";

async function run() {
  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  const auth = await import("../middlewares/auth.middleware");
  const upload = await import("../middlewares/orderAttachmentUpload.middleware");
  const limits = await import("../middlewares/rateLimit.middleware");
  const { AgentFacade } = await import("../ai/runtime/agent-facade");
  const { sessionView } = await import("../ai/agent/agent.service");
  const userId = "111111111111111111111111";
  const id = randomUUID();
  const session = newSession(id, userId);
  session.state = "COMPLETED";
  let uploads = 0;
  let sends = 0;
  // Chỉ stub xác thực/IO cho server loopback của bài test; giữ router/role/validator/controller thật.
  mock.method(auth, "authMiddleware", (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.headers["x-test-auth"] === "none") { res.status(401).json({ message: "Chưa xác thực." }); return; }
    req.user = { id: userId, email: "fixture@example.invalid", role: req.headers["x-test-role"] === "provider" ? "PROVIDER" : "CUSTOMER" };
    next();
  });
  mock.method(limits, "chatbotRateLimit", (_req: express.Request, _res: express.Response, next: express.NextFunction) => next());
  mock.method(upload, "uploadOrderAttachmentImage", (_req: express.Request, _res: express.Response, next: express.NextFunction) => { uploads++; next(); });
  mock.method(AgentFacade.prototype, "send", async (user: RequestUser, sessionId: string, input: AgentInput) => {
    sends++; assert.equal(user.id, userId); assert.equal(sessionId, id);
    if ("paymentStatus" in input) throw new AppError("Phiên thử nghiệm chỉ hỗ trợ tra cứu.", 409);
    return sessionView(session);
  });
  mock.method(AgentFacade.prototype, "get", async () => session);
  mock.method(AgentFacade.prototype, "latest", async () => session);
  mock.method(AgentFacade.prototype, "progress", async () => ({ sessionId: id, requestId: null, state: "COMPLETED" as const, activity: null }));
  mock.method(AgentFacade.prototype, "list", async (_user: RequestUser, page: number, limit: number) => ({ items: [], pagination: { page, limit, total: 0, totalPages: 0 } }));
  mock.method(AgentFacade.prototype, "reset", async () => newSession(randomUUID(), userId));
  mock.method(AgentFacade.prototype, "delete", async () => undefined);
  mock.method(AgentFacade.prototype, "requireAttachmentSupport", async () => { throw new AppError("Phiên tra cứu chưa hỗ trợ ảnh.", 409); });
  const { default: router } = await import("../ai/ai.routes");
  const app = express(); app.use(express.json()); app.use("/ai", router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  try {
    const address = server.address(); assert.ok(address && typeof address !== "string");
    const request = (path: string, method = "GET", body?: unknown, headers?: Record<string, string>) => fetch(`http://127.0.0.1:${address.port}/ai${path}`, {
      method, headers: { "content-type": "application/json", ...headers }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(3000),
    });
    const message = { sessionId: id, requestId: randomUUID(), message: "Tra cứu hướng dẫn" };
    const sent = await request("/messages", "POST", message);
    assert.equal(sent.status, 200);
    const sentBody = await sent.json();
    assert.deepEqual(Object.keys(sentBody).sort(), ["data", "message", "success"]);
    assert.equal(sentBody.data.sessionId, id);
    assert.equal(sentBody.data.pendingConfirmation, null);
    assert.ok("orderActions" in sentBody.data);
    assert.ok(!("engine" in sentBody.data));
    assert.equal((await request("/messages", "POST", { ...message, engine: "langgraph-readonly" })).status, 400);
    assert.equal((await request("/messages", "POST", { ...message, userId: "khach-khac" })).status, 400);
    assert.equal((await request("/messages", "POST", { ...message, requestId: "sai-id" })).status, 400);
    assert.equal(sends, 1);
    const denied = await request("/messages", "POST", { sessionId: id, requestId: randomUUID(), paymentStatus: { orderId: "222222222222222222222222" } });
    assert.equal(denied.status, 409); assert.equal((await denied.json()).success, false);
    for (const path of [`/sessions/${id}`, "/sessions/latest"]) {
      const response = await request(path); assert.equal(response.status, 200);
      assert.equal((await response.json()).data.sessionId, id);
    }
    const progress = await request(`/sessions/${id}/progress`);
    assert.deepEqual((await progress.json()).data, { sessionId: id, requestId: null, state: "COMPLETED", activity: null });
    const list = await request("/sessions?page=2&limit=5");
    assert.deepEqual((await list.json()).data.pagination, { page: 2, limit: 5, total: 0, totalPages: 0 });
    assert.equal((await request("/sessions?limit=500")).status, 400);
    const reset = await request("/sessions/reset", "POST", { sessionId: id });
    assert.equal(reset.status, 200); assert.notEqual((await reset.json()).data.sessionId, id);
    const removed = await request(`/sessions/${id}`, "DELETE");
    assert.equal(removed.status, 200); assert.equal((await removed.json()).data, null);
    assert.equal((await request(`/sessions/${id}/attachments`, "POST")).status, 409);
    assert.equal(uploads, 0, "Preflight phải chặn trước middleware upload.");
    assert.equal((await request("/sessions/latest", "GET", undefined, { "x-test-role": "provider" })).status, 403);
    assert.equal((await request("/sessions/latest", "GET", undefined, { "x-test-auth": "none" })).status, 401);
    console.log("Đạt HTTP facade loopback: route/response, validation, role, controller dispatch, lifecycle và preflight ảnh; auth/IO giả lập, không gọi dịch vụ ngoài.");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    mock.restoreAll();
  }
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
