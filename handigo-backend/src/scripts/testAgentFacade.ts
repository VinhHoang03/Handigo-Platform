import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { newSession, type AgentSession } from "../ai/agent/agent-state";
import type { SessionEngine } from "../ai/session/session.service";
import type { RequestUser } from "../middlewares/authContext";
import { AppError } from "../utils/appError";

async function run() {
  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  const { AgentFacade, selectNewSessionEngine } = await import("../ai/runtime/agent-facade");
  const { sessionView } = await import("../ai/agent/agent.service");
  const user: RequestUser = { id: "111111111111111111111111", role: "CUSTOMER" };
  const rows = new Map<string, { owner: string; engine?: SessionEngine; data: AgentSession; deleted?: boolean; lock?: string }>();
  const canonical = new Map<string, AgentSession>();
  let useGraph = true;
  let legacyCalls = 0;
  let graphCalls = 0;
  let attachments = 0;
  const lookup = (id: string, owner: string) => {
    const row = rows.get(id);
    if (!row || row.owner !== owner || row.deleted) throw new AppError("Không tìm thấy phiên.", 404);
    return row;
  };
  const directory = {
    async resolveEngine(id: string, owner: string, create?: SessionEngine | (() => SessionEngine)) {
      if (!rows.has(id) && create) rows.set(id, { owner, engine: typeof create === "function" ? create() : create, data: newSession(id, owner) });
      return lookup(id, owner).engine ?? "legacy";
    },
    async acquireEngine(id: string, owner: string, engine: SessionEngine) {
      const row = lookup(id, owner);
      if ((row.engine ?? "legacy") !== engine || row.lock) throw new AppError("Phiên đang xử lý.", 409);
      row.lock = randomUUID(); return { session: row.data, lockId: row.lock };
    },
    async release(id: string, lockId: string) { const row = rows.get(id); if (row?.lock === lockId) delete row.lock; },
    async saveGraphProjection(session: AgentSession, lockId: string) {
      const row = lookup(session.id, session.userId); assert.equal(row.lock, lockId); row.data = structuredClone(session);
    },
    async archiveGraph(id: string, owner: string, lockId: string) { const row = lookup(id, owner); assert.equal(row.lock, lockId); row.deleted = true; },
    async get(id: string, owner: string) { return lookup(id, owner).data; },
    async listDirectory(owner: string, page: number, limit: number) {
      const all = [...rows.values()].filter((row) => row.owner === owner && !row.deleted);
      return { items: all.slice((page - 1) * limit, page * limit).map((row) => ({ sessionId: row.data.id, engine: row.engine ?? "legacy", title: "Cache chưa cập nhật",
        state: row.data.state, needsAttention: false, updatedAt: new Date(0) })),
      pagination: { page, limit, total: all.length, totalPages: Math.ceil(all.length / limit) } };
    },
    async latest(owner: string) { return [...rows.values()].reverse().find((row) => row.owner === owner && !row.deleted)?.data ?? null; },
    async progress(id: string, owner: string) { return { sessionId: id, requestId: null, state: lookup(id, owner).data.state, activity: null }; },
    async delete(id: string, owner: string) { lookup(id, owner); rows.delete(id); },
    async reset(id: string, owner: string, engine: SessionEngine = "legacy") {
      lookup(id, owner); const data = newSession(randomUUID(), owner); rows.set(data.id, { owner, engine, data }); return data;
    },
    async registerAttachment(id: string, owner: string, url: string) { lookup(id, owner); attachments++; return { url }; },
  };
  const facade = new AgentFacade(directory, async () => ({
    async exclusive(_user, _id, runExclusive) { return runExclusive(); },
    async get(id, owner) { lookup(id, owner); return structuredClone(canonical.get(id) ?? newSession(id, owner)); },
    async send(customer, id, input) {
      graphCalls++; const session = newSession(id, customer.id); session.state = "COMPLETED";
      session.conversation = [{ id: "user", role: "user", content: input.message, createdAt: new Date().toISOString() }];
      canonical.set(id, session); return session;
    },
  }), async (customer, id) => { legacyCalls++; return sessionView(newSession(id, customer.id)); }, () => useGraph ? "langgraph-readonly" : "legacy");
  const oldId = randomUUID(); rows.set(oldId, { owner: user.id, data: newSession(oldId, user.id) });
  const input = { requestId: randomUUID(), message: "Tra cứu hướng dẫn" };
  await facade.send(user, oldId, input);
  assert.equal(legacyCalls, 1, "Phiên cũ không có engine phải tiếp tục legacy dù pilot bật.");
  const graphId = randomUUID();
  const graphResult = await facade.send(user, graphId, input);
  assert.equal(graphCalls, 1);
  assert.equal(graphResult.sessionId, graphId);
  assert.equal(graphResult.pendingConfirmation, null);
  useGraph = false;
  await facade.send(user, graphId, input);
  assert.equal(graphCalls, 2, "Tắt mở phiên mới không đổi engine đã ghim.");
  for (const unsupported of [
    { ...input, bookingAction: { type: "provider" as const, orderId: "222222222222222222222222" } },
    { ...input, customerAttachments: ["https://example.invalid/anh.jpg"] },
    { requestId: randomUUID(), paymentStatus: { orderId: "222222222222222222222222" } },
    { requestId: randomUUID(), confirmation: { actionId: randomUUID(), decision: "CONFIRM" as const } },
  ]) await assert.rejects(facade.send(user, graphId, unsupported));
  assert.equal(legacyCalls, 1, "Không fallback luồng ghi graph sang legacy.");
  assert.equal(graphCalls, 2);
  await assert.rejects(facade.requireAttachmentSupport(user, graphId));
  assert.equal(attachments, 0);
  await facade.registerAttachment(user, oldId, "https://example.invalid/anh.jpg");
  assert.equal(attachments, 1);
  await assert.rejects(facade.get({ ...user, id: "khach-khac" }, graphId));
  await assert.rejects(facade.send({ ...user, role: "PROVIDER" }, graphId, input));
  const waiting = canonical.get(graphId)!;
  waiting.state = "RUNNING";
  waiting.activeRequest = { ...input, digest: "dang-do", input };
  waiting.conversation[0].content = "Nguồn chuẩn từ checkpoint";
  assert.equal((await facade.get(user, graphId)).conversation[0].content, "Nguồn chuẩn từ checkpoint");
  const progress = await facade.progress(user, graphId);
  assert.equal(progress.requestId, input.requestId);
  assert.equal(progress.state, "RUNNING");
  const page = await facade.list(user, 1, 20);
  const item = page.items.find((row) => row.sessionId === graphId)!;
  assert.equal(item.title, "Nguồn chuẩn từ checkpoint"); assert.equal(item.needsAttention, true);
  assert.equal((await facade.latest(user))?.state, "RUNNING");
  await assert.rejects(facade.delete(user, graphId));
  assert.notEqual((await facade.reset(user, graphId)).id, graphId);
  assert.equal(rows.get(graphId)?.lock, undefined);
  waiting.activeRequest = null; waiting.state = "COMPLETED";
  const reset = await facade.reset(user, graphId);
  assert.notEqual(reset.id, graphId);
  assert.equal(rows.get(reset.id)?.engine, "legacy", "Phiên mới tuân cấu hình rollout hiện tại.");
  await facade.delete(user, graphId);
  assert.equal(rows.get(graphId)?.deleted, true);
  assert.ok(canonical.has(graphId), "Ẩn phiên không xóa checkpoint.");
  await assert.rejects(facade.get(user, graphId));
  await assert.rejects(facade.send(user, graphId, input));
  await assert.rejects(facade.progress(user, graphId));
  assert.ok(!(await facade.list(user, 1, 20)).items.some((row) => row.sessionId === graphId));
  assert.equal(selectNewSessionEngine(user, {}), "legacy");
  assert.equal(selectNewSessionEngine(user, { AI_AGENT_GRAPH_NEW_SESSIONS: "true", AI_AGENT_GRAPH_PILOT_USERS: user.id }), "langgraph-readonly");
  assert.equal(selectNewSessionEngine({ ...user, id: "333333333333333333333333" }, { AI_AGENT_GRAPH_NEW_SESSIONS: "true", AI_AGENT_GRAPH_PILOT_USERS: user.id }), "legacy");
  assert.throws(() => selectNewSessionEngine(user, { AI_AGENT_GRAPH_NEW_SESSIONS: "true" }));
  assert.equal(selectNewSessionEngine(user, { AI_AGENT_CUSTOMER_NEW_SESSIONS: "true", AI_AGENT_CUSTOMER_PILOT_USERS: user.id }), "langgraph-customer");
  assert.throws(() => selectNewSessionEngine(user, { AI_AGENT_CUSTOMER_NEW_SESSIONS: "true" }));
  const anotherCustomer = { ...user, id: "4".repeat(24) };
  for (const customer of [user, anotherCustomer]) {
    assert.equal(selectNewSessionEngine(customer, { AI_AGENT_CUSTOMER_ROLLOUT: "all" }), "langgraph-customer");
    assert.equal(selectNewSessionEngine(customer, { AI_AGENT_CUSTOMER_ROLLOUT: "all", AI_AGENT_CUSTOMER_PILOT_USERS: "khong-can-id",
      AI_AGENT_CUSTOMER_NEW_SESSIONS: "false", AI_AGENT_GRAPH_NEW_SESSIONS: "true" }), "langgraph-customer");
  }
  assert.equal(selectNewSessionEngine(user, { AI_AGENT_CUSTOMER_ROLLOUT: "off", AI_AGENT_CUSTOMER_NEW_SESSIONS: "true" }), "legacy");
  assert.equal(selectNewSessionEngine(user, { AI_AGENT_CUSTOMER_ROLLOUT: "pilot", AI_AGENT_CUSTOMER_PILOT_USERS: user.id }), "langgraph-customer");
  assert.equal(selectNewSessionEngine(anotherCustomer, { AI_AGENT_CUSTOMER_ROLLOUT: "pilot", AI_AGENT_CUSTOMER_PILOT_USERS: user.id }), "legacy");
  for (const role of ["PROVIDER", "ADMIN"] as const) assert.equal(selectNewSessionEngine({ ...user, role }, { AI_AGENT_CUSTOMER_ROLLOUT: "all" }), "legacy");
  assert.throws(() => selectNewSessionEngine(user, { AI_AGENT_CUSTOMER_ROLLOUT: "ALL" }));
  assert.throws(() => selectNewSessionEngine(user, { AI_AGENT_CUSTOMER_ROLLOUT: "pilot" }));
  assert.throws(() => selectNewSessionEngine(user, { AI_AGENT_CUSTOMER_ROLLOUT: "pilot", AI_AGENT_CUSTOMER_PILOT_USERS: Array(101).fill(user.id).join(",") }));
  let customerCalls = 0, customerAttachments = 0;
  let rollout: "all" | "off" = "all";
  let customerLegacyCalls = 0;
  let customerUnavailable = false;
  let actionRecorded = false;
  const customerFacade = new AgentFacade(directory, async () => { throw new Error("Không được chuyển phiên nghiệp vụ sang graph chỉ đọc."); },
    async (customer, id) => { customerLegacyCalls++; return sessionView(newSession(id, customer.id)); },
    (customer) => selectNewSessionEngine(customer, { AI_AGENT_CUSTOMER_ROLLOUT: rollout }), async () => ({
      async exclusive(_customer, _id, runExclusive) { return runExclusive(); },
      async get(id, owner) { lookup(id, owner); return structuredClone(canonical.get(id) ?? newSession(id, owner)); },
      async send(customer, id, request) {
        if (customerUnavailable) throw new AppError("Kho engine nghiệp vụ fixture tạm thời không khả dụng.", 503);
        customerCalls++;
        const session = newSession(id, customer.id);
        session.state = "COMPLETED";
        session.conversation.push({ id: request.requestId, role: "user", content: "Nội dung từ checkpoint nghiệp vụ", createdAt: new Date().toISOString() });
        canonical.set(id, session);
        return session;
      },
      async requireAttachmentSupport(customer, id) { lookup(id, customer.id); },
      async registerAttachment(customer, id, url) { lookup(id, customer.id); customerAttachments++; return { url }; },
      async hasActionRecord() { return actionRecorded; },
    }));
  const customerId = randomUUID();
  await customerFacade.send(user, customerId, { requestId: randomUUID(), confirmation: { actionId: randomUUID(), decision: "CONFIRM" } });
  assert.equal(rows.get(customerId)?.engine, "langgraph-customer");
  const oldLegacyId = randomUUID(); rows.set(oldLegacyId, { owner: user.id, engine: "legacy", data: newSession(oldLegacyId, user.id) });
  await customerFacade.send(user, oldLegacyId, input);
  assert.equal(customerLegacyCalls, 1, "Chế độ all không đổi phiên legacy đã ghim.");
  rollout = "off";
  await customerFacade.send(user, customerId, { requestId: randomUUID(), paymentStatus: { orderId: "2".repeat(24) } });
  assert.equal(customerCalls, 2, "Tắt pilot không đổi engine giao dịch đã ghim.");
  const newLegacyId = randomUUID();
  await customerFacade.send(user, newLegacyId, input);
  assert.equal(rows.get(newLegacyId)?.engine, "legacy");
  assert.equal(customerLegacyCalls, 2, "Chế độ off chỉ ngừng tạo phiên nghiệp vụ mới.");
  customerUnavailable = true;
  await assert.rejects(customerFacade.send(user, customerId, input));
  assert.equal(customerLegacyCalls, 2, "Lỗi engine đã ghim không được fallback về legacy để ghi lại.");
  assert.equal(rows.get(customerId)?.lock, undefined, "Lỗi runtime vẫn nhả khóa directory.");
  customerUnavailable = false;
  await customerFacade.registerAttachment(user, customerId, "https://example.invalid/anh-nghiep-vu.jpg");
  assert.equal(customerAttachments, 1);
  assert.equal((await customerFacade.get(user, customerId)).conversation[0].content, "Nội dung từ checkpoint nghiệp vụ");
  const customerWaiting = canonical.get(customerId)!;
  customerWaiting.pendingAction = { id: randomUUID(), taskVersion: 0, tool: "create_payment", arguments: {}, preview: {},
    status: "WAITING_CONFIRMATION", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString() };
  assert.notEqual((await customerFacade.reset(user, customerId)).id, customerId);
  actionRecorded = true;
  await assert.rejects(customerFacade.delete(user, customerId), /Thao tác xác nhận đã được tiếp nhận/);
  actionRecorded = false;
  assert.equal((await customerFacade.list(user, 1, 50)).items.find((item) => item.sessionId === customerId)?.needsAttention, true);
  customerWaiting.pendingAction = null;
  customerWaiting.state = "FAILED";
  customerWaiting.activeRequest = { requestId: input.requestId, digest: "loi-model", input };
  customerWaiting.modelWorkflow = { version: "customer-model-v1", requestId: input.requestId, digest: "loi-model",
    phase: "call_model", iteration: 1, consecutiveProviderErrors: 1, failedCalls: [], waitingForModelRetry: true };
  // Lỗi model không phải giao dịch chưa rõ kết quả: tạo phiên mới và xóa đều được phép.
  const afterModelFailure = await customerFacade.reset(user, customerId);
  assert.notEqual(afterModelFailure.id, customerId);
  assert.equal(customerWaiting.activeRequest.requestId, input.requestId, "Tạo phiên mới giữ lịch sử để có thể tiếp tục phiên cũ.");
  customerWaiting.requiresReconciliation = true;
  await assert.rejects(customerFacade.delete(user, customerId), /Kết quả thao tác trước chưa được xác định/);
  assert.notEqual((await customerFacade.reset(user, customerId)).id, customerId);
  customerWaiting.requiresReconciliation = false;
  const transactionInput = { requestId: input.requestId, confirmation: { actionId: randomUUID(), decision: "CONFIRM" as const } };
  customerWaiting.activeRequest.input = transactionInput;
  await assert.rejects(customerFacade.delete(user, customerId), /Lượt trước chưa hoàn tất/);
  assert.notEqual((await customerFacade.reset(user, customerId)).id, customerId);
  customerWaiting.activeRequest.input = input;
  customerWaiting.actions.push({ id: randomUUID(), taskVersion: 0, tool: "create_payment", arguments: {}, preview: {},
    status: "UNKNOWN", createdAt: new Date().toISOString(), expiresAt: new Date().toISOString() });
  await assert.rejects(customerFacade.delete(user, customerId), /Kết quả thao tác trước chưa được xác định/);
  customerWaiting.actions = [];
  await customerFacade.delete(user, customerId);
  assert.equal(rows.get(customerId)?.deleted, true);
  assert.ok(canonical.has(customerId));
  rollout = "all";
  const discardId = randomUUID();
  await customerFacade.send(user, discardId, input);
  canonical.get(discardId)!.pendingAction = { id: randomUUID(), taskVersion: 0, tool: "create_payment", arguments: {}, preview: {},
    status: "WAITING_CONFIRMATION", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString() };
  await customerFacade.delete(user, discardId);
  assert.ok(rows.get(discardId)?.deleted, "Được xóa xác nhận chưa thực hiện.");
  await assert.rejects(customerFacade.send(user, discardId, { requestId: randomUUID(), confirmation: {
    actionId: canonical.get(discardId)!.pendingAction!.id, decision: "CONFIRM" } }), /Không tìm thấy phiên/);
  console.log("Đạt facade: ghim engine, phiên cũ, rollout, không fallback ghi, ownership, nguồn checkpoint, progress/list/latest/reset, ẩn phiên giữ checkpoint và chặn ảnh trước upload.");
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
