import { AppError } from "../../utils/appError";
import { ActionPreconditionError } from "../../utils/actionPreconditionError";
import { ZodError } from "zod";
import { isDeepStrictEqual } from "node:util";
import { withAgentTimeout } from "./timeout";
import { llmResponseSchema, type LLMProvider } from "../llm/llm.interface";
import { MessageRepository } from "../session/message.repository";
import type { AgentTool, ToolContext } from "../tools/tool.interface";
import { ToolRegistry } from "../tools/tool-registry";
import { ConfirmationService } from "./confirmation.service";
import type { AgentSession, AgentState, PendingAction } from "./agent-state";

export const toolError = (error: unknown) => error instanceof ZodError
  ? `Dữ liệu tool không hợp lệ: ${error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`
  : error instanceof AppError && error.statusCode < 500 ? error.message : "Tool tạm thời không khả dụng. Hãy thử cách khác hoặc hỏi người dùng.";

export class AgentLoop {
  private readonly messages = new MessageRepository();
  readonly confirmation = new ConfirmationService();
  constructor(private readonly provider: LLMProvider, readonly tools: ToolRegistry,
    private readonly config: { maxIterations: number; systemPrompt: string; timeoutMs: number }) {}

  reply(session: AgentSession, state: AgentState, message: string) {
    session.state = state;
    this.messages.append(session, "assistant", message);
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
    if (action) action.status = "EXECUTING";
    // Ghi nhận ý định trước khi gọi service: request sau tuyệt đối không tự gọi lại khi mất kết quả.
    await checkpoint();
    const signal = AbortSignal.any([context.signal, AbortSignal.timeout(this.config.timeoutMs)]);
    let directReply: ReturnType<NonNullable<AgentTool["reply"]>> | undefined;
    try {
      signal.throwIfAborted();
      const operation = tool.execute({ ...context, signal, confirmedPreview: action?.preview }, args);
      const result = await withAgentTimeout(operation, signal, this.config.timeoutMs);
      this.record(session, tool.name, result, true);
      if (action) { action.status = "SUCCEEDED"; action.result = result; }
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
    const failedCalls = new Set<string>();
    let consecutiveProviderErrors = 0;
    for (let iteration = 0; iteration < this.config.maxIterations; iteration += 1) {
      if (context.signal.aborted) break;
      session.state = "RUNNING";
      await checkpoint();
      let response;
      try {
        response = llmResponseSchema.parse(await withAgentTimeout(this.provider.generate({
          system: this.config.systemPrompt, goal: session.currentGoal,
          conversation: session.conversation, tools: this.tools.list(context), signal: context.signal,
        }), context.signal, this.config.timeoutMs));
        consecutiveProviderErrors = 0;
      } catch {
        consecutiveProviderErrors += 1;
        if (context.signal.aborted || consecutiveProviderErrors >= 2) {
          return this.reply(session, "FAILED", "Chưa nhận được phản hồi hợp lệ từ AI hoặc kết nối đã quá thời gian chờ. Chọn Tiếp tục yêu cầu để thử lại; kết quả đã lưu được giữ nguyên.");
        }
        this.messages.append(session, "tool", "Phản hồi AI lỗi hoặc không đúng JSON. Hãy chọn lại một bước hợp lệ.", "agent_protocol");
        continue;
      }
      if (response.type === "MESSAGE") return this.reply(session, "WAITING_USER_INPUT", response.message);
      if (response.type === "FINAL") return this.reply(session, "COMPLETED", response.message);
      if (response.type === "ERROR") return this.reply(session, "FAILED", response.message);

      let tool: AgentTool;
      let args: unknown;
      try {
        this.messages.append(session, "tool", JSON.stringify({ event: "TOOL_CALL", arguments: response.arguments }), response.tool);
        tool = this.tools.get(response.tool, context);
        args = tool.inputSchema.parse(response.arguments);
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
    }
    return this.reply(session, "FAILED", context.signal.aborted
      ? "Lượt xử lý đã hết thời gian chờ. Chọn Tiếp tục yêu cầu để tiếp tục từ kết quả đã lưu."
      : "Đã đạt giới hạn số bước của lượt này. Chọn Tiếp tục yêu cầu hoặc gửi thêm thông tin để tiếp tục ngay. Nếu có nhu cầu khác, chọn Bắt đầu tác vụ mới.");
  }
}
