import { isDeepStrictEqual } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { ZodError } from "zod";
import { AppError } from "../../utils/appError";
import type { AgentLoop } from "./agent-loop.service";
import { toolError } from "./agent-loop.service";
import type { AgentSession } from "./agent-state";
import type { AgentTool, ToolContext } from "../tools/tool.interface";
import { llmResponseSchema, type LLMResponse } from "../llm/llm.interface";
import { ProviderHttpError } from "../llm/providers/provider-http";
import { agentContext, compactAgentContext } from "./agent-context";
import { bookingSearchResult, type AgentBookingSearch } from "./booking-history";
import { isAirConditionerRepair, isGeneralRepairBookingRequest, type DraftService } from "./booking-draft";
import { inferToolIntent, selectToolGroup, toolGroupSchema, TOOL_ROUTING_PROMPT, type ToolIntent } from "../tools/tool-groups";
import { withAgentTimeout } from "./timeout";
import { measureCustomerStage, recordCustomerModelUsage } from "../runtime/customer-runtime-metrics";
import { invalidateReadSnapshots, REFRESHABLE_READ_TOOLS, type ReadSource } from "./read-source-refresh";
import type { TurnPlan } from "./turn-plan";

export const MODEL_WORKFLOW_PHASES = ["route_request", "compact_context", "call_model", "route_tool", "validate_tool",
  "prepare_confirmation", "execute_read", "after_tool", "prepare_draft", "apply_address", "respond", "refresh_sources",
  "history_request", "voucher_request", "recover_draft", "recover_address"] as const;
export type ModelWorkflowPhase = typeof MODEL_WORKFLOW_PHASES[number] | "done";
export interface ModelWorkflowFrame {
  version: "customer-model-v1";
  requestId: string;
  digest: string;
  phase: ModelWorkflowPhase;
  iteration: number;
  consecutiveProviderErrors: number;
  waitingForModelRetry?: boolean;
  modelRetryCount?: number;
  readSources?: ReadSource[];
  refreshCursor?: number;
  turnPlan?: TurnPlan;
  failedCalls: string[];
  intent?: ToolIntent;
  response?: LLMResponse;
  selected?: { tool: string; args: unknown };
  searchResult?: AgentBookingSearch;
  readReply?: ReturnType<NonNullable<AgentTool["reply"]>>;
  message?: string;
}
export type ModelWorkflowRunner = (workflow: AgentModelWorkflow) => Promise<string>;

// Cùng các bước nghiệp vụ cho legacy và graph; chỉ graph lưu con trỏ bước vào checkpoint phiên.
export class AgentModelWorkflow {
  readonly frame: ModelWorkflowFrame;
  constructor(readonly host: AgentLoop, readonly session: AgentSession, readonly context: ToolContext,
    private readonly save: () => Promise<void>, readonly durable: boolean) {
    const request = session.activeRequest;
    const previous = durable ? session.modelWorkflow : undefined;
    if (previous && previous.requestId === request?.requestId && previous.digest === request.digest) {
      if (previous.version !== "customer-model-v1" || ![...MODEL_WORKFLOW_PHASES, "done"].includes(previous.phase)
        || !Number.isInteger(previous.iteration) || previous.iteration < 0 || previous.iteration > host.config.maxIterations) {
        throw new AppError("Tiến độ điều phối không tương thích. Cần khôi phục đúng phiên bản runtime.", 409);
      }
      this.frame = previous;
    } else {
      this.frame = { version: "customer-model-v1", requestId: request?.requestId ?? "", digest: request?.digest ?? "",
        phase: "route_request", iteration: 0, consecutiveProviderErrors: 0, failedCalls: [] };
    }
    if (durable) {
      if (!request) throw new AppError("Thiếu request chuẩn để điều phối graph.", 409);
      session.modelWorkflow = this.frame;
    }
    context.bookingAddressLookup = {};
  }

  async checkpoint() { await this.save(); }
  private finish(message: string) { this.frame.message = message; this.frame.phase = "done"; }
  private reply(...args: Parameters<AgentLoop["reply"]>) { this.finish(this.host.reply(...args)); }
  private retry() { this.frame.phase = "call_model"; delete this.frame.selected; delete this.frame.response; }
  private fallback() {
    const f = this.frame;
    if (f.readReply) this.reply(this.session, f.readReply.state, f.readReply.message, f.searchResult);
    else this.reply(this.session, "FAILED", this.context.signal.aborted
      ? "Xử lý quá thời gian chờ. Chọn Tiếp tục yêu cầu để tiếp tục."
      : "Yêu cầu cần thêm bước xử lý. Chọn Tiếp tục yêu cầu.");
  }
  private selected() {
    if (!this.frame.selected) throw new AppError("Thiếu công cụ đã được kiểm tra trong tiến độ graph.", 409);
    const tool = this.host.tools.get(this.frame.selected.tool, this.context);
    return { tool, args: tool.inputSchema.parse(this.frame.selected.args) };
  }

  async step(phase: ModelWorkflowPhase) {
    if (phase !== this.frame.phase) throw new AppError("Bước điều phối không khớp checkpoint.", 409);
    const { frame: f, session, context, host } = this;
    switch (phase) {
      case "route_request": {
        const plan = host.planTurn(session, context);
        if (typeof plan === "string") this.finish(plan);
        else if (plan === null) {
          if (host.tools.routeByIntent) {
            const latest = [...session.conversation].reverse().find((item) => item.role === "user");
            f.intent = inferToolIntent(latest?.content ?? "");
          }
          f.phase = "compact_context";
        }
        else {
          f.turnPlan = plan;
          f.phase = ({ history: "history_request", voucher: "voucher_request", draft: "recover_draft", address: "recover_address" } as const)[plan.kind];
        }
        break;
      }
      case "history_request":
      case "voucher_request":
      case "recover_draft":
      case "recover_address": {
        if (!f.turnPlan) throw new AppError("Thiếu kế hoạch nhánh nghiệp vụ trong checkpoint.", 409);
        const reply = await host.executeTurnPlan(session, context, () => this.save(), f.turnPlan);
        if (reply !== null) this.finish(reply); else f.phase = "compact_context";
        break;
      }
      case "compact_context":
        compactAgentContext(session, context.signal);
        f.phase = "call_model";
        break;
      case "call_model": await this.callModel(); break;
      case "refresh_sources": await this.refreshSources(); break;
      case "route_tool": this.routeTool(); break;
      case "validate_tool": await this.validateTool(); break;
      case "prepare_confirmation": {
        const { tool, args } = this.selected();
        try {
          session.pendingAction = await host.confirmation.prepare(tool, context, args);
          session.pendingAction.taskVersion = session.taskVersion;
          this.reply(session, "WAITING_CONFIRMATION", "Vui lòng kiểm tra thông tin bên dưới và chọn Xác nhận hoặc Từ chối.");
        } catch (error) { this.toolFailure(tool.name, args, error); }
        break;
      }
      case "execute_read": {
        const { tool, args } = this.selected();
        // Chốt after_tool cùng kết quả để crash sau đọc/cập nhật draft không chạy lại bước đã lưu.
        const progressCount = session.progress.length;
        const finished = await host.execute(session, context, tool, args, async () => {
          if (session.progress.length > progressCount) {
            const last = session.conversation[session.conversation.length - 1];
            if (last?.role === "assistant" && ["WAITING_USER_INPUT", "COMPLETED", "FAILED"].includes(session.state)) this.finish(last.content);
            else f.phase = "after_tool";
          }
          await this.save();
        }, undefined, true);
        if (finished) this.finish(session.conversation[session.conversation.length - 1].content);
        else f.phase = "after_tool";
        break;
      }
      case "after_tool": await this.afterTool(); break;
      case "prepare_draft": {
        const reply = await host.prepareBookingDraft(session, context, () => this.save());
        if (reply !== null) this.finish(reply); else this.retry();
        break;
      }
      case "apply_address": {
        const { tool, args } = this.selected();
        this.finish(await host.applyBookingAddress(session, context, tool, args, () => this.save()));
        break;
      }
      case "respond": this.respond(); break;
      case "done": break;
    }
  }

  private async refreshSources() {
    const { frame: f, session, context, host } = this;
    if (f.refreshCursor === undefined) {
      invalidateReadSnapshots(session);
      delete f.readReply;
      delete f.searchResult;
      f.refreshCursor = 0;
      await this.save();
    }
    const sources = f.readSources ?? [];
    while (f.refreshCursor < sources.length) {
      const source = sources[f.refreshCursor];
      try {
        context.signal.throwIfAborted();
        const readContext = { ...context, session: structuredClone(session), readOnly: true,
          signal: AbortSignal.any([context.signal, AbortSignal.timeout(host.config.timeoutMs)]) };
        const tool = host.tools.get(source.tool, readContext);
        if (!REFRESHABLE_READ_TOOLS.has(source.tool) || tool.mutates || host.tools.needsConfirmation(tool)) {
          throw new AppError("Công cụ không được phép tự đọc lại khi tiếp tục.", 409);
        }
        const result = await withAgentTimeout(tool.execute(readContext, tool.inputSchema.parse(source.args)), readContext.signal, host.config.timeoutMs);
        host.record(session, tool.name, result, true);
        if (["get_booking_quotation", "get_booking_refunds"].includes(tool.name)) f.readReply = tool.reply?.(result);
        if (["search_my_bookings", "get_previous_providers"].includes(tool.name)) f.searchResult = bookingSearchResult(session, source.args, tool.name);
      } catch {
        delete session.collectedInformation[source.tool];
        if (["get_booking_quotation", "get_booking_refunds"].includes(source.tool)) delete f.readReply;
        if (["search_my_bookings", "get_previous_providers"].includes(source.tool)) delete f.searchResult;
        host.record(session, source.tool, { error: "Chưa đọc lại được nguồn hiện tại. Không dùng kết quả trước gián đoạn để kết luận trạng thái mới." }, false);
      }
      source.messageId = session.conversation[session.conversation.length - 1].id;
      f.refreshCursor++;
      await this.save();
    }
    delete f.refreshCursor;
    f.phase = "call_model";
  }

  private async callModel() {
    const { frame: f, session, context, host } = this;
    if (context.signal.aborted || f.iteration >= host.config.maxIterations) { this.fallback(); return; }
    f.iteration++;
    session.state = "RUNNING";
    host.activity(session, "Đang phân tích yêu cầu");
    await this.save();
    const signal = AbortSignal.any([context.signal, AbortSignal.timeout(host.config.timeoutMs)]);
    try {
      f.response = llmResponseSchema.parse(await measureCustomerStage("model_request", () => withAgentTimeout(host.provider.generate({
        system: host.config.systemPrompt + (host.tools.routeByIntent ? TOOL_ROUTING_PROMPT : "")
          + (f.modelRetryCount ? "\nYêu cầu vừa được tiếp tục sau gián đoạn. Kết quả công cụ trước đó là dữ liệu tại thời điểm đã đọc. Khi cần kết luận trạng thái hiện tại, hãy tra cứu lại bằng công cụ đọc; không tự thực hiện lại thao tác ghi đã thành công." : "")
          + (context.readOnly ? "\nPhiên đang đối soát thao tác trước. Chỉ được tra cứu, giải thích dữ liệu hiện tại; không sửa bản nháp, chuẩn bị xác nhận hoặc thực hiện thao tác ghi. Không khẳng định thao tác trước thành công nếu chưa có bằng chứng." : ""),
        ...agentContext(session), tools: host.tools.forIntent(context, f.intent), signal, onUsage: recordCustomerModelUsage,
      }), signal, host.config.timeoutMs)));
      f.consecutiveProviderErrors = 0;
      f.phase = f.response.type === "TOOL_CALL" ? "route_tool" : "respond";
    } catch (error) {
      f.consecutiveProviderErrors++;
      const status = error instanceof ProviderHttpError ? error.status : undefined;
      const invalidResponse = error instanceof ZodError || error instanceof SyntaxError;
      const timedOut = signal.aborted || (error instanceof Error && error.name === "TimeoutError");
      console.warn("Lỗi xử lý phản hồi trợ lý AI", JSON.stringify({ requestId: session.activeRequest?.requestId,
        category: timedOut ? "TIMEOUT" : status ? "HTTP" : invalidResponse ? "INVALID_RESPONSE" : "CONNECTION_OR_PROVIDER",
        status, diagnostic: error instanceof ProviderHttpError ? error.diagnostic : undefined,
        request: error instanceof ProviderHttpError ? error.request : undefined, attempt: f.consecutiveProviderErrors }));
      const permanent = status !== undefined && status >= 400 && status < 500 && status !== 408 && status !== 429;
      const temporary = timedOut || status !== undefined && [408, 429, 500, 502, 503, 504].includes(status);
      if (this.durable && temporary && !context.readOnly) {
        if (f.iteration >= host.config.maxIterations) {
          this.reply(session, "FAILED", "Trợ lý chưa thể hoàn tất sau nhiều lần thử. Bạn có thể gửi yêu cầu mới sau.");
        } else {
          f.waitingForModelRetry = true;
          f.phase = "call_model";
          delete f.response;
          delete f.selected;
          f.message = host.reply(session, "FAILED", session.activeRequest && "message" in session.activeRequest.input
            ? "Trợ lý tạm thời chưa thể trả lời. Bạn có thể thử lại hoặc gửi yêu cầu khác."
            : "Trợ lý tạm thời chưa thể trả lời. Chọn Thử lại để kiểm tra và tiếp tục thao tác trước.");
        }
        return;
      }
      if (context.signal.aborted || permanent || status === 429 || f.consecutiveProviderErrors >= 2) {
        if (f.readReply) this.reply(session, f.readReply.state, f.readReply.message, f.searchResult);
        else if (f.searchResult) this.reply(session, "WAITING_USER_INPUT", "Đã lấy được kết quả bên dưới. Bạn có thể chọn thao tác để tiếp tục.", f.searchResult);
        else this.reply(session, "FAILED", `${timedOut ? "Trợ lý phản hồi chậm." : status === 429 ? "Trợ lý đang quá tải." : "Trợ lý chưa xử lý được yêu cầu."} ${permanent ? "Vui lòng thử lại sau." : "Chọn Tiếp tục yêu cầu để thử lại."}`);
      } else {
        if (invalidResponse) host.appendProtocol(session, "Phản hồi chưa đúng cấu trúc. Chỉ trả một JSON theo MESSAGE, TOOL_CALL, FINAL hoặc ERROR. MESSAGE cần message; choiceGroups tối đa 6 nhóm, mỗi nhóm có label, multiple và 1–12 options dạng chuỗi. TOOL_CALL cần tool và arguments dạng object. Không thêm trường khác hoặc lời giải thích ngoài JSON.");
        else await delay(500, undefined, { signal: context.signal }).catch(() => undefined);
        this.retry();
      }
    }
  }

  private routeTool() {
    const { frame: f, session, context, host } = this;
    const response = f.response;
    if (response?.type !== "TOOL_CALL") throw new AppError("Thiếu lời gọi công cụ trong graph.", 409);
    if (host.tools.routeByIntent && response.tool === selectToolGroup.name) {
      const selection = toolGroupSchema.safeParse(response.arguments);
      if (selection.success) {
        f.intent = selection.data.intent;
        host.appendProtocol(session, JSON.stringify({ intent: f.intent, message: "Đã nạp nhóm công cụ. Tiếp tục xử lý yêu cầu bằng công cụ được cung cấp." }), selectToolGroup.name);
      } else host.appendProtocol(session, "Nhóm công cụ không hợp lệ. Chọn booking, support, complaint, order hoặc payment.", selectToolGroup.name);
      this.retry(); return;
    }
    const available = host.tools.forIntent(context, f.intent);
    if (host.tools.routeByIntent && !available.some((tool) => tool.name === response.tool)) {
      host.record(session, response.tool, { error: "Công cụ chưa được nạp hoặc không được phép. Dùng select_tool_group để chọn nhóm phù hợp trước." }, false);
      this.retry(); return;
    }
    if (response.tool === "create_booking" && available.some((tool) => tool.name === "update_booking_draft")) {
      const { uniformQuantity, ...args } = response.arguments;
      f.response = { ...response, tool: "update_booking_draft", arguments: { ...args, ...(uniformQuantity !== undefined ? { quantity: uniformQuantity } : {}) } };
    }
    f.phase = "validate_tool";
  }

  private async validateTool() {
    const { frame: f, session, context, host } = this;
    const response = f.response;
    if (response?.type !== "TOOL_CALL") throw new AppError("Thiếu đầu vào công cụ trong graph.", 409);
    try {
      host.appendProtocol(session, JSON.stringify({ event: "TOOL_CALL", arguments: response.arguments }), response.tool);
      const tool = host.tools.get(response.tool, context);
      const args = tool.inputSchema.parse(response.arguments);
      f.selected = { tool: tool.name, args };
      if (!context.readOnly && session.bookingDraft?.status === "active" && !["update_booking_draft", "create_booking", "get_service",
        "search_services", "get_addresses", "get_price", "get_available_times", "get_booking_vouchers", "search_booking_providers",
        "save_booking_address", "rebook_booking", "get_previous_providers", "search_my_bookings", "get_my_bookings", "get_booking"].includes(tool.name)) session.bookingDraft.status = "paused";
      const address = args as { addressId?: string; useForBooking?: boolean };
      if (tool.name === "save_booking_address" && !address.addressId && address.useForBooking === true
        && session.bookingDraft && ["active", "paused"].includes(session.bookingDraft.status) && !session.bookingDraft.orderId) {
        f.phase = "apply_address"; return;
      }
      if (host.tools.needsConfirmation(tool)) {
        const completed = !["create_payment", "cancel_payment", "submit_booking_feedback"].includes(tool.name)
          && session.actions.find((action) => action.taskVersion === session.taskVersion && action.tool === tool.name
            && action.status === "SUCCEEDED" && isDeepStrictEqual(action.arguments, args));
        if (completed) {
          host.record(session, tool.name, { alreadyExecuted: true, result: completed.result }, true);
          const reply = tool.reply?.(completed.result);
          if (reply) this.reply(session, reply.state, reply.message); else this.retry();
        } else f.phase = "prepare_confirmation";
      } else f.phase = "execute_read";
    } catch (error) { this.toolFailure(response.tool, response.arguments, error); }
  }

  private toolFailure(tool: string, args: unknown, error: unknown) {
    this.host.record(this.session, tool, { error: toolError(error) }, false);
    const key = JSON.stringify([tool, args, toolError(error)]);
    if (["create_payment", "cancel_payment"].includes(tool) || this.frame.failedCalls.includes(key)) this.reply(this.session, "WAITING_USER_INPUT", toolError(error));
    else { this.frame.failedCalls.push(key); this.retry(); }
  }

  private async afterTool() {
    const { frame: f, session, context, host } = this;
    const { tool, args } = this.selected();
    const success = session.progress[session.progress.length - 1]?.status === "SUCCEEDED";
    if (["get_booking_quotation", "get_booking_refunds"].includes(tool.name) && success) f.readReply = tool.reply?.(session.collectedInformation[tool.name]);
    if (["search_my_bookings", "get_previous_providers"].includes(tool.name) && success) f.searchResult = bookingSearchResult(session, args, tool.name);
    if (tool.name === "get_service" && success) {
      const service = session.collectedInformation.get_service as Partial<DraftService> | undefined;
      const latest = [...session.conversation].reverse().find((item) => item.role === "user")?.content ?? "";
      if (typeof service?.name === "string" && typeof service.serviceType === "string"
        && isAirConditionerRepair({ name: service.name, slug: service.slug, serviceType: service.serviceType })
        && isGeneralRepairBookingRequest(latest) && session.bookingDraft?.status !== "booked" && !session.bookingDraft?.orderId
        && host.tools.forIntent(context, f.intent).some((item) => item.name === "update_booking_draft")) {
        const update = host.tools.get("update_booking_draft", context);
        f.selected = { tool: update.name, args: update.inputSchema.parse({ serviceId: (args as { serviceId: string }).serviceId }) };
        f.phase = "execute_read"; return;
      }
    }
    if (!success) {
      if (session.recovery) {
        const failure = JSON.parse(session.conversation[session.conversation.length - 1].content) as { error: string };
        this.reply(session, "FAILED", `${failure.error} Chọn Tiếp tục yêu cầu để tiếp tục.`); return;
      }
      const key = JSON.stringify([tool.name, args]);
      if (f.failedCalls.includes(key)) { this.reply(session, "WAITING_USER_INPUT", "Vẫn chưa xử lý được. Bạn có thể sửa yêu cầu hoặc thử lại sau."); return; }
      f.failedCalls.push(key);
    }
    if (["update_booking_draft", "rebook_booking"].includes(tool.name) && success) f.phase = "prepare_draft";
    else this.retry();
  }

  private respond() {
    const { frame: f, session } = this;
    const response = f.response;
    if (response?.type === "MESSAGE") {
      this.reply(session, "WAITING_USER_INPUT", response.message, f.searchResult);
      session.conversation[session.conversation.length - 1].choiceGroups = f.searchResult ? undefined : response.choiceGroups;
    } else if (response?.type === "FINAL") this.reply(session, f.searchResult ? "WAITING_USER_INPUT" : "COMPLETED", response.message, f.searchResult);
    else if (response?.type === "ERROR") {
      if (f.readReply) this.reply(session, f.readReply.state, f.readReply.message, f.searchResult);
      else this.reply(session, "FAILED", response.message);
    } else throw new AppError("Phản hồi không khớp bước trả lời của graph.", 409);
  }

  async runLegacy() {
    while (this.frame.phase !== "done") {
      await this.step(this.frame.phase);
      // Legacy không lưu frame; giữ cơ chế SessionStore và receipt hiện có.
    }
    return this.frame.message ?? "";
  }
}
