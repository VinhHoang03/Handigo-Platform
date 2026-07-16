import api from "@/api/client";
import { unwrap } from "@/api/response";
import type {
  CaseList,
  CaseListQuery,
  Complaint,
  ComplaintStatus,
  CreateViolationPayload,
  Report,
  ReportStatus,
  Violation,
} from "@/features/case-management/types/caseManagement.types";

export interface AdminReportQuery extends CaseListQuery {
  reportType?: string;
  targetType?: string;
}

export interface ViolationQuery extends CaseListQuery {
  severity?: string;
  sourceType?: string;
  userId?: string;
}

export const adminCasesApi = {
  complaints: async (query: CaseListQuery) =>
    unwrap<CaseList<Complaint>>(await api.get("/admin/complaints", { params: query })),
  complaint: async (id: string) =>
    unwrap<Complaint>(await api.get(`/admin/complaints/${id}`)),
  requestComplaintEvidence: async (id: string, requestedEvidenceNote: string) =>
    unwrap<Complaint>(
      await api.patch(`/admin/complaints/${id}/request-evidence`, {
        requestedEvidenceNote,
      }),
    ),
  updateComplaint: async (
    id: string,
    status: ComplaintStatus,
    resolutionNote?: string,
  ) =>
    unwrap<Complaint>(
      await api.patch(`/admin/complaints/${id}/status`, {
        status,
        resolutionNote: resolutionNote || undefined,
      }),
    ),

  reports: async (query: AdminReportQuery) =>
    unwrap<CaseList<Report>>(await api.get("/admin/reports", { params: query })),
  report: async (id: string) =>
    unwrap<Report>(await api.get(`/admin/reports/${id}`)),
  reviewReport: async (
    id: string,
    status: ReportStatus,
    reviewNote?: string,
    resolutionNote?: string,
  ) =>
    unwrap<Report>(
      await api.patch(`/admin/reports/${id}/review`, {
        status,
        reviewNote: reviewNote || undefined,
        resolutionNote: resolutionNote || undefined,
      }),
    ),

  violations: async (query: ViolationQuery) =>
    unwrap<CaseList<Violation>>(await api.get("/admin/violations", { params: query })),
  violation: async (id: string) =>
    unwrap<Violation>(await api.get(`/admin/violations/${id}`)),
  createViolation: async (payload: CreateViolationPayload) =>
    unwrap<Violation>(await api.post("/admin/violations", payload)),
};
