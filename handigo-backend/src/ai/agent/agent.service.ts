import { createHash } from "node:crypto";
import type { RequestUser } from "../../middlewares/authContext";
import { AppError } from "../../utils/appError";
import type { SessionStore } from "../session/session.service";
import { MessageRepository } from "../session/message.repository";
import type { ToolContext } from "../tools/tool.interface";
import { AgentLoop, toolError } from "./agent-loop.service";
import type { AgentInput, AgentSession, PendingAction } from "./agent-state";
import { agentPaymentResultSchema } from "../../services/agentPayment.service";
import { withAgentTimeout } from "./timeout";
import { z } from "zod";
import { sessionStorageFull } from "./session-lifecycle";
import { bookingSchema } from "../tools/implementations/booking.schemas";

export function sessionView(session: AgentSession) {
  const requiresReconciliation = session.requiresReconciliation
    || session.pendingAction?.status === "EXECUTING" || session.pendingAction?.status === "UNKNOWN";
  const recentMessages = [...session.conversation].reverse();
  const latestUserIndex = recentMessages.findIndex((item) => item.role === "user");
  // Ưu tiên thanh toán của lượt hiện tại; giữ dữ liệu khi cần đối soát hoặc giao dịch vẫn đang chờ.
  const paymentMessages = requiresReconciliation || latestUserIndex < 0
    ? recentMessages : recentMessages.slice(0, latestUserIndex);
  const validPaymentMessage = (item: typeof recentMessages[number]) => item.role === "tool"
    && ["create_payment", "get_payment_status"].includes(item.tool ?? "")
    && (() => { try { return agentPaymentResultSchema.safeParse(JSON.parse(item.content)).success; } catch { return false; } })();
  const latestPayment = recentMessages.find(validPaymentMessage);
  // Giao dịch đang chờ vẫn phải hiển thị khi khách gửi thêm tin nhắn trong cùng phiên.
  const paymentResult = paymentMessages.find(validPaymentMessage)
    ?? (latestPayment && JSON.parse(latestPayment.content).status === "pending" ? latestPayment : undefined);
  let payment = paymentResult ? agentPaymentResultSchema.parse(JSON.parse(paymentResult.content)) : null;
  const unknown = session.pendingAction?.tool === "create_payment" && session.pendingAction.status === "EXECUTING"
    ? session.pendingAction : [...session.actions].reverse().find((action) => action.tool === "create_payment" && action.status === "UNKNOWN");
  if (unknown && requiresReconciliation) {
    const preview = unknown.preview as { orderId?: string; orderCode?: string; amount?: number };
    const parsed = agentPaymentResultSchema.safeParse({ ...preview, status: "blocked", message: "Chưa rõ kết quả thanh toán. Chọn Kiểm tra thanh toán trước khi thực hiện thêm thao tác." });
    if (parsed.success) payment = parsed.data;
  }
  const actions = new Map([...session.actions, ...(session.pendingAction ? [session.pendingAction] : [])]
    .map((action) => [action.id, action]));
  return { sessionId: session.id, state: session.state, currentGoal: session.currentGoal,
    expiresAt: null,
    payment,
    bookingDraft: session.bookingDraft ? { status: session.bookingDraft.status, revision: session.bookingDraft.revision,
      summary: session.bookingDraft.summary, missing: session.bookingDraft.missing } : null,
    messages: session.conversation.filter((item) => item.role !== "tool").map((item) => {
      const action = item.role === "assistant" && item.confirmationActionId
        ? actions.get(item.confirmationActionId) : undefined;
      const booking = action?.tool === "create_booking" && action.status === "SUCCEEDED"
        ? z.object({ orderId: z.string().regex(/^[a-f\d]{24}$/i), orderCode: z.string().optional() }).safeParse(action.result) : null;
      return {
        _id: item.id, sender: item.role, content: item.content, createdAt: item.createdAt,
        ...(item.choiceGroups?.length ? { choiceGroups: item.choiceGroups } : {}),
        ...(action ? { confirmation: { actionId: action.id, tool: action.tool, preview: action.preview,
          expiresAt: action.expiresAt, status: action.status === "WAITING_CONFIRMATION" && Date.parse(action.expiresAt) <= Date.now()
            ? "EXPIRED" as const : action.status,
          ...(booking?.success ? { booking: booking.data } : {}),
        } } : {}),
      };
    }), pendingConfirmation: session.pendingAction?.status === "WAITING_CONFIRMATION" ? {
      actionId: session.pendingAction.id, tool: session.pendingAction.tool,
      preview: session.pendingAction.preview, expiresAt: session.pendingAction.expiresAt,
    } : null, requiresReconciliation,
    interruptedRequest: session.activeRequest?.input ?? null,
    requiresNewSession: !session.pendingAction && !session.activeRequest && sessionStorageFull(session) };
}

export class AgentService {
  constructor(private readonly sessions: SessionStore, private readonly loop: AgentLoop) {}

  async send(user: RequestUser, sessionId: string, input: AgentInput) {
    if (user.role !== "CUSTOMER") throw new AppError("Trợ lý hệ thống chỉ dành cho khách hàng.", 403);
    const { session, lockId } = await this.sessions.acquire(sessionId, user.id);
    const checkpoint = () => this.sessions.save(session, lockId);
    const digest = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const context: ToolContext = { user, sessionId, signal: AbortSignal.timeout(180_000) };
    try {
      const receipt = session.receipts.find((item) => item.requestId === input.requestId);
      if (receipt) {
        if (receipt.digest !== digest) throw new AppError("Mã request đã được dùng với dữ liệu khác.", 409);
        return sessionView(session);
      }
      if ("paymentStatus" in input) {
        if (session.pendingAction?.status === "EXECUTING" || session.pendingAction?.status === "UNKNOWN") session.requiresReconciliation = true;
        if (!session.requiresReconciliation && sessionStorageFull(session)) {
          throw new AppError("Phiên đã đầy. Vui lòng bắt đầu phiên mới để kiểm tra thanh toán.", 409);
        }
        const tool = this.loop.tools.get("get_payment_status", context);
        const args = tool.inputSchema.parse(input.paymentStatus);
        const result = agentPaymentResultSchema.parse(await withAgentTimeout(tool.execute(context, args), context.signal, 20000));
        new MessageRepository().append(session, "tool", JSON.stringify(result), "get_payment_status");
        const unknown = session.pendingAction ?? [...session.actions].reverse().find((action) => action.status === "UNKNOWN");
        const original = unknown?.arguments as { orderId?: string; method?: string } | undefined;
        const preview = unknown?.preview as { amount?: number; paymentType?: string } | undefined;
        const samePayment = unknown?.tool === "create_payment" && original?.orderId === result.orderId
          && preview?.amount === result.amount && preview?.paymentType === result.paymentType
          && (({ PAYOS: "payos", WALLET: "wallet", CASH: "cash" } as Record<string, string>)[original?.method ?? ""] === result.method);
        const resolved = samePayment && (["paid", "deposit_paid", "cash_pending"].includes(result.status)
          || (result.status === "pending" && Boolean(result.checkoutUrl)));
        if (resolved && session.requiresReconciliation) {
          unknown!.status = "SUCCEEDED";
          unknown!.result = result;
          if (session.pendingAction === unknown) { session.actions.push({ ...unknown! }); session.pendingAction = null; }
          session.requiresReconciliation = false;
          session.activeRequest = null;
        }
        this.loop.reply(session, session.requiresReconciliation ? "FAILED" : session.pendingAction ? "WAITING_CONFIRMATION" : "WAITING_USER_INPUT",
          session.requiresReconciliation ? `${result.message} Thao tác trước vẫn cần đối soát; không thực hiện thanh toán lại.` : result.message);
        session.receipts.push({ requestId: input.requestId, digest, message: result.message });
        await checkpoint();
        return sessionView(session);
      }
      if (session.pendingAction?.status === "EXECUTING" || session.pendingAction?.status === "UNKNOWN") {
        session.requiresReconciliation = true;
      }
      if (session.requiresReconciliation) {
        this.loop.reply(session, "FAILED", "Thao tác trước cần được đối soát. Vui lòng kiểm tra đơn hoặc yêu cầu trong Hỗ trợ của tôi; hệ thống sẽ không tự thực hiện lại.");
        await checkpoint();
        return sessionView(session);
      }
      if (!session.pendingAction && !session.activeRequest && sessionStorageFull(session)) {
        throw new AppError("Phiên đã đạt giới hạn lưu trữ. Vui lòng bắt đầu phiên mới sau khi xử lý yêu cầu đang chờ.", 409);
      }
      if (session.activeRequest) {
        if (session.activeRequest.requestId !== input.requestId || session.activeRequest.digest !== digest) {
          throw new AppError("Lượt trước bị gián đoạn. Hãy gửi lại đúng request trước để tiếp tục.", 409);
        }
        // Nếu đã lưu kết quả ghi thành công, chỉ tiếp tục suy luận; không tiêu thụ xác nhận lần hai.
        if (session.pendingAction?.status === "WAITING_CONFIRMATION") {
          this.loop.reply(session, "WAITING_CONFIRMATION", "Vui lòng kiểm tra và xác nhận hành động đang chờ.");
        } else {
          const completedBooking = "confirmation" in input && input.confirmation.decision === "CONFIRM"
            ? session.actions.find((action) => action.id === input.confirmation.actionId
              && action.tool === "create_booking" && action.status === "SUCCEEDED") : undefined;
          if (!completedBooking || !(await this.continueBooking(session, context, completedBooking, checkpoint))) {
            await this.loop.run(session, context, checkpoint);
          }
        }
      } else {
        if ("confirmation" in input) this.loop.confirmation.requirePending(session, input.confirmation.actionId);
        session.activeRequest = { requestId: input.requestId, digest, input };
        if ("confirmation" in input) {
          await this.confirm(session, context, input.confirmation, checkpoint);
        } else {
          new MessageRepository().append(session, "user", input.message);
          if (session.pendingAction?.status === "WAITING_CONFIRMATION"
            && (session.pendingAction.tool === "create_booking" || Date.parse(session.pendingAction.expiresAt) <= Date.now())) {
            const action = session.pendingAction;
            if (action.tool === "create_booking" && !session.bookingDraft) {
              const previous = bookingSchema.safeParse(action.arguments);
              if (previous.success) session.bookingDraft = { revision: 0, status: "active", values: previous.data,
                sources: {}, missing: [], summary: [], choiceGroups: [] };
            }
            action.status = "EXPIRED";
            session.actions.push({ ...action });
            session.pendingAction = null;
            new MessageRepository().append(session, "tool", "Khách gửi yêu cầu mới. Bản xác nhận cũ đã hết hiệu lực; đọc yêu cầu mới và cập nhật bản nháp hoặc trả lời câu hỏi. Không thực hiện thao tác bằng xác nhận cũ.", "agent_protocol");
          }
          if (session.pendingAction) {
            this.loop.reply(session, "WAITING_CONFIRMATION", "Hãy dùng nút xác nhận cho hành động đang chờ, hoặc từ chối trước khi sửa yêu cầu.");
          } else {
            if (!session.currentGoal || session.state === "COMPLETED") {
              session.currentGoal = input.message;
              session.taskVersion += 1;
              session.collectedInformation = {};
            }
            session.currentGoal = input.message;
            await this.loop.run(session, context, checkpoint);
          }
        }
      }
      session.receipts.push({ requestId: input.requestId, digest, message: session.conversation[session.conversation.length - 1]?.content ?? "" });
      session.activeRequest = null;
      await checkpoint();
      return sessionView(session);
    } finally {
      await this.sessions.release(sessionId, lockId);
    }
  }

  private async confirm(session: AgentSession, context: ToolContext,
    input: { actionId: string; decision: "CONFIRM" | "REJECT" }, checkpoint: () => Promise<void>) {
    const action = this.loop.confirmation.requirePending(session, input.actionId);
    const expired = Date.parse(action.expiresAt) <= Date.now();
    new MessageRepository().append(session, "user", input.decision === "CONFIRM"
      ? expired ? "Kiểm tra lại thông tin của bản xác nhận đã hết hạn." : "Xác nhận hành động đã xem."
      : "Từ chối hành động đã xem.");
    if (input.decision === "REJECT" || new Date(action.expiresAt).getTime() <= Date.now()) {
      action.status = input.decision === "REJECT" ? "REJECTED" : "EXPIRED";
      session.actions.push({ ...action });
      session.pendingAction = null;
      if (input.decision === "CONFIRM" && expired && action.tool === "create_booking") {
        try {
          const tool = this.loop.tools.get(action.tool, context);
          session.pendingAction = await this.loop.confirmation.prepare(tool, context, tool.inputSchema.parse(action.arguments));
          session.pendingAction.taskVersion = session.taskVersion;
          this.loop.reply(session, "WAITING_CONFIRMATION", "Bản cũ đã hết hạn. Thông tin đã được kiểm tra lại; vui lòng xác nhận form mới để đặt đơn.");
        } catch (error) {
          this.loop.reply(session, "WAITING_USER_INPUT", toolError(error));
        }
        return;
      }
      new MessageRepository().append(session, "tool", action.status === "REJECTED"
        ? "Người dùng đã từ chối. Không đề nghị lại cùng hành động; hỏi điều cần thay đổi."
        : "Xác nhận hết hạn. Cần tạo bản xem trước và yêu cầu xác nhận mới.", action.tool);
      await this.loop.run(session, context, checkpoint);
      return;
    }
    let tool;
    let args;
    try {
      tool = this.loop.tools.get(action.tool, context);
      args = tool.inputSchema.parse(action.arguments);
      if (!(await this.loop.confirmation.unchanged(tool, context, action))) {
        action.status = "EXPIRED";
        session.actions.push({ ...action });
        session.pendingAction = await this.loop.confirmation.prepare(tool, context, args);
        session.pendingAction.taskVersion = session.taskVersion;
        this.loop.reply(session, "WAITING_CONFIRMATION", "Thông tin hoặc chi phí đã thay đổi. Vui lòng kiểm tra và xác nhận lại bản mới.");
        return;
      }
    } catch (error) {
      action.status = "EXPIRED";
      session.actions.push({ ...action });
      session.pendingAction = null;
      new MessageRepository().append(session, "tool", toolError(error), action.tool);
      if (action.tool === "create_payment") {
        this.loop.reply(session, "WAITING_USER_INPUT", toolError(error));
        return;
      }
      await this.loop.run(session, context, checkpoint);
      return;
    }
    const finished = await this.loop.execute(session, context, tool, args, checkpoint, action);
    if (!finished && action.tool === "create_booking" && action.status === "SUCCEEDED") {
      if (await this.continueBooking(session, context, action, checkpoint)) return;
    }
    if (!finished) await this.loop.run(session, context, checkpoint);
  }

  private async continueBooking(session: AgentSession, context: ToolContext, action: PendingAction, checkpoint: () => Promise<void>) {
    const booking = z.object({ orderId: z.string().regex(/^[a-f\d]{24}$/i), orderCode: z.string(),
      orderType: z.string(), bookingStatus: z.string(), paymentMethod: z.enum(["bank", "wallet", "cash"]) }).safeParse(action.result);
    if (!booking.success) return false;
    const order = booking.data;
    // Khi tiếp tục request, dùng kết quả đã lưu; không tạo lại giao dịch đã chạy.
    const previousPayment = [...session.actions].reverse().find((item) => item.tool === "create_payment"
      && (item.arguments as { orderId?: string })?.orderId === order.orderId);
    if (previousPayment) {
      const payment = agentPaymentResultSchema.safeParse(previousPayment.result);
      this.loop.reply(session, "WAITING_USER_INPUT", payment.success ? payment.data.message
        : "Đã tạo đơn. Vui lòng kiểm tra thanh toán của đơn trước khi thực hiện thêm thao tác.");
      return true;
    }
    let message = "Đã tạo đơn. Vui lòng kiểm tra trạng thái thanh toán của đơn.";
    {
      let paymentTool;
      let paymentArgs;
      let paymentAction: PendingAction | undefined;
      try {
        paymentTool = this.loop.tools.get("create_payment", context);
        paymentArgs = paymentTool.inputSchema.parse({ orderId: order.orderId,
          method: { bank: "PAYOS", wallet: "WALLET", cash: "CASH" }[order.paymentMethod] });
        paymentAction = await this.loop.confirmation.prepare(paymentTool, context, paymentArgs);
        paymentAction.taskVersion = action.taskVersion;
        const confirmed = z.object({ paymentOnConfirmation: z.literal(true), amount: z.number().positive(),
          paymentMethod: z.enum(["bank", "wallet", "cash"]), serviceType: z.enum(["fixed_price", "variable_price"]) }).safeParse(action.preview);
        const current = z.object({ amount: z.number().positive(), paymentType: z.enum(["full", "inspection_deposit"]),
          paymentMethod: z.enum(["bank", "wallet", "cash"]) }).safeParse(paymentAction.preview);
        // Form cũ hoặc chi phí/phương thức thay đổi không cấp quyền tự trừ tiền.
        const authorized = confirmed.success && current.success && confirmed.data.amount === current.data.amount
          && confirmed.data.paymentMethod === order.paymentMethod && current.data.paymentMethod === order.paymentMethod
          && current.data.paymentType === (confirmed.data.serviceType === "variable_price" ? "inspection_deposit" : "full");
        session.pendingAction = paymentAction;
        if (!authorized) {
          this.loop.reply(session, "WAITING_CONFIRMATION", "Đã tạo đơn. Thông tin thanh toán chưa được xác nhận hoặc đã thay đổi. Vui lòng kiểm tra và xác nhận khoản thanh toán bên dưới.");
          return true;
        }
      } catch (error) {
        paymentAction = undefined;
        session.pendingAction = null;
        message = `Đã tạo đơn. ${toolError(error)}`;
      }
      if (paymentAction && paymentTool) {
        // execute lưu trạng thái trước khi ghi; lỗi checkpoint phải được truyền ra để tiếp tục an toàn.
        const finished = await this.loop.execute(session, context, paymentTool, paymentArgs, checkpoint, paymentAction);
        if (!finished) this.loop.reply(session, "WAITING_USER_INPUT", "Đã tạo đơn. Vui lòng kiểm tra trạng thái thanh toán của đơn.");
        return true;
      }
    }
    new MessageRepository().append(session, "tool", JSON.stringify({ orderId: order.orderId,
      orderCode: order.orderCode, status: "blocked", message }), "create_payment");
    this.loop.reply(session, "WAITING_USER_INPUT", message);
    return true;
  }
}
