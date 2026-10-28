import { Order } from "../../models/order.model";
import { withAgentTimeout } from "./timeout";
import type { sessionView } from "./agent.service";

// Chỉ tính khả năng từ dữ liệu hiện tại thuộc khách, không dùng trạng thái lịch sử làm quyền thao tác.
export async function withOrderActions(view: ReturnType<typeof sessionView>, userId: string) {
  const target = view.viewedOrder?.orderId ?? view.bookingDraft?.orderId ?? view.payment?.orderId;
  if (!target) return { ...view, assignedProvider: null, orderActions: null };
  const knownCode = view.viewedOrder?.orderId === target ? view.viewedOrder.orderCode
    : view.payment?.orderId === target ? view.payment.orderCode : "Đơn đang xem";
  try {
    const order = await withAgentTimeout(Order.findOne({ _id: target, customerId: userId, isDeleted: false })
      .select("orderCode status paymentStatus inspectionRequired currentQuotationId bookingStatus providerId").lean().exec(), AbortSignal.timeout(5000), 5000);
    if (!order) return { ...view, assignedProvider: null, orderActions: { orderId: target, orderCode: knownCode,
      quotation: false, refunds: false, payment: false, rebook: false, provider: false, feedback: false, reason: "Đơn không còn khả dụng trong tài khoản. Hãy kiểm tra lại danh sách đơn." } };
    const blocked = view.requiresReconciliation;
    const awaitingPayment = (["created", "accepted"].includes(order.status)
      || order.status === "in_progress" && !order.inspectionRequired)
      && order.paymentStatus === "unpaid" && !["expired", "rejected"].includes(order.bookingStatus);
    const assignedProvider = view.assignedProvider?.orderId === String(order._id)
      && view.assignedProvider.status === order.status
      && (view.assignedProvider.provider?.id ?? "") === (order.providerId ? String(order.providerId) : "") ? view.assignedProvider : null;
    return { ...view, assignedProvider, viewedOrder: { orderId: String(order._id), orderCode: order.orderCode }, orderActions: {
      orderId: String(order._id), orderCode: order.orderCode,
      quotation: !blocked && Boolean(order.inspectionRequired || order.currentQuotationId),
      refunds: !blocked && (order.status === "cancelled" || order.paymentStatus === "refunded"),
      payment: awaitingPayment || blocked && view.payment?.orderId === target,
      rebook: !blocked && ["completed", "cancelled"].includes(order.status),
      provider: !blocked,
      feedback: !blocked && order.status === "completed",
      reason: blocked ? "Cần đối soát thao tác trước khi thực hiện bước khác." : undefined,
    } };
  } catch {
    return { ...view, assignedProvider: null, orderActions: { orderId: target, orderCode: knownCode,
      quotation: false, refunds: false, payment: false, rebook: false, provider: false, feedback: false, reason: "Chưa tải được trạng thái mới. Mở chi tiết đơn hoặc tải lại cuộc trò chuyện để kiểm tra." } };
  }
}
