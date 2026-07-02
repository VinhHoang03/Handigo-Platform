import { Types } from "mongoose";
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

type UserRole = "CUSTOMER" | "PROVIDER" | "ADMIN";

interface Query {
  page?: string | number;
  limit?: string | number;
  status?: string;
  reportType?: string;
  targetType?: string;
  keyword?: string;
}

interface EvidenceFilePayload {
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
  let targetUserId = payload.targetUserId ? new Types.ObjectId(payload.targetUserId) : null;
  let orderId = payload.orderId ? new Types.ObjectId(payload.orderId) : null;
  let targetFeedbackId = payload.targetFeedbackId
    ? new Types.ObjectId(payload.targetFeedbackId)
    : null;
  let conversationId = payload.conversationId ? new Types.ObjectId(payload.conversationId) : null;

  if (targetUserId) {
    await assertUserExists(targetUserId.toString());
  }

  if (payload.targetType === "provider" && !targetUserId && payload.targetProviderId) {
    targetUserId = await resolveProviderUserId(payload.targetProviderId);
  }

  if (payload.targetType === "user" || payload.targetType === "provider") {
    if (!targetUserId) {
      throw new AppError("Thiếu người dùng bị báo cáo", 400);
    }
  }

  if (payload.targetType === "order") {
    if (!orderId) throw new AppError("Thiếu đơn dịch vụ bị báo cáo", 400);
    const order = await Order.findOne({ _id: orderId, isDeleted: false });
    if (!order) throw new AppError("Không tìm thấy đơn dịch vụ", 404);

    if (role === "CUSTOMER" && order.customerId.toString() === reporterId) {
      if (order.providerId) targetUserId = await resolveProviderUserId(order.providerId.toString());
    } else if (role === "PROVIDER") {
      const provider = await getProviderByUserId(reporterId);
      if (!provider || order.providerId?.toString() !== provider._id.toString()) {
        throw new AppError("Bạn không có quyền báo cáo đơn dịch vụ này", 403);
      }
      targetUserId = order.customerId;
    } else {
      throw new AppError("Chỉ khách hàng và thợ được tạo báo cáo", 403);
    }
  }

  if (payload.targetType === "feedback") {
    if (!targetFeedbackId) throw new AppError("Thiếu đánh giá bị báo cáo", 400);
    const feedback = await Feedback.findOne({ _id: targetFeedbackId, isDeleted: false }).select(
      "customerId orderId",
    );
    if (!feedback) throw new AppError("Không tìm thấy đánh giá", 404);
    targetUserId = feedback.customerId;
    orderId = feedback.orderId;
  }

  if (payload.targetType === "chat_conversation") {
    if (!conversationId) throw new AppError("Thiếu cuộc trò chuyện bị báo cáo", 400);
    const conversation = await Conversation.findOne({ _id: conversationId, isDeleted: false });
    if (!conversation) throw new AppError("Không tìm thấy cuộc trò chuyện", 404);
    orderId = conversation.orderId;

    if (role === "CUSTOMER" && conversation.customerId.toString() === reporterId) {
      targetUserId = await resolveProviderUserId(conversation.providerId.toString());
    } else if (role === "PROVIDER") {
      const provider = await getProviderByUserId(reporterId);
      if (!provider || conversation.providerId.toString() !== provider._id.toString()) {
        throw new AppError("Bạn không có quyền báo cáo cuộc trò chuyện này", 403);
      }
      targetUserId = conversation.customerId;
    } else {
      throw new AppError("Chỉ khách hàng và thợ được tạo báo cáo", 403);
    }
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
  { path: "createdViolationId", select: "violationType severity penaltyType status" },
];

export const createReport = async (
  reporterId: string,
  role: UserRole,
  payload: CreateReportPayload,
) => {
  assertObjectId(reporterId, "User id");
  if (!["CUSTOMER", "PROVIDER"].includes(role)) {
    throw new AppError("Chỉ khách hàng và thợ được tạo báo cáo", 403);
  }

  const target = await resolveReportTarget(reporterId, role, payload);

  const report = await Report.create({
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
  });

  return Report.findById(report._id).populate(populateReport());
};

export const getMyReports = async (reporterId: string, query: Query = {}) => {
  assertObjectId(reporterId, "User id");
  const { page, limit, skip } = getPagination(query);
  const filter: Record<string, unknown> = { reporterId, isDeleted: false };

  if (query.status) filter.status = query.status;
  if (query.reportType) filter.reportType = query.reportType;
  if (query.targetType) filter.targetType = query.targetType;

  const [items, total] = await Promise.all([
    Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate(populateReport()),
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
  }).populate(populateReport());
  if (!report) throw new AppError("Không tìm thấy báo cáo", 404);
  return report;
};

export const getAdminReports = async (query: Query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter: Record<string, unknown> = { isDeleted: false };

  if (query.status) filter.status = query.status;
  if (query.reportType) filter.reportType = query.reportType;
  if (query.targetType) filter.targetType = query.targetType;
  if (query.keyword?.trim()) {
    const regex = new RegExp(query.keyword.trim(), "i");
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
  if (report.createdViolationId && payload.status !== "confirmed") {
    throw new AppError("Báo cáo đã có bản ghi vi phạm, không thể đổi sang trạng thái khác", 400);
  }

  report.status = payload.status;
  report.handledBy = new Types.ObjectId(adminId);
  report.handledAt = new Date();
  report.reviewNote = payload.reviewNote ?? report.reviewNote ?? null;
  report.resolutionNote = payload.resolutionNote ?? report.resolutionNote ?? null;
  await report.save();

  return getAdminReportById(reportId);
};
