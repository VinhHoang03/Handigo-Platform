import { useMemo, useState } from "react";
import type {
  Complaint,
  ComplaintStatus,
  ReportStatus,
  ViolationSourceType,
} from "@/features/case-management/types/caseManagement.types";
import { getErrorMessage } from "@/utils/apiError";
import { adminCasesApi } from "../../api/adminCases.api";
import type { AdminCaseTab, SelectedAdminCase } from "./case-detail.types";

export interface SourceForViolation {
  sourceType: ViolationSourceType;
  sourceId: string;
  userId?: string;
  orderId?: string;
}

/**
 * Toàn bộ state + hành động của modal chi tiết khiếu nại/báo cáo/vi phạm.
 * Tách khỏi `AdminCasesPage` để trang chính chỉ còn lo bảng + phân trang.
 */
export function useCaseDetailController(
  tab: AdminCaseTab,
  reload: () => Promise<void>,
  /** Lỗi tải chi tiết dùng chung banner lỗi của bảng (giữ nguyên hành vi cũ). */
  reportError: (message: string) => void,
) {
  const [selected, setSelected] = useState<SelectedAdminCase | null>(null);
  const [violationSource, setViolationSource] = useState<SourceForViolation | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [nextStatus, setNextStatus] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");

  const resetForm = () => {
    setEvidenceNote("");
    setNextStatus("");
    setReviewNote("");
    setResolutionNote("");
  };

  const openDetail = async (id: string) => {
    try {
      setDetailLoading(true);
      setActionError("");
      resetForm();
      if (tab === "complaints") {
        setSelected({ kind: "complaint", item: await adminCasesApi.complaint(id) });
      } else if (tab === "reports") {
        setSelected({ kind: "report", item: await adminCasesApi.report(id) });
      } else {
        setSelected({ kind: "violation", item: await adminCasesApi.violation(id) });
      }
    } catch (requestError) {
      reportError(getErrorMessage(requestError, "Không thể tải chi tiết hồ sơ."));
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setActionError("");
  };

  const runComplaintAction = async (action: () => Promise<Complaint>) => {
    try {
      setBusy(true);
      setActionError("");
      const item = await action();
      setSelected({ kind: "complaint", item });
      resetForm();
      await reload();
    } catch (requestError) {
      setActionError(getErrorMessage(requestError, "Không thể cập nhật khiếu nại."));
    } finally {
      setBusy(false);
    }
  };

  const runReportAction = async () => {
    if (!selected || selected.kind !== "report" || !nextStatus) return;
    try {
      setBusy(true);
      setActionError("");
      const item = await adminCasesApi.reviewReport(
        selected.item._id,
        nextStatus as ReportStatus,
        reviewNote.trim() || undefined,
        resolutionNote.trim() || undefined,
      );
      setSelected({ kind: "report", item });
      resetForm();
      await reload();
    } catch (requestError) {
      setActionError(getErrorMessage(requestError, "Không thể cập nhật báo cáo."));
    } finally {
      setBusy(false);
    }
  };

  const openViolationForm = () => {
    if (!selected || selected.kind === "violation") return;
    if (selected.kind === "complaint") {
      setViolationSource({
        sourceType: "COMPLAINT",
        sourceId: selected.item._id,
        userId: selected.item.targetUserId._id,
        orderId: selected.item.orderId._id,
      });
    } else {
      setViolationSource({
        sourceType: "REPORT",
        sourceId: selected.item._id,
        userId: selected.item.targetUserId?._id,
        orderId: selected.item.orderId?._id,
      });
    }
  };

  const selectedTitle = selected?.kind === "complaint"
    ? selected.item.title
    : selected?.kind === "report"
      ? selected.item.title
      : selected?.item.violationType;

  const detailEvidence = useMemo(() => {
    if (!selected) return [];
    if (selected.kind === "complaint") {
      return [
        ...selected.item.evidenceImages,
        ...(selected.item.evidence?.map((evidence) => evidence.url) || []),
      ];
    }
    if (selected.kind === "report") {
      return [
        ...selected.item.evidenceImages,
        ...selected.item.evidenceFiles.map((file) => file.url),
      ];
    }
    return [];
  }, [selected]);

  return {
    selected,
    setSelected,
    violationSource,
    setViolationSource,
    detailLoading,
    busy,
    actionError,
    evidenceNote,
    setEvidenceNote,
    nextStatus,
    setNextStatus,
    reviewNote,
    setReviewNote,
    resolutionNote,
    setResolutionNote,
    selectedTitle,
    detailEvidence,
    openDetail,
    closeDetail,
    onRequestEvidence: () =>
      selected?.kind === "complaint" &&
      void runComplaintAction(() => adminCasesApi.requestComplaintEvidence(selected.item._id, evidenceNote.trim())),
    onUpdateComplaint: () =>
      selected?.kind === "complaint" &&
      void runComplaintAction(() =>
        adminCasesApi.updateComplaint(selected.item._id, nextStatus as ComplaintStatus, resolutionNote.trim() || undefined),
      ),
    onReviewReport: () => void runReportAction(),
    openViolationForm,
  };
}
