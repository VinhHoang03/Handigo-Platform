import mongoose, { Types } from "mongoose";
import { Order, IOrder } from "../models/order.model";
import { Provider } from "../models/provider.model";
import { Address } from "../models/address.model";
import { Location } from "../models/location.model";
import { Report, ReportStatus } from "../models/report.model";
import { AppError } from "../utils/appError";
import { withTransactionRetry } from "../utils/transaction";
import { createLogger } from "../utils/logger";
import { haversineMeters } from "./matching.service";
import { lockProviderSchedule } from "./providerSchedule.service";
import { createNotificationRecord } from "./notification.service";
import { emitToUser } from "../sockets/socketServer";
import { assertCustomerNoShowWait, CUSTOMER_NO_SHOW_ARRIVAL_RADIUS_METERS, CUSTOMER_NO_SHOW_COMPENSATION } from "../utils/customerNoShow";
import { cancelOrderWithSettlement } from "./orderCancellation.service";
import { getNoShowEvidence, storeNoShowEvidence, verifyNoShowEvidence } from "./customerNoShowVerification.service";
import type { NoShowEvidenceKind } from "../ai/customer-no-show/evidence-agent";
import { orderActorContext } from "../utils/orderActorContext";
import { releaseProviderAfterNoShow } from "./providerPresence.service";

const logger = createLogger("CustomerNoShow");

const getProvider = async (userId: string) => {
  const provider = await Provider.findOne({ userId, verified: true, isDeleted: false });
  if (!provider) throw new AppError("Không tìm thấy hồ sơ thợ hợp lệ.", 403);
  return provider;
};

const assertAccepted = (order: IOrder | null): IOrder => {
  if (!order) throw new AppError("Không tìm thấy đơn hàng của bạn.", 404);
  if (order.status !== "accepted") throw new AppError("Chỉ thực hiện thao tác này khi đơn đã nhận và chưa bắt đầu làm việc.", 409);
  if (["scheduled", "recurring"].includes(order.orderType) && order.bookingStatus !== "confirmed") {
    throw new AppError("Lịch hẹn chưa được thanh toán và xác nhận.", 409);
  }
  return order;
};

const notify = async (order: IOrder, userId: string, title: string, content: string) => {
  try {
    await createNotificationRecord({ userId, type: "ORDER", title, content, data: { orderId: order._id } }, { emitRealtime: true });
    emitToUser(userId, "order:updated", { orderId: String(order._id) });
  } catch (error) { logger.error("Không thể gửi thông báo cập nhật đơn hàng.", error, { orderId: String(order._id) }); }
};

export const markOrderArrival = async (orderId: string, userId: string) => {
  const provider = await getProvider(userId);
  const order = assertAccepted(await Order.findOne({ _id: orderId, providerId: provider._id, isDeleted: false }));
  if (String(order.arrival?.providerId) === String(provider._id)) return order;
  const [location, address] = await Promise.all([
    Location.findOne({ userId, ownerType: "provider", isActive: true, isDeleted: false }).sort({ lastUpdatedAt: -1 }).lean(),
    order.addressSnapshot ?? Address.findOne({ _id: order.addressId, isDeleted: false }).lean(),
  ]);
  const coordinates = location?.coordinates.coordinates;
  if (!coordinates || !location || Date.now() - location.lastUpdatedAt.getTime() > 120_000) {
    throw new AppError("Vui lòng cập nhật vị trí hiện tại trước khi xác nhận đã đến nơi.", 409);
  }
  const [longitude, latitude] = coordinates;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(address?.latitude) || !Number.isFinite(address?.longitude)) {
    throw new AppError("Chưa có tọa độ hợp lệ để xác nhận đã đến nơi.", 409);
  }
  if (haversineMeters(latitude, longitude, address!.latitude!, address!.longitude!) > CUSTOMER_NO_SHOW_ARRIVAL_RADIUS_METERS) {
    throw new AppError("Bạn cần ở trong phạm vi 200 m quanh địa chỉ khách để xác nhận đã đến nơi.", 409);
  }
  const updated = await Order.findOneAndUpdate({
    _id: orderId, providerId: provider._id, status: "accepted", isDeleted: false,
    "arrival.providerId": { $ne: provider._id },
  }, { $set: { arrival: { providerId: provider._id, arrivedAt: new Date(), latitude, longitude } } }, { new: true, runValidators: true });
  if (!updated) {
    const current = assertAccepted(await Order.findOne({ _id: orderId, providerId: provider._id, isDeleted: false }));
    if (String(current.arrival?.providerId) === String(provider._id)) return current;
    throw new AppError("Đơn hàng vừa thay đổi. Vui lòng tải lại.", 409);
  }
  await notify(updated, String(order.customerId), "Thợ đã đến nơi", `Thợ đã đến địa chỉ của đơn ${order.orderCode}. Vui lòng liên hệ để bắt đầu dịch vụ.`);
  return updated;
};

export const checkCustomerNoShowEligibility = async (orderId: string, userId: string) => {
  const provider = await getProvider(userId);
  const order = assertAccepted(await Order.findOne({ _id: orderId, providerId: provider._id, isDeleted: false }));
  if (order.currentQuotationId) throw new AppError("Đơn đã lưu báo giá, không thể báo khách không có mặt.", 409);
  if (order.customerNoShow) throw new AppError("Đơn này đã có báo cáo khách không có mặt. Vui lòng xem kết quả xử lý.", 409);
  assertCustomerNoShowWait(order);
  return { eligible: true, compensationAmount: CUSTOMER_NO_SHOW_COMPENSATION };
};

export const uploadNoShowEvidence = async (orderId: string, userId: string, kind: NoShowEvidenceKind, file: Express.Multer.File) => {
  await checkCustomerNoShowEligibility(orderId, userId);
  const provider = await getProvider(userId);
  const order = assertAccepted(await Order.findOne({ _id: orderId, providerId: provider._id, isDeleted: false }));
  return storeNoShowEvidence(order, userId, kind, file);
};

export const reportCustomerNoShow = async (
  orderId: string,
  userId: string,
  payload: { description: string; arrivalEvidenceIds: string[]; contactEvidenceIds: string[]; contactedCustomer: true },
) => {
  const provider = await getProvider(userId);
  const session = await mongoose.startSession();
  let result: IOrder | undefined;
  try {
    await withTransactionRetry(session, async () => {
      await lockProviderSchedule(provider._id, session);
      const order = assertAccepted(await Order.findOne({ _id: orderId, providerId: provider._id, isDeleted: false }).session(session));
      if (order.currentQuotationId) throw new AppError("Đơn đã lưu báo giá, không thể báo khách không có mặt.", 409);
      if (order.customerNoShow) throw new AppError("Đơn này đã có báo cáo khách không có mặt.", 409);
      assertCustomerNoShowWait(order);
      const evidence = await getNoShowEvidence(order._id, userId, payload.arrivalEvidenceIds, payload.contactEvidenceIds, session);
      const verification = await verifyNoShowEvidence(order, userId, evidence, session);
      const [report] = await Report.create([{
        isCustomerNoShow: true, reporterId: provider.userId, targetType: "order", targetUserId: order.customerId,
        orderId: order._id, reportType: "spam_booking", title: `Khách không có mặt - ${order.orderCode}`,
        description: `${payload.description}\nThợ xác nhận đã gọi hoặc nhắn tin nhưng không liên hệ được khách.\nĐã đến: ${order.arrival!.arrivedAt.toISOString()}.\nVị trí đến: ${order.arrival!.latitude}, ${order.arrival!.longitude}.\nHỗ trợ đề nghị: 5.000đ.`,
        evidenceImages: evidence.map((item) => item.url), noShowVerification: verification,
      }], { session });
      order.customerNoShow = { reportId: report._id, status: "pending", reportedAt: new Date(), compensationAmount: CUSTOMER_NO_SHOW_COMPENSATION, evidenceIds: evidence.map((item) => item._id) };
      await order.save({ session });
      await releaseProviderAfterNoShow(provider._id, order._id, session);
      result = order;
    });
  } finally { await session.endSession(); }
  if (!result) throw new AppError("Không thể gửi báo cáo. Vui lòng thử lại.", 409);
  const report = await Report.findById(result.customerNoShow!.reportId);
  if (report?.noShowVerification?.decision === "auto_eligible") {
    try {
      result = await orderActorContext.exit(() => cancelOrderWithSettlement({
        orderId, role: "admin", system: true,
        reason: "Hệ thống xác minh khách không có mặt sau thời gian chờ 10 phút.",
        customerNoShowReview: { reportId: String(report._id), automated: true },
      }));
    } catch {
      // Dữ liệu vừa thay đổi hoặc giao dịch chưa xác định được kết quả: giữ hàng đợi admin.
      const latest = await Order.findById(orderId);
      if (latest?.customerNoShow?.status === "approved") result = latest;
      else await Report.updateOne({ _id: report._id, status: "pending" }, { $set: {
        "noShowVerification.decision": "manual_review",
        "noShowVerification.reasons": ["Dữ liệu hoặc trạng thái giao dịch thay đổi khi tự duyệt; cần quản trị viên kiểm tra lại."],
      } }, { runValidators: true });
    }
  }
  const approved = result.customerNoShow?.status === "approved";
  emitToUser(String(provider.userId), "provider:availability", {});
  await notify(result, String(provider.userId), approved ? "Đã tự động duyệt hỗ trợ khách vắng mặt" : "Đã tiếp nhận báo cáo khách vắng mặt",
    approved ? "Đơn đã hủy, Handigo đã cộng 5.000đ vào ví. Bạn có thể nhận công việc khác khi đủ điều kiện." : "Bằng chứng cần được quản trị viên xem xét thêm. Khoản hỗ trợ 5.000đ chỉ được cộng khi được chấp thuận.");
  if (!approved) await notify(result, String(result.customerId), "Thợ báo không liên hệ được bạn", `Thợ đã báo không liên hệ được bạn ở đơn ${result.orderCode}. Vui lòng liên hệ thợ hoặc gửi yêu cầu hỗ trợ nếu thông tin chưa chính xác.`);
  return result;
};

export const reviewCustomerNoShowReport = async (
  reportId: string,
  adminId: string,
  payload: { status: ReportStatus; reviewNote?: string | null; resolutionNote?: string | null },
) => {
  if (payload.status === "confirmed") {
    const report = await Report.findOne({ _id: reportId, isCustomerNoShow: true, isDeleted: false });
    if (!report?.orderId) throw new AppError("Không tìm thấy báo cáo khách vắng mặt.", 404);
    if (report.status === "confirmed") return;
    if (!["pending", "under_review"].includes(report.status)) throw new AppError("Báo cáo đã có kết quả xử lý.", 409);
    const order = await cancelOrderWithSettlement({
      orderId: String(report.orderId), actorId: adminId, role: "admin",
      reason: "Khách không có mặt, không liên hệ được sau thời gian chờ 10 phút.",
      customerNoShowReview: { reportId, reviewNote: payload.reviewNote, resolutionNote: payload.resolutionNote },
    });
    if (order.customerNoShow?.status !== "approved") throw new AppError("Đơn đã được xử lý theo luồng khác. Vui lòng kiểm tra lại.", 409);
    await notify(order, String(report.reporterId), "Đã chấp thuận hỗ trợ khách vắng mặt", `Đơn ${order.orderCode} đã hủy. Handigo đã cộng 5.000đ hỗ trợ vào ví. Bạn có thể nhận công việc khác khi đủ điều kiện.`);
    return;
  }
  if (!["under_review", "rejected"].includes(payload.status)) {
    throw new AppError("Vui lòng chọn đang xem xét, chấp thuận hoặc từ chối báo cáo khách vắng mặt.", 409);
  }
  const note = payload.resolutionNote?.trim() || payload.reviewNote?.trim();
  if (payload.status === "rejected" && (!note || note.length < 10)) {
    throw new AppError("Vui lòng ghi lý do từ chối ít nhất 10 ký tự.", 400);
  }
  const session = await mongoose.startSession();
  let result: IOrder | undefined;
  let requesterId = "";
  try {
    await withTransactionRetry(session, async () => {
      const report = await Report.findOne({ _id: reportId, isCustomerNoShow: true, isDeleted: false }).session(session);
      if (!report) throw new AppError("Không tìm thấy báo cáo khách vắng mặt.", 404);
      if (!["pending", "under_review"].includes(report.status)) throw new AppError("Báo cáo đã có kết quả xử lý.", 409);
      const order = await Order.findOne({ _id: report.orderId, "customerNoShow.reportId": report._id, "customerNoShow.status": "pending", isDeleted: false }).session(session);
      if (!order || !order.customerNoShow) throw new AppError("Báo cáo không còn khớp với đơn hàng. Vui lòng kiểm tra lại.", 409);
      if (payload.status === "rejected" && order.providerId) await lockProviderSchedule(order.providerId, session);
      report.status = payload.status;
      report.handledBy = new Types.ObjectId(adminId);
      report.reviewedByType = "admin";
      report.handledAt = new Date();
      report.reviewNote = payload.reviewNote?.trim() || report.reviewNote;
      report.resolutionNote = payload.resolutionNote?.trim() || report.resolutionNote;
      if (payload.status === "rejected") {
        order.customerNoShow.status = "rejected";
        order.customerNoShow.reviewedAt = new Date();
        await order.save({ session });
      }
      await report.save({ session });
      requesterId = String(report.reporterId);
      result = order;
    });
  } finally { await session.endSession(); }
  if (result && payload.status === "rejected") {
    await notify(result, requesterId, "Kết quả báo cáo khách vắng mặt", `Báo cáo không được chấp thuận: ${note}. Bạn có thể tiếp tục thực hiện đơn hoặc liên hệ hỗ trợ.`);
    await notify(result, String(result.customerId), "Kết quả xem xét báo cáo", `Báo cáo khách vắng mặt của đơn ${result.orderCode} không được chấp thuận. Đơn giữ trạng thái hiện tại.`);
  }
};
