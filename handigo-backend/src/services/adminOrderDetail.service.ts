import { Types } from "mongoose";
import { Order } from "../models/order.model";
import { OrderStatus } from "../models/orderStatus.model";
import { RepairQuotation } from "../models/repairQuotation.model";
import { Feedback } from "../models/feedback.model";
import { AppError } from "../utils/appError";
import { withOrderAddress } from "../utils/orderAddress";
import { serviceImageResponse } from "../utils/serviceImageResponse";

export const getAdminOrderDetail = async (orderId: string) => {
  if (!Types.ObjectId.isValid(orderId)) throw new AppError("Định danh đơn hàng không hợp lệ.", 400);
  const order = await Order.findOne({ _id: orderId, isDeleted: false })
    .select("orderCode customerId providerId serviceId addressId addressSnapshot orderType scheduledAt status paymentMethod paymentStatus pricing depositAmount depositPaidAt inspectionRequired currentQuotationId quotationFinalAmount selectedOptionsSnapshot problemDescription customerAttachments completionEvidenceImages completionNote confirmation cancellation createdAt updatedAt")
    .populate("customerId", "fullName avatar phone email")
    .populate({ path: "providerId", select: "userId", populate: { path: "userId", select: "fullName avatar phone email" } })
    .populate({ path: "serviceId", select: "name serviceType image coverImage", transform: serviceImageResponse })
    .populate("addressId", "fullAddress detailAddress ward district province note")
    .lean();
  if (!order) return { order: null, quotation: null, feedback: null };
  const [statusHistory, quotation, feedback] = await Promise.all([
    OrderStatus.find({ orderId: order._id, isDeleted: false })
      .select("status previousStatus changedByRole note createdAt")
      .sort({ createdAt: 1, statusVersion: 1 }).lean(),
    order.currentQuotationId ? RepairQuotation.findOne({ _id: order.currentQuotationId, orderId: order._id, isDeleted: false })
      .select("quotationCode status finalAmount discountAmount subtotalAmount directPaymentConfirmedAt directPaymentConfirmedAmount customerConfirmed providerConfirmed")
      .lean() : Promise.resolve(null),
    order.status === 'completed' ? Feedback.findOne({ orderId: order._id, isDeleted: false })
      .select('orderId customerId providerId serviceId rating comment images isVisible providerReply createdAt')
      .sort({ createdAt: -1, _id: -1 }).lean() : Promise.resolve(null),
  ]);
  return {
    order: { ...withOrderAddress(order), statusHistory },
    quotation: quotation ? { quotation, items: [] } : null,
    feedback,
  };
};
