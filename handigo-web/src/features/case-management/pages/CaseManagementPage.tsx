import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { Pagination } from "@/components/common/Pagination";
import { bookingApi } from "@/features/booking/api/booking.api";
import { providerOrderApi } from "@/features/provider/api/providerOrder.api";
import type { Order } from "@/types/booking";
import { getErrorMessage } from "@/utils/apiError";
import { caseManagementApi } from "../api/caseManagement.api";
import { CaseDetailModal, type SelectedCase } from "../components/CaseDetailModal";
import { CaseListItem } from "../components/CaseListItem";
import { CaseManagementHeader } from "../components/CaseManagementHeader";
import { STATUS_LABELS } from "../components/caseStatusLabels.constants";
import { CaseStatusFilter } from "../components/CaseStatusFilter";
import { TAB_CONFIG, type CaseTab } from "../components/caseTabs.constants";
import { CaseTabSelector } from "../components/CaseTabSelector";
import { CreateCaseModal, type CreateCaseKind } from "../components/CreateCaseModal";
import type { CaseListQuery, Complaint, Report, SupportTicket } from "../types/caseManagement.types";

interface CaseManagementPageProps {
  role: "CUSTOMER" | "PROVIDER";
}

export default function CaseManagementPage({ role }: CaseManagementPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const requestedCreateKind = searchParams.get("create");
  const requestedOrderId = searchParams.get("orderId") || undefined;
  const initialTab: CaseTab = requestedTab === "ticket" || requestedTab === "report"
    ? requestedTab
    : "complaint";
  const initialCreateKind: CreateCaseKind | null =
    requestedCreateKind === "complaint" ||
    requestedCreateKind === "ticket" ||
    requestedCreateKind === "report"
      ? requestedCreateKind
      : null;

  const [tab, setTab] = useState<CaseTab>(initialTab);
  const [query, setQuery] = useState<CaseListQuery>({ page: 1, limit: 10 });
  const [items, setItems] = useState<Array<Complaint | SupportTicket | Report>>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [createKind, setCreateKind] = useState<CreateCaseKind | null>(initialCreateKind);
  const [selected, setSelected] = useState<SelectedCase | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = tab === "complaint"
        ? await caseManagementApi.complaints(query)
        : tab === "ticket"
          ? await caseManagementApi.tickets(query)
          : await caseManagementApi.reports(query);
      setItems(result.items);
      setTotalPages(result.pagination.totalPages || 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Không thể tải dữ liệu hỗ trợ."));
    } finally {
      setLoading(false);
    }
  }, [query, tab]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    const loadOrders = async () => {
      try {
        const result = role === "CUSTOMER" ? await bookingApi.getMyOrders(1, 50) : await providerOrderApi.getProviderOrders(1, 50);
        let nextOrders = result.items;
        if (role === "CUSTOMER" && requestedOrderId && !nextOrders.some((order) => order._id === requestedOrderId)) {
          nextOrders = [await bookingApi.getOrderById(requestedOrderId), ...nextOrders];
        }
        if (!cancelled) setOrders(nextOrders);
      } catch {
        if (!cancelled) setOrders([]);
      }
    };
    void loadOrders();
    return () => { cancelled = true; };
  }, [requestedOrderId, role]);

  const closeCreateModal = () => {
    setCreateKind(null);
    if (!searchParams.has("create") && !searchParams.has("orderId")) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("create");
    nextParams.delete("orderId");
    setSearchParams(nextParams, { replace: true });
  };

  const switchTab = (nextTab: CaseTab) => {
    setTab(nextTab);
    setQuery({ page: 1, limit: 10 });
    setItems([]);
  };

  const openDetail = async (id: string) => {
    try {
      setDetailLoading(true);
      setActionError("");
      if (tab === "complaint") {
        setSelected({ kind: "complaint", item: await caseManagementApi.complaint(id) });
      } else if (tab === "ticket") {
        setSelected({ kind: "ticket", item: await caseManagementApi.ticket(id) });
      } else {
        setSelected({ kind: "report", item: await caseManagementApi.report(id) });
      }
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
      return true;
    } catch (requestError) {
      setActionError(getErrorMessage(requestError, errorMessage));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const cancelSelected = () => {
    if (!selected || selected.kind === "report") return Promise.resolve(false);
    return runAction(async () => {
      const item = selected.kind === "complaint"
        ? await caseManagementApi.cancelComplaint(selected.item._id)
        : await caseManagementApi.cancelTicket(selected.item._id);
      setSelected("subject" in item ? { kind: "ticket", item } : { kind: "complaint", item });
      await load();
    }, "Không thể cập nhật yêu cầu.");
  };

  const addEvidence = (files: File[], note: string) => {
    if (!selected || selected.kind !== "complaint") return Promise.resolve(false);
    return runAction(async () => {
      const uploaded = await caseManagementApi.uploadImages(files);
      const item = await caseManagementApi.addComplaintEvidence(selected.item._id, uploaded, note);
      setSelected({ kind: "complaint", item });
      await load();
    }, "Không thể bổ sung bằng chứng.");
  };

  const respond = (message: string, files: File[]) => {
    if (!selected || selected.kind !== "ticket") return Promise.resolve(false);
    return runAction(async () => {
      const attachments = files.length ? await caseManagementApi.uploadImages(files) : undefined;
      const item = await caseManagementApi.respondTicket(selected.item._id, message, attachments);
      setSelected({ kind: "ticket", item });
      await load();
    }, "Không thể gửi phản hồi.");
  };

  const activeConfig = useMemo(() => TAB_CONFIG.find((item) => item.value === tab)!, [tab]);

  return (
    <DashboardShell role={role}>
      <CaseManagementHeader loading={loading} activeLabel={activeConfig.label} onRefresh={() => void load()} onCreate={() => setCreateKind(tab)} />
      <CaseTabSelector active={tab} onChange={switchTab} />
      <CaseStatusFilter tab={tab} value={query.status || ""} onChange={(status) => setQuery((current) => ({ ...current, page: 1, status: status || undefined }))} />
      <AsyncState loading={loading} error={error} empty={!items.length} emptyMessage={`Bạn chưa có ${activeConfig.label.toLowerCase()} nào.`} onRetry={load}>
        <div className="grid gap-4">
          {items.map((item) => (
            <CaseListItem key={item._id} item={item} statusLabel={STATUS_LABELS[item.status] || item.status} onOpenDetail={(id) => void openDetail(id)} />
          ))}
        </div>
      </AsyncState>
      <Pagination page={query.page || 1} totalPages={totalPages} onChange={(page) => setQuery((current) => ({ ...current, page }))} />
      {createKind && <CreateCaseModal open kind={createKind} role={role} orders={orders} initialOrderId={requestedOrderId} onClose={closeCreateModal} onCreated={() => void load()} />}
      <CaseDetailModal selected={selected} loading={detailLoading} busy={busy} actionError={actionError} onClose={() => { setSelected(null); setActionError(""); }} onCancel={cancelSelected} onAddEvidence={addEvidence} onRespond={respond} />
    </DashboardShell>
  );
}
