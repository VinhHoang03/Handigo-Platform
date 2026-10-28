import { z } from "zod";
import { AssignmentService } from "./assignment.service";
import { OrderService } from "./order.service";
import { Payment } from "../models/payment.model";
import { ownedBooking } from "./agentBookingHistory.service";
import { AppError } from "../utils/appError";
import { ActionPreconditionError } from "../utils/actionPreconditionError";
import { RepairQuotation } from "../models/repairQuotation.model";
import { happenedAfter } from "../ai/agent/reconciliation-evidence";
import { AgentBookingService } from "./agentBooking.service";

export const AgentQuotationService = {
  async get(userId: string, orderId: string) {
    const order = await ownedBooking(userId, orderId);
    const result = await AssignmentService.getQuotationByOrder(orderId, userId, "CUSTOMER");
    if (!result) return { orderId, orderCode: order.orderCode, quotation: null, note: "Đơn chưa có báo giá hiện tại." };
    const payments = await Payment.find({ orderId, customerId: userId, paymentType: "inspection_deposit", status: "paid", isDeleted: false }).select("amount").lean();
    const paidDeposit = payments.reduce((sum, payment) => sum + payment.amount, 0);
    // Đồng nhất cách khấu trừ cọc với màn chi tiết đơn trên web, kể cả dữ liệu cũ.
    const appliedDeposit = order.pricing.baseAmount !== undefined
      ? order.depositPaidAt ? Math.max(order.pricing.totalPaidAmount, 0) : paidDeposit
      : order.depositPaidAt ? Math.max(paidDeposit, order.depositAmount || 0) : paidDeposit;
    const quotation = result.quotation;
    return { orderId, orderCode: order.orderCode, orderStatus: order.status,
      quotation: { id: String(quotation._id), code: quotation.quotationCode, revision: quotation.revision ?? 0,
        status: quotation.status, inspectionNote: quotation.inspectionNote, recommendation: quotation.recommendation,
        subtotalAmount: quotation.subtotalAmount, discountAmount: quotation.discountAmount,
        finalAmount: quotation.finalAmount, paidDeposit: appliedDeposit,
        directPaymentAmount: Math.max(quotation.finalAmount - appliedDeposit, 0),
        directPaymentConfirmedAmount: quotation.directPaymentConfirmedAmount ?? null,
        directPaymentConfirmedAt: quotation.directPaymentConfirmedAt ?? null,
        remainingDirectPaymentAmount: order.status === "cancelled" || ["rejected", "cancelled", "expired"].includes(quotation.status)
          ? 0 : Math.max(quotation.finalAmount - appliedDeposit - (quotation.directPaymentConfirmedAt ? quotation.directPaymentConfirmedAmount ?? 0 : 0), 0),
        items: result.items.map((item) => ({ title: item.title, description: item.description, type: item.itemType,
          quantity: item.quantity, unitPrice: item.unitPrice, totalPrice: item.totalPrice, note: item.note })),
      },
      canRequestRejection: quotation.status === "pending" && ["created", "accepted"].includes(order.status),
      note: "Số tiền trực tiếp = max(tổng báo giá − cọc thực trả được khấu trừ, 0); phần này trả trực tiếp cho thợ, không thu qua Handigo. Xác nhận trực tiếp của thợ là dữ liệu ghi nhận, không tự khẳng định khách đã giao tiền. Luồng khách hiện chỉ từ chối báo giá pending khi chính sách cho phép hủy; saved/approved không được tự đổi trạng thái hoặc hủy thay thợ." };
  },
  async previewReject(userId: string, orderId: string, reason: string) {
    const detail = await this.get(userId, orderId);
    if (!detail.quotation || !detail.canRequestRejection) throw new AppError("Báo giá hiện không thể từ chối qua luồng khách hàng. Vui lòng trao đổi với thợ hoặc gửi yêu cầu hỗ trợ.", 409);
    const cancellation = await OrderService.previewCancellation(orderId, userId, "customer");
    const policyReason = cancellation.items[0]?.policyReason ?? "Áp dụng chính sách hủy đơn hiện tại.";
    if (!cancellation.canCancel) throw new AppError(policyReason, 409);
    return { title: "Từ chối báo giá và hủy đơn", orderId, orderCode: detail.orderCode,
      quotationId: detail.quotation.id, quotationCode: detail.quotation.code, quotationRevision: detail.quotation.revision,
      quotationAmount: detail.quotation.finalAmount, reason,
      paidAmount: cancellation.paidAmount, refundAmount: cancellation.refundAmount,
      cancellationFee: cancellation.cancellationFee, providerCompensation: cancellation.providerCompensation,
      policyVersion: cancellation.policyVersion,
      note: `Xác nhận sẽ từ chối báo giá và hủy đơn. ${policyReason}`, currency: "VND" };
  },
  async reject(userId: string, orderId: string, reason: string, confirmedPreview: unknown) {
    const expectation = z.object({ quotationId: z.string(), quotationRevision: z.number().int().nonnegative(),
      paidAmount: z.number().nonnegative(), refundAmount: z.number().nonnegative(),
      cancellationFee: z.number().nonnegative(), providerCompensation: z.number().nonnegative(),
    }).parse(confirmedPreview);
    const order = await ownedBooking(userId, orderId);
    if (String(order.currentQuotationId) !== expectation.quotationId) throw new ActionPreconditionError("Báo giá hiện tại đã thay đổi. Vui lòng xem và xác nhận lại.");
    const result = await AssignmentService.rejectRepairQuotation(expectation.quotationId, userId, reason, {
      revision: expectation.quotationRevision, ...expectation,
    });
    return { orderId, orderCode: order.orderCode, quotationId: String(result._id), status: result.status,
      message: "Đã từ chối báo giá và hủy đơn. Khoản hoàn được xử lý theo chính sách; dùng get_booking_refunds để kiểm tra kết quả thực tế." };
  },
  async reconcileRejection(userId: string, orderId: string, reason: string, expected: unknown, startedAt?: string) {
    const preview = z.object({ quotationId: z.string(), quotationRevision: z.number() }).safeParse(expected);
    if (!preview.success) return null;
    const quotation = await RepairQuotation.findOne({ _id: preview.data.quotationId, orderId, customerId: userId, isDeleted: false });
    if (!quotation || quotation.status !== "rejected" || (quotation.revision ?? 0) !== preview.data.quotationRevision
      || quotation.rejectionReason !== reason || !happenedAfter(quotation.rejectedAt, startedAt)) return null;
    const order = await AgentBookingService.reconcileCancellation(userId, orderId, `Từ chối báo giá sửa chữa: ${reason}`, expected, startedAt);
    if (!order) return null;
    return { orderId, orderCode: order.orderCode, quotationId: String(quotation._id), status: quotation.status,
      message: "Đã kiểm tra báo giá bị từ chối và đơn đã hủy. Hãy kiểm tra khoản hoàn để biết kết quả thực tế." };
  },
};
