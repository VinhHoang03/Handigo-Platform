import mongoose, { Types } from "mongoose";
import { Report } from "../models/report.model";
import { Order } from "../models/order.model";
import { CustomerNoShowEvidence } from "../models/customerNoShowEvidence.model";
import User from "../models/user.model";
import { Address } from "../models/address.model";
import { AuditLog } from "../models/auditLog.model";
import { AppError } from "../utils/appError";
import { withTransactionRetry } from "../utils/transaction";
import { getNoShowCallVerification, NO_SHOW_VERIFICATION_VERSION } from "./customerNoShowVerification.service";

/** Đối chiếu lại cuộc gọi trên khoảng chờ đã lưu; không dùng vị trí hiện tại hoặc tự xử lý tiền. */
export const reverifyCustomerNoShowCalls = async (adminId: string, reportId: string) => {
  if (!Types.ObjectId.isValid(adminId) || !Types.ObjectId.isValid(reportId)) throw new AppError("Mã người xử lý hoặc báo cáo không hợp lệ.", 400);
  const session = await mongoose.startSession();
  try {
    await withTransactionRetry(session, async () => {
      const report = await Report.findOne({ _id: reportId, isCustomerNoShow: true, isDeleted: false }).session(session);
      if (!report) throw new AppError("Không tìm thấy báo cáo khách vắng mặt.", 404);
      if (!["pending", "under_review"].includes(report.status) || report.createdViolationId) throw new AppError("Báo cáo đã được xử lý, không thể xác minh lại.", 409);
      const previous = report.toObject().noShowVerification;
      if (!previous?.checks || !Number.isFinite(new Date(previous.checkedAt).getTime())) {
        throw new AppError("Báo cáo chưa lưu đủ dữ liệu xác minh gốc. Vui lòng xem xét thủ công.", 409);
      }
      const order = await Order.findOne({ _id: report.orderId, "customerNoShow.reportId": report._id,
        "customerNoShow.status": "pending", status: "accepted", isDeleted: false }).session(session);
      if (!order) throw new AppError("Đơn hàng không còn phù hợp để xác minh lại báo cáo.", 409);
      const ids = order.customerNoShow?.evidenceIds ?? [];
      const evidence = await CustomerNoShowEvidence.find({ _id: { $in: ids }, orderId: order._id,
        providerUserId: report.reporterId, isDeleted: false }).session(session);
      if (ids.length < 2 || evidence.length !== ids.length) throw new AppError("Không còn đủ bằng chứng gốc để xác minh lại.", 409);
      const customer = await User.findOne({ _id: order.customerId, isDeleted: false }).select("phone").session(session).lean();
      const address = order.addressSnapshot ?? await Address.findOne({ _id: order.addressId, isDeleted: false }).session(session).lean();
      const verification = getNoShowCallVerification(evidence, {
        customerPhone: customer?.phone?.trim() || address?.recipientPhone || "",
        waitStartedAt: new Date(previous.checks.waiting.waitStartedAt).getTime(), now: new Date(previous.checkedAt).getTime(),
      });
      const reasons = previous.decision === "manual_review" ? previous.reasons.filter(reason =>
        !/^Chỉ xác minh được \d+\/3 cuộc gọi/.test(reason) && !/^Cuộc gọi \d+:/.test(reason)
        && !reason.startsWith("Lịch sử cuộc gọi có kết nối với khách")) : [];
      reasons.push(...verification.reasons);
      if (!verification.checks.passed && !verification.reasons.length) reasons.push("Ảnh cuộc gọi thể hiện có phản hồi hoặc kết nối; cần quản trị viên xem xét.");
      if ((!previous.checks.location.passed || !previous.checks.waiting.passed || !previous.checks.chat.passed) && !reasons.length) {
        reasons.push("Kết quả vị trí, thời gian chờ hoặc tin nhắn đã lưu chưa đạt; cần quản trị viên xem xét.");
      }
      if (evidence.some(item => item.analysisStatus !== "analyzed" || !item.analysis)) {
        reasons.push("Chưa phân tích được toàn bộ bằng chứng gốc; cần quản trị viên xem xét.");
      }
      const next = { ...previous, policyVersion: NO_SHOW_VERIFICATION_VERSION,
        decision: reasons.length ? "manual_review" as const : "auto_eligible" as const,
        reasons: reasons.length ? [...new Set(reasons)] : ["Đối chiếu lại theo độ chính xác thời gian trên ảnh: đủ cuộc gọi hợp lệ; các điều kiện xác minh gốc được giữ nguyên. Quản trị viên tiếp tục quyết định xử lý báo cáo."],
        checks: { ...previous.checks, calls: verification.checks } };
      report.noShowVerification = next;
      await report.save({ session });
      await AuditLog.create([{
        actorId: new Types.ObjectId(adminId), actorRole: "admin", action: "customer_no_show_calls_reverified",
        targetType: "report", targetId: report._id,
        oldValue: { noShowVerification: previous }, newValue: { noShowVerification: next, reverifiedAt: new Date() },
        description: "Quản trị viên xác minh lại cuộc gọi theo bằng chứng và khoảng thời gian chờ đã lưu; giữ nguyên trạng thái báo cáo và đơn hàng.",
      }], { session });
    });
  } finally { await session.endSession(); }
};
