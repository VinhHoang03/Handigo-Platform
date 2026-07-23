import { useCallback, useEffect, useState } from "react";
import { Eye, RefreshCw } from "lucide-react";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { Pagination } from "@/components/common/Pagination";
import { DataTable } from "@/components/common/dashboard/DataTable";
import { TableSkeleton } from "@/components/common/dashboard/TableSkeleton";
import { TableToolbar } from "@/components/common/dashboard/TableToolbar";
import type { CaseListQuery } from "@/features/case-management/types/caseManagement.types";
import { getErrorMessage } from "@/utils/apiError";
import { adminCasesApi, type ViolationQuery } from "../api/adminCases.api";
import { CaseDetailModal } from "../components/cases/CaseDetailModal";
import { CaseTabs } from "../components/cases/CaseTabs";
import { caseTableColumns } from "../components/cases/case-table-columns";
import type { AdminCaseTab, CaseRow } from "../components/cases/case-detail.types";
import { CASE_STATUS_LABELS, CASE_STATUS_OPTIONS } from "../components/cases/case-status.constants";
import { useCaseDetailController } from "../components/cases/useCaseDetailController";
import { ViolationFormModal } from "../components/cases/ViolationFormModal";

export default function AdminCasesPage() {
  const [tab, setTab] = useState<AdminCaseTab>("complaints");
  const [query, setQuery] = useState<CaseListQuery>({ page: 1, limit: 10 });
  const [items, setItems] = useState<CaseRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = tab === "complaints"
        ? await adminCasesApi.complaints(query)
        : tab === "reports"
          ? await adminCasesApi.reports(query)
          : await adminCasesApi.violations(query as ViolationQuery);
      setItems(result.items);
      setTotalPages(result.pagination.totalPages || 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Không thể tải hàng đợi xử lý."));
    } finally {
      setLoading(false);
    }
  }, [query, tab]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const detail = useCaseDetailController(tab, load, setError);

  const switchTab = (nextTab: AdminCaseTab) => {
    setTab(nextTab);
    setQuery({ page: 1, limit: 10 });
    setItems([]);
    detail.setSelected(null);
  };

  return (
    <DashboardShell role="ADMIN">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-headline-lg font-bold">Khiếu nại, báo cáo và vi phạm</h1>
          <p className="mt-2 text-on-surface-variant">Kiểm tra bằng chứng, ra quyết định xử lý và áp dụng hình phạt từ nguồn đã xác minh.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2.5 font-semibold text-primary disabled:opacity-40">
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} /> Làm mới
        </button>
      </header>

      <CaseTabs tab={tab} onSwitch={switchTab} />

      <TableToolbar
        search={{
          value: query.keyword || "",
          onChange: (value) => setQuery((current) => ({ ...current, page: 1, keyword: value || undefined })),
          placeholder: "Tìm theo tiêu đề hoặc nội dung...",
          disabled: tab === "violations",
        }}
        filters={
          <select value={query.status || ""} onChange={(event) => setQuery((current) => ({ ...current, page: 1, status: event.target.value || undefined }))} className="min-h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-3">
            <option value="">Tất cả trạng thái</option>
            {CASE_STATUS_OPTIONS[tab].map((status) => (
              <option key={status} value={status}>{CASE_STATUS_LABELS[status] || status}</option>
            ))}
          </select>
        }
      />

      <AsyncState loading={loading} error={error} onRetry={load} skeleton={<TableSkeleton columns={caseTableColumns.length + 1} rowCount={query.limit || 10} />}>
        <DataTable
          columns={[
            ...caseTableColumns,
            {
              key: "actions",
              header: "Thao tác",
              className: "text-right",
              render: (item) => (
                <button type="button" onClick={() => void detail.openDetail(item._id)} title="Xem chi tiết" className="inline-grid h-10 w-10 place-items-center rounded-xl border border-outline-variant text-primary">
                  <Eye size={18} />
                </button>
              ),
            },
          ]}
          rows={items}
          rowKey={(item) => item._id}
          emptyState={<div className="p-10 text-center text-on-surface-variant">Không có hồ sơ phù hợp.</div>}
          minWidthClassName="min-w-[900px]"
        />
      </AsyncState>
      <Pagination page={query.page || 1} totalPages={totalPages} onChange={(page) => setQuery((current) => ({ ...current, page }))} />

      <CaseDetailModal
        open={Boolean(detail.selected) || detail.detailLoading}
        detailLoading={detail.detailLoading}
        selected={detail.selected}
        selectedTitle={detail.selectedTitle}
        detailEvidence={detail.detailEvidence}
        busy={detail.busy}
        actionError={detail.actionError}
        evidenceNote={detail.evidenceNote}
        onEvidenceNoteChange={detail.setEvidenceNote}
        onRequestEvidence={detail.onRequestEvidence}
        nextStatus={detail.nextStatus}
        onNextStatusChange={detail.setNextStatus}
        reviewNote={detail.reviewNote}
        onReviewNoteChange={detail.setReviewNote}
        resolutionNote={detail.resolutionNote}
        onResolutionNoteChange={detail.setResolutionNote}
        onUpdateComplaint={detail.onUpdateComplaint}
        onReviewReport={detail.onReviewReport}
        onOpenViolationForm={detail.openViolationForm}
        onClose={detail.closeDetail}
      />

      {detail.violationSource && (
        <ViolationFormModal
          open
          {...detail.violationSource}
          onClose={() => detail.setViolationSource(null)}
          onCreated={() => { detail.setSelected(null); void load(); }}
        />
      )}
    </DashboardShell>
  );
}
