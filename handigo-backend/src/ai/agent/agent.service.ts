import { createHash } from "node:crypto";
import type { RequestUser } from "../../middlewares/authContext";
import { AppError } from "../../utils/appError";
import type { SessionStore } from "../session/session.service";
import { MessageRepository } from "../session/message.repository";
import type { ToolContext } from "../tools/tool.interface";
import { AgentLoop, toolError } from "./agent-loop.service";
import type { AgentInput, AgentSession } from "./agent-state";
import { agentPaymentResultSchema } from "../../services/agentPayment.service";
import { withAgentTimeout } from "./timeout";
import { z } from "zod";
import { sessionLifecycle } from "./session-lifecycle";

export function sessionView(session: AgentSession) {
  const lifecycle = sessionLifecycle(session);
  const requiresReconciliation = session.requiresReconciliation
    || session.pendingAction?.status === "EXECUTING" || session.pendingAction?.status === "UNKNOWN";
  const paymentResult = [...session.conversation].reverse().find((item) => item.role === "tool"
    && ["create_payment", "get_payment_status"].includes(item.tool ?? "")
    && (() => { try { return agentPaymentResultSchema.safeParse(JSON.parse(item.content)).success; } catch { return false; } })());
  let payment = paymentResult ? agentPaymentResultSchema.parse(JSON.parse(paymentResult.content)) : null;
  const unknown = session.pendingAction?.tool === "create_payment" && session.pendingAction.status === "EXECUTING"
    ? session.pendingAction : [...session.actions].reverse().find((action) => action.tool === "create_payment" && action.status === "UNKNOWN");
  if (unknown && requiresReconciliation) {
    const preview = unknown.preview as { orderId?: string; orderCode?: string; amount?: number };
    const parsed = agentPaymentResultSchema.safeParse({ ...preview, status: "blocked", message: "Chưa rõ kết quả thanh toán. Chọn Kiểm tra thanh toán trước khi thực hiện thêm thao tác." });
    if (parsed.success) payment = parsed.data;
  }
  return { sessionId: session.id, state: session.state, currentGoal: session.currentGoal,
    expiresAt: lifecycle.expiresAt,
    payment,
    messages: session.conversation.filter((item) => item.role !== "tool").map((item) => ({
      _id: item.id, sender: item.role, content: item.content, createdAt: item.createdAt,
    })), pendingConfirmation: session.pendingAction?.status === "WAITING_CONFIRMATION" ? {
      actionId: session.pendingAction.id, tool: session.pendingAction.tool,
      preview: session.pendingAction.preview, expiresAt: session.pendingAction.expiresAt,
    } : null, requiresReconciliation,
    interruptedRequest: session.activeRequest?.input ?? null,
    requiresNewSession: lifecycle.expired || (!session.pendingAction && !session.activeRequest
      && (session.receipts.length >= 100 || JSON.stringify(session).length > 350_000)) };
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
      if (sessionLifecycle(session).expired && !("paymentStatus" in input)) return sessionView(session);
      if ("paymentStatus" in input) {
        if (session.pendingAction?.status === "EXECUTING" || session.pendingAction?.status === "UNKNOWN") session.requiresReconciliation = true;
        if (!session.requiresReconciliation && (session.receipts.length >= 100 || JSON.stringify(session).length > 350_000)) {
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
        if (session.receipts.length > 100) session.receipts.shift();
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
      if (!session.pendingAction && !session.activeRequest && (session.receipts.length >= 100 || JSON.stringify(session).length > 350_000)) {
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
          await this.loop.run(session, context, checkpoint);
        }
      } else {
        if ("confirmation" in input) this.loop.confirmation.requirePending(session, input.confirmation.actionId);
        session.activeRequest = { requestId: input.requestId, digest, input };
        if ("confirmation" in input) {
          await this.confirm(session, context, input.confirmation, checkpoint);
        } else {
          new MessageRepository().append(session, "user", input.message);
          if (session.pendingAction) {
            this.loop.reply(session, "WAITING_CONFIRMATION", "Hãy dùng nút xác nhận cho hành động đang chờ, hoặc từ chối trước khi sửa yêu cầu.");
          } else {
            if (!session.currentGoal || session.state === "COMPLETED") {
              session.currentGoal = input.message;
              session.taskVersion += 1;
              session.collectedInformation = {};
            }
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
    new MessageRepository().append(session, "user", input.decision === "CONFIRM" ? "Xác nhận hành động đã xem." : "Từ chối hành động đã xem.");
    if (input.decision === "REJECT" || new Date(action.expiresAt).getTime() <= Date.now()) {
      action.status = input.decision === "REJECT" ? "REJECTED" : "EXPIRED";
      session.actions.push({ ...action });
      session.pendingAction = null;
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
      const booking = z.object({ orderId: z.string().regex(/^[a-f\d]{24}$/i), orderCode: z.string(),
        orderType: z.string(), bookingStatus: z.string(), paymentMethod: z.enum(["bank", "wallet", "cash"]) }).safeParse(action.result);
      if (booking.success) {
        const order = booking.data;
        let message: string;
        if (["scheduled", "recurring"].includes(order.orderType) && order.bookingStatus !== "awaiting_payment") {
          message = "Đã tạo lịch hẹn. Vui lòng chờ chuyên gia xác nhận trước khi thanh toán.";
        } else {
          try {
            const paymentTool = this.loop.tools.get("create_payment", context);
            const paymentArgs = paymentTool.inputSchema.parse({ orderId: order.orderId,
              method: { bank: "PAYOS", wallet: "WALLET", cash: "CASH" }[order.paymentMethod] });
            session.pendingAction = await this.loop.confirmation.prepare(paymentTool, context, paymentArgs);
            session.pendingAction.taskVersion = session.taskVersion;
            this.loop.reply(session, "WAITING_CONFIRMATION", "Đã tạo đơn. Vui lòng kiểm tra và xác nhận riêng bước thanh toán bên dưới.");
            return;
          } catch (error) { message = `Đã tạo đơn. ${toolError(error)}`; }
        }
        new MessageRepository().append(session, "tool", JSON.stringify({ orderId: order.orderId,
          orderCode: order.orderCode, status: "blocked", message }), "create_payment");
        this.loop.reply(session, "WAITING_USER_INPUT", message);
        return;
      }
    }
    if (!finished) await this.loop.run(session, context, checkpoint);
  }
}
