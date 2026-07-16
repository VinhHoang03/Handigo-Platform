import api from "@/api/client";
import { unwrap } from "@/api/response";
import { bookingApi } from "@/features/booking/api/booking.api";
import type {
  CaseList,
  CaseListQuery,
  Complaint,
  CreateComplaintPayload,
  CreateReportPayload,
  CreateSupportTicketPayload,
  EvidenceFile,
  Report,
  SupportTicket,
} from "../types/caseManagement.types";

const uploadImages = async (files: File[]): Promise<EvidenceFile[]> =>
  Promise.all(
    files.map(async (file) => ({
      fileType: "image" as const,
      url: await bookingApi.uploadOrderAttachment(file),
      mimeType: file.type,
      fileName: file.name,
    })),
  );

export const caseManagementApi = {
  uploadImages,

  complaints: async (query: CaseListQuery) =>
    unwrap<CaseList<Complaint>>(await api.get("/complaints/me", { params: query })),
  complaint: async (id: string) =>
    unwrap<Complaint>(await api.get(`/complaints/${id}`)),
  createComplaint: async (payload: CreateComplaintPayload) =>
    unwrap<Complaint>(await api.post("/complaints", payload)),
  cancelComplaint: async (id: string) =>
    unwrap<Complaint>(await api.patch(`/complaints/${id}/cancel`)),
  addComplaintEvidence: async (id: string, files: EvidenceFile[], note?: string) =>
    unwrap<Complaint>(
      await api.post(`/complaints/${id}/evidence`, { files, note: note || undefined }),
    ),

  tickets: async (query: CaseListQuery) =>
    unwrap<CaseList<SupportTicket>>(
      await api.get("/support-tickets/me", { params: query }),
    ),
  ticket: async (id: string) =>
    unwrap<SupportTicket>(await api.get(`/support-tickets/${id}`)),
  createTicket: async (payload: CreateSupportTicketPayload) =>
    unwrap<SupportTicket>(await api.post("/support-tickets", payload)),
  cancelTicket: async (id: string) =>
    unwrap<SupportTicket>(await api.patch(`/support-tickets/${id}/cancel`)),
  respondTicket: async (id: string, message: string, attachments?: EvidenceFile[]) =>
    unwrap<SupportTicket>(
      await api.post(`/support-tickets/${id}/responses`, { message, attachments }),
    ),

  reports: async (query: CaseListQuery) =>
    unwrap<CaseList<Report>>(await api.get("/reports/me", { params: query })),
  report: async (id: string) => unwrap<Report>(await api.get(`/reports/${id}`)),
  createReport: async (payload: CreateReportPayload) =>
    unwrap<Report>(await api.post("/reports", payload)),
};
