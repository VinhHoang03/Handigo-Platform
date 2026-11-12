import type { ClientSession } from "mongoose";
import { Refund } from "../../models/refund.model";
import { WalletTransaction } from "../../models/walletTransaction.model";
import { OrderStatus } from "../../models/orderStatus.model";
import { Feedback } from "../../models/feedback.model";
import { RepairQuotation } from "../../models/repairQuotation.model";
import { RepairQuotationItem } from "../../models/repairQuotationItem.model";
import { Order } from "../../models/order.model";

export async function loadComplaintDetails(row: Record<string, unknown>, session?: ClientSession) {
  const records: Array<{ id: string; data: unknown }> = [];
  let complete = true;
  if (row.orderId) {
    const order = await Order.findOne({ _id: row.orderId, isDeleted: false }).select("customerId").session(session ?? null).lean();
    const customerId = order?.customerId ?? null;
    const refunds = await Refund.find({ orderId: row.orderId, customerId, isDeleted: false })
      .select("paymentId amount currency channel destination status completedAt updatedAt")
      .sort({ createdAt: -1, _id: -1 }).limit(51).session(session ?? null).lean();
    const transactions = await WalletTransaction.find({ relatedOrderId: row.orderId, userId: customerId, type: { $in: ["payment", "refund"] }, isDeleted: false })
      .select("relatedPaymentId type direction amount status createdAt updatedAt")
      .sort({ createdAt: -1, _id: -1 }).limit(51).session(session ?? null).lean();
    const history = await OrderStatus.find({ orderId: row.orderId, isDeleted: false })
      .select("status previousStatus changedByRole note createdAt")
      .sort({ createdAt: -1, _id: -1 }).limit(51).session(session ?? null).lean();
    const quotations = await RepairQuotation.find({ orderId: row.orderId, isDeleted: false })
      .select("quotationCode status revision inspectionNote subtotalAmount discountAmount finalAmount customerConfirmed providerConfirmed directPaymentConfirmedAt directPaymentConfirmedAmount updatedAt")
      .sort({ createdAt: -1, _id: -1 }).limit(21).session(session ?? null).lean();
    const quotationItems = await RepairQuotationItem.find({ quotationId: { $in: quotations.slice(0, 20).map(item => item._id) }, isDeleted: false })
      .select("quotationId title quantity unitPrice totalPrice itemType").sort({ _id: 1 }).limit(101).session(session ?? null).lean();
    for (const refund of refunds.slice(0, 50)) records.push({ id: `refund:${refund._id}`, data: refund });
    for (const transaction of transactions.slice(0, 50)) records.push({ id: `wallet_transaction:${transaction._id}`, data: transaction });
    for (const event of history.slice(0, 50).reverse()) records.push({ id: `order_status:${event._id}`, data: event });
    for (const quotation of quotations.slice(0, 20)) records.push({ id: `quotation:${quotation._id}`, data: quotation });
    for (const item of quotationItems.slice(0, 100)) records.push({ id: `quotation_item:${item._id}`, data: item });
    complete = [refunds, transactions, history].every(items => items.length <= 50) && quotations.length <= 20 && quotationItems.length <= 100;
    records.push({ id: "financial_inventory", data: {
      refundCount: refunds.length, walletTransactionCount: transactions.length,
      note: "Phân biệt hoàn tiền đang chờ, thất bại và đã hoàn tất; giao dịch ví phải đúng đơn và khoản thanh toán. Chưa có bản ghi không chứng minh đã hoàn tiền. Không suy ra tiền đã về ngân hàng từ trạng thái đơn.",
    } });
  }
  if (row.targetFeedbackId) {
    const feedback = await Feedback.findOne({ _id: row.targetFeedbackId, isDeleted: false })
      .select("rating comment images providerReply isVisible createdAt updatedAt").session(session ?? null).lean();
    if (feedback) records.push({ id: `feedback:${feedback._id}`, data: feedback });
  }
  return { records, complete };
}
