import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { ActionPreconditionError } from "../../utils/actionPreconditionError";
import type { AgentSession, PendingAction } from "../agent/agent-state";
import type { AgentTool, ToolContext } from "./tool.interface";
import { ToolRegistry } from "./tool-registry";

const bookingPaymentSchema = z.object({ paymentOnConfirmation: z.literal(true), amount: z.number().nonnegative(),
  paymentMethod: z.enum(["bank", "wallet", "cash"]), serviceType: z.enum(["fixed_price", "variable_price"]), policyVersion: z.string() });
const paymentPreviewSchema = z.object({ amount: z.number().nonnegative(), paymentMethod: z.enum(["bank", "wallet", "cash"]),
  paymentType: z.enum(["full", "inspection_deposit"]) });

// Dùng chung cho vòng lặp hiện tại và node graph; model không được cấp quyền ghi.
export class ToolExecutor {
  constructor(private readonly registry: ToolRegistry) {}

  authorize<T>(session: AgentSession, context: ToolContext, candidate: AgentTool<T>, args: unknown, action?: PendingAction) {
    if (context.sessionId !== session.id || context.user.id !== session.userId) {
      throw new ActionPreconditionError("Phiên thao tác không thuộc tài khoản hiện tại.");
    }
    const tool = this.registry.get(candidate.name, { ...context, readOnly: context.readOnly || session.requiresReconciliation });
    if (tool !== candidate) throw new ActionPreconditionError("Công cụ thực thi không khớp đăng ký hiện tại.");
    const parsed = tool.inputSchema.parse(args);
    if (!this.registry.needsConfirmation(tool)) return parsed;
    if (!action || session.pendingAction !== action || action.tool !== tool.name
      || action.status !== "WAITING_CONFIRMATION" || action.taskVersion !== session.taskVersion
      || !Number.isFinite(Date.parse(action.expiresAt)) || Date.parse(action.expiresAt) <= Date.now()
      || !isDeepStrictEqual(tool.inputSchema.parse(action.arguments), parsed)) {
      throw new ActionPreconditionError("Thao tác cần bản xác nhận còn hiệu lực và đúng thông tin hiện tại.");
    }
    const input = session.activeRequest?.input;
    const explicitConfirmation = input && "confirmation" in input && input.confirmation.actionId === action.id
      && input.confirmation.decision === "CONFIRM";
    if (!explicitConfirmation && !this.authorizedBookingPayment(session, context, action, parsed)) {
      throw new ActionPreconditionError("Chưa có xác nhận của khách cho thao tác này.");
    }
    if (tool.name === "create_booking") {
      const version = (action.preview as { policyVersion?: string } | null)?.policyVersion;
      if (!version || action.policyConsent?.version !== version || action.policyConsent.actionId !== action.id) {
        throw new ActionPreconditionError("Cần đồng ý đúng phiên bản chính sách trước khi đặt đơn.");
      }
    }
    return parsed;
  }

  private authorizedBookingPayment(session: AgentSession, context: ToolContext, action: PendingAction, args: unknown) {
    if (action.tool !== "create_payment" || !context.bookingPaymentActionId) return false;
    const booking = session.actions.find((item) => item.id === context.bookingPaymentActionId
      && item.tool === "create_booking" && item.status === "SUCCEEDED" && item.taskVersion === action.taskVersion);
    if (!booking || booking.policyConsent?.actionId !== booking.id) return false;
    const confirmed = bookingPaymentSchema.safeParse(booking.preview);
    const current = paymentPreviewSchema.safeParse(action.preview);
    const request = z.object({ orderId: z.string(), method: z.enum(["PAYOS", "WALLET", "CASH"]) }).safeParse(args);
    const order = z.object({ orderId: z.string(), paymentMethod: z.enum(["bank", "wallet", "cash"]) }).safeParse(booking.result);
    return confirmed.success && current.success && request.success && order.success
      && booking.policyConsent.version === confirmed.data.policyVersion
      && request.data.orderId === order.data.orderId
      && ({ PAYOS: "bank", WALLET: "wallet", CASH: "cash" }[request.data.method]) === order.data.paymentMethod
      && confirmed.data.paymentMethod === order.data.paymentMethod && current.data.paymentMethod === order.data.paymentMethod
      && confirmed.data.amount === current.data.amount
      && current.data.paymentType === (confirmed.data.serviceType === "variable_price" ? "inspection_deposit" : "full");
  }
}
