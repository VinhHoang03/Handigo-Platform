import { AppError } from "../../utils/appError";
import { ActionPreconditionError } from "../../utils/actionPreconditionError";
import { ZodError } from "zod";
import { isDeepStrictEqual } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { withAgentTimeout } from "./timeout";
import { llmResponseSchema, type LLMProvider } from "../llm/llm.interface";
import { ProviderHttpError } from "../llm/providers/provider-http";
import { MessageRepository } from "../session/message.repository";
import type { AgentTool, ToolContext } from "../tools/tool.interface";
import { ToolRegistry } from "../tools/tool-registry";
import { ConfirmationService } from "./confirmation.service";
import type { AgentSession, AgentState, PendingAction } from "./agent-state";
import { readyBookingArguments, isAirConditionerRepair, isGeneralRepairBookingRequest, parseBookingVoucherRequest, type DraftService } from "./booking-draft";
import { agentContext, compactAgentContext } from "./agent-context";
import { selectToolGroup, toolGroupSchema, TOOL_ROUTING_PROMPT, type ToolIntent } from "../tools/tool-groups";
import { AgentAddressService, type AgentAddressArguments } from "../../services/agentAddress.service";
import { bookingSearchResult, parseBookingHistoryRequest, type AgentBookingSearch } from "./booking-history";
import { bookingActionSchema, isContinueRequest } from "./booking-actions";

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
  constructor(private readonly provider: LLMProvider, readonly tools: ToolRegistry,
    private readonly config: { maxIterations: number; systemPrompt: string; timeoutMs: number }) { }

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

  private record(session: AgentSession, tool: string, result: unknown, success: boolean) {
    const content = JSON.stringify(result);
    this.messages.append(session, "tool", content.length <= 16000 ? content
      : JSON.stringify({ error: "Kết quả vượt giới hạn. Hãy thu hẹp truy vấn." }), tool);
    session.progress.push({ tool, status: success ? "SUCCEEDED" : "FAILED", at: new Date().toISOString() });
    if (success) session.collectedInformation[tool] = JSON.parse(session.conversation[session.conversation.length - 1].content);
  }

  async execute(session: AgentSession, context: ToolContext, tool: AgentTool, args: unknown,
    checkpoint: () => Promise<void>, action?: PendingAction, continueAfterRead = false) {
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
      const operation = tool.execute({ ...context, session, signal, confirmedPreview: action?.preview, actionId: action?.id }, args);
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
    context.bookingAddressLookup = {};
    const latestMessage = [...session.conversation].reverse().find((item) => item.role === "user")?.content ?? "";
    const input = session.activeRequest?.input;
    if (session.activeRequest && session.lastDraftRequest?.requestId === session.activeRequest.requestId
      && session.lastDraftRequest.revision === session.bookingDraft?.revision && session.lastDraftRequest.taskVersion === session.taskVersion) {
      return await this.prepareBookingDraft(session, context, checkpoint)
        ?? this.reply(session, "WAITING_USER_INPUT", "Đã giữ thay đổi của bản nháp. Bạn có thể tiếp tục từ thông tin hiện tại.");
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
          return await this.prepareBookingDraft(session, context, checkpoint)
            ?? this.reply(session, "WAITING_USER_INPUT", "Đã giữ bản nháp đang soạn.");
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
        } catch (error) { return this.reply(session, "WAITING_USER_INPUT", toolError(error)); }
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
      if (recovery.stage === "preview") return await this.prepareBookingDraft(session, context, checkpoint)
        ?? this.reply(session, "WAITING_USER_INPUT", "Bản nháp chưa đủ thông tin để xác nhận.");
      if (recovery.stage === "address") {
        try {
          const tool = this.tools.get("save_booking_address", context);
          return this.applyBookingAddress(session, context, tool, tool.inputSchema.parse(recovery.arguments), checkpoint);
        } catch (error) { return this.reply(session, "WAITING_USER_INPUT", toolError(error)); }
      }
      try {
        const retryTool = this.tools.get(recovery.tool, context);
        if (retryTool.mutates || this.tools.needsConfirmation(retryTool)) return this.reply(session, "WAITING_USER_INPUT", "Thao tác này cần kiểm tra kết quả và xác nhận mới trước khi thực hiện; chưa chạy lại.");
        historyRequest = { tool: retryTool.name, args: recovery.arguments };
        if (recovery.replaceDraft && retryTool.name === "rebook_booking") context.replaceBookingDraft = true;
      } catch (error) { return this.reply(session, "WAITING_USER_INPUT", toolError(error)); }
    } else if (!isContinueRequest(latestMessage)) session.recovery = undefined;
    if (historyRequest) {
      if ("error" in historyRequest) return this.reply(session, "WAITING_USER_INPUT", historyRequest.error);
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
      } catch (error) { return this.reply(session, "WAITING_USER_INPUT", toolError(error)); }
    }
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
      } catch (error) { return this.reply(session, "WAITING_USER_INPUT", toolError(error)); }
      if (await this.execute(session, context, update, args, checkpoint)) return session.conversation[session.conversation.length - 1].content;
      if (session.progress[session.progress.length - 1]?.status !== "SUCCEEDED") {
        return this.reply(session, "WAITING_USER_INPUT", "Chưa kiểm tra được mã giảm giá cho đơn này. Vui lòng thử lại; thông tin đặt dịch vụ vẫn được giữ.");
      }
      return await this.prepareBookingDraft(session, context, checkpoint)
        ?? this.reply(session, "WAITING_USER_INPUT", "Vui lòng hoàn thiện thông tin đặt dịch vụ để kiểm tra mã giảm giá.");
    }
    await compactAgentContext(session, this.provider, AbortSignal.any([context.signal, AbortSignal.timeout(20000)]));
    const failedCalls = new Set<string>();
    let searchResult: AgentBookingSearch | undefined;
    let readReply: ReturnType<NonNullable<AgentTool["reply"]>> = undefined;
    // Chọn lại theo ngữ cảnh mỗi lượt để không khóa khách vào chủ đề cũ.
    let intent: ToolIntent | undefined;
    let consecutiveProviderErrors = 0;
    for (let iteration = 0; iteration < this.config.maxIterations; iteration += 1) {
      if (context.signal.aborted) break;
      session.state = "RUNNING";
      this.activity(session, "Đang phân tích yêu cầu");
      await checkpoint();
      let response;
      const generationSignal = AbortSignal.any([context.signal, AbortSignal.timeout(this.config.timeoutMs)]);
      const availableTools = this.tools.forIntent(context, intent);
      try {
        response = llmResponseSchema.parse(await withAgentTimeout(this.provider.generate({
          system: this.config.systemPrompt + (this.tools.routeByIntent ? TOOL_ROUTING_PROMPT : "")
            + (context.readOnly ? "\nPhiên đang đối soát thao tác trước. Chỉ được tra cứu, giải thích dữ liệu hiện tại; không sửa bản nháp, chuẩn bị xác nhận hoặc thực hiện thao tác ghi. Không khẳng định thao tác trước thành công nếu chưa có bằng chứng." : ""), ...agentContext(session),
          tools: availableTools, signal: generationSignal,
        }), generationSignal, this.config.timeoutMs));
        consecutiveProviderErrors = 0;
      } catch (error) {
        consecutiveProviderErrors += 1;
        const status = error instanceof ProviderHttpError ? error.status : undefined;
        const invalidResponse = error instanceof ZodError || error instanceof SyntaxError;
        const timedOut = generationSignal.aborted || (error instanceof Error && error.name === "TimeoutError");
        const category = timedOut ? "TIMEOUT" : status ? "HTTP" : invalidResponse ? "INVALID_RESPONSE" : "CONNECTION_OR_PROVIDER";
        // Chỉ ghi lỗi provider đã che dữ liệu và metadata request, không ghi payload hay credential.
        console.warn("Lỗi xử lý phản hồi trợ lý AI", JSON.stringify({
          requestId: session.activeRequest?.requestId, category, status,
          diagnostic: error instanceof ProviderHttpError ? error.diagnostic : undefined,
          request: error instanceof ProviderHttpError ? error.request : undefined, attempt: consecutiveProviderErrors
        }));
        const permanent = status !== undefined && status >= 400 && status < 500 && status !== 408 && status !== 429;
        if (context.signal.aborted || permanent || status === 429 || consecutiveProviderErrors >= 2) {
          if (readReply) return this.reply(session, readReply.state, readReply.message, searchResult);
          if (searchResult) return this.reply(session, "WAITING_USER_INPUT", "Đã lấy được kết quả bên dưới. Bạn có thể chọn thao tác để tiếp tục.", searchResult);
          const reason = timedOut ? "Trợ lý phản hồi chậm."
            : status === 429 ? "Trợ lý đang quá tải."
              : "Trợ lý chưa xử lý được yêu cầu.";
          return this.reply(session, "FAILED", `${reason} ${permanent ? "Vui lòng thử lại sau." : "Chọn Tiếp tục yêu cầu để thử lại."}`);
        }
        if (invalidResponse) {
          this.messages.append(session, "tool", "Phản hồi chưa đúng cấu trúc. Chỉ trả một JSON theo MESSAGE, TOOL_CALL, FINAL hoặc ERROR. MESSAGE cần message; choiceGroups tối đa 6 nhóm, mỗi nhóm có label, multiple và 1–12 options dạng chuỗi. TOOL_CALL cần tool và arguments dạng object. Không thêm trường khác hoặc lời giải thích ngoài JSON.", "agent_protocol");
        }
        if (!invalidResponse) await delay(500, undefined, { signal: context.signal }).catch(() => undefined);
        continue;
      }
      if (response.type === "MESSAGE") {
        const message = this.reply(session, "WAITING_USER_INPUT", response.message, searchResult);
        session.conversation[session.conversation.length - 1].choiceGroups = searchResult ? undefined : response.choiceGroups;
        return message;
      }
      if (response.type === "FINAL") return this.reply(session, searchResult ? "WAITING_USER_INPUT" : "COMPLETED", response.message, searchResult);
      if (response.type === "ERROR") return readReply ? this.reply(session, readReply.state, readReply.message, searchResult)
        : this.reply(session, "FAILED", response.message);

      if (this.tools.routeByIntent && response.tool === selectToolGroup.name) {
        const selection = toolGroupSchema.safeParse(response.arguments);
        if (selection.success) {
          intent = selection.data.intent;
          this.messages.append(session, "tool", JSON.stringify({ intent, message: "Đã nạp nhóm công cụ. Tiếp tục xử lý yêu cầu bằng công cụ được cung cấp." }), selectToolGroup.name);
        } else {
          this.messages.append(session, "tool", "Nhóm công cụ không hợp lệ. Chọn booking, support, complaint, order hoặc payment.", selectToolGroup.name);
        }
        continue;
      }

      const requestedTool = response.tool;
      if (this.tools.routeByIntent && !availableTools.some((tool) => tool.name === requestedTool)) {
        this.record(session, response.tool, { error: "Công cụ chưa được nạp hoặc không được phép. Dùng select_tool_group để chọn nhóm phù hợp trước." }, false);
        continue;
      }

      if (response.tool === "create_booking" && availableTools.some((tool) => tool.name === "update_booking_draft")) {
        const { uniformQuantity, ...argumentsWithoutUniform } = response.arguments;
        response = {
          ...response, tool: "update_booking_draft", arguments: {
            ...argumentsWithoutUniform, ...(uniformQuantity !== undefined ? { quantity: uniformQuantity } : {}),
          }
        };
      }

      let tool: AgentTool;
      let args: unknown;
      let applyAddressToDraft = false;
      try {
        this.messages.append(session, "tool", JSON.stringify({ event: "TOOL_CALL", arguments: response.arguments }), response.tool);
        tool = this.tools.get(response.tool, context);
        args = tool.inputSchema.parse(response.arguments);
        if (!context.readOnly && session.bookingDraft?.status === "active" && !["update_booking_draft", "create_booking", "get_service",
          "search_services", "get_addresses", "get_price", "get_available_times", "get_booking_vouchers",
          "search_booking_providers", "save_booking_address", "rebook_booking", "get_previous_providers", "search_my_bookings", "get_my_bookings", "get_booking"].includes(tool.name)) {
          session.bookingDraft.status = "paused";
        }
        const addressArgs = args as { addressId?: string; useForBooking?: boolean };
        applyAddressToDraft = tool.name === "save_booking_address" && !addressArgs.addressId && addressArgs.useForBooking === true
          && Boolean(session.bookingDraft && ["active", "paused"].includes(session.bookingDraft.status) && !session.bookingDraft.orderId);
        if (this.tools.needsConfirmation(tool) && !applyAddressToDraft) {
          const completed = !["create_payment", "cancel_payment", "submit_booking_feedback"].includes(tool.name) && session.actions.find((action) => action.taskVersion === session.taskVersion
            && action.tool === tool.name && action.status === "SUCCEEDED" && isDeepStrictEqual(action.arguments, args));
          if (completed) {
            this.record(session, tool.name, { alreadyExecuted: true, result: completed.result }, true);
            if (tool.reply) {
              const reply = tool.reply(completed.result);
              if (reply) return this.reply(session, reply.state, reply.message);
            }
            continue;
          }
          session.pendingAction = await this.confirmation.prepare(tool, context, args);
          session.pendingAction.taskVersion = session.taskVersion;
          return this.reply(session, "WAITING_CONFIRMATION", "Vui lòng kiểm tra thông tin bên dưới và chọn Xác nhận hoặc Từ chối.");
        }
      } catch (error) {
        this.record(session, response.tool, { error: toolError(error) }, false);
        const failureKey = JSON.stringify([response.tool, response.arguments, toolError(error)]);
        if (["create_payment", "cancel_payment"].includes(response.tool) || failedCalls.has(failureKey)) {
          return this.reply(session, "WAITING_USER_INPUT", toolError(error));
        }
        failedCalls.add(failureKey);
        continue;
      }
      if (applyAddressToDraft) return this.applyBookingAddress(session, context, tool, args, checkpoint);
      const finished = await this.execute(session, context, tool, args, checkpoint, undefined, true);
      if (finished) return session.conversation[session.conversation.length - 1].content;
      if (["get_booking_quotation", "get_booking_refunds"].includes(tool.name) && session.progress[session.progress.length - 1]?.status === "SUCCEEDED") {
        readReply = tool.reply?.(session.collectedInformation[tool.name]);
      }
      if (["search_my_bookings", "get_previous_providers"].includes(tool.name) && session.progress[session.progress.length - 1]?.status === "SUCCEEDED") {
        searchResult = bookingSearchResult(session, args, tool.name);
      }
      if (tool.name === "get_service" && session.progress[session.progress.length - 1]?.status === "SUCCEEDED") {
        const service = session.collectedInformation.get_service as Partial<DraftService> | undefined;
        const latestRequest = [...session.conversation].reverse().find((item) => item.role === "user")?.content ?? "";
        if (typeof service?.name === "string" && typeof service.serviceType === "string"
          && isAirConditionerRepair({ name: service.name, slug: service.slug, serviceType: service.serviceType })
          && isGeneralRepairBookingRequest(latestRequest) && session.bookingDraft?.status !== "booked" && !session.bookingDraft?.orderId
          && availableTools.some((candidate) => candidate.name === "update_booking_draft")) {
          const update = this.tools.get("update_booking_draft", context);
          const patch = update.inputSchema.parse({ serviceId: (args as { serviceId: string }).serviceId });
          if (await this.execute(session, context, update, patch, checkpoint)) return session.conversation[session.conversation.length - 1].content;
          if (session.progress[session.progress.length - 1]?.status === "SUCCEEDED") {
            const reply = await this.prepareBookingDraft(session, context, checkpoint);
            if (reply !== null) return reply;
          }
        }
      }
      if (session.progress[session.progress.length - 1]?.status === "FAILED") {
        if (session.recovery) {
          const failure = JSON.parse(session.conversation[session.conversation.length - 1].content) as { error: string };
          return this.reply(session, "FAILED", `${failure.error} Chọn Tiếp tục yêu cầu để tiếp tục.`);
        }
        const failureKey = JSON.stringify([tool.name, args]);
        if (failedCalls.has(failureKey)) {
          return this.reply(session, "WAITING_USER_INPUT", "Vẫn chưa xử lý được. Bạn có thể sửa yêu cầu hoặc thử lại sau.");
        }
        failedCalls.add(failureKey);
      }
      if (["update_booking_draft", "rebook_booking"].includes(tool.name) && session.progress[session.progress.length - 1]?.status === "SUCCEEDED") {
        const reply = await this.prepareBookingDraft(session, context, checkpoint);
        if (reply !== null) return reply;
      }

    }
    if (readReply) return this.reply(session, readReply.state, readReply.message, searchResult);
    return this.reply(session, "FAILED", context.signal.aborted
      ? "Xử lý quá thời gian chờ. Chọn Tiếp tục yêu cầu để tiếp tục."
      : "Yêu cầu cần thêm bước xử lý. Chọn Tiếp tục yêu cầu.");
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
      const message = this.reply(session, "WAITING_CONFIRMATION", draft.voucherFeedback ?? "");
      session.conversation[session.conversation.length - 1].choiceGroups = draft.choiceGroups.length ? draft.choiceGroups : undefined;
      return message;
    } catch (error) {
      this.record(session, "create_booking", { error: toolError(error) }, false);
      session.recovery = { tool: "create_booking", arguments: bookingArgs, taskVersion: session.taskVersion, revision: draft.revision, stage: "preview" };
      return this.reply(session, "WAITING_USER_INPUT", toolError(error));
    }
  }

  private async applyBookingAddress(session: AgentSession, context: ToolContext, tool: AgentTool, args: unknown,
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

  private activity(session: AgentSession, message: string) {
    session.activity = { requestId: session.activeRequest?.requestId ?? "", message, updatedAt: new Date().toISOString() };
  }
}
