import { useToast, useToastFeedback } from "@/components/common/Toast";
import { useMemo, useState } from "react";
import type {
  Report,
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
 * Toàn bộ state + hành động của modal chi tiết báo cáo/vi phạm.
 * Tách khỏi `AdminCasesPage` để trang chính chỉ còn lo bảng + phân trang.
 */
export function useCaseDetailController(
  tab: AdminCaseTab,
  reload: () => Promise<void>,
  /** Lỗi tải chi tiết dùng chung banner lỗi của bảng (giữ nguyên hành vi cũ). */
  reportError: (message: string) => void,
) {
  const { addToast } = useToast();
  const [selected, setSelected] = useState<SelectedAdminCase | null>(null);
  const [violationSource, setViolationSource] = useState<SourceForViolation | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useToastFeedback<string>("", "error");
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
      if (tab === "reports") {
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

  const requestEvidence = async (action: () => Promise<Report>) => {
    try {
      setBusy(true);
      setActionError("");
      const item = await action();
      setSelected({ kind: "report", item });
      resetForm();
      await reload();
      addToast("Đã cập nhật hồ sơ xử lý.", "success");
    } catch (requestError) {
      setActionError(getErrorMessage(requestError, "Không thể yêu cầu bổ sung bằng chứng."));
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
      addToast("Đã cập nhật hồ sơ xử lý.", "success");
    } catch (requestError) {
      setActionError(getErrorMessage(requestError, "Không thể cập nhật báo cáo."));
    } finally {
      setBusy(false);
    }
  };

  const openViolationForm = () => {
    if (!selected || selected.kind === "violation") return;
    setViolationSource({
      sourceType: "REPORT",
      sourceId: selected.item._id,
      userId: selected.item.targetUserId?._id,
      orderId: selected.item.orderId?._id,
    });
  };

  const reverifyReport = async () => {
    if (busy || !selected || selected.kind !== "report" || !selected.item.isCustomerNoShow) return;
    const reportId = selected.item._id;
    try {
      setBusy(true);
      setActionError("");
      const item = await adminCasesApi.reverifyReport(reportId);
      setSelected(current => current?.kind === "report" && current.item._id === reportId ? { kind: "report", item } : current);
      await reload();
      addToast("Đã xác minh lại cuộc gọi và lưu lịch sử kiểm tra.", "success");
    } catch (requestError) {
      setActionError(getErrorMessage(requestError, "Không thể xác minh lại cuộc gọi."));
    } finally { setBusy(false); }
  };

  const selectedTitle = selected?.kind === "report"
      ? selected.item.title
      : selected?.item.violationType;

  const detailEvidence = useMemo(() => {
    if (!selected) return [];
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
      selected?.kind === "report" &&
      void requestEvidence(() => adminCasesApi.requestReportEvidence(selected.item._id, evidenceNote.trim())),
    onReviewReport: () => void runReportAction(),
    onReverifyReport: () => void reverifyReport(),
    openViolationForm,
  };
}
