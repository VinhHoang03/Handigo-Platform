import { Types } from "mongoose";
import { AppError } from "../utils/appError";
import { Complaint } from "../models/complaint.model";
import { Report } from "../models/report.model";
import { Session } from "../models/session.model";
import { SupportTicket } from "../models/supportTicket.model";
import { PenaltyType, Violation } from "../models/violation.model";
import User from "../models/user.model";

interface Query {
  page?: string | number;
  limit?: string | number;
  status?: string;
  severity?: string;
  sourceType?: string;
  userId?: string;
}

interface CreateViolationPayload {
  userId?: string;
  sourceType: "REPORT" | "COMPLAINT" | "SUPPORT_TICKET";
  sourceId: string;
  orderId?: string;
  violationType: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reason: string;
  adminDecision: string;
  penalty: {
    type: PenaltyType;
    feature?: string | null;
    durationDays?: number | null;
    note?: string | null;
  };
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

const populateViolation = () => [
  { path: "userId", select: "fullName email avatar role status" },
  { path: "relatedReportId", select: "title status reportType targetType" },
  { path: "relatedComplaintId", select: "title status orderId" },
  { path: "relatedSupportTicketId", select: "subject status category priority" },
  { path: "orderId", select: "orderCode status" },
  { path: "handledBy", select: "fullName email" },
];

const resolveSource = async (payload: CreateViolationPayload) => {
  assertObjectId(payload.sourceId, "Source id");

  if (payload.sourceType === "REPORT") {
    const report = await Report.findOne({ _id: payload.sourceId, isDeleted: false });
    if (!report) throw new AppError("Không tìm thấy báo cáo", 404);
    if (report.createdViolationId) {
      throw new AppError("Báo cáo đã có bản ghi vi phạm", 400);
    }
    return {
      source: report,
      userId: payload.userId ?? report.targetUserId?.toString(),
      orderId: payload.orderId ?? report.orderId?.toString(),
      relatedReportId: report._id as Types.ObjectId,
      relatedComplaintId: null,
      relatedSupportTicketId: null,
    };
  }

  if (payload.sourceType === "COMPLAINT") {
    const complaint = await Complaint.findOne({ _id: payload.sourceId, isDeleted: false });
    if (!complaint) throw new AppError("Không tìm thấy khiếu nại", 404);
    if (complaint.createdViolationId) {
      throw new AppError("Khiếu nại đã có bản ghi vi phạm", 400);
    }
    return {
      source: complaint,
      userId: payload.userId ?? complaint.targetUserId.toString(),
      orderId: payload.orderId ?? complaint.orderId.toString(),
      relatedReportId: null,
      relatedComplaintId: complaint._id as Types.ObjectId,
      relatedSupportTicketId: null,
    };
  }

  const ticket = await SupportTicket.findOne({ _id: payload.sourceId, isDeleted: false });
  if (!ticket) throw new AppError("Không tìm thấy yêu cầu hỗ trợ", 404);
  if (ticket.createdViolationId) {
    throw new AppError("Yêu cầu hỗ trợ đã có bản ghi vi phạm", 400);
  }
  return {
    source: ticket,
    userId: payload.userId,
    orderId: payload.orderId ?? ticket.orderId?.toString(),
    relatedReportId: null,
    relatedComplaintId: null,
    relatedSupportTicketId: ticket._id as Types.ObjectId,
  };
};

const applyPenalty = async (userId: string, penaltyType: PenaltyType) => {
  if (penaltyType === "WARNING") return;
  if (
    penaltyType === "TEMPORARY_SUSPEND" ||
    penaltyType === "PERMANENT_BAN" ||
    penaltyType === "account_locked" ||
    penaltyType === "provider_suspended"
  ) {
    await User.findOneAndUpdate(
      { _id: userId, isDeleted: false },
      { status: "locked" },
      { new: true, runValidators: true },
    );
    await Session.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
  }
};

const getPenaltyEndAt = (penalty: CreateViolationPayload["penalty"]) => {
  if (penalty.type !== "TEMPORARY_SUSPEND" || !penalty.durationDays) return null;
  return new Date(Date.now() + penalty.durationDays * 24 * 60 * 60 * 1000);
};

export const createViolation = async (adminId: string, payload: CreateViolationPayload) => {
  assertObjectId(adminId, "Admin id");
  const source = await resolveSource(payload);
  const userId = source.userId;

  if (!userId) {
    throw new AppError("Cần chọn người dùng vi phạm", 400);
  }
  assertObjectId(userId, "User id");

  const violatedUser = await User.findOne({ _id: userId, isDeleted: false }).select("_id role");
  if (!violatedUser) throw new AppError("Không tìm thấy người dùng vi phạm", 404);
  if (violatedUser.role === "ADMIN") {
    throw new AppError("Không thể tạo vi phạm cho tài khoản quản trị trong phiên bản này", 400);
  }

  const now = new Date();
  const violation = await Violation.create({
    userId,
    sourceType: payload.sourceType,
    sourceId: payload.sourceId,
    relatedReportId: source.relatedReportId,
    relatedComplaintId: source.relatedComplaintId,
    relatedSupportTicketId: source.relatedSupportTicketId,
    orderId: source.orderId ? new Types.ObjectId(source.orderId) : null,
    violationType: payload.violationType,
    severity: payload.severity,
    penaltyType: payload.penalty.type,
    penalty: payload.penalty,
    handledBy: adminId,
    reason: payload.reason,
    adminDecision: payload.adminDecision,
    note: payload.penalty.note ?? null,
    startAt: now,
    endAt: getPenaltyEndAt(payload.penalty),
    appliedAt: now,
  });

  await applyPenalty(userId, payload.penalty.type);

  if (payload.sourceType === "REPORT") {
    await Report.findByIdAndUpdate(
      payload.sourceId,
      {
        status: "confirmed",
        handledBy: adminId,
        handledAt: now,
        reviewNote: payload.reason,
        resolutionNote: payload.adminDecision,
        createdViolationId: violation._id,
      },
      { runValidators: true },
    );
  } else if (payload.sourceType === "COMPLAINT") {
    await Complaint.findByIdAndUpdate(
      payload.sourceId,
      {
        status: "resolved",
        reviewedBy: adminId,
        reviewedAt: now,
        resolvedBy: adminId,
        resolvedAt: now,
        resolutionNote: payload.adminDecision,
        createdViolationId: violation._id,
      },
      { runValidators: true },
    );
  } else {
    await SupportTicket.findByIdAndUpdate(
      payload.sourceId,
      {
        status: "resolved",
        assignedAdminId: adminId,
        resolvedBy: adminId,
        resolvedAt: now,
        resolutionNote: payload.adminDecision,
        createdViolationId: violation._id,
      },
      { runValidators: true },
    );
  }

  return Violation.findById(violation._id).populate(populateViolation());
};

export const getAdminViolations = async (query: Query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter: Record<string, unknown> = { isDeleted: false };

  if (query.status) filter.status = query.status;
  if (query.severity) filter.severity = query.severity;
  if (query.sourceType) filter.sourceType = query.sourceType;
  if (query.userId && Types.ObjectId.isValid(query.userId)) filter.userId = query.userId;

  const [items, total] = await Promise.all([
    Violation.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(populateViolation()),
    Violation.countDocuments(filter),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getAdminViolationById = async (violationId: string) => {
  assertObjectId(violationId, "Violation id");
  const violation = await Violation.findOne({ _id: violationId, isDeleted: false }).populate(
    populateViolation(),
  );
  if (!violation) throw new AppError("Không tìm thấy bản ghi vi phạm", 404);
  return violation;
};

export const getMyViolations = async (userId: string, query: Query = {}) => {
  assertObjectId(userId, "User id");
  const { page, limit, skip } = getPagination(query);
  const filter: Record<string, unknown> = { userId, isDeleted: false };
  if (query.status) filter.status = query.status;
  if (query.severity) filter.severity = query.severity;

  const [items, total] = await Promise.all([
    Violation.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(populateViolation()),
    Violation.countDocuments(filter),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};
