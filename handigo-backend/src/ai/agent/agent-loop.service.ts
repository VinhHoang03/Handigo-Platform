import { AppError } from "../../utils/appError";
import { ActionPreconditionError } from "../../utils/actionPreconditionError";
import { ZodError } from "zod";
import { isDeepStrictEqual } from "node:util";
import { withAgentTimeout } from "./timeout";
import type { LLMProvider } from "../llm/llm.interface";
import { MessageRepository } from "../session/message.repository";
import type { AgentTool, ToolContext } from "../tools/tool.interface";
import { ToolRegistry } from "../tools/tool-registry";
import { ToolExecutor } from "../tools/tool-executor";
import { ConfirmationService } from "./confirmation.service";
import type { AgentSession, AgentState, PendingAction } from "./agent-state";
import { readyBookingArguments, parseBookingVoucherRequest } from "./booking-draft";
import { AgentAddressService, type AgentAddressArguments } from "../../services/agentAddress.service";
import { bookingSearchResult, parseBookingHistoryRequest, type AgentBookingSearch } from "./booking-history";
import { bookingActionSchema, isContinueRequest } from "./booking-actions";
import type { ActionGraphRunner } from "../runtime/action-graph-dispatcher";
import { AgentModelWorkflow, type ModelWorkflowRunner } from "./model-workflow";
import { measureCustomerStage } from "../runtime/customer-runtime-metrics";
import { rememberReadSource } from "./read-source-refresh";
import type { TurnPlan } from "./turn-plan";
import { AgentCheckpointError } from "./checkpoint-error";

export const toolError = (error: unknown, tool?: string) => error instanceof ZodError
  ? "Thông tin chưa hợp lệ. Vui lòng kiểm tra và chọn lại."
  : error instanceof AppError && error.statusCode < 500 ? error.message
    : `${({ save_booking_address: "Chưa tra cứu được địa chỉ.", get_available_times: "Chưa kiểm tra được lịch hẹn.",
      search_booking_providers: "Chưa kiểm tra được thợ.", get_booking_vouchers: "Chưa kiểm tra được mã giảm giá.",
      get_booking_quotation: "Chưa tải được báo giá.", get_booking_refunds: "Chưa tra được khoản hoàn.",
      search_my_bookings: "Chưa tải được lịch sử đơn.", get_previous_providers: "Chưa tải được lịch sử thợ." } as Record<string, string>)[tool ?? ""]
      ?? "Chức năng tạm thời không khả dụng."} Vui lòng thử lại.`;

export class AgentLoop {
  private readonly messages = new MessageRepository();
  readonly confirmation = new ConfirmationService();
  constructor(readonly provider: LLMProvider, readonly tools: ToolRegistry,
    readonly config: { maxIterations: number; systemPrompt: string; timeoutMs: number },
    readonly actionGraphs?: ActionGraphRunner,
    readonly modelWorkflowRunner?: ModelWorkflowRunner) { }

  async executeActionGraph(session: AgentSession, context: ToolContext, action: PendingAction, checkpoint: () => Promise<void>) {
    if (!this.actionGraphs) throw new AppError("Phiên chưa được cấu hình graph nghiệp vụ.", 503);
    const result = await measureCustomerStage("action_graph", () => this.actionGraphs!.run(session, context, action));
    Object.assign(action, result.action);
    Object.assign(session, result.session);
    let hasDirectReply = false;
    if (session.requiresReconciliation) {
      this.reply(session, "FAILED", "Chưa xác định được kết quả thao tác. Hệ thống sẽ đối soát trước khi thực hiện thêm thay đổi.");
    } else if (action.result !== undefined) {
      session.collectedInformation[action.tool] = action.result;
      const tool = this.tools.get(action.tool, { ...context, session });
      const reply = tool.reply?.(action.result);
      if (reply) { this.reply(session, reply.state, reply.message); hasDirectReply = true; }
    } else {
      this.reply(session, "WAITING_USER_INPUT", result.preconditionMessage
        ?? "Bản xác nhận không còn phù hợp. Vui lòng kiểm tra và chuẩn bị lại yêu cầu.");
    }
    await checkpoint();
    return session.requiresReconciliation || hasDirectReply || action.result === undefined;
  }

  reply(session: AgentSession, state: AgentState, message: string, bookingSearch?: AgentBookingSearch) {
    session.state = state;
    session.activity = undefined;
    this.messages.append(session, "assistant", message);
    if (bookingSearch) session.conversation[session.conversation.length - 1].bookingSearch = bookingSearch;
    if (state === "WAITING_CONFIRMATION" && session.pendingAction
      && !session.conversation.some((item) => item.confirmationActionId === session.pendingAction!.id)) {
      session.conversation[session.conversation.length - 1].confirmationActionId = session.pendingAction.id;
    }
    return message;
  }

  record(session: AgentSession, tool: string, result: unknown, success: boolean) {
    const content = JSON.stringify(result);
    this.messages.append(session, "tool", content.length <= 16000 ? content
      : JSON.stringify({ error: "Kết quả vượt giới hạn. Hãy thu hẹp truy vấn." }), tool);
    session.progress.push({ tool, status: success ? "SUCCEEDED" : "FAILED", at: new Date().toISOString() });
    if (success) session.collectedInformation[tool] = JSON.parse(session.conversation[session.conversation.length - 1].content);
  }

  async execute(session: AgentSession, context: ToolContext, tool: AgentTool, args: unknown,
    checkpoint: () => Promise<void>, action?: PendingAction, continueAfterRead = false) {
    try {
      args = new ToolExecutor(this.tools).authorize(session, context, tool, args, action);
    } catch (error) {
      if (error instanceof AgentCheckpointError) throw error;
      if (action && session.pendingAction === action && action.status === "WAITING_CONFIRMATION") {
        action.status = "EXPIRED";
        session.actions.push({ ...action });
        session.pendingAction = null;
      }
      this.record(session, tool.name, { error: toolError(error, tool.name) }, false);
      this.reply(session, "WAITING_USER_INPUT", toolError(error, tool.name));
      await checkpoint();
      return true;
    }
    if (action && this.actionGraphs) {
      // Lưu xác nhận và request chuẩn trước khi ledger được phép gọi service ghi.
      await checkpoint();
      return this.executeActionGraph(session, context, action, checkpoint);
    }
    if (tool.mutates && this.actionGraphs) throw new AppError("Thao tác ghi phải đi qua hành động đã xác nhận.", 409);
    session.state = "EXECUTING_TOOL";
    this.activity(session, tool.name === "update_booking_draft" ? "Đang chuẩn bị thông tin đặt lịch"
      : tool.name === "get_available_times" ? "Đang kiểm tra lịch hẹn"
        : tool.name.includes("payment") ? "Đang kiểm tra thanh toán"
          : ["get_service", "search_services", "get_service_catalog"].includes(tool.name) ? "Đang tìm dịch vụ phù hợp"
            : tool.name === "get_addresses" ? "Đang kiểm tra địa chỉ đã lưu" : "Đang xử lý yêu cầu của bạn");
    if (action) { action.status = "EXECUTING"; action.executionStartedAt = new Date().toISOString(); }
    // Ghi nhận ý định trước khi gọi service: request sau tuyệt đối không tự gọi lại khi mất kết quả.
    await checkpoint();
    const signal = AbortSignal.any([context.signal, AbortSignal.timeout(this.config.timeoutMs)]);
    let directReply: ReturnType<NonNullable<AgentTool["reply"]>> | undefined;
    try {
      signal.throwIfAborted();
      const operation = tool.execute({ ...context, session, signal, confirmedPreview: action?.preview,
        actionId: action?.id, actionCreatedAt: action?.executionStartedAt }, args);
      const result = await withAgentTimeout(operation, signal, this.config.timeoutMs);
      if (["update_booking_draft", "rebook_booking"].includes(tool.name) && session.bookingDraft
        && (result as { revision?: number })?.revision === session.bookingDraft.revision && session.activeRequest) {
        session.lastDraftRequest = { requestId: session.activeRequest.requestId, revision: session.bookingDraft.revision, taskVersion: session.taskVersion };
      }
      if (["get_booking", "get_booking_provider", "get_booking_feedback", "submit_booking_feedback", "get_booking_quotation", "get_booking_refunds", "create_booking", "get_payment_status", "create_payment", "cancel_payment"].includes(tool.name)) {
        const order = result as { orderId?: string; orderCode?: string } | null;
        if (order?.orderId && order.orderCode) session.viewedOrder = { orderId: order.orderId, orderCode: order.orderCode };
      }
      if (session.recovery?.tool === tool.name && !(tool.name === "update_booking_draft" && session.bookingDraft?.lookupFailures?.length)) session.recovery = undefined;
      if (tool.name === "save_booking_address" && context.bookingAddressLookup) context.bookingAddressLookup.value = undefined;
      this.record(session, tool.name, result, true);
      if (this.modelWorkflowRunner && !action) rememberReadSource(session, tool, args);
      if (action) { action.status = "SUCCEEDED"; action.result = result; }
      if (tool.name === "create_booking" && session.bookingDraft) {
        session.draftBackup = undefined;
        session.rebookProposal = undefined;
        session.bookingDraft.status = "booked";
        session.bookingDraft.draftAddress = undefined;
        if (result && typeof result === "object" && "orderId" in result && typeof result.orderId === "string") session.bookingDraft.orderId = result.orderId;
      }
      directReply = continueAfterRead && ["get_booking_quotation", "get_booking_refunds"].includes(tool.name) ? undefined : tool.reply?.(result);
      if (action && directReply?.retryable) action.status = "EXPIRED";
    } catch (error) {
      if (error instanceof AgentCheckpointError) throw error;
      if (error instanceof ActionPreconditionError) {
        if (action) action.status = "EXPIRED";
        this.record(session, tool.name, { error: error.message }, false);
      } else if (tool.mutates) {
        if (action) action.status = "UNKNOWN";
        session.requiresReconciliation = true;
        this.record(session, tool.name, { error: "Kết quả ghi chưa xác định; cần đối soát trước khi thực hiện lại." }, false);
        this.reply(session, "FAILED", "Chưa xác định được kết quả thao tác. Vui lòng kiểm tra đơn hoặc yêu cầu trong Hỗ trợ của tôi trước khi thực hiện lại.");
      } else {
        this.record(session, tool.name, { error: toolError(error, tool.name) }, false);
        if (!(error instanceof ZodError) && !(error instanceof AppError && error.statusCode < 500)) {
          session.recovery = { tool: tool.name, arguments: args, taskVersion: session.taskVersion, revision: session.bookingDraft?.revision,
            ...(context.replaceBookingDraft && tool.name === "rebook_booking" ? { replaceDraft: true } : {}) };
        }
      }
    }
    if (action) {
      session.actions.push({ ...action });
      session.pendingAction = null;
    }
    if (directReply) this.reply(session, directReply.state, directReply.message);
    await checkpoint();
    return Boolean(directReply) || session.requiresReconciliation;
  }

  async run(session: AgentSession, context: ToolContext, checkpoint: () => Promise<void>) {
    const workflow = new AgentModelWorkflow(this, session, context, checkpoint, Boolean(this.modelWorkflowRunner));
    return this.modelWorkflowRunner ? this.modelWorkflowRunner(workflow) : workflow.runLegacy();
  }

  appendProtocol(session: AgentSession, content: string, tool = "agent_protocol") {
    this.messages.append(session, "tool", content, tool);
  }

  async prepareTurn(session: AgentSession, context: ToolContext, checkpoint: () => Promise<void>): Promise<string | null> {
    const plan = this.planTurn(session, context);
    if (typeof plan === "string" || plan === null) return plan;
    return this.executeTurnPlan(session, context, checkpoint, plan);
  }

  planTurn(session: AgentSession, context: ToolContext): string | TurnPlan | null {
    context.bookingAddressLookup = {};
    const latestMessage = [...session.conversation].reverse().find((item) => item.role === "user")?.content ?? "";
    const input = session.activeRequest?.input;
    if (session.activeRequest && session.lastDraftRequest?.requestId === session.activeRequest.requestId
      && session.lastDraftRequest.revision === session.bookingDraft?.revision && session.lastDraftRequest.taskVersion === session.taskVersion) {
      return { kind: "draft", fallback: "Đã giữ thay đổi của bản nháp. Bạn có thể tiếp tục từ thông tin hiện tại." };
    }
    let historyRequest = parseBookingHistoryRequest(latestMessage, session);
    if (!historyRequest && !(input && "message" in input && input.bookingAction) && session.viewedOrder
      && session.bookingDraft && ["active", "paused", "booked"].includes(session.bookingDraft.status)
      && session.bookingDraft.orderId !== session.viewedOrder.orderId
      && /đơn (?:này|đó)/i.test(latestMessage) && /(?:báo giá|hoàn tiền|thanh toán|hủy đơn|thợ|vị trí|đánh giá|liên hệ|nhắn tin|gọi)/i.test(latestMessage)
      && !/bản nháp|[a-f\d]{24}/i.test(latestMessage)) {
      return this.reply(session, "WAITING_USER_INPUT", `Bạn muốn xử lý đơn ${session.viewedOrder.orderCode} hay ${session.bookingDraft.orderId ? "đơn đã đặt trước đó" : "bản nháp đang soạn"}?`);
    }
    if (input && "message" in input && input.bookingAction) {
      const action = bookingActionSchema.parse(input.bookingAction);
      session.recovery = undefined;
      if (action.type === "update") {
        const draft = session.bookingDraft;
        if (!draft || !["active", "paused"].includes(draft.status) || draft.orderId || draft.revision !== action.revision) {
          return this.reply(session, "WAITING_USER_INPUT", "Bản nháp đã thay đổi hoặc không còn chỉnh sửa được. Hãy tải trạng thái mới trước khi chọn lại.");
        }
        historyRequest = { tool: "update_booking_draft", args: action.patch };
      } else if (action.type === "rebook_decision") {
        const proposal = session.rebookProposal;
        if (!proposal || proposal.id !== action.proposalId || proposal.revision !== session.bookingDraft?.revision || proposal.taskVersion !== session.taskVersion) {
          session.rebookProposal = undefined;
          return this.reply(session, "WAITING_USER_INPUT", "Bản nháp đã thay đổi. Hãy chọn lại đơn cũ nếu vẫn muốn chuyển sang đặt lại.");
        }
        if (!action.accept) {
          session.rebookProposal = undefined;
          return { kind: "draft", fallback: "Đã giữ bản nháp đang soạn." };
        }
        context.replaceBookingDraft = true;
        historyRequest = { tool: "rebook_booking", args: proposal.arguments };
      } else if (action.type === "provider" || action.type === "feedback") {
        historyRequest = action.type === "provider" ? { tool: "get_booking_provider", args: { orderId: action.orderId } }
          : { tool: "submit_booking_feedback", args: action.feedback };
      } else {
        const backup = session.draftBackup;
        if (!backup || backup.id !== action.backupId || session.bookingDraft?.orderId || session.bookingDraft?.status === "booked") {
          return this.reply(session, "WAITING_USER_INPUT", "Không còn bản nháp có thể khôi phục. Nếu đã tạo đơn, hãy mở chi tiết đơn để xử lý.");
        }
        try {
          const update = this.tools.get("update_booking_draft", context);
          if (this.tools.needsConfirmation(update)) return this.reply(session, "WAITING_USER_INPUT", "Cần xác nhận trước khi khôi phục bản nháp.");
        } catch (error) {
          if (error instanceof AgentCheckpointError) throw error;
          return this.reply(session, "WAITING_USER_INPUT", toolError(error));
        }
        session.bookingDraft = { ...backup.draft, revision: (session.bookingDraft?.revision ?? 0) + 1, status: "active" };
        session.draftBackup = undefined;
        session.rebookProposal = undefined;
        session.taskVersion += 1;
        historyRequest = { tool: "update_booking_draft", args: { mode: "resume" } };
      }
    } else if (isContinueRequest(latestMessage) && session.recovery) {
      const recovery = session.recovery;
      if (recovery.taskVersion !== session.taskVersion || recovery.revision !== session.bookingDraft?.revision) {
        session.recovery = undefined;
        return this.reply(session, "WAITING_USER_INPUT", "Thông tin đã thay đổi sau bước lỗi. Hãy chọn lại thao tác trên bản nháp hoặc đơn hiện tại.");
      }
      if (recovery.stage === "preview") return { kind: "draft", fallback: "Bản nháp chưa đủ thông tin để xác nhận." };
      if (recovery.stage === "address") {
        try {
          const tool = this.tools.get("save_booking_address", context);
          return { kind: "address", args: tool.inputSchema.parse(recovery.arguments) };
        } catch (error) {
          if (error instanceof AgentCheckpointError) throw error;
          return this.reply(session, "WAITING_USER_INPUT", toolError(error));
        }
      }
      try {
        const retryTool = this.tools.get(recovery.tool, context);
        if (retryTool.mutates || this.tools.needsConfirmation(retryTool)) return this.reply(session, "WAITING_USER_INPUT", "Thao tác này cần kiểm tra kết quả và xác nhận mới trước khi thực hiện; chưa chạy lại.");
        historyRequest = { tool: retryTool.name, args: recovery.arguments };
        if (recovery.replaceDraft && retryTool.name === "rebook_booking") context.replaceBookingDraft = true;
      } catch (error) {
        if (error instanceof AgentCheckpointError) throw error;
        return this.reply(session, "WAITING_USER_INPUT", toolError(error));
      }
    } else if (!isContinueRequest(latestMessage)) session.recovery = undefined;
    if (historyRequest) {
      if ("error" in historyRequest) return this.reply(session, "WAITING_USER_INPUT", historyRequest.error);
      return { kind: "history", tool: historyRequest.tool, args: historyRequest.args,
        ...(context.replaceBookingDraft ? { replaceDraft: true } : {}) };
    }
    return this.planVoucherTurn(session, context);
  }

  async executeTurnPlan(session: AgentSession, context: ToolContext, checkpoint: () => Promise<void>, plan: TurnPlan): Promise<string | null> {
    if (plan.kind === "draft") return await this.prepareBookingDraft(session, context, checkpoint)
      ?? this.reply(session, "WAITING_USER_INPUT", plan.fallback);
    if (plan.kind === "address") {
      const tool = this.tools.get("save_booking_address", context);
      return this.applyBookingAddress(session, context, tool, tool.inputSchema.parse(plan.args), checkpoint);
    }
    if (plan.kind === "voucher") return this.executeVoucherTurn(session, context, checkpoint, plan.args);
    if (plan.replaceDraft) context.replaceBookingDraft = true;
    if (session.activeRequest && session.lastDraftRequest?.requestId === session.activeRequest.requestId
      && session.lastDraftRequest.revision === session.bookingDraft?.revision && session.lastDraftRequest.taskVersion === session.taskVersion) {
      return await this.prepareBookingDraft(session, context, checkpoint)
        ?? this.reply(session, "WAITING_USER_INPUT", "Đã giữ thay đổi của bản nháp. Bạn có thể tiếp tục từ thông tin hiện tại.");
    }
    const historyRequest = { tool: plan.tool, args: plan.args };
    try {
      const tool = this.tools.get(historyRequest.tool, context);
      const args = tool.inputSchema.parse(historyRequest.args);
      this.messages.append(session, "tool", JSON.stringify({ event: "TOOL_CALL", arguments: args }), tool.name);
      if (this.tools.needsConfirmation(tool)) {
        session.pendingAction = await this.confirmation.prepare(tool, context, args);
        session.pendingAction.taskVersion = session.taskVersion;
        return this.reply(session, "WAITING_CONFIRMATION", "Vui lòng kiểm tra thông tin bên dưới trước khi xác nhận.");
      }
      if (await this.execute(session, context, tool, args, checkpoint)) return session.conversation[session.conversation.length - 1].content;
      if (session.progress[session.progress.length - 1]?.status !== "SUCCEEDED") {
        const last = session.conversation[session.conversation.length - 1];
        const failure = last?.role === "tool" ? JSON.parse(last.content) as { error?: string } : undefined;
        return this.reply(session, session.recovery ? "FAILED" : "WAITING_USER_INPUT", failure?.error ?? "Chưa thể xử lý đơn đã chọn. Vui lòng thử lại.");
      }
      if (tool.name === "search_my_bookings" || tool.name === "get_previous_providers") {
        const result = bookingSearchResult(session, args, tool.name);
        if (tool.name === "get_previous_providers") return this.reply(session, "WAITING_USER_INPUT", result
          ? result.items.length ? "Chọn thợ từng phục vụ bên dưới."
            : "Chưa tìm thấy thợ từng phục vụ phù hợp. Bạn có thể để hệ thống tìm thợ."
          : "Kết quả lịch sử quá dài. Hãy thu hẹp dịch vụ hoặc thời gian cần tìm.", result);
        return this.reply(session, "WAITING_USER_INPUT", result
          ? result.items.length ? "Chọn thao tác trên đơn bạn muốn xử lý bên dưới." : "Không tìm thấy đơn phù hợp. Bạn có thể đổi tiêu chí hoặc tìm tất cả đơn."
          : "Kết quả tìm kiếm quá dài. Hãy thu hẹp tiêu chí để tìm đúng đơn.", result);
      }
      if (tool.name === "rebook_booking" || tool.name === "update_booking_draft") return await this.prepareBookingDraft(session, context, checkpoint)
        ?? this.reply(session, "WAITING_USER_INPUT", session.bookingDraft?.status === "paused" ? "Đã tạm dừng bản nháp."
          : session.bookingDraft?.status === "discarded" ? "Đã bỏ bản nháp." : "Vui lòng chọn lịch mới để đặt lại.");
      if (!context.readOnly && session.bookingDraft?.status === "active") session.bookingDraft.status = "paused";
    } catch (error) {
      if (error instanceof AgentCheckpointError) throw error;
      return this.reply(session, "WAITING_USER_INPUT", toolError(error));
    }
    const voucher = this.planVoucherTurn(session, context);
    return typeof voucher === "string" || voucher === null ? voucher : this.executeTurnPlan(session, context, checkpoint, voucher);
  }

  planVoucherTurn(session: AgentSession, context: ToolContext): string | TurnPlan | null {
    const latestMessage = [...session.conversation].reverse().find((message) => message.role === "user")?.content ?? "";
    const voucherRequest = parseBookingVoucherRequest(latestMessage);
    if (voucherRequest) {
      if (!session.bookingDraft?.values.serviceId || session.bookingDraft.status === "discarded") {
        return this.reply(session, "WAITING_USER_INPUT", "Bạn muốn áp mã cho dịch vụ nào?");
      }
      if (session.bookingDraft.status === "booked" || session.bookingDraft.orderId) {
        return this.reply(session, "WAITING_USER_INPUT", "Đơn đã được tạo, chưa áp thêm mã. Vui lòng kiểm tra trong chi tiết đơn.");
      }
      let update: AgentTool;
      let args: unknown;
      try {
        update = this.tools.get("update_booking_draft", context);
        args = update.inputSchema.parse({ mode: "update", ...voucherRequest });
      } catch (error) {
        if (error instanceof AgentCheckpointError) throw error;
        return this.reply(session, "WAITING_USER_INPUT", toolError(error));
      }
      return { kind: "voucher", args };
    }
    return null;
  }

  private async executeVoucherTurn(session: AgentSession, context: ToolContext, checkpoint: () => Promise<void>, args: unknown): Promise<string> {
    const update = this.tools.get("update_booking_draft", context);
    if (session.activeRequest && session.lastDraftRequest?.requestId === session.activeRequest.requestId
      && session.lastDraftRequest.revision === session.bookingDraft?.revision && session.lastDraftRequest.taskVersion === session.taskVersion) {
      return await this.prepareBookingDraft(session, context, checkpoint)
        ?? this.reply(session, "WAITING_USER_INPUT", "Vui lòng hoàn thiện thông tin đặt dịch vụ để kiểm tra mã giảm giá.");
    }
    if (await this.execute(session, context, update, args, checkpoint)) return session.conversation[session.conversation.length - 1].content;
    if (session.progress[session.progress.length - 1]?.status !== "SUCCEEDED") {
      return this.reply(session, "WAITING_USER_INPUT", "Chưa kiểm tra được mã giảm giá cho đơn này. Vui lòng thử lại; thông tin đặt dịch vụ vẫn được giữ.");
    }
    return await this.prepareBookingDraft(session, context, checkpoint)
      ?? this.reply(session, "WAITING_USER_INPUT", "Vui lòng hoàn thiện thông tin đặt dịch vụ để kiểm tra mã giảm giá.");
  }

  async prepareBookingDraft(session: AgentSession, context: ToolContext, checkpoint: () => Promise<void>): Promise<string | null> {
    const draft = session.bookingDraft;
    if (!draft || draft.status !== "active") return null;
    const bookingArgs = readyBookingArguments(draft);
    if (!bookingArgs) {
      if (draft.addressPreference && !draft.values.addressId) {
        const addressText = draft.addressPreference;
        const normalized = addressText.toLocaleLowerCase("vi-VN").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        // Địa chỉ có khu vực rõ ràng được tra ngay, tránh một lượt LLM tự đòi số nhà.
        if (/[,;\n]/.test(addressText) || /\b(?:phuong|xa|thanh pho|tinh|tp)\b/.test(normalized)) {
          let saveAddress: AgentTool;
          try { saveAddress = this.tools.get("save_booking_address", context); }
          catch { return null; }
          let args: unknown;
          try {
            args = saveAddress.inputSchema.parse({ addressText, useForBooking: true });
          } catch (error) {
      if (error instanceof AgentCheckpointError) throw error;
            this.record(session, "save_booking_address", { error: toolError(error) }, false);
            return this.reply(session, "WAITING_USER_INPUT", toolError(error));
          }
          return this.applyBookingAddress(session, context, saveAddress, args, checkpoint);
        }
        return null;
      }
      let previousSummary: string[] = [];
      for (const item of [...session.conversation].reverse()) {
        if (item.role !== "tool" || item.tool !== "update_booking_draft") continue;
        try {
          const previous = JSON.parse(item.content);
          if (!previous.revision || previous.revision >= draft.revision || previous.status !== "active") continue;
          previousSummary = Array.isArray(previous.summary) ? previous.summary : [];
          break;
        } catch { /* Bỏ qua kết quả công cụ không phải bản nháp. */ }
      }
      const changed = draft.summary.filter((line) => !previousSummary.includes(line)
        && !/^(?:Dịch vụ|Số lượng|Địa chỉ|Thời gian|Thanh toán|Ảnh hiện trạng|Chuyên gia ưu tiên):/.test(line));
      const represented = draft.choiceGroups.map((group) => group.label);
      const missing = draft.missing.filter((item) => !represented.some((label) => item.toLocaleLowerCase("vi-VN").includes(label.toLocaleLowerCase("vi-VN"))));
      const message = this.reply(session, "WAITING_USER_INPUT", [
        ...changed,
        ...(draft.voucherFeedback ? [draft.voucherFeedback] : []),
        missing.length ? `Cần bổ sung: ${missing.join("; ")}.` : "Chọn thông tin còn thiếu bên dưới để tiếp tục.",
      ].join("\n"));
      session.conversation[session.conversation.length - 1].choiceGroups = draft.choiceGroups.length ? draft.choiceGroups : undefined;
      return message;
    }
    try {
      const create = this.tools.get("create_booking", context);
      const previous = [...session.actions].reverse().find((action) => action.tool === "create_booking"
        && action.taskVersion === session.taskVersion && isDeepStrictEqual(action.arguments, bookingArgs)
        && ["SUCCEEDED", "REJECTED", "UNKNOWN"].includes(action.status));
      if (previous) {
        return this.reply(session, "WAITING_USER_INPUT", previous.status === "SUCCEEDED"
          ? "Đơn đã được tạo. Bạn có thể xem đơn hoặc kiểm tra thanh toán."
          : previous.status === "REJECTED" ? "Bạn đã từ chối bản đặt lịch này. Hãy cho biết thông tin cần thay đổi."
            : "Kết quả tạo đơn trước chưa xác định. Cần kiểm tra đơn trước khi thực hiện lại.");
      }
      this.activity(session, "Đang kiểm tra giá và chuẩn bị bản xác nhận");
      await checkpoint();
      session.pendingAction = await this.confirmation.prepare(create, context, bookingArgs);
      session.recovery = undefined;
      session.pendingAction.taskVersion = session.taskVersion;
      const feedback = draft.voucherFeedback;
      const message = this.reply(session, "WAITING_CONFIRMATION", feedback
        && !/^Có \d+ mã giảm giá dùng được/.test(feedback) && !feedback.startsWith("Đã bỏ mã giảm giá.") ? feedback : "");
      session.conversation[session.conversation.length - 1].choiceGroups = draft.choiceGroups.length ? draft.choiceGroups : undefined;
      return message;
    } catch (error) {
      if (error instanceof AgentCheckpointError) throw error;
      this.record(session, "create_booking", { error: toolError(error) }, false);
      session.recovery = { tool: "create_booking", arguments: bookingArgs, taskVersion: session.taskVersion, revision: draft.revision, stage: "preview" };
      return this.reply(session, "WAITING_USER_INPUT", toolError(error));
    }
  }

  async applyBookingAddress(session: AgentSession, context: ToolContext, tool: AgentTool, args: unknown,
    checkpoint: () => Promise<void>): Promise<string> {
    this.activity(session, "Đang nhận diện và cập nhật địa chỉ đặt dịch vụ");
    await checkpoint();
    let update: AgentTool;
    try {
      update = this.tools.get("update_booking_draft", context);
      const staged = await AgentAddressService.stage(context.user.id, args as AgentAddressArguments);
      const draft = session.bookingDraft!;
      draft.draftAddress = staged.draftAddress;
      draft.values.addressId = staged.addressId;
      draft.sources.addressId = "customer";
      draft.addressPreference = undefined;
      draft.status = "active";
      this.record(session, tool.name, { addressId: staged.addressId, saved: false,
        message: draft.values.saveAddressToBook === false ? "Đã chọn địa chỉ dùng một lần cho bản nháp, không thêm vào sổ địa chỉ."
          : "Đã chọn địa chỉ cho bản nháp. Địa chỉ mới chỉ được lưu khi đặt đơn thành công." }, true);
    } catch (error) {
      if (error instanceof AgentCheckpointError) throw error;
      this.record(session, tool.name, { error: toolError(error, tool.name) }, false);
      session.recovery = { tool: tool.name, arguments: args, taskVersion: session.taskVersion, revision: session.bookingDraft?.revision, stage: "address" };
      return this.reply(session, "WAITING_USER_INPUT", toolError(error, tool.name));
    }
    if (await this.execute(session, context, update, update.inputSchema.parse({ mode: "resume" }), checkpoint)) {
      return session.conversation[session.conversation.length - 1].content;
    }
    if (session.progress[session.progress.length - 1]?.status !== "SUCCEEDED") {
      return this.reply(session, "WAITING_USER_INPUT", "Địa chỉ đang được giữ trong bản nháp. Chưa kiểm tra lại được thông tin đặt dịch vụ; vui lòng thử lại.");
    }
    return await this.prepareBookingDraft(session, context, checkpoint)
      ?? this.reply(session, "WAITING_USER_INPUT", "Đã cập nhật địa chỉ cho bản nháp. Vui lòng bổ sung thông tin còn thiếu để tiếp tục.");
  }

  activity(session: AgentSession, message: string) {
    session.activity = { requestId: session.activeRequest?.requestId ?? "", message, updatedAt: new Date().toISOString() };
  }
}
