import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import http from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Chỉ đọc tài khoản CUSTOMER do chủ dự án chỉ định; token chỉ tồn tại trong bộ nhớ tiến trình.
export async function verifyCustomerAgentHttpAtlas(identifier: string) {
  if (!process.env.MONGO_URI || !process.env.ACCESS_TOKEN_SECRET || !identifier.trim()) throw new Error("Thiếu cấu hình kiểm chứng.");
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 12000 });
  let server: http.Server | undefined;
  try {
    const { default: User } = await import("../models/user.model");
    const lookup = mongoose.isObjectIdOrHexString(identifier) ? { _id: identifier } : { email: identifier.trim().toLowerCase() };
    const customer = await User.findOne({ ...lookup, role: "CUSTOMER", status: "active", isDeleted: false })
      .select("_id tokenVersion").lean();
    if (!customer) throw new Error("Không tìm thấy CUSTOMER kiểm thử hợp lệ.");
    const { default: app } = await import("../app");
    server = http.createServer(app);
    await new Promise<void>((resolve, reject) => { server!.once("error", reject); server!.listen(0, "127.0.0.1", resolve); });
    const address = server.address(); assert.ok(address && typeof address !== "string");
    const token = jwt.sign({ id: String(customer._id), tokenVersion: customer.tokenVersion ?? 0 }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "5m" });
    const request = (path: string, method = "GET", body?: unknown) => fetch(`http://127.0.0.1:${address.port}${path}`, {
      method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(200_000),
    });
    const input = { sessionId: randomUUID(), requestId: randomUUID(),
      message: "Tôi chỉ hỏi chính sách: một đơn được dùng hai voucher cùng lúc hay chỉ một mã?" };
    const started = Date.now();
    let res = await request("/ai/messages", "POST", input); assert.equal(res.status, 200);
    let view = (await res.json()).data;
    let resumes = 0;
    while (view.interruptedRequest && resumes < 2) {
      resumes++; res = await request("/ai/messages", "POST", input); assert.equal(res.status, 200); view = (await res.json()).data;
    }
    assert.equal(view.interruptedRequest, null); assert.equal(view.pendingConfirmation, null);
    assert.ok(["COMPLETED", "WAITING_USER_INPUT"].includes(view.state));
    const answer = view.messages.filter((message: { sender: string }) => message.sender === "assistant").slice(-1)[0]?.content ?? "";
    assert.match(answer, /(một|1|duy nhất).*(mã|voucher)|(mã|voucher).*(một|1|duy nhất)/i);
    res = await request(`/ai/sessions/${input.sessionId}`); assert.equal(res.status, 200);
    assert.equal((await res.json()).data.sessionId, input.sessionId);
    res = await request(`/ai/sessions/${input.sessionId}/progress`); assert.equal(res.status, 200);
    res = await request("/ai/messages", "POST", input); assert.equal(res.status, 200);
    const replay = (await res.json()).data;
    assert.deepEqual(replay.messages, view.messages);
    const { getCustomerGraphHost } = await import("../ai/runtime/graph-host");
    const canonical = await (await getCustomerGraphHost()).get(input.sessionId, String(customer._id));
    assert.equal(canonical.actions.length, 0); assert.equal(canonical.receipts.length, 1);
    const report = { createdAt: new Date().toISOString(), passed: true, realCustomerAuth: true, realControllerFacade: true,
      realGeminiAtlas: true, engine: "langgraph-customer", getProgressReplay: true, businessWrites: 0, deletedDocuments: 0,
      elapsedMs: Date.now() - started, resumes,
      limitations: "Kiểm chứng HTTP bằng tài khoản chủ dự án chỉ định; không thay kiểm tra thao tác trình duyệt hoặc tải. Không khởi động monitor nghiệp vụ." };
    const folder = join(process.cwd(), "docs", "evaluations"); await mkdir(folder, { recursive: true });
    const filename = `customer-agent-http-atlas-${Date.now()}.json`;
    await writeFile(join(folder, filename), JSON.stringify(report, null, 2), { flag: "wx" });
    return { ...report, report: `docs/evaluations/${filename}` };
  } finally {
    if (server) { server.closeAllConnections(); await new Promise<void>((resolve) => server!.close(() => resolve())); }
    await import("../ai/runtime/graph-host").then((host) => host.closeGraphHost()).catch(() => undefined);
    await mongoose.disconnect();
  }
}

if (require.main === module) void verifyCustomerAgentHttpAtlas(process.env.AI_AGENT_E2E_CUSTOMER ?? "")
  .then((report) => console.log(JSON.stringify(report)))
  .catch((error: unknown) => { console.error(JSON.stringify({ passed: false, type: error instanceof Error ? error.name : "unknown",
    requirement: "Cấp AI_AGENT_E2E_CUSTOMER là ID/email CUSTOMER kiểm thử, cùng cấu hình tiến trình. Không tự tạo tài khoản hoặc đọc .env." })); process.exitCode = 1; });
