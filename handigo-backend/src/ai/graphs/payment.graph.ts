import { buildConfirmedActionGraph, type ConfirmedActionDependencies } from "./confirmed-action.graph";
import { z } from "zod";
import { AgentPaymentService } from "../../services/agentPayment.service";
import type { ToolContext } from "../tools/tool.interface";

export const PAYMENT_WRITE_TOOLS = ["create_payment", "cancel_payment", "reject_booking_quotation"] as const;

// Chỉ ghi nhận trạng thái đã được backend xác minh; không tạo/hủy giao dịch trong bước đối soát.
export async function reconcileGraphPayment(context: ToolContext, input: unknown) {
  const args = z.object({ orderId: z.string(), method: z.enum(["PAYOS", "WALLET", "CASH"]) }).parse(input);
  const expected = z.object({ amount: z.number().nonnegative(), paymentType: z.enum(["full", "inspection_deposit"]) }).parse(context.confirmedPreview);
  const current = await AgentPaymentService.status(context.user, args.orderId);
  if (current.orderId !== args.orderId || current.amount !== expected.amount || current.paymentType !== expected.paymentType
    || current.method !== ({ PAYOS: "payos", WALLET: "wallet", CASH: "cash" }[args.method])) return null;
  return ["paid", "deposit_paid", "cash_pending"].includes(current.status)
    || current.status === "pending" && Boolean(current.checkoutUrl) ? current : null;
}

export async function reconcileGraphPaymentCancellation(context: ToolContext, input: unknown) {
  const args = z.object({ orderId: z.string() }).parse(input);
  const expected = z.object({ paymentId: z.string(), amount: z.number().nonnegative(),
    paymentType: z.enum(["full", "inspection_deposit"]) }).parse(context.confirmedPreview);
  const current = await AgentPaymentService.status(context.user, args.orderId);
  if (current.orderId !== args.orderId || current.amount !== expected.amount || current.paymentType !== expected.paymentType) return null;
  return await AgentPaymentService.cancellationConfirmed(context.user, current, expected.paymentId) ? current : null;
}

export const buildPaymentActionGraph = (deps: ConfirmedActionDependencies) =>
  buildConfirmedActionGraph("payment", PAYMENT_WRITE_TOOLS, { ...deps, reconcilers: {
    create_payment: reconcileGraphPayment, cancel_payment: reconcileGraphPaymentCancellation,
    ...deps.reconcilers,
  } });
