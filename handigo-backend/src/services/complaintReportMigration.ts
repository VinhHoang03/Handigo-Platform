import type { IComplaint } from "../models/complaint.model";
import type { IComplaintEvidence } from "../models/complaintEvidence.model";

// Giữ nguyên định danh để URL, kết quả AI và đăng ký theo dõi cũ tiếp tục hoạt động.
export const complaintToReport = (complaint: IComplaint, evidence: IComplaintEvidence[]) => ({
  _id: complaint._id,
  legacyComplaintId: complaint._id,
  reporterId: complaint.complainantId,
  reporterRole: complaint.complainantRole,
  targetType: "order" as const,
  reportType: "service_quality" as const,
  targetUserId: complaint.targetUserId,
  orderId: complaint.orderId,
  title: complaint.title,
  description: complaint.description,
  evidenceImages: complaint.evidenceImages,
  evidenceFiles: evidence.filter(file => !file.isDeleted).map(file => ({
    _id: file._id,
    fileType: file.fileType,
    url: file.url,
    mimeType: file.mimeType,
    fileName: file.fileName,
    note: file.note,
    uploadedBy: file.uploadedBy,
    uploadedAt: file.createdAt,
  })),
  status: complaint.createdViolationId ? "confirmed" as const : complaint.status,
  requestedEvidenceNote: complaint.requestedEvidenceNote,
  reviewedBy: complaint.reviewedBy,
  reviewedAt: complaint.reviewedAt,
  handledBy: complaint.resolvedBy,
  handledAt: complaint.resolvedAt,
  resolutionNote: complaint.resolutionNote,
  createdViolationId: complaint.createdViolationId,
  isDeleted: complaint.isDeleted,
  deletedAt: complaint.deletedAt,
  createdAt: complaint.createdAt,
  updatedAt: complaint.updatedAt,
});
