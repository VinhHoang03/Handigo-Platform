import { AdminPageTitle, AdminRefreshButton } from "@/features/admin/components/shared/AdminPageHeader";
import { useToastFeedback } from "@/components/common/Toast";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { Pagination } from "@/components/common/Pagination";
import { DataTable } from "@/components/common/dashboard/DataTable";
import { TableSkeleton } from "@/components/common/dashboard/TableSkeleton";
import { TableToolbar } from "@/components/common/dashboard/TableToolbar";
import { getErrorMessage } from "@/utils/apiError";
import { adminCasesApi, type AdminReportQuery, type ViolationQuery } from "../api/adminCases.api";
import { CaseDetailModal } from "../components/cases/CaseDetailModal";
import { CaseTabs } from "../components/cases/CaseTabs";
import { caseTableColumns } from "../components/cases/case-table-columns";
import type { AdminCaseTab, CaseRow } from "../components/cases/case-detail.types";
import { CASE_STATUS_LABELS, CASE_STATUS_OPTIONS } from "../components/cases/case-status.constants";
import { useCaseDetailController } from "../components/cases/useCaseDetailController";
import { ViolationFormModal } from "../components/cases/ViolationFormModal";

export default function AdminCasesPage() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<AdminCaseTab>(() => params.get('tab') === 'violations' ? 'violations' : 'reports');
  const [query, setQuery] = useState<AdminReportQuery>({ page: 1, limit: 10, reportType: params.get("reportType") === "service_quality" ? "service_quality" : undefined });
  const [items, setItems] = useState<CaseRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useToastFeedback<string>("", "error");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = tab === "reports"
          ? await adminCasesApi.reports(query)
          : await adminCasesApi.violations(query as ViolationQuery);
      setItems(result.items);
      setTotalPages(result.pagination.totalPages || 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Không thể tải hàng đợi xử lý."));
    } finally {
      setLoading(false);
    }
  }, [query, setError, tab]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const detail = useCaseDetailController(tab, load, setError);
  const openInitialDetail = useRef(detail.openDetail);
  const [initialReportId] = useState(() => params.get('tab') === 'reports' ? params.get('reportId') : null);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active && initialReportId && /^[a-f\d]{24}$/i.test(initialReportId)) return openInitialDetail.current(initialReportId);
    });
    return () => { active = false; };
  }, [initialReportId]);

  const switchTab = (nextTab: AdminCaseTab) => {
    setTab(nextTab);
    setQuery({ page: 1, limit: 10 });
    setItems([]);
    detail.setSelected(null);
  };

  return (
    <DashboardShell role="ADMIN">
      <header className="admin-page-header">
        <div>
          <AdminPageTitle title="Báo cáo và vi phạm" />
        </div>
        <AdminRefreshButton onRefresh={() => void load()} loading={loading} />
      </header>

      <CaseTabs tab={tab} onSwitch={switchTab} />

      <TableToolbar
        fieldsClassName={tab === "reports" ? "sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]" : "sm:grid-cols-2"}
        search={{
          value: query.keyword || "",
          onChange: (value) => setQuery((current) => ({ ...current, page: 1, keyword: value || undefined })),
          placeholder: "Tìm theo tiêu đề hoặc nội dung...",
          disabled: tab === "violations",
        }}
        filters={
          <>
          {tab === "reports" && <select aria-label="Loại báo cáo" value={query.reportType || ""} onChange={(event) => setQuery(current => ({ ...current, page: 1, reportType: event.target.value || undefined }))} className="min-h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-3"><option value="">Tất cả loại báo cáo</option><option value="service_quality">Chất lượng dịch vụ</option></select>}
          <select value={query.status || ""} onChange={(event) => setQuery((current) => ({ ...current, page: 1, status: event.target.value || undefined }))} className="min-h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-3">
            <option value="">Tất cả trạng thái</option>
            {CASE_STATUS_OPTIONS[tab].map((status) => (
              <option key={status} value={status}>{CASE_STATUS_LABELS[status] || status}</option>
            ))}
          </select>
          </>
        }
      />

      <AsyncState loading={loading} error={error} onRetry={load} skeleton={<TableSkeleton columns={caseTableColumns.length} rowCount={query.limit || 10} />}>
        <DataTable
          columns={caseTableColumns}
          onRowClick={(item) => void detail.openDetail(item._id)}
          rows={items}
          rowKey={(item) => item._id}
          emptyState={<div className="p-10 text-center text-on-surface-variant">Không có hồ sơ phù hợp.</div>}
          minWidthClassName="min-w-[1150px]"
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
        onReviewReport={detail.onReviewReport}
        onReverifyReport={detail.onReverifyReport}
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
