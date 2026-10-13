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
import { readyBookingArguments } from "./booking-draft";
import { agentContext, compactAgentContext } from "./agent-context";
import { selectToolGroup, toolGroupSchema, TOOL_ROUTING_PROMPT, type ToolIntent } from "../tools/tool-groups";

export const toolError = (error: unknown) => error instanceof ZodError
  ? `Dữ liệu tool không hợp lệ: ${error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`
  : error instanceof AppError && error.statusCode < 500 ? error.message : "Tool tạm thời không khả dụng. Hãy thử cách khác hoặc hỏi người dùng.";

export class AgentLoop {
  private readonly messages = new MessageRepository();
  readonly confirmation = new ConfirmationService();
  constructor(private readonly provider: LLMProvider, readonly tools: ToolRegistry,
    private readonly config: { maxIterations: number; systemPrompt: string; timeoutMs: number }) { }

  reply(session: AgentSession, state: AgentState, message: string) {
    session.state = state;
    session.activity = undefined;
    this.messages.append(session, "assistant", message);
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
    checkpoint: () => Promise<void>, action?: PendingAction) {
    session.state = "EXECUTING_TOOL";
    this.activity(session, tool.name === "update_booking_draft" ? "Đang chuẩn bị thông tin đặt lịch"
      : tool.name === "get_available_times" ? "Đang kiểm tra lịch hẹn"
        : tool.name.includes("payment") ? "Đang kiểm tra thanh toán"
          : ["get_service", "search_services", "get_service_catalog"].includes(tool.name) ? "Đang tìm dịch vụ phù hợp"
            : tool.name === "get_addresses" ? "Đang kiểm tra địa chỉ đã lưu" : "Đang xử lý yêu cầu của bạn");
    if (action) action.status = "EXECUTING";
    // Ghi nhận ý định trước khi gọi service: request sau tuyệt đối không tự gọi lại khi mất kết quả.
    await checkpoint();
    const signal = AbortSignal.any([context.signal, AbortSignal.timeout(this.config.timeoutMs)]);
    let directReply: ReturnType<NonNullable<AgentTool["reply"]>> | undefined;
    try {
      signal.throwIfAborted();
      const operation = tool.execute({ ...context, session, signal, confirmedPreview: action?.preview }, args);
      const result = await withAgentTimeout(operation, signal, this.config.timeoutMs);
      if (tool.name === "save_booking_address" && context.bookingAddressLookup) context.bookingAddressLookup.value = undefined;
      this.record(session, tool.name, result, true);
      if (action) { action.status = "SUCCEEDED"; action.result = result; }
      if (tool.name === "create_booking" && session.bookingDraft) {
        session.bookingDraft.status = "booked";
        if (result && typeof result === "object" && "orderId" in result && typeof result.orderId === "string") session.bookingDraft.orderId = result.orderId;
      }
      directReply = tool.reply?.(result);
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
        this.record(session, tool.name, { error: toolError(error) }, false);
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
    await compactAgentContext(session, this.provider, AbortSignal.any([context.signal, AbortSignal.timeout(20000)]));
    const failedCalls = new Set<string>();
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
          system: this.config.systemPrompt + (this.tools.routeByIntent ? TOOL_ROUTING_PROMPT : ""), ...agentContext(session),
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
          const reason = timedOut ? "Nhà cung cấp AI chưa trả lời trong thời gian cho phép."
            : status === 429 ? "Nhà cung cấp AI đang giới hạn lượt gọi hoặc đã hết hạn mức."
              : status === 400 ? "Nhà cung cấp AI từ chối dữ liệu yêu cầu (HTTP 400). Hệ thống cần kiểm tra định dạng yêu cầu và cấu hình công cụ."
                : status === 401 || status === 403 ? `Nhà cung cấp AI từ chối xác thực hoặc quyền truy cập (HTTP ${status}).`
                  : status === 404 ? "Không tìm thấy mô hình hoặc địa chỉ API đã cấu hình (HTTP 404)."
                    : permanent ? `Nhà cung cấp AI từ chối yêu cầu (HTTP ${status}); hệ thống cần được kiểm tra.`
                      : invalidResponse ? "AI trả về dữ liệu chưa đúng định dạng để xử lý yêu cầu."
                        : "Kết nối tới nhà cung cấp AI đang gặp lỗi.";
          return this.reply(session, "FAILED", `${reason} Kết quả các bước trước đã được giữ lại.${permanent ? "" : " Bạn có thể chọn Tiếp tục yêu cầu để thử lại."}`);
        }
        if (invalidResponse) {
          this.messages.append(session, "tool", "Phản hồi chưa đúng cấu trúc. Chỉ trả một JSON theo MESSAGE, TOOL_CALL, FINAL hoặc ERROR. MESSAGE cần message; choiceGroups tối đa 6 nhóm, mỗi nhóm có label, multiple và 1–12 options dạng chuỗi. TOOL_CALL cần tool và arguments dạng object. Không thêm trường khác hoặc lời giải thích ngoài JSON.", "agent_protocol");
        }
        if (!invalidResponse) await delay(500, undefined, { signal: context.signal }).catch(() => undefined);
        continue;
      }
      if (response.type === "MESSAGE") {
        const message = this.reply(session, "WAITING_USER_INPUT", response.message);
        session.conversation[session.conversation.length - 1].choiceGroups = response.choiceGroups;
        return message;
      }
      if (response.type === "FINAL") return this.reply(session, "COMPLETED", response.message);
      if (response.type === "ERROR") return this.reply(session, "FAILED", response.message);

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
      try {
        this.messages.append(session, "tool", JSON.stringify({ event: "TOOL_CALL", arguments: response.arguments }), response.tool);
        tool = this.tools.get(response.tool, context);
        args = tool.inputSchema.parse(response.arguments);
        if (session.bookingDraft?.status === "active" && !["update_booking_draft", "create_booking", "get_service",
          "search_services", "get_addresses", "get_price", "get_available_times", "get_booking_vouchers",
          "search_booking_providers", "save_booking_address"].includes(tool.name)) {
          session.bookingDraft.status = "paused";
        }
        if (this.tools.needsConfirmation(tool)) {
          const completed = tool.name !== "create_payment" && session.actions.find((action) => action.taskVersion === session.taskVersion
            && action.tool === tool.name && action.status === "SUCCEEDED" && isDeepStrictEqual(action.arguments, args));
          if (completed) {
            this.record(session, tool.name, { alreadyExecuted: true, result: completed.result }, true);
            if (tool.reply) {
              const reply = tool.reply(completed.result);
              return this.reply(session, reply.state, reply.message);
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
        if (response.tool === "create_payment" || failedCalls.has(failureKey)) {
          return this.reply(session, "WAITING_USER_INPUT", toolError(error));
        }
        failedCalls.add(failureKey);
        continue;
      }
      const finished = await this.execute(session, context, tool, args, checkpoint);
      if (finished) return session.conversation[session.conversation.length - 1].content;
      if (session.progress[session.progress.length - 1]?.status === "FAILED") {
        const failureKey = JSON.stringify([tool.name, args]);
        if (failedCalls.has(failureKey)) {
          return this.reply(session, "WAITING_USER_INPUT", "Bước xử lý này chưa thực hiện được sau khi thử lại. Thông tin đã thu thập vẫn được giữ; bạn có thể sửa yêu cầu hoặc thử lại sau.");
        }
        failedCalls.add(failureKey);
      }
      if (tool.name === "update_booking_draft" && session.progress[session.progress.length - 1]?.status === "SUCCEEDED") {
        const reply = await this.prepareBookingDraft(session, context, checkpoint);
        if (reply !== null) return reply;
      }

    }
    return this.reply(session, "FAILED", context.signal.aborted
      ? "Lượt xử lý đã hết thời gian chờ. Chọn Tiếp tục yêu cầu để tiếp tục từ kết quả đã lưu."
      : "Đã đạt giới hạn số bước của lượt này. Chọn Tiếp tục yêu cầu hoặc gửi thêm thông tin để tiếp tục ngay. Nếu có nhu cầu khác, chọn Bắt đầu tác vụ mới.");
  }

  async prepareBookingDraft(session: AgentSession, context: ToolContext, checkpoint: () => Promise<void>): Promise<string | null> {
    const draft = session.bookingDraft;
    if (!draft || draft.status !== "active") return null;
    const bookingArgs = readyBookingArguments(draft);
    if (!bookingArgs) {
      // Tiếp tục lập bản xác nhận lưu địa chỉ khách vừa nêu trong cùng lượt.
      if (draft.addressPreference && !draft.values.addressId) return null;
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
      const changed = draft.summary.filter((line) => !previousSummary.includes(line));
      const represented = draft.choiceGroups.map((group) => group.label);
      const missing = draft.missing.filter((item) => !represented.some((label) => item.toLocaleLowerCase("vi-VN").includes(label.toLocaleLowerCase("vi-VN"))));
      const message = this.reply(session, "WAITING_USER_INPUT", [
        ...changed,
        missing.length ? `Cần bổ sung: ${missing.join("; ")}.` : "Chọn thông tin còn thiếu bên dưới để tiếp tục.",
      ].join("\n"));
      session.conversation[session.conversation.length - 1].choiceGroups = draft.choiceGroups;
      return message;
    }
    try {
      const create = this.tools.get("create_booking", context);
      const previous = [...session.actions].reverse().find((action) => action.tool === "create_booking"
        && action.taskVersion === session.taskVersion && isDeepStrictEqual(action.arguments, bookingArgs)
        && ["SUCCEEDED", "REJECTED", "UNKNOWN"].includes(action.status));
      if (previous) {
        return this.reply(session, "WAITING_USER_INPUT", previous.status === "SUCCEEDED"
          ? "Yêu cầu này đã tạo đơn. Bạn có thể xem đơn hoặc kiểm tra thanh toán; không cần đặt lại."
          : previous.status === "REJECTED" ? "Bạn đã từ chối bản đặt lịch này. Hãy cho biết thông tin cần thay đổi."
            : "Kết quả tạo đơn trước chưa xác định. Cần kiểm tra đơn trước khi thực hiện lại.");
      }
      this.activity(session, "Đang kiểm tra giá và chuẩn bị bản xác nhận");
      await checkpoint();
      session.pendingAction = await this.confirmation.prepare(create, context, bookingArgs);
      session.pendingAction.taskVersion = session.taskVersion;
      return this.reply(session, "WAITING_CONFIRMATION", "");
    } catch (error) {
      this.record(session, "create_booking", { error: toolError(error) }, false);
      return this.reply(session, "WAITING_USER_INPUT", toolError(error));
    }
  }

  private activity(session: AgentSession, message: string) {
    session.activity = { requestId: session.activeRequest?.requestId ?? "", message, updatedAt: new Date().toISOString() };
  }
}
