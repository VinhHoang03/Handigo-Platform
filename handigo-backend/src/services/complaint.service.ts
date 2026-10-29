import { Types } from "mongoose";
import { ComplaintStatus } from "../models/complaint.model";
import type { IReport } from "../models/report.model";
import { AppError } from "../utils/appError";
import * as reports from "./report.service";
import { getServiceQualityReportContext } from "./reportQuality.service";
export const getComplaintCreationContext = getServiceQualityReportContext;

type UserRole = "CUSTOMER" | "PROVIDER" | "ADMIN";

// Giữ contract API cũ; mọi thao tác ghi đi qua nghiệp vụ báo cáo chung.
const asComplaint = (report: unknown) => {
  if (!report) throw new AppError("Không tìm thấy khiếu nại", 404);
  const document = report as IReport;
  const value: IReport = typeof document.toObject === "function" ? document.toObject() : document;
  if (value.reportType !== "service_quality") throw new AppError("Không tìm thấy khiếu nại", 404);
  return {
    ...value,
    complainantId: value.reporterId,
    complainantRole: value.reporterRole,
    status: value.status === "confirmed" ? "resolved" : value.status,
    resolvedBy: value.handledBy ?? null,
    resolvedAt: value.handledAt ?? null,
    evidence: value.evidenceFiles.filter(file => file.uploadedBy).map(file => ({
      ...file, createdAt: file.uploadedAt,
    })),
  };
};

export const createComplaint = async (
  userId: string, role: UserRole,
  payload: { orderId: string; title: string; description: string; evidenceImages?: string[] },
  resourceId?: Types.ObjectId,
) => asComplaint(await reports.createReport(userId, role, {
  ...payload, targetType: "order", reportType: "service_quality",
}, resourceId));

export const getMyComplaints = async (userId: string, query: reports.Query = {}) => {
  const result = await reports.getMyReports(userId, { ...query, reportType: "service_quality" });
  return { ...result, items: result.items.map(asComplaint) };
};

export const getComplaintForUser = async (userId: string, id: string) =>
  asComplaint(await reports.getReportForUser(userId, id));

export const cancelComplaint = async (userId: string, id: string) => {
  await getComplaintForUser(userId, id);
  return asComplaint(await reports.cancelReport(userId, id));
};

export const addComplaintEvidence = async (userId: string, role: UserRole, id: string,
  payload: { files: reports.EvidenceFilePayload[]; note?: string | null }) => {
  if (role === "ADMIN") await getAdminComplaintById(id);
  else await getComplaintForUser(userId, id);
  return asComplaint(await reports.addReportEvidence(userId, role, id, payload));
};

export const getAdminComplaints = async (query: reports.Query = {}) => {
  const result = await reports.getAdminReports({ ...query, reportType: "service_quality" });
  return { ...result, items: result.items.map(asComplaint) };
};

export const getAdminComplaintById = async (id: string) => asComplaint(await reports.getAdminReportById(id));

export const requestEvidence = async (adminId: string, id: string, note: string) => {
  await getAdminComplaintById(id);
  return asComplaint(await reports.requestReportEvidence(adminId, id, note));
};

export const updateComplaintStatus = async (adminId: string, id: string,
  payload: { status: ComplaintStatus; resolutionNote?: string | null }) => {
  const current = await getAdminComplaintById(id);
  return asComplaint(await reports.reviewReport(adminId, id, {
    ...payload, status: current.createdViolationId && payload.status === "resolved" ? "confirmed" : payload.status,
  }));
};
