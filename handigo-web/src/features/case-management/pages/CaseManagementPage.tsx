import { useToast, useToastFeedback } from "@/components/common/Toast";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { Pagination } from "@/components/common/Pagination";
import { getErrorMessage } from "@/utils/apiError";
import { caseManagementApi } from "../api/caseManagement.api";
import { CaseDetailModal, type SelectedCase } from "../components/CaseDetailModal";
import { CaseListItem } from "../components/CaseListItem";
import { CaseManagementHeader } from "../components/CaseManagementHeader";
import { STATUS_LABELS } from "../components/caseStatusLabels.constants";
import { CaseStatusFilter } from "../components/CaseStatusFilter";
import { type CaseTab } from "../components/caseTabs.constants";
import { SupportTicketSection } from "../components/SupportTicketSection";
import { CaseTabSelector } from "../components/CaseTabSelector";
import { CreateCaseModal, type CreateCaseKind } from "../components/CreateCaseModal";
import type { CaseListQuery, Report } from "../types/caseManagement.types";

interface CaseManagementPageProps {
  role: "CUSTOMER" | "PROVIDER";
}

function ReportCases({ role }: CaseManagementPageProps) {
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCreateKind = searchParams.get("create");
  const requestedOrderId = searchParams.get("orderId") || undefined;
  const initialCreateKind: CreateCaseKind | null = requestedCreateKind === "report" || requestedCreateKind === "complaint" ? "report" : null;

  const [query, setQuery] = useState<CaseListQuery>({ page: 1, limit: 10 });
  const [items, setItems] = useState<Report[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useToastFeedback<string>("", "error");
  const [actionError, setActionError] = useToastFeedback<string>("", "error");
  const [createKind, setCreateKind] = useState<CreateCaseKind | null>(initialCreateKind);
  const [selected, setSelected] = useState<SelectedCase | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await caseManagementApi.reports(query);
      setItems(result.items);
      setTotalPages(result.pagination.totalPages || 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Không thể tải dữ liệu hỗ trợ."));
    } finally {
      setLoading(false);
    }
  }, [query, setError]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const closeCreateModal = () => {
    setCreateKind(null);
    if (!searchParams.has("create") && !searchParams.has("orderId")) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("create");
    nextParams.delete("orderId");
    setSearchParams(nextParams, { replace: true });
  };

  const openDetail = async (id: string) => {
    try {
      setDetailLoading(true);
      setActionError("");
      setSelected({ kind: "report", item: await caseManagementApi.report(id) });
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Không thể tải chi tiết yêu cầu."));
    } finally {
      setDetailLoading(false);
    }
  };

  const runAction = async (action: () => Promise<void>, errorMessage: string) => {
    try {
      setBusy(true);
      setActionError("");
      await action();
      addToast("Đã cập nhật yêu cầu.", "success");
      return true;
    } catch (requestError) {
      setActionError(getErrorMessage(requestError, errorMessage));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const cancelSelected = () => {
    if (!selected) return Promise.resolve(false);
    return runAction(async () => {
      const item = await caseManagementApi.cancelReport(selected.item._id);
      setSelected({ kind: "report", item });
      await load();
    }, "Không thể cập nhật yêu cầu.");
  };

  const addEvidence = (files: File[], note: string) => {
    if (!selected || selected.kind !== "report") return Promise.resolve(false);
    return runAction(async () => {
      const uploaded = await caseManagementApi.uploadImages(files);
      const item = await caseManagementApi.addReportEvidence(selected.item._id, uploaded, note);
      setSelected({ kind: "report", item });
      await load();
    }, "Không thể bổ sung bằng chứng.");
  };

  return (
    <>
      <CaseManagementHeader loading={loading} activeLabel="Báo cáo" onRefresh={() => void load()} onCreate={() => setCreateKind("report")} />
      <CaseStatusFilter tab="report" value={query.status || ""} onChange={(status) => setQuery((current) => ({ ...current, page: 1, status: status || undefined }))} />
      <AsyncState loading={loading} error={error} empty={!items.length} emptyMessage="Bạn chưa có báo cáo nào." onRetry={load}>
        <div className="grid gap-4">
          {items.map((item) => (
            <CaseListItem key={item._id} item={item} statusLabel={STATUS_LABELS[item.status] || item.status} onOpenDetail={(id) => void openDetail(id)} />
          ))}
        </div>
      </AsyncState>
      <Pagination page={query.page || 1} totalPages={totalPages} onChange={(page) => setQuery((current) => ({ ...current, page }))} />
      {createKind && <CreateCaseModal open kind={createKind} role={role} initialOrderId={requestedOrderId} initialReportType={requestedCreateKind === "complaint" ? "service_quality" : undefined} onClose={closeCreateModal} onCreated={() => void load()} />}
      <CaseDetailModal selected={selected} loading={detailLoading} busy={busy} actionError={actionError} onClose={() => { setSelected(null); setActionError(""); }} onCancel={cancelSelected} onAddEvidence={addEvidence} onRespond={async () => false} />
    </>
  );
}

export default function CaseManagementPage({ role }: CaseManagementPageProps) {
  const [params, setParams] = useSearchParams();
  const tab: CaseTab = params.get("tab") === "ticket" || params.get("create") === "ticket" ? "ticket" : "report";
  const switchTab = (next: CaseTab) => {
    const updated = new URLSearchParams(params);
    updated.set("tab", next);
    updated.delete("create");
    updated.delete("orderId");
    setParams(updated);
  };
  const closeCreate = () => {
    const updated = new URLSearchParams(params);
    updated.delete("create");
    updated.delete("orderId");
    setParams(updated, { replace: true });
  };
  return <DashboardShell role={role}>
    <CaseTabSelector active={tab} onChange={switchTab} />
    {tab === "ticket" ? <SupportTicketSection role={role} initialCreate={params.get("create") === "ticket"} initialOrderId={params.get("orderId") || undefined} onCloseCreate={closeCreate} /> : <ReportCases role={role} />}
  </DashboardShell>;
}
