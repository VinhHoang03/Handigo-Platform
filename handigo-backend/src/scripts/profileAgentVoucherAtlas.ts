import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import mongoose from "mongoose";
import { newSession, type AgentInput, type AgentSession } from "../ai/agent/agent-state";
import { updateBookingDraft, readyBookingArguments } from "../ai/agent/booking-draft";
import { ConfirmationService } from "../ai/agent/confirmation.service";
import { createCustomerGraphConnection } from "../ai/runtime/customer-graph-connection";
import { buildCustomerSessionGraph } from "../ai/runtime/customer-workflow-state";
import { CUSTOMER_GRAPH_VERSION } from "../ai/runtime/mongo-graph-access";
import { observeCustomerTurn, type CustomerTurnMetric } from "../ai/runtime/customer-runtime-metrics";

// Đo runtime với Atlas và service đọc thật; chỉ tạo checkpoint AI, không xác nhận đơn hoặc thanh toán.
export async function profileAgentVoucherAtlas(identifier: string, label: string) {
  if (!process.env.MONGO_URI || !identifier || !/^[a-z0-9-]{1,30}$/.test(label)) throw new Error("Thiếu cấu hình đo thời gian.");
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 12000 });
  const connection = createCustomerGraphConnection(process.env.MONGO_URI);
  try {
    const { default: User } = await import("../models/user.model");
    const user = await User.findOne({ email: identifier, role: "CUSTOMER", status: "active", isDeleted: false }).select("_id").lean();
    assert.ok(user);
    const owner = { id: String(user._id), role: "CUSTOMER" as const };
    const source = await mongoose.connection.db!.collection("ai_agent_sessions").findOne({ userId: owner.id, deletedAt: null,
      "data.bookingDraft.values.serviceId": { $exists: true } }, { sort: { updatedAt: -1 } });
    assert.ok(source?.data.bookingDraft);
    const address = await mongoose.connection.db!.collection("addresses").findOne({ userId: user._id, isDeleted: { $ne: true },
      latitude: { $type: "number" }, longitude: { $type: "number" } });
    assert.ok(address);
    const session = newSession(randomUUID(), owner.id);
    session.currentGoal = "Kiểm thử tốc độ cập nhật voucher, không tạo đơn.";
    const previous = structuredClone(source.data.bookingDraft) as NonNullable<AgentSession["bookingDraft"]>;
    previous.status = "active"; delete previous.orderId; delete previous.draftAddress;
    delete previous.providerPreference; delete previous.providerCriteria; delete previous.rebookNeedsOptionReview;
    const localTomorrow = new Date(Date.now() + 7 * 3600000 + 86400000).toISOString().slice(0, 10);
    const { AgentBookingService } = await import("../services/agentBooking.service");
    session.bookingDraft = await updateBookingDraft(previous, { mode: "update", voucherCode: null, preferredProviderId: null,
      addressId: String(address._id), orderType: "scheduled", scheduledAt: `${localTomorrow}T10:00:00+07:00` }, owner.id, AgentBookingService);
    const voucher = session.bookingDraft.availableVouchers?.find((item) => item.discountType === "PERCENT" && item.discountValue === 10)
      ?? session.bookingDraft.availableVouchers?.[0];
    assert.ok(voucher && readyBookingArguments(session.bookingDraft));
    const { loadAgentConfig } = await import("../ai/ai.config");
    const { registerTools } = await import("../ai/tools/register-tools");
    const { CustomerWorkflowRuntime } = await import("../ai/runtime/customer-workflow-runtime");
    const config = loadAgentConfig(), registry = registerTools(config.tools);
    const context = { user: owner, session, sessionId: session.id, signal: AbortSignal.timeout(30000) };
    const tool = registry.get("create_booking", context);
    session.pendingAction = await new ConfirmationService().prepare(tool, context, readyBookingArguments(session.bookingDraft));
    session.pendingAction.taskVersion = session.taskVersion;
    session.state = "WAITING_CONFIRMATION";
    session.conversation.push({ id: randomUUID(), role: "assistant", content: "", createdAt: new Date().toISOString(), confirmationActionId: session.pendingAction.id });
    await connection.open();
    await connection.access.exclusive(owner, session.id, async (threadId) => {
      await buildCustomerSessionGraph(connection.saver).updateState({ configurable: { thread_id: threadId } },
        { data: { version: CUSTOMER_GRAPH_VERSION, session } }, "session");
    });
    let modelCalls = 0;
    const runtime = new CustomerWorkflowRuntime({ config, registry, access: connection.access, checkpointer: connection.saver,
      ledger: connection.ledger, assertWriteAccess: connection.assertWriteAccess,
      provider: { generate: async () => { modelCalls++; throw new Error("Chọn mã không được gọi model."); } } });
    const measurements: Array<{ operation: string; metric?: CustomerTurnMetric }> = [];
    let current = session;
    for (const code of [voucher.code, null]) {
      const input: AgentInput = { requestId: randomUUID(), message: code ? `Áp mã ${code}.` : "Không dùng voucher.",
        bookingAction: { type: "update", revision: current.bookingDraft!.revision, patch: { voucherCode: code } } };
      const measurement: typeof measurements[number] = { operation: code ? "apply" : "remove" };
      current = await observeCustomerTurn(() => runtime.send(owner, session.id, input), (metric) => { measurement.metric = metric; });
      assert.ok(current.pendingAction && current.bookingDraft);
      assert.equal(current.bookingDraft.values.voucherCode ?? null, code);
      assert.ok(current.actions.every((action) => !["SUCCEEDED", "EXECUTING", "UNKNOWN"].includes(action.status)));
      measurements.push(measurement);
    }
    assert.equal(modelCalls, 0);
    const report = { label, createdAt: new Date().toISOString(), measurements, modelCalls, businessWrites: 0, deletedDocuments: 0,
      limitation: "Đo runtime với Atlas thật, hai thao tác tuần tự, chưa gồm HTTP/auth/directory hoặc tải đồng thời; không phải SLO." };
    const folder = join(process.cwd(), "docs/evaluations"); await mkdir(folder, { recursive: true });
    const filename = `voucher-runtime-${label}-${Date.now()}.json`;
    await writeFile(join(folder, filename), JSON.stringify(report, null, 2), { flag: "wx" });
    return { ...report, report: `docs/evaluations/${filename}` };
  } finally { await connection.close(); await mongoose.disconnect(); }
}
if (require.main === module) void profileAgentVoucherAtlas(process.env.AI_AGENT_E2E_CUSTOMER ?? "", process.argv[2] ?? "profile")
  .then((report) => console.log(JSON.stringify(report)))
  .catch((error: unknown) => { console.error(JSON.stringify({ passed: false, errorType: error instanceof Error ? error.name : "unknown" })); process.exitCode = 1; });
