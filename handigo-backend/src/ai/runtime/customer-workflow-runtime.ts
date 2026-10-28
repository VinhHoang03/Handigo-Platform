import type { BaseCheckpointSaver } from "@langchain/langgraph";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { RequestUser } from "../../middlewares/authContext";
import { AppError } from "../../utils/appError";
import { AgentService } from "../agent/agent.service";
import { AgentLoop } from "../agent/agent-loop.service";
import { newSession, type AgentInput, type AgentSession, type PendingAction } from "../agent/agent-state";
import { AGENT_REQUEST_TIMEOUT_MS } from "../agent/runtime-limits";
import { agentRequestSchema } from "../ai.validation";
import type { LLMProvider } from "../llm/llm.interface";
import type { ToolRegistry } from "../tools/tool-registry";
import { mergeAgentOrderMessages } from "../../services/agentOrderProgress.service";
import { ActionGraphDispatcher } from "./action-graph-dispatcher";
import { runCustomerModelGraph } from "../graphs/customer-model.graph";
import { measureCustomerStage } from "./customer-runtime-metrics";
import { AgentCheckpointError } from "../agent/checkpoint-error";
import type { ActionLedger } from "./action-ledger";
import type { GraphThreadAccess } from "./agent-runtime";
import { CUSTOMER_GRAPH_VERSION } from "./mongo-graph-access";
import { buildCustomerSessionGraph, projectCustomerWorkflow, type CustomerWorkflowData } from "./customer-workflow-state";
import { buildBookingDraftGraph } from "../graphs/booking.graph";
import { MessageRepository } from "../session/message.repository";
export { buildCustomerSessionGraph, projectCustomerWorkflow, type CustomerWorkflowData } from "./customer-workflow-state";

interface Dependencies {
  provider: LLMProvider;
  registry: ToolRegistry;
  checkpointer: BaseCheckpointSaver;
  ledger: ActionLedger;
  access: GraphThreadAccess;
  assertWriteAccess(threadId: string): Promise<void>;
  config: { maxIterations: number; systemPrompt: string; timeoutMs: number };
  mergeMessages?: (session: AgentSession) => Promise<AgentSession>;
}

export class CustomerWorkflowRuntime {
  constructor(private readonly deps: Dependencies) {}

  hasActionRecord(session: AgentSession, action: PendingAction) {
    return new ActionGraphDispatcher(this.deps.registry, this.deps.ledger, async () => {}).hasRecord(session, action);
  }

  private async withSession<T>(user: RequestUser, id: string,
    run: (session: AgentSession, save: () => Promise<void>, threadId: string) => Promise<T>) {
    if (user.role !== "CUSTOMER") throw new AppError("Trợ lý hệ thống chỉ dành cho khách hàng.", 403);
    z.string().uuid().parse(id);
    return this.deps.access.exclusive(user, id, async (threadId) => {
      const graph = buildCustomerSessionGraph(this.deps.checkpointer);
      const config = { configurable: { thread_id: threadId } };
      const snapshot = await measureCustomerStage("checkpoint_read", () => graph.getState(config));
      const data: CustomerWorkflowData | undefined = snapshot.values.data;
      const session = data ? projectCustomerWorkflow(data, id, user.id) : newSession(id, user.id);
      const merge = this.deps.mergeMessages ?? mergeAgentOrderMessages;
      Object.assign(session, await measureCustomerStage("merge_messages", () => merge(session)));
      const actionState = () => session.actions.map((action) => `${action.id}:${action.status}`).join("|");
      let mergedActionState = actionState();
      let savedDigest = data ? createHash("sha256").update(JSON.stringify(data)).digest("hex") : undefined;
      const save = async () => {
        // Cập nhật thông báo ở ranh giới hành động/phản hồi; GET/progress vẫn đọc riêng nguồn thông báo.
        if (actionState() !== mergedActionState || !session.activeRequest || session.modelWorkflow?.phase === "done"
          || session.pendingAction?.status === "WAITING_CONFIRMATION") {
          Object.assign(session, await measureCustomerStage("merge_messages", () => merge(session)));
          mergedActionState = actionState();
        }
        if (!session.activeRequest) delete session.modelWorkflow;
        const value: CustomerWorkflowData = { version: CUSTOMER_GRAPH_VERSION, session: structuredClone(session) };
        const digest = createHash("sha256").update(JSON.stringify(value)).digest("hex");
        if (savedDigest === digest) return;
        try {
          await measureCustomerStage("checkpoint_write", () => graph.updateState(config,
            { data: value }, "session"));
          savedDigest = digest;
        } catch (error) { throw new AgentCheckpointError(error); }
      };
      return run(session, save, threadId);
    });
  }

  async send(user: RequestUser, id: string, rawInput: AgentInput) {
    const { sessionId: _sessionId, ...input } = agentRequestSchema.parse({ ...rawInput, sessionId: id });
    return this.withSession(user, id, async (session, checkpoint, threadId) => {
      const signal = AbortSignal.timeout(AGENT_REQUEST_TIMEOUT_MS);
      const digest = createHash("sha256").update(JSON.stringify(input)).digest("hex");
      const receipt = session.receipts.find((item) => item.requestId === input.requestId);
      if (receipt) {
        if (receipt.digest !== digest) throw new AppError("Mã request đã được dùng với dữ liệu khác.", 409);
        return structuredClone(session);
      }
      if (session.modelWorkflow?.waitingForModelRetry
        && (session.activeRequest?.requestId !== input.requestId || session.activeRequest.digest !== digest)) {
        const previous = session.activeRequest;
        // Chỉ thay lượt nhập liệu đang chờ model; xác nhận giao dịch vẫn phải phục hồi đúng request.
        if (!previous || previous.requestId === input.requestId || !("message" in previous.input) || "confirmation" in input
          || session.requiresReconciliation || session.pendingAction
          || session.actions.some((action) => ["EXECUTING", "UNKNOWN"].includes(action.status))) {
          throw new AppError("Lượt trước cần được tiếp tục an toàn. Hãy thử lại đúng yêu cầu đang gián đoạn.", 409);
        }
        session.receipts.push({ requestId: previous.requestId, digest: previous.digest,
          message: "Khách đã chuyển sang yêu cầu mới; không tiếp tục lượt model cũ." });
        session.activeRequest = null;
        delete session.modelWorkflow;
        session.recovery = undefined;
        new MessageRepository().append(session, "tool", "Khách đã gửi yêu cầu mới thay cho lượt phản hồi bị gián đoạn. Ưu tiên yêu cầu mới nhất; không tự tiếp tục ý định cũ hoặc thực hiện lại thao tác đã hoàn tất.", "agent_protocol");
        await checkpoint();
      }
      const dispatcher = new ActionGraphDispatcher(this.deps.registry, this.deps.ledger,
        () => this.deps.assertWriteAccess(threadId), this.deps.config.timeoutMs);
      const loop = new AgentLoop(this.deps.provider, this.deps.registry, this.deps.config, dispatcher, runCustomerModelGraph);
      // Crash có thể xảy ra sau checkpoint kết quả nhưng trước checkpoint receipt.
      const completed = "confirmation" in input && input.confirmation.decision === "CONFIRM"
        && session.activeRequest?.requestId === input.requestId && session.activeRequest.digest === digest
        ? session.actions.find((item) => item.id === input.confirmation.actionId && ["SUCCEEDED", "EXPIRED"].includes(item.status)) : undefined;
      if (completed && !session.requiresReconciliation && !session.pendingAction && completed.tool !== "create_booking" && completed.result !== undefined) {
        const reply = this.deps.registry.get(completed.tool, { user, sessionId: id, session, signal }).reply?.(completed.result);
        if (reply) {
          const last = session.conversation[session.conversation.length - 1];
          if (last?.role !== "assistant" || last.content !== reply.message) loop.reply(session, reply.state, reply.message);
          session.state = reply.state;
          session.activeRequest = null;
          session.receipts.push({ requestId: input.requestId, digest, message: reply.message });
          await checkpoint();
          return structuredClone(session);
        }
      }
      // Sau crash, ledger có thể đã tiến xa hơn checkpoint vẫn còn WAITING_CONFIRMATION.
      // Đọc/đối soát trước để không biến xác nhận cũ thành một lời gọi ghi mới.
      const action = session.pendingAction;
      if (action?.status === "WAITING_CONFIRMATION" && await dispatcher.hasRecord(session, action)) {
        if (session.activeRequest && (session.activeRequest.requestId !== input.requestId || session.activeRequest.digest !== digest)) {
          throw new AppError("Lượt trước bị gián đoạn. Hãy gửi lại đúng request trước để tiếp tục.", 409);
        }
        const finished = await loop.executeActionGraph(session, { user, sessionId: id, session, signal }, action, async () => {});
        // Kết quả có formatter đã đủ để hoàn tất xác nhận riêng; không cần gọi model lần nữa.
        // Xác nhận đặt đơn vẫn đi tiếp luồng thanh toán/đăng ký theo dõi hiện có.
        if (finished && !session.requiresReconciliation && action.tool !== "create_booking"
          && "confirmation" in input && input.confirmation.actionId === action.id) {
          session.receipts.push({ requestId: input.requestId, digest,
            message: session.conversation[session.conversation.length - 1]?.content ?? "" });
          session.activeRequest = null;
          await checkpoint();
          return structuredClone(session);
        }
        await checkpoint();
      }
      const voucherUpdate = "message" in input && input.bookingAction?.type === "update" ? input.bookingAction : undefined;
      if ("message" in input && voucherUpdate?.patch.voucherCode !== undefined
        && voucherUpdate.patch.mode === "update" && Object.keys(voucherUpdate.patch).every((key) => ["mode", "voucherCode"].includes(key))
        && input.customerAttachments === undefined && !session.activeRequest && !session.modelWorkflow && !session.requiresReconciliation
        && session.bookingDraft?.status === "active" && !session.bookingDraft.orderId
        && session.pendingAction?.tool === "create_booking" && session.pendingAction.status === "WAITING_CONFIRMATION"
        && !session.actions.some((item) => ["EXECUTING", "UNKNOWN"].includes(item.status))) {
        const candidate = structuredClone(session);
        new MessageRepository().append(candidate, "user", input.message);
        let prepared = false;
        if (candidate.bookingDraft!.revision !== voucherUpdate.revision) {
          loop.reply(candidate, "WAITING_CONFIRMATION", "Bản nháp đã thay đổi. Vui lòng tải trạng thái mới trước khi chọn lại mã.");
          prepared = true;
        } else {
          candidate.activeRequest = { requestId: input.requestId, digest, input };
          let updated: AgentSession | undefined;
          try {
            updated = (await measureCustomerStage("voucher_request", () => buildBookingDraftGraph({ registry: this.deps.registry,
              context: { user, sessionId: id, session: candidate, signal } }).invoke({ data: {
              session: candidate, patch: voucherUpdate.patch, expectedRevision: voucherUpdate.revision,
            } }, { signal }))).data.session;
          } catch (error) {
            if (error instanceof AgentCheckpointError) throw error;
            // Lỗi nguồn/điều kiện vẫn đi qua xử lý lỗi và phục hồi hiện có của AgentService.
          }
          if (updated?.pendingAction?.status === "WAITING_CONFIRMATION") {
            updated.lastDraftRequest = { requestId: input.requestId, revision: updated.bookingDraft!.revision, taskVersion: updated.taskVersion };
            loop.record(updated, "update_booking_draft", updated.bookingDraft, true);
            loop.reply(updated, "WAITING_CONFIRMATION", "");
            Object.assign(candidate, updated);
            prepared = true;
          }
        }
        if (prepared) {
          // Nhánh này chỉ đọc nghiệp vụ/sửa state trong bộ nhớ: lưu form + receipt nguyên tử một lần.
          candidate.activeRequest = null;
          candidate.receipts.push({ requestId: input.requestId, digest, message: candidate.conversation[candidate.conversation.length - 1]?.content ?? "" });
          Object.assign(session, candidate);
          await checkpoint();
          return structuredClone(session);
        }
      }
      const lockId = randomUUID();
      const service = new AgentService({
        acquire: async (sessionId, userId) => {
          if (sessionId !== id || userId !== user.id) throw new AppError("Không tìm thấy phiên của khách hàng.", 404);
          return { session, lockId };
        },
        save: async (candidate, candidateLock) => {
          if (candidate !== session || candidateLock !== lockId) throw new AppError("Phiên không còn quyền lưu checkpoint.", 409);
          await checkpoint();
        },
        release: async () => { /* Khóa native/fencing được nhả bởi withSession sau khi lưu xong. */ },
      }, loop);
      await service.send(user, id, input, signal);
      return structuredClone(session);
    });
  }

  async requireAttachmentSupport(user: RequestUser, id: string) {
    return this.withSession(user, id, async (session) => { this.checkAttachment(session); });
  }

  private checkAttachment(session: AgentSession) {
    const waitingForModel = session.modelWorkflow?.waitingForModelRetry && session.activeRequest && "message" in session.activeRequest.input
      && !session.pendingAction && !session.actions.some((action) => ["EXECUTING", "UNKNOWN"].includes(action.status));
    if (session.requiresReconciliation || session.activeRequest && !waitingForModel || session.pendingAction && session.pendingAction.tool !== "create_booking") {
      throw new AppError("Vui lòng xử lý yêu cầu đang chờ trước khi tải ảnh.", 409);
    }
    if ((session.uploadedAttachments?.length ?? 0) >= 20) throw new AppError("Cuộc trò chuyện đã đạt giới hạn tải 20 ảnh. Vui lòng bắt đầu tác vụ mới.", 409);
  }

  async registerAttachment(user: RequestUser, id: string, url: string) {
    z.string().url().max(1000).startsWith("https://").parse(url);
    return this.withSession(user, id, async (session, save) => {
      this.checkAttachment(session);
      session.uploadedAttachments = [...new Set([...(session.uploadedAttachments ?? []), url])];
      await save();
      return { url };
    });
  }
}
