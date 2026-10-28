import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ConfirmationService } from "../agent/confirmation.service";
import type { AgentSession, PendingAction } from "../agent/agent-state";
import { withAgentTimeout } from "../agent/timeout";
import { ToolExecutor } from "../tools/tool-executor";
import type { ToolRegistry } from "../tools/tool-registry";
import type { AgentTool, ToolContext } from "../tools/tool.interface";
import { AppError } from "../../utils/appError";
import { ActionPreconditionError } from "../../utils/actionPreconditionError";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { actionIdentity, type ActionDomain, type ActionLedger, type ActionRecord } from "../runtime/action-ledger";

export interface ConfirmedActionData {
  session: AgentSession;
  action: PendingAction;
  record?: ActionRecord;
  executionPermit?: string;
  preconditionMessage?: string;
}
const ActionState = Annotation.Root({ data: Annotation<ConfirmedActionData> });
export interface ConfirmedActionDependencies {
  registry: ToolRegistry;
  ledger: ActionLedger;
  context: ToolContext;
  // Host phải kiểm tra/gia hạn lease hiện tại; không lấy callback này từ client hoặc model.
  assertWriteAccess: () => Promise<void>;
  timeoutMs?: number;
  reconcilers?: Readonly<Record<string, NonNullable<AgentTool["reconcile"]>>>;
}

export function buildConfirmedActionGraph(domain: ActionDomain, allowedTools: readonly string[], deps: ConfirmedActionDependencies) {
  const confirmation = new ConfirmationService();
  const executor = new ToolExecutor(deps.registry);
  const timeoutMs = deps.timeoutMs ?? 20000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new Error("Thời hạn thao tác không hợp lệ.");
  // Quyền gọi ghi chỉ tồn tại trong lần chạy này, không tuần tự hóa vào checkpoint.
  const permits = new Set<string>();
  const getContext = (data: ConfirmedActionData): ToolContext => ({ ...deps.context, session: data.session,
    actionId: data.action.id, confirmedPreview: data.action.preview, actionCreatedAt: data.record?.startedAt });
  const identity = (data: ConfirmedActionData) => actionIdentity(data.session.userId, data.session.id, domain, data.action);

  return new StateGraph(ActionState)
    .addNode("validate", async ({ data: previous }) => {
      const data = structuredClone(previous);
      delete data.executionPermit;
      delete data.preconditionMessage;
      const { session, action } = data;
      if (deps.context.user.role !== "CUSTOMER" || deps.context.user.id !== session.userId
        || deps.context.sessionId !== session.id || !allowedTools.includes(action.tool)) {
        throw new AppError("Không có quyền thực hiện hành động trong phiên này.", 403);
      }
      deps.context.signal.throwIfAborted();
      await deps.assertWriteAccess();
      if ([...session.actions, ...(session.pendingAction ? [session.pendingAction] : [])]
        .some((item) => item.id !== action.id && ["EXECUTING", "UNKNOWN"].includes(item.status))) {
        throw new AppError("Cần đối soát hành động trước trước khi xử lý xác nhận khác.", 409);
      }
      // Quyền đọc/đối soát vẫn kiểm tra registry; cờ readOnly không được dùng để bắt đầu ghi.
      const tool = deps.registry.get(action.tool, { ...getContext(data), readOnly: false });
      if (!tool.mutates || !tool.preview) throw new AppError("Graph chỉ nhận thao tác ghi có bản xem trước.", 409);
      tool.inputSchema.parse(action.arguments);
      data.record = await deps.ledger.find(identity(data)) ?? undefined;
      if (!data.record) {
        if (deps.context.readOnly || session.requiresReconciliation) throw new AppError("Cần đối soát thao tác trước khi ghi tiếp.", 409);
        // Giữ đúng tham chiếu pendingAction mà executor hiện tại yêu cầu.
        if (!isDeepStrictEqual(session.pendingAction, action)) throw new AppError("Bản xác nhận không còn thuộc phiên hiện tại.", 409);
        data.action = session.pendingAction!;
        executor.authorize(session, getContext(data), tool, action.arguments, data.action);
        if (!(await confirmation.unchanged(tool, getContext(data), data.action))) throw new ActionPreconditionError();
      }
      return { data };
    })
    .addNode("reserve", async ({ data: previous }) => {
      const data = structuredClone(previous);
      deps.context.signal.throwIfAborted();
      const reservation = await deps.ledger.reserve(identity(data));
      data.record = reservation.record;
      if (reservation.inserted) {
        data.executionPermit = randomUUID();
        permits.add(data.executionPermit);
      }
      return { data };
    })
    .addNode("execute", async ({ data: previous }) => {
      const data = structuredClone(previous);
      if (!data.executionPermit || !permits.delete(data.executionPermit) || data.record?.status !== "EXECUTING") {
        throw new AppError("Chưa có quyền thực thi hành động mới.", 409);
      }
      delete data.executionPermit;
      const context = getContext(data);
      const tool = deps.registry.get(data.action.tool, context);
      let result: unknown;
      try {
        deps.context.signal.throwIfAborted();
        // Kiểm tra lại hạn xác nhận và preview sát lúc ghi, sau khi đã giành slot chống đồng thời.
        data.session.pendingAction = data.action;
        const args = executor.authorize(data.session, context, tool, data.action.arguments, data.action);
        if (!(await confirmation.unchanged(tool, context, data.action))) throw new ActionPreconditionError();
        await deps.assertWriteAccess();
        const signal = AbortSignal.any([deps.context.signal, AbortSignal.timeout(timeoutMs)]);
        result = await withAgentTimeout(tool.execute({ ...context, signal }, args), signal, timeoutMs);
        const serialized = JSON.stringify(result);
        if (!serialized || Buffer.byteLength(serialized, "utf8") > 128000) throw new Error("Kết quả thao tác không thể lưu đối soát.");
        result = JSON.parse(serialized);
      } catch (error) {
        if (error instanceof ActionPreconditionError) data.preconditionMessage = error.message;
        data.record = await deps.ledger.settle(identity(data), error instanceof ActionPreconditionError ? "EXPIRED" : "UNKNOWN");
        return { data };
      }
      // Lưu lỗi ở đây phải thoát ra ngoài; không đổi kết quả ghi thành thất bại có thể tự chạy lại.
      data.record = await deps.ledger.settle(identity(data), tool.reply?.(result)?.retryable ? "EXPIRED" : "SUCCEEDED", result);
      return { data };
    })
    .addNode("reconcile", async ({ data: previous }) => {
      const data = structuredClone(previous);
      if (!data.record || ["SUCCEEDED", "EXPIRED"].includes(data.record.status)) return { data };
      const context = getContext(data);
      const tool = deps.registry.get(data.action.tool, { ...context, readOnly: false });
      const reconcile = deps.reconcilers?.[tool.name] ?? tool.reconcile;
      if (!reconcile) return { data };
      let result: unknown;
      try {
        deps.context.signal.throwIfAborted();
        result = await withAgentTimeout(reconcile(context, tool.inputSchema.parse(data.action.arguments)), deps.context.signal, timeoutMs);
      } catch { return { data }; }
      // Không tìm thấy hoặc nguồn lỗi không chứng minh rằng thao tác chưa ghi.
      if (result !== null && result !== undefined) {
        const serialized = JSON.stringify(result);
        if (!serialized || Buffer.byteLength(serialized, "utf8") > 128000) return { data };
        data.record = await deps.ledger.settle(identity(data), "SUCCEEDED", JSON.parse(serialized));
      }
      return { data };
    })
    .addNode("project", ({ data: previous }) => {
      const data = structuredClone(previous);
      const record = data.record!;
      data.action.status = record.status;
      data.action.executionStartedAt = record.startedAt;
      if (record.result !== undefined) data.action.result = record.result;
      const unresolved = record.status === "EXECUTING" || record.status === "UNKNOWN";
      data.session.requiresReconciliation = unresolved;
      data.session.state = unresolved ? "FAILED" : "WAITING_USER_INPUT";
      data.session.pendingAction = unresolved ? data.action : null;
      data.session.actions = data.session.actions.filter((item) => item.id !== data.action.id);
      if (!unresolved) data.session.actions.push(data.action);
      if (record.result !== undefined) {
        const result = record.result as { orderId?: string; orderCode?: string } | null;
        if (result?.orderId && result.orderCode) data.session.viewedOrder = { orderId: result.orderId, orderCode: result.orderCode };
        if (record.status === "SUCCEEDED" && data.action.tool === "create_booking" && data.session.bookingDraft) {
          data.session.bookingDraft.status = "booked";
          data.session.bookingDraft.orderId = result?.orderId;
          data.session.bookingDraft.draftAddress = undefined;
          data.session.draftBackup = undefined;
          data.session.rebookProposal = undefined;
        }
        const address = record.result as { addressId?: string } | null;
        if (record.status === "SUCCEEDED" && data.action.tool === "save_booking_address"
          && (data.action.arguments as { useForBooking?: boolean })?.useForBooking
          && address?.addressId && data.session.bookingDraft
          && ["active", "paused"].includes(data.session.bookingDraft.status)) {
          data.session.bookingDraft.values.addressId = address.addressId;
          data.session.bookingDraft.sources.addressId = "customer";
          data.session.bookingDraft.addressPreference = undefined;
          data.session.bookingDraft.status = "active";
        }
        const toolId = `action:${data.action.id}:tool`;
        if (!data.session.conversation.some((item) => item.id === toolId)) {
          data.session.conversation.push({ id: toolId, role: "tool", tool: data.action.tool,
            content: JSON.stringify(record.result), createdAt: record.startedAt });
          data.session.progress.push({ tool: data.action.tool, status: "SUCCEEDED", at: record.startedAt });
        }
      }
      return { data };
    })
    .addEdge(START, "validate")
    .addConditionalEdges("validate", ({ data }) => data.record ? "reconcile" : "reserve", ["reconcile", "reserve"])
    .addConditionalEdges("reserve", ({ data }) => data.executionPermit ? "execute" : "reconcile", ["execute", "reconcile"])
    .addEdge("execute", "project")
    .addEdge("reconcile", "project")
    .addEdge("project", END)
    // Graph con chạy lại từ đầu qua ledger khi node cha được tiếp tục; không resume trực tiếp node ghi.
    .compile({ checkpointer: false });
}

export async function prepareDomainAction(domain: ActionDomain, allowedTools: readonly string[], deps: ConfirmedActionDependencies,
  session: AgentSession, toolName: string, args: unknown) {
  if (deps.context.user.role !== "CUSTOMER" || deps.context.user.id !== session.userId
    || deps.context.sessionId !== session.id || session.requiresReconciliation || !allowedTools.includes(toolName)
    || session.pendingAction) throw new AppError("Chưa thể chuẩn bị hành động mới trong phiên này.", 409);
  const context = { ...deps.context, session };
  const tool = deps.registry.get(toolName, context);
  if (!tool.mutates || !tool.preview) throw new AppError("Hành động phải có bản xem trước trước khi xác nhận.", 409);
  const action = await new ConfirmationService().prepare(tool, context, tool.inputSchema.parse(args));
  action.taskVersion = session.taskVersion;
  return action;
}
