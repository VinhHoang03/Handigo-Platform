import { Types } from "mongoose";
import type { ClientSession } from "mongoose";
import { AppError } from "../../utils/appError";
import User from "../../models/user.model";
import { Order } from "../../models/order.model";
import { Payment } from "../../models/payment.model";
import { Refund } from "../../models/refund.model";
import { WalletTransaction } from "../../models/walletTransaction.model";
import { AdminAIAssessment } from "./admin-ai.models";
import { loadContext } from "./admin-ai.context";
import { complaintDecisionSchema, complaintWorkflowSchema, type ComplaintDecision } from "./admin-ai.complaint-schema";

export async function decideComplaint(assessmentId: string, adminId: string, input: ComplaintDecision) {
  const decision = complaintDecisionSchema.parse(input);
  const assessment = await AdminAIAssessment.findOne({ _id: assessmentId, feature: "complaint_summary", sourceType: "report", preview: false, status: { $in: ["manual", "completed"] } }).lean();
  if (!assessment) throw new AppError("Kết quả chưa sẵn sàng, chỉ là chạy thử hoặc đã được áp dụng. Hãy tải lại hồ sơ.", 409);
  if (assessment.adminDecision && (!["under_review", "evidence_requested"].includes(assessment.adminDecision.status)
    || assessment.adminDecision.status === decision.status)) {
    throw new AppError("Quyết định đã được áp dụng. Hãy tải lại hồ sơ để tiếp tục bước xử lý hợp lệ.", 409);
  }
  const resolution = assessment.output?.complaintResolution;
  const parsed = complaintWorkflowSchema.safeParse(resolution?.workflow);
  if (!parsed.success) throw new AppError("Phương án cũ chưa đủ dữ liệu nghiệp vụ. Hãy phân tích lại.", 422);
  const workflow = parsed.data;
  if (decision.completedTasks.some(task => task.index >= workflow.tasks.length)) throw new AppError("Công việc xác nhận không thuộc phương án đã phân tích.", 400);
  if (["confirmed", "rejected", "resolved"].includes(decision.status) && (workflow.missingEvidence.length || assessment.output?.missingData?.length || resolution.evidenceStatus !== "sufficient")) {
    throw new AppError("Còn thiếu bằng chứng. Hãy bổ sung và phân tích lại trước khi xác nhận, từ chối hoặc kết thúc ca.", 422);
  }
  if (["confirmed", "rejected"].includes(decision.status) && !workflow.facts.length) throw new AppError("Chưa có dữ kiện đối chiếu để xác nhận hoặc từ chối phản ánh.", 422);
  if (decision.status === "rejected" && !resolution.policyFindings?.some((finding: { sourceId: string; applicable: string }) => finding.sourceId !== "policy:warranty" && finding.applicable !== "unknown")) throw new AppError("Từ chối khiếu nại cần căn cứ chính sách được đối chiếu.", 422);
  if (decision.status === "resolved" && workflow.tasks.some((_, index) => !decision.completedTasks.some(task => task.index === index))) {
    throw new AppError("Chưa có kết quả xác minh cho tất cả công việc. Không thể kết thúc khiếu nại.", 422);
  }
  const beforeWrite = async (session: ClientSession) => {
    if (!await User.exists({ _id: adminId, role: "ADMIN", status: "active", isDeleted: false }).session(session)) throw new AppError("Tài khoản không còn quyền quản trị hoạt động.", 403);
    const context = await loadContext({ sourceType: "report", sourceId: assessment.sourceId }, session);
    if (context.hash !== (assessment.appliedSourceHash || assessment.sourceHash) || !context.catalogComplete) throw new AppError("Hồ sơ, bằng chứng hoặc giao dịch đã thay đổi hay chưa thu thập đủ. Hãy phân tích lại.", 409);
    if (decision.status === "resolved" && (workflow.category === "refund" || workflow.tasks.some(task => task.kind === "refund"))) {
      const linkedOrderId = String(context.row?.orderId || "");
      if (!Types.ObjectId.isValid(linkedOrderId)) throw new AppError("Chưa xác định được đơn hàng để đối soát hoàn tiền.", 422);
      const order = await Order.findOne({ _id: linkedOrderId, isDeleted: false }).select("customerId").session(session).lean();
      const ownedPayments = await Payment.find({ orderId: order?._id ?? null, customerId: order?.customerId ?? null, isDeleted: false }).select("amount method status").session(session).lean();
      const refunds = await Refund.find({ orderId: order?._id ?? null, customerId: order?.customerId ?? null, isDeleted: false }).select("paymentId amount status channel destination completedAt").session(session).lean();
      const transactions = await WalletTransaction.find({ relatedOrderId: order?._id ?? null, userId: order?.customerId ?? null, type: "refund", isDeleted: false }).select("relatedPaymentId type amount status direction").session(session).lean();
      const payments = new Map(ownedPayments.map(payment => [String(payment._id), payment]));
      const records = [...refunds.map(data => ({ channel: "refund" as const, data })), ...transactions.map(data => ({ channel: "wallet" as const, data }))];
      const pending = refunds.some(refund => refund.status !== "succeeded");
      const succeeded = records.some(record => {
        const paymentId = record.channel === "refund" ? record.data.paymentId : record.data.relatedPaymentId;
        const payment = payments.get(String(paymentId));
        if (!payment || !["paid", "refunded"].includes(payment.status) || record.data.amount <= 0 || record.data.amount > payment.amount) return false;
        return record.channel === "refund"
          ? record.data.status === "succeeded" && record.data.completedAt && record.data.channel === "payos_payout" && record.data.destination === "source_account" && payment.method === "payos"
          : record.data.status === "success" && record.data.direction === "in";
      });
      if (pending || !succeeded) throw new AppError("Khoản hoàn chưa được hệ thống xác nhận hoàn tất. Tiếp tục theo dõi hoặc xử lý lỗi hoàn tiền.", 422);
    }
    const saved = await AdminAIAssessment.updateOne({ _id: assessmentId, updatedAt: assessment.updatedAt,
      ...(assessment.adminDecision ? { "adminDecision.decidedAt": assessment.adminDecision.decidedAt } : { adminDecision: null }),
      status: { $in: ["manual", "completed"] } }, {
      $set: { adminDecision: { actorId: new Types.ObjectId(adminId), ...decision, decidedAt: new Date() } },
    }, { session, runValidators: true });
    if (saved.modifiedCount !== 1) throw new AppError("Phương án vừa được xử lý bởi phiên khác. Hãy tải lại.", 409);
  };
  const afterWrite = async (session: ClientSession) => {
    const context = await loadContext({ sourceType: "report", sourceId: assessment.sourceId }, session);
    await AdminAIAssessment.updateOne({ _id: assessmentId }, { $set: { appliedSourceHash: context.hash } }, { session, runValidators: true });
  };
  if (decision.status === "evidence_requested") {
    const { requestReportEvidence } = await import("../../services/report.service");
    await requestReportEvidence(adminId, assessment.sourceId, decision.note, undefined, { beforeWrite, afterWrite });
  } else {
    const { reviewReport } = await import("../../services/report.service");
    await reviewReport(adminId, assessment.sourceId, {
      status: decision.status, reviewNote: `Admin quyết định từ phân tích AI ${assessment._id}. ${decision.note}`.slice(0, 3000),
      resolutionNote: ["resolved", "rejected", "confirmed"].includes(decision.status) ? decision.note : undefined,
    }, undefined, { beforeWrite, afterWrite });
  }
  return { assessmentId, sourceId: assessment.sourceId, status: decision.status };
}
