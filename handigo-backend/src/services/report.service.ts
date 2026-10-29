import mongoose, { ClientSession, Types } from "mongoose";
import { AppError } from "../utils/appError";
import { Conversation } from "../models/conversation.model";
import { Feedback } from "../models/feedback.model";
import { Order } from "../models/order.model";
import { Provider } from "../models/provider.model";
import {
  Report,
  ReportStatus,
  ReportTargetType,
  ReportType,
} from "../models/report.model";
import User from "../models/user.model";
import { reviewCustomerNoShowReport } from "./customerNoShow.service";
import { getAdminNoShowDetails } from "./customerNoShowVerification.service";
import { getServiceQualityReportContext } from "./reportQuality.service";
import { withTransactionRetry } from "../utils/transaction";
import { createReportSchema, addReportEvidenceSchema, requestReportEvidenceSchema, reviewReportSchema } from "../validations/report.validator";

type UserRole = "CUSTOMER" | "PROVIDER" | "ADMIN";

export interface Query {
  orderId?: string;
  page?: string | number;
  limit?: string | number;
  status?: string;
  reportType?: string;
  targetType?: string;
  keyword?: string;
}

export interface EvidenceFilePayload {
  fileType: "image" | "video" | "file";
  url: string;
  mimeType?: string | null;
  fileName?: string | null;
}

interface CreateReportPayload {
  targetType: ReportTargetType;
  targetUserId?: string;
  targetProviderId?: string;
  orderId?: string;
  targetFeedbackId?: string;
  conversationId?: string;
  reportType: ReportType;
  title: string;
  description: string;
  evidenceImages?: string[];
  evidenceFiles?: EvidenceFilePayload[];
}

const assertObjectId = (id: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`${fieldName} không hợp lệ`, 400);
  }
};

const getPagination = (query: Query = {}) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 50);
  return { page, limit, skip: (page - 1) * limit };
};

const getProviderByUserId = async (userId: string) => {
  return Provider.findOne({ userId, isDeleted: false }).select("_id userId");
};

const resolveProviderUserId = async (providerId: string) => {
  assertObjectId(providerId, "Provider id");
  const provider = await Provider.findOne({ _id: providerId, isDeleted: false }).select("userId");
  if (!provider) {
    throw new AppError("Không tìm thấy hồ sơ thợ", 404);
  }
  return provider.userId;
};

const assertUserExists = async (userId: string) => {
  assertObjectId(userId, "User id");
  const user = await User.findOne({ _id: userId, isDeleted: false }).select("_id");
  if (!user) {
    throw new AppError("Không tìm thấy người dùng bị báo cáo", 404);
  }
};

const resolveReportTarget = async (
  reporterId: string,
  role: UserRole,
  payload: CreateReportPayload,
) => {
  let targetUserId: Types.ObjectId | null = null;
  let orderId: Types.ObjectId | null = null;
  let targetFeedbackId: Types.ObjectId | null = null;
  let conversationId: Types.ObjectId | null = null;

  const provider = role === "PROVIDER" ? await getProviderByUserId(reporterId) : null;
  if (role === "PROVIDER" && !provider) {
    throw new AppError("Không tìm thấy hồ sơ thợ", 404);
  }

  if (payload.targetType === "user" || payload.targetType === "provider") {
    if (payload.targetProviderId) targetUserId = await resolveProviderUserId(payload.targetProviderId);
    if (payload.targetUserId) {
      await assertUserExists(payload.targetUserId);
      if (targetUserId && targetUserId.toString() !== payload.targetUserId) {
        throw new AppError("Người dùng và hồ sơ thợ bị báo cáo không khớp", 400);
      }
      targetUserId = new Types.ObjectId(payload.targetUserId);
    }
    if (!targetUserId) throw new AppError("Thiếu người dùng bị báo cáo", 400);
    if (payload.targetType === "provider" && !payload.targetProviderId) {
      const targetProvider = await getProviderByUserId(targetUserId.toString());
      if (!targetProvider) throw new AppError("Không tìm thấy hồ sơ thợ", 404);
    }
  }

  if (payload.targetType === "feedback") {
    const feedback = await Feedback.findOne({
      _id: payload.targetFeedbackId, isDeleted: false, isVisible: true,
    }).select(
      "customerId orderId providerId",
    );
    if (!feedback) throw new AppError("Không tìm thấy đánh giá", 404);
    if (feedback.customerId.toString() !== reporterId &&
      feedback.providerId.toString() !== provider?._id.toString()) {
      throw new AppError("Bạn không có quyền báo cáo đánh giá này", 403);
    }
    targetUserId = feedback.customerId;
    orderId = feedback.orderId;
    targetFeedbackId = feedback._id;
  }

  if (payload.targetType === "chat_conversation") {
    const conversation = await Conversation.findOne({ _id: payload.conversationId, isDeleted: false });
    if (!conversation) throw new AppError("Không tìm thấy cuộc trò chuyện", 404);
    orderId = conversation.orderId;
    conversationId = conversation._id;

    if (role === "CUSTOMER" && conversation.customerId.toString() === reporterId) {
      targetUserId = await resolveProviderUserId(conversation.providerId.toString());
    } else if (role === "PROVIDER") {
      if (!provider || conversation.providerId.toString() !== provider._id.toString()) {
        throw new AppError("Bạn không có quyền báo cáo cuộc trò chuyện này", 403);
      }
      targetUserId = conversation.customerId;
    } else {
      throw new AppError("Chỉ khách hàng và thợ được tạo báo cáo", 403);
    }
  }

  if (payload.orderId && orderId && payload.orderId !== orderId.toString()) {
    throw new AppError("Đơn dịch vụ không khớp với tài nguyên bị báo cáo", 400);
  }
  orderId = orderId ?? (payload.orderId ? new Types.ObjectId(payload.orderId) : null);
  if (orderId) {
    const order = await Order.findOne({ _id: orderId, isDeleted: false });
    if (!order) throw new AppError("Không tìm thấy đơn dịch vụ", 404);
    let participantId: Types.ObjectId | null = null;
    if (role === "CUSTOMER" && order.customerId.toString() === reporterId) {
      if (order.providerId) participantId = await resolveProviderUserId(order.providerId.toString());
    } else if (provider && order.providerId?.toString() === provider._id.toString()) {
      participantId = order.customerId;
    } else {
      throw new AppError("Bạn không có quyền báo cáo đơn dịch vụ này", 403);
    }
    if (targetUserId && targetUserId.toString() !== participantId?.toString()) {
      throw new AppError("Đối tượng bị báo cáo không thuộc ngữ cảnh đơn dịch vụ", 400);
    }
    targetUserId = participantId;
  }

  if (payload.targetUserId && payload.targetUserId !== targetUserId?.toString()) {
    throw new AppError("Người dùng không khớp với đối tượng bị báo cáo", 400);
  }

  if (targetUserId?.toString() === reporterId) {
    throw new AppError("Bạn không thể tự báo cáo chính mình", 400);
  }

  return { targetUserId, orderId, targetFeedbackId, conversationId };
};

const normalizeEvidenceFiles = (files: EvidenceFilePayload[] = []) =>
  files.map((file) => ({
    fileType: file.fileType,
    url: file.url,
    mimeType: file.mimeType ?? null,
    fileName: file.fileName ?? null,
    uploadedAt: new Date(),
  }));

const populateReport = () => [
  { path: "reporterId", select: "fullName email avatar role" },
  { path: "targetUserId", select: "fullName email avatar role" },
  { path: "orderId", select: "orderCode status" },
  { path: "targetFeedbackId", select: "rating comment images providerReply" },
  { path: "handledBy", select: "fullName email" },
  { path: "reviewedBy", select: "fullName email" },
  { path: "evidenceFiles.uploadedBy", select: "fullName email avatar role" },
  { path: "createdViolationId", select: "violationType severity penaltyType status" },
];

const populateReportForUser = async (reporterId: string) => {
  const provider = await getProviderByUserId(reporterId);
  const participants: Record<string, unknown>[] = [{ customerId: reporterId }];
  if (provider) participants.push({ providerId: provider._id });
  return populateReport().map((entry) => {
    if (entry.path === "orderId") {
      return { ...entry, match: { isDeleted: false, $or: participants } };
    }
    if (entry.path === "targetFeedbackId") {
      return { ...entry, match: { isDeleted: false, isVisible: true, $or: participants } };
    }
    return entry;
  });
};

export const createReport = async (
  reporterId: string,
  role: UserRole,
  payload: CreateReportPayload,
  resourceId?: Types.ObjectId,
) => {
  assertObjectId(reporterId, "User id");
  if (!["CUSTOMER", "PROVIDER"].includes(role)) {
    throw new AppError("Chỉ khách hàng và thợ được tạo báo cáo", 403);
  }

  const parsed = createReportSchema.safeParse(payload);
  if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
  payload = parsed.data;

  const target = await resolveReportTarget(reporterId, role, payload);

  const create = (session?: ClientSession) => Report.create([{
    ...(resourceId ? { _id: resourceId } : {}),
    reporterRole: role as "CUSTOMER" | "PROVIDER",
    reporterId,
    targetType: payload.targetType,
    targetUserId: target.targetUserId,
    orderId: target.orderId,
    targetFeedbackId: target.targetFeedbackId,
    conversationId: target.conversationId,
    reportType: payload.reportType,
    title: payload.title,
    description: payload.description,
    evidenceImages: payload.evidenceImages ?? [],
    evidenceFiles: normalizeEvidenceFiles(payload.evidenceFiles),
  }], { session });

  const reportId = payload.reportType === "service_quality"
    ? await withReportTransaction(async (session) => {
      const order = await Order.findOneAndUpdate(
        { _id: payload.orderId, isDeleted: false }, { $inc: { __v: 1 } },
        { session, new: true, runValidators: true },
      );
      if (!order) throw new AppError("Không tìm thấy đơn dịch vụ", 404);
      const context = await getServiceQualityReportContext(reporterId, role, payload.orderId!, session);
      target.targetUserId = context.targetUserId;
      const [report] = await create(session);
      return report._id;
    })
    : (await create())[0]._id;

  return Report.findById(reportId).populate(await populateReportForUser(reporterId));
};

export const getMyReports = async (reporterId: string, query: Query = {}) => {
  assertObjectId(reporterId, "User id");
  const { page, limit, skip } = getPagination(query);
  const filter: Record<string, unknown> = { reporterId, isDeleted: false };

  if (query.status) filter.status = query.reportType === "service_quality" && query.status === "resolved"
    ? { $in: ["resolved", "confirmed"] } : query.status;
  if (query.orderId) filter.orderId = query.orderId;
  if (query.reportType) filter.reportType = query.reportType;
  if (query.targetType) filter.targetType = query.targetType;

  const populate = await populateReportForUser(reporterId);

  const [items, total] = await Promise.all([
    Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate(populate),
    Report.countDocuments(filter),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getReportForUser = async (reporterId: string, reportId: string) => {
  assertObjectId(reporterId, "User id");
  assertObjectId(reportId, "Report id");
  const report = await Report.findOne({
    _id: reportId,
    reporterId,
    isDeleted: false,
  }).populate(await populateReportForUser(reporterId));
  if (!report) throw new AppError("Không tìm thấy báo cáo", 404);
  return report;
};

export const getAdminReports = async (query: Query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter: Record<string, unknown> = { isDeleted: false };

  if (query.status) filter.status = query.reportType === "service_quality" && query.status === "resolved"
    ? { $in: ["resolved", "confirmed"] } : query.status;
  if (query.orderId) filter.orderId = query.orderId;
  if (query.reportType) filter.reportType = query.reportType;
  if (query.targetType) filter.targetType = query.targetType;
  if (query.keyword?.trim()) {
    const keyword = query.keyword
      .trim()
      .replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
    const regex = new RegExp(keyword, "i");
    filter.$or = [{ title: regex }, { description: regex }];
  }

  const [items, total] = await Promise.all([
    Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate(populateReport()),
    Report.countDocuments(filter),
  ]);

  const reporterIds = [
    ...new Set(items.map((item) => item.reporterId?._id?.toString()).filter(Boolean)),
  ];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const reporterStats = await Promise.all(
    reporterIds.map(async (reporterId) => {
      const [recentTotal, rejectedTotal] = await Promise.all([
        Report.countDocuments({ reporterId, createdAt: { $gte: sevenDaysAgo }, isDeleted: false }),
        Report.countDocuments({
          reporterId,
          status: "rejected",
          createdAt: { $gte: sevenDaysAgo },
          isDeleted: false,
        }),
      ]);
      return [reporterId, { recentTotal, rejectedTotal }] as const;
    }),
  );
  const statsByReporter = Object.fromEntries(reporterStats);

  return {
    items: items.map((item) => {
      const value = item.toObject() as any;
      const reporterId = value.reporterId?._id?.toString();
      const stats = reporterId ? statsByReporter[reporterId] : undefined;
      return {
        ...value,
        falseReportRisk: Boolean(stats && (stats.recentTotal >= 5 || stats.rejectedTotal >= 3)),
        reporterStats: stats ?? { recentTotal: 0, rejectedTotal: 0 },
      };
    }),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getAdminReportById = async (reportId: string) => {
  assertObjectId(reportId, "Report id");
  const report = await Report.findOne({ _id: reportId, isDeleted: false }).populate(
    populateReport(),
  );
  if (!report) throw new AppError("Không tìm thấy báo cáo", 404);
  if (report.isCustomerNoShow) {
    return { ...report.toObject(), noShowDetails: await getAdminNoShowDetails(report) };
  }
  return report;
};

export const reviewReport = async (
  adminId: string,
  reportId: string,
  payload: {
    status: ReportStatus;
    reviewNote?: string | null;
    resolutionNote?: string | null;
  },
) => {
  assertObjectId(adminId, "Admin id");
  assertObjectId(reportId, "Report id");

  const report = await Report.findOne({ _id: reportId, isDeleted: false });
  if (!report) throw new AppError("Không tìm thấy báo cáo", 404);
  if (report.isCustomerNoShow) {
    await reviewCustomerNoShowReport(reportId, adminId, payload);
    return getAdminReportById(reportId);
  }
  if (report.createdViolationId && payload.status !== "confirmed") {
    throw new AppError("Báo cáo đã có bản ghi vi phạm, không thể đổi sang trạng thái khác", 400);
  }

  const parsed = reviewReportSchema.safeParse(payload);
  if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
  if (payload.status === "evidence_requested") {
    throw new AppError("Vui lòng sử dụng chức năng yêu cầu bổ sung bằng chứng", 400);
  }
  await withReportTransaction(async (session) => {
    const current = await lockReport(reportId, session);
    if (!current) throw new AppError("Không tìm thấy báo cáo", 404);
    if (current.createdViolationId && payload.status !== "confirmed") {
      throw new AppError("Báo cáo đã có bản ghi vi phạm, không thể đổi sang trạng thái khác", 400);
    }
    if (current.status === "cancelled") throw new AppError("Báo cáo đã hủy, không thể cập nhật", 400);
    current.status = payload.status;
    current.reviewedBy = new Types.ObjectId(adminId);
    current.reviewedAt = new Date();
    current.handledBy = REPORT_TERMINAL_STATUSES.includes(payload.status) ? new Types.ObjectId(adminId) : null;
    current.handledAt = REPORT_TERMINAL_STATUSES.includes(payload.status) ? new Date() : null;
    current.reviewNote = payload.reviewNote ?? current.reviewNote ?? null;
    current.resolutionNote = payload.resolutionNote ?? current.resolutionNote ?? null;
    await current.save({ session });
  });
  return getAdminReportById(reportId);
};

export const REPORT_TERMINAL_STATUSES: ReportStatus[] = ["confirmed", "resolved", "rejected", "cancelled"];

const withReportTransaction = async <T>(work: (session: ClientSession) => Promise<T>) => {
  const session = await mongoose.startSession();
  try { return await withTransactionRetry(session, work); }
  finally { await session.endSession(); }
};

const lockReport = (id: string, session: ClientSession, reporterId?: string) =>
  Report.findOneAndUpdate(
    { _id: id, isDeleted: false, ...(reporterId ? { reporterId } : {}) },
    { $inc: { __v: 1 } }, { session, new: true, runValidators: true },
  );

const assertReportAcceptsEvidence = (report: { status: ReportStatus; isCustomerNoShow?: boolean }) => {
  if (REPORT_TERMINAL_STATUSES.includes(report.status)) {
    throw new AppError("Báo cáo đã kết thúc, không thể cập nhật", 400);
  }
  if (report.isCustomerNoShow) {
    throw new AppError("Báo cáo khách vắng mặt phải được xử lý qua quy trình xác minh riêng", 400);
  }
};

export const cancelReport = async (userId: string, reportId: string) => {
  assertObjectId(userId, "User id");
  assertObjectId(reportId, "Report id");
  await withReportTransaction(async (session) => {
    const report = await lockReport(reportId, session, userId);
    if (!report) throw new AppError("Không tìm thấy báo cáo", 404);
    assertReportAcceptsEvidence(report);
    report.status = "cancelled";
    report.handledAt = new Date();
    await report.save({ session });
  });
  return getReportForUser(userId, reportId);
};

export const addReportEvidence = async (
  userId: string, role: UserRole, reportId: string,
  payload: { files: EvidenceFilePayload[]; note?: string | null },
) => {
  assertObjectId(userId, "User id");
  assertObjectId(reportId, "Report id");
  const parsed = addReportEvidenceSchema.safeParse(payload);
  if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
  await withReportTransaction(async (session) => {
    const report = await lockReport(reportId, session, role === "ADMIN" ? undefined : userId);
    if (!report) throw new AppError("Không tìm thấy báo cáo", 404);
    assertReportAcceptsEvidence(report);
    report.evidenceFiles.push(...normalizeEvidenceFiles(parsed.data.files).map(file => ({
      ...file, _id: new Types.ObjectId(), uploadedBy: new Types.ObjectId(userId), note: parsed.data.note ?? null,
    })));
    if (report.status === "evidence_requested") report.status = "under_review";
    await report.save({ session });
  });
  return role === "ADMIN" ? getAdminReportById(reportId) : getReportForUser(userId, reportId);
};

export const requestReportEvidence = async (adminId: string, reportId: string, requestedEvidenceNote: string) => {
  assertObjectId(adminId, "Admin id");
  assertObjectId(reportId, "Report id");
  const parsed = requestReportEvidenceSchema.safeParse({ requestedEvidenceNote });
  if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
  await withReportTransaction(async (session) => {
    const report = await lockReport(reportId, session);
    if (!report) throw new AppError("Không tìm thấy báo cáo", 404);
    assertReportAcceptsEvidence(report);
    report.status = "evidence_requested";
    report.requestedEvidenceNote = parsed.data.requestedEvidenceNote;
    report.reviewedBy = new Types.ObjectId(adminId);
    report.reviewedAt = new Date();
    await report.save({ session });
  });
  return getAdminReportById(reportId);
};
