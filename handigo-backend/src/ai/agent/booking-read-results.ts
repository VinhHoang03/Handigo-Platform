import type { AgentQuotationService } from "../../services/agentQuotation.service";
import type { AgentBookingHistoryService } from "../../services/agentBookingHistory.service";

const money = (amount: number) => `${amount.toLocaleString("vi-VN")} đ`;
const states: Record<string, string> = { pending: "đang chờ", processing: "đang xử lý", succeeded: "đã hoàn thành",
  success: "đã hoàn thành", failed: "chưa thành công", cancelled: "đã hủy", approved: "đã duyệt", saved: "đã lưu", rejected: "đã từ chối", expired: "hết hiệu lực" };
const destination = (value: string | null) => value === "handigo_wallet" ? "ví Handigo"
  : value === "source_account" ? "tài khoản thanh toán ban đầu" : "chưa xác định đích nhận";

export function quotationReply(result: Awaited<ReturnType<typeof AgentQuotationService.get>>) {
  const q = result.quotation;
  if (!q) return `Đơn ${result.orderCode}: ${result.note}`;
  return [
    `Báo giá ${q.code} của đơn ${result.orderCode}: ${states[q.status] ?? "cần kiểm tra trạng thái"}.`,
    ...q.items.map((item) => `• ${item.title}: ${item.quantity} × ${money(item.unitPrice)} = ${money(item.totalPrice)}${item.description ? ` — ${item.description}` : ""}`),
    q.discountAmount > 0 ? `Trước giảm: ${money(q.subtotalAmount)}. Giảm: ${money(q.discountAmount)}. Tổng: ${money(q.finalAmount)}.` : `Tổng báo giá: ${money(q.finalAmount)}.`,
    `Cọc thực trả được khấu trừ: ${money(q.paidDeposit)}.`,
    ["cancelled", "rejected", "expired"].includes(q.status) || result.orderStatus === "cancelled"
      ? "Báo giá/đơn đã ngừng thực hiện. Không cần trả thêm theo báo giá này."
      : `Còn thanh toán trực tiếp với thợ: ${money(q.remainingDirectPaymentAmount)}.`,
    q.directPaymentConfirmedAt ? `Thợ ghi nhận đã nhận ${money(q.directPaymentConfirmedAmount ?? 0)}. Nếu chưa đúng, vui lòng liên hệ hỗ trợ.` : "",
    "Chi phí sửa chữa trả trực tiếp cho thợ.",
    result.canRequestRejection ? "Muốn từ chối báo giá? Bạn có thể xem phí hủy và tiền hoàn trước khi xác nhận." : "",
  ].filter(Boolean).join("\n");
}

export function refundReply(result: Awaited<ReturnType<typeof AgentBookingHistoryService.refunds>>) {
  return [
    `Khoản hoàn của đơn ${result.orderCode}:`,
    result.policy ? `Theo chính sách: đã trả ${money(result.policy.paidAmount)}, phí hủy ${money(result.policy.cancellationFee)}, dự kiến hoàn ${money(result.policy.refundAmount)}.` : "Chưa có thông tin chính sách hoàn trên đơn.",
    ...result.refunds.map((refund) => `• ${money(refund.amount)} — ${states[refund.status] ?? "cần kiểm tra trạng thái"}, về ${destination(refund.destination)}.`),
    ...result.walletTransactions.map((tx) => `• Giao dịch ví ${tx.transactionCode}: ${money(tx.amount)} — ${states[tx.status] ?? "cần kiểm tra trạng thái"}.`),
    ...result.payments.filter((p) => p.legacyRefund).map((p) => `• Dữ liệu hoàn của thanh toán cũ: ${p.legacyRefund?.amount !== undefined ? money(p.legacyRefund.amount) : "chưa có số tiền"} — ${states[p.legacyRefund?.status ?? ""] ?? "chưa có bằng chứng hoàn thành"}, về ${destination(p.legacyRefund?.destination ?? null)}.`),
    !result.refunds.length && !result.walletTransactions.length && !result.payments.some((p) => p.legacyRefund)
      ? "Chưa ghi nhận giao dịch hoàn tiền thành công." : "",
    "Khoản hoàn và giao dịch ví có thể trùng nhau, không cộng dồn. Chỉ trạng thái thành công mới xác nhận đã hoàn tiền.",
    "Cần đối chiếu? Bạn có thể mở chi tiết đơn hoặc liên hệ hỗ trợ.",
  ].filter(Boolean).join("\n");
}
