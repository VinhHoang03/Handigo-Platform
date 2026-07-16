import { useCallback, useEffect, useMemo, useState } from "react";
import { FileWarning, Flag, Headphones, Plus, RefreshCw } from "lucide-react";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { Pagination } from "@/components/common/Pagination";
import { bookingApi } from "@/features/booking/api/booking.api";
import { providerOrderApi } from "@/features/provider/api/providerOrder.api";
import type { Order } from "@/types/booking";
import { getErrorMessage } from "@/utils/apiError";
import { caseManagementApi } from "../api/caseManagement.api";
import {
  CaseDetailModal,
  type SelectedCase,
} from "../components/CaseDetailModal";
import {
  CreateCaseModal,
  type CreateCaseKind,
} from "../components/CreateCaseModal";
import type {
  CaseListQuery,
  Complaint,
  Report,
  SupportTicket,
} from "../types/caseManagement.types";

type CaseTab = CreateCaseKind;

interface CaseManagementPageProps {
  role: "CUSTOMER" | "PROVIDER";
}

const date = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" });

const TAB_CONFIG: Array<{
  value: CaseTab;
  label: string;
  description: string;
  icon: typeof FileWarning;
}> = [
  {
    value: "complaint",
    label: "Khiếu nại",
    description: "Khiếu nại đơn đã hoàn thành",
    icon: FileWarning,
  },
  {
    value: "ticket",
    label: "Hỗ trợ",
    description: "Trao đổi với bộ phận hỗ trợ",
    icon: Headphones,
  },
  {
    value: "report",
    label: "Báo cáo",
    description: "Báo cáo hành vi hoặc đơn dịch vụ",
    icon: Flag,
  },
];

const STATUS_LABELS: Record<string, string> = {
  pending: "Chờ xử lý",
  evidence_requested: "Cần bổ sung bằng chứng",
  under_review: "Đang xem xét",
  resolved: "Đã xử lý",
  rejected: "Đã từ chối",
  cancelled: "Đã hủy",
  open: "Mới tiếp nhận",
  in_progress: "Đang xử lý",
  waiting_user: "Chờ phản hồi",
  closed: "Đã đóng",
  confirmed: "Đã xác nhận vi phạm",
};

const FILTERS: Record<CaseTab, string[]> = {
  complaint: ["pending", "evidence_requested", "under_review", "resolved", "rejected", "cancelled"],
  ticket: ["open", "in_progress", "waiting_user", "resolved", "closed", "cancelled"],
  report: ["pending", "under_review", "confirmed", "rejected", "resolved"],
};

const getTitle = (item: Complaint | SupportTicket | Report) =>
  "subject" in item ? item.subject : item.title;

export default function CaseManagementPage({ role }: CaseManagementPageProps) {
  const [tab, setTab] = useState<CaseTab>("complaint");
  const [query, setQuery] = useState<CaseListQuery>({ page: 1, limit: 10 });
  const [items, setItems] = useState<Array<Complaint | SupportTicket | Report>>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [createKind, setCreateKind] = useState<CreateCaseKind | null>(null);
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
    const request = role === "CUSTOMER"
      ? bookingApi.getMyOrders(1, 50)
      : providerOrderApi.getProviderOrders(1, 50);
    request.then((result) => setOrders(result.items)).catch(() => setOrders([]));
  }, [role]);

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

  const updateSelected = async (action: () => Promise<Complaint | SupportTicket>) => {
    try {
      setBusy(true);
      setActionError("");
      const item = await action();
      setSelected("subject" in item ? { kind: "ticket", item } : { kind: "complaint", item });
      await load();
      return true;
    } catch (requestError) {
      setActionError(getErrorMessage(requestError, "Không thể cập nhật yêu cầu."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const cancelSelected = () => {
    if (!selected || selected.kind === "report") return Promise.resolve(false);
    return selected.kind === "complaint"
      ? updateSelected(() => caseManagementApi.cancelComplaint(selected.item._id))
      : updateSelected(() => caseManagementApi.cancelTicket(selected.item._id));
  };

  const addEvidence = async (files: File[], note: string) => {
    if (!selected || selected.kind !== "complaint") return false;
    try {
      setBusy(true);
      setActionError("");
      const uploaded = await caseManagementApi.uploadImages(files);
      const item = await caseManagementApi.addComplaintEvidence(selected.item._id, uploaded, note);
      setSelected({ kind: "complaint", item });
      await load();
      return true;
    } catch (requestError) {
      setActionError(getErrorMessage(requestError, "Không thể bổ sung bằng chứng."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const respond = async (message: string, files: File[]) => {
    if (!selected || selected.kind !== "ticket") return false;
    try {
      setBusy(true);
      setActionError("");
      const attachments = files.length ? await caseManagementApi.uploadImages(files) : undefined;
      const item = await caseManagementApi.respondTicket(selected.item._id, message, attachments);
      setSelected({ kind: "ticket", item });
      await load();
      return true;
    } catch (requestError) {
      setActionError(getErrorMessage(requestError, "Không thể gửi phản hồi."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const activeConfig = useMemo(() => TAB_CONFIG.find((item) => item.value === tab)!, [tab]);

  return (
    <DashboardShell role={role}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-primary">Trung tâm hỗ trợ</p>
          <h1 className="mt-1 text-headline-lg font-bold">Khiếu nại, hỗ trợ và báo cáo</h1>
          <p className="mt-2 max-w-3xl text-on-surface-variant">Theo dõi toàn bộ yêu cầu đã gửi và phản hồi trực tiếp khi quản trị viên cần thêm thông tin.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-outline-variant px-4 py-2.5 font-semibold text-primary disabled:opacity-40"><RefreshCw size={18} className={loading ? "animate-spin" : ""} /> Làm mới</button>
          <button type="button" onClick={() => setCreateKind(tab)} className="btn-primary"><Plus size={18} /> {activeConfig.label === "Hỗ trợ" ? "Tạo yêu cầu" : `Tạo ${activeConfig.label.toLowerCase()}`}</button>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        {TAB_CONFIG.map((item) => {
          const Icon = item.icon;
          const active = tab === item.value;
          return <button key={item.value} type="button" onClick={() => switchTab(item.value)} className={`rounded-2xl border p-4 text-left transition ${active ? "border-primary bg-primary/5 shadow-sm" : "border-outline-variant/40 bg-surface hover:border-primary/40"}`}><div className="flex items-center gap-3"><span className={`grid h-10 w-10 place-items-center rounded-xl ${active ? "bg-primary text-white" : "bg-surface-container text-primary"}`}><Icon size={20} /></span><div><p className="font-bold">{item.label}</p><p className="mt-1 text-xs text-on-surface-variant">{item.description}</p></div></div></button>;
        })}
      </section>

      <section className="rounded-2xl border border-outline-variant/40 bg-surface p-4">
        <label className="text-sm font-semibold">
          Trạng thái
          <select value={query.status || ""} onChange={(event) => setQuery((current) => ({ ...current, page: 1, status: event.target.value || undefined }))} className="ml-3 min-h-11 rounded-xl border border-outline-variant bg-surface px-3">
            <option value="">Tất cả</option>
            {FILTERS[tab].map((status) => <option key={status} value={status}>{STATUS_LABELS[status] || status}</option>)}
          </select>
        </label>
      </section>

      <AsyncState loading={loading} error={error} empty={!items.length} emptyMessage={`Bạn chưa có ${activeConfig.label.toLowerCase()} nào.`} onRetry={load}>
        <div className="grid gap-4">
          {items.map((item) => (
            <article key={item._id} className="rounded-2xl border border-outline-variant/40 bg-surface p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant"><span className="rounded-full bg-primary/10 px-3 py-1 font-bold text-primary">{STATUS_LABELS[item.status] || item.status}</span><span>#{item._id.slice(-8).toUpperCase()}</span><span>{date.format(new Date(item.createdAt))}</span></div>
                  <h2 className="mt-3 truncate text-lg font-bold">{getTitle(item)}</h2>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-on-surface-variant">{item.description}</p>
                </div>
                <button type="button" onClick={() => void openDetail(item._id)} className="shrink-0 rounded-xl border border-primary px-4 py-2.5 font-semibold text-primary hover:bg-primary/5">Xem chi tiết</button>
              </div>
            </article>
          ))}
        </div>
      </AsyncState>

      <Pagination page={query.page || 1} totalPages={totalPages} onChange={(page) => setQuery((current) => ({ ...current, page }))} />

      {createKind && <CreateCaseModal open kind={createKind} role={role} orders={orders} onClose={() => setCreateKind(null)} onCreated={() => void load()} />}
      <CaseDetailModal selected={selected} loading={detailLoading} busy={busy} actionError={actionError} onClose={() => { setSelected(null); setActionError(""); }} onCancel={cancelSelected} onAddEvidence={addEvidence} onRespond={respond} />
    </DashboardShell>
  );
}
