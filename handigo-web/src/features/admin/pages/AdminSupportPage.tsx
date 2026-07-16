import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Clock3,
  Eye,
  MessageSquareReply,
  RefreshCw,
  Search,
  Send,
  UserRoundCheck,
} from "lucide-react";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { Modal } from "@/components/common/Modal";
import { Pagination } from "@/components/common/Pagination";
import { getErrorMessage } from "@/utils/apiError";
import { adminSupportApi } from "../api/adminSupport.api";
import { ViolationFormModal } from "../components/cases/ViolationFormModal";
import type { AdminUser } from "../types/admin.types";
import type {
  AdminSupportTicket,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketQuery,
  SupportTicketStatus,
  SupportSummary,
} from "../types/adminSupport.types";

const dateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
});

const STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: "Mới tiếp nhận",
  in_progress: "Đang xử lý",
  waiting_user: "Chờ người dùng",
  resolved: "Đã xử lý",
  closed: "Đã đóng",
  cancelled: "Đã hủy",
};

const CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  ACCOUNT: "Tài khoản",
  PAYMENT: "Thanh toán",
  ORDER: "Đơn dịch vụ",
  TECHNICAL: "Kỹ thuật",
  SECURITY: "Bảo mật",
  APPEAL: "Khiếu nại",
  OTHER: "Khác",
};

const PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  URGENT: "Khẩn cấp",
};

const STATUS_TRANSITIONS: Record<SupportTicketStatus, SupportTicketStatus[]> = {
  open: ["in_progress", "waiting_user", "resolved"],
  in_progress: ["waiting_user", "resolved"],
  waiting_user: ["in_progress", "resolved"],
  resolved: ["in_progress", "closed"],
  closed: [],
  cancelled: [],
};

const EMPTY_SUMMARY: SupportSummary = {
  total: 0,
  active: 0,
  urgentActive: 0,
  unassignedActive: 0,
  waitingUser: 0,
  resolvedToday: 0,
  oldestActiveAt: null,
  averageResolutionMs: 0,
};

const formatDuration = (milliseconds: number) => {
  if (!milliseconds || milliseconds < 0) return "Chưa có dữ liệu";
  const hours = Math.round(milliseconds / 3_600_000);
  if (hours < 24) return hours + " giờ";
  return (hours / 24).toFixed(1) + " ngày";
};

const ticketAge = (createdAt: string) =>
  formatDuration(Date.now() - new Date(createdAt).getTime());

function StatusBadge({ status }: { status: SupportTicketStatus }) {
  const className = {
    open: "bg-blue-50 text-blue-700",
    in_progress: "bg-amber-50 text-amber-700",
    waiting_user: "bg-violet-50 text-violet-700",
    resolved: "bg-emerald-50 text-emerald-700",
    closed: "bg-slate-100 text-slate-700",
    cancelled: "bg-rose-50 text-rose-700",
  }[status];

  return (
    <span className={"inline-flex rounded-full px-3 py-1 text-xs font-bold " + className}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: SupportTicketPriority }) {
  const className = {
    LOW: "text-slate-600",
    MEDIUM: "text-blue-700",
    HIGH: "text-amber-700",
    URGENT: "text-error",
  }[priority];

  return <span className={"text-xs font-bold " + className}>{PRIORITY_LABELS[priority]}</span>;
}

function SummaryCard({
  icon,
  label,
  value,
  description,
}: {
  icon: string;
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</span>
        <div>
          <p className="text-sm text-on-surface-variant">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
          <p className="mt-1 text-xs text-on-surface-variant">{description}</p>
        </div>
      </div>
    </article>
  );
}

function Attachments({
  attachments,
}: {
  attachments: AdminSupportTicket["attachments"];
}) {
  if (!attachments.length) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <a
          key={attachment.url}
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-outline-variant px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5"
        >
          {attachment.fileName || "Xem tệp đính kèm"}
        </a>
      ))}
    </div>
  );
}

interface TicketDetailProps {
  ticket: AdminSupportTicket;
  admins: AdminUser[];
  busy: boolean;
  actionError: string;
  onAssign: (adminId: string) => Promise<boolean>;
  onStatusChange: (status: SupportTicketStatus, note?: string) => Promise<boolean>;
  onRespond: (message: string) => Promise<boolean>;
  onCreateViolation: () => void;
}

function TicketDetail({
  ticket,
  admins,
  busy,
  actionError,
  onAssign,
  onStatusChange,
  onRespond,
  onCreateViolation,
}: TicketDetailProps) {
  const [assignedAdminId, setAssignedAdminId] = useState(ticket.assignedAdminId?._id ?? "");
  const [nextStatus, setNextStatus] = useState<SupportTicketStatus | "">("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [reply, setReply] = useState("");
  const isTerminal = ["closed", "cancelled"].includes(ticket.status);
  const canRespond = !["resolved", "closed", "cancelled"].includes(ticket.status);

  const submitStatus = async () => {
    if (!nextStatus) return;
    const succeeded = await onStatusChange(nextStatus, resolutionNote.trim() || undefined);
    if (succeeded) {
      setNextStatus("");
      setResolutionNote("");
    }
  };

  const submitReply = async (event: FormEvent) => {
    event.preventDefault();
    const message = reply.trim();
    if (!message) return;
    const succeeded = await onRespond(message);
    if (succeeded) setReply("");
  };

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
      <div className="min-w-0 space-y-5">
        <section className="rounded-2xl bg-surface-container-low p-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <span className="text-xs text-on-surface-variant">#{ticket._id.slice(-8).toUpperCase()}</span>
          </div>
          <h3 className="mt-3 text-xl font-bold">{ticket.subject}</h3>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-on-surface-variant">
            <span>{ticket.requesterId.fullName} · {ticket.requesterId.email}</span>
            <span>Tạo lúc {dateTime.format(new Date(ticket.createdAt))}</span>
            <span>Đã chờ {ticketAge(ticket.createdAt)}</span>
          </div>
          {ticket.orderId && (
            <p className="mt-2 text-sm">
              Đơn liên quan: <b>{ticket.orderId.orderCode}</b> · {ticket.orderId.status} · {ticket.orderId.paymentStatus}
            </p>
          )}
        </section>

        <section className="space-y-4">
          <h3 className="font-bold">Trao đổi</h3>
          <article className="mr-8 rounded-2xl rounded-tl-sm border border-outline-variant/40 bg-surface p-4">
            <div className="flex items-center justify-between gap-3 text-xs text-on-surface-variant">
              <b className="text-on-surface">{ticket.requesterId.fullName}</b>
              <span>{dateTime.format(new Date(ticket.createdAt))}</span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{ticket.description}</p>
            <Attachments attachments={ticket.attachments} />
          </article>
          {ticket.responses.map((response, index) => {
            const isAdmin = response.responderRole === "ADMIN";
            return (
              <article key={response.respondedAt + index} className={"rounded-2xl border p-4 " + (isAdmin ? "ml-8 rounded-tr-sm border-primary/20 bg-primary/5" : "mr-8 rounded-tl-sm border-outline-variant/40 bg-surface")}>
                <div className="flex items-center justify-between gap-3 text-xs text-on-surface-variant">
                  <b className={isAdmin ? "text-primary" : "text-on-surface"}>
                    {response.responderId?.fullName || (isAdmin ? "Quản trị viên" : "Người dùng")}
                  </b>
                  <span>{dateTime.format(new Date(response.respondedAt))}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{response.message}</p>
                <Attachments attachments={response.attachments} />
              </article>
            );
          })}
        </section>

        {canRespond && (
          <form onSubmit={submitReply} className="rounded-2xl border border-outline-variant/40 p-4">
            <label htmlFor="support-reply" className="font-bold">Phản hồi người dùng</label>
            <textarea id="support-reply" value={reply} onChange={(event) => setReply(event.target.value)} rows={4} maxLength={3000} placeholder="Nhập hướng dẫn hoặc thông tin cần bổ sung..." className="mt-3 w-full resize-y rounded-xl border border-outline-variant bg-surface p-3" />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-on-surface-variant">{reply.length}/3000 ký tự</span>
              <button type="submit" disabled={busy || !reply.trim()} className="btn-primary">
                <Send size={17} /> {busy ? "Đang gửi..." : "Gửi phản hồi"}
              </button>
            </div>
          </form>
        )}
      </div>

      <aside className="space-y-5">
        {actionError && <p className="rounded-xl bg-error/10 p-3 text-sm font-semibold text-error">{actionError}</p>}

        {!ticket.createdViolationId && ticket.status !== "cancelled" && (
          <button type="button" onClick={onCreateViolation} className="w-full rounded-xl bg-error px-4 py-3 font-bold text-white">
            Tạo vi phạm và áp dụng penalty
          </button>
        )}

        <section className="rounded-2xl border border-outline-variant/40 p-4">
          <div className="flex items-center gap-2">
            <UserRoundCheck size={19} className="text-primary" />
            <h3 className="font-bold">Phân công xử lý</h3>
          </div>
          <select value={assignedAdminId} onChange={(event) => setAssignedAdminId(event.target.value)} disabled={isTerminal || busy} className="mt-3 min-h-11 w-full rounded-xl border border-outline-variant bg-surface px-3">
            <option value="">Chọn quản trị viên</option>
            {admins.map((admin) => <option key={admin._id} value={admin._id}>{admin.fullName} · {admin.email}</option>)}
          </select>
          <button type="button" onClick={() => assignedAdminId && void onAssign(assignedAdminId)} disabled={isTerminal || busy || !assignedAdminId || assignedAdminId === ticket.assignedAdminId?._id} className="mt-3 w-full rounded-xl border border-primary px-4 py-2.5 font-semibold text-primary disabled:opacity-40">
            Xác nhận phân công
          </button>
        </section>

        <section className="rounded-2xl border border-outline-variant/40 p-4">
          <div className="flex items-center gap-2">
            <MessageSquareReply size={19} className="text-primary" />
            <h3 className="font-bold">Cập nhật trạng thái</h3>
          </div>
          <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as SupportTicketStatus | "")} disabled={busy || !STATUS_TRANSITIONS[ticket.status].length} className="mt-3 min-h-11 w-full rounded-xl border border-outline-variant bg-surface px-3">
            <option value="">Chọn trạng thái tiếp theo</option>
            {STATUS_TRANSITIONS[ticket.status].map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
          </select>
          {nextStatus === "resolved" && (
            <textarea value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} rows={4} maxLength={3000} placeholder="Kết quả xử lý (tối thiểu 10 ký tự)..." className="mt-3 w-full resize-y rounded-xl border border-outline-variant bg-surface p-3" />
          )}
          <button type="button" onClick={() => void submitStatus()} disabled={busy || !nextStatus || (nextStatus === "resolved" && resolutionNote.trim().length < 10)} className="mt-3 w-full btn-primary disabled:opacity-40">
            {busy ? "Đang cập nhật..." : "Cập nhật trạng thái"}
          </button>
        </section>

        {ticket.resolutionNote && (
          <section className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
            <h3 className="font-bold">Kết quả xử lý</h3>
            <p className="mt-2 whitespace-pre-wrap">{ticket.resolutionNote}</p>
          </section>
        )}
      </aside>
    </div>
  );
}

export default function AdminSupportPage() {
  const [query, setQuery] = useState<SupportTicketQuery>({ page: 1, limit: 10 });
  const [searchInput, setSearchInput] = useState("");
  const [items, setItems] = useState<AdminSupportTicket[]>([]);
  const [summary, setSummary] = useState<SupportSummary>(EMPTY_SUMMARY);
  const [totalPages, setTotalPages] = useState(1);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<AdminSupportTicket | null>(null);
  const [violationTicket, setViolationTicket] = useState<AdminSupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await adminSupportApi.getTickets(query);
      setItems(result.items);
      setSummary(result.summary ?? EMPTY_SUMMARY);
      setTotalPages(result.pagination.totalPages || 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Không thể tải yêu cầu hỗ trợ."));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  useEffect(() => {
    adminSupportApi.getActiveAdmins()
      .then((result) => setAdmins(result.items))
      .catch(() => setAdmins([]));
  }, []);

  const openTicket = async (ticketId: string) => {
    try {
      setDetailLoading(true);
      setActionError("");
      setSelected(await adminSupportApi.getTicket(ticketId));
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Không thể tải chi tiết yêu cầu."));
    } finally {
      setDetailLoading(false);
    }
  };

  const runAction = async (action: () => Promise<AdminSupportTicket>) => {
    try {
      setBusy(true);
      setActionError("");
      setSelected(await action());
      await load();
      return true;
    } catch (requestError) {
      setActionError(getErrorMessage(requestError, "Không thể cập nhật yêu cầu hỗ trợ."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setQuery((current) => ({
      ...current,
      page: 1,
      keyword: searchInput.trim() || undefined,
    }));
  };

  const setFilter = <K extends keyof SupportTicketQuery>(
    key: K,
    value: SupportTicketQuery[K],
  ) => setQuery((current) => ({ ...current, [key]: value || undefined, page: 1 }));

  const summaryCards = useMemo(() => [
    { icon: "inbox", label: "Đang tồn", value: summary.active, description: "Ticket cần tiếp tục xử lý" },
    { icon: "priority_high", label: "Khẩn cấp", value: summary.urgentActive, description: "Ưu tiên xử lý ngay" },
    { icon: "person_off", label: "Chưa phân công", value: summary.unassignedActive, description: "Chưa có người phụ trách" },
    { icon: "task_alt", label: "Hoàn tất hôm nay", value: summary.resolvedToday, description: "Đã xử lý hoặc đóng" },
    { icon: "schedule", label: "Thời gian xử lý TB", value: formatDuration(summary.averageResolutionMs), description: "Từ lúc tạo đến khi xử lý" },
  ], [summary]);

  return (
    <DashboardShell role="ADMIN">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-headline-lg font-bold">Yêu cầu hỗ trợ</h1>
          <p className="mt-1 text-on-surface-variant">Tiếp nhận, phân công và theo dõi xử lý vấn đề của khách hàng và provider.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2.5 font-semibold text-primary disabled:opacity-50">
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} /> Làm mới
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => <SummaryCard key={card.label} {...card} />)}
      </section>

      <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4">
        <form onSubmit={submitSearch} className="flex gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Tìm kiếm yêu cầu hỗ trợ</span>
            <Search size={18} className="pointer-events-none absolute left-3 top-3 text-on-surface-variant" />
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} maxLength={100} placeholder="Tìm theo tiêu đề hoặc nội dung..." className="min-h-11 w-full rounded-xl border border-outline-variant bg-surface pl-10 pr-3" />
          </label>
          <button type="submit" className="rounded-xl bg-primary px-5 font-semibold text-on-primary">Tìm</button>
        </form>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <select value={query.status ?? ""} onChange={(event) => setFilter("status", event.target.value as SupportTicketStatus | undefined)} className="min-h-11 rounded-xl border border-outline-variant bg-surface px-3">
            <option value="">Tất cả trạng thái</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={query.category ?? ""} onChange={(event) => setFilter("category", event.target.value as SupportTicketCategory | undefined)} className="min-h-11 rounded-xl border border-outline-variant bg-surface px-3">
            <option value="">Tất cả danh mục</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={query.priority ?? ""} onChange={(event) => setFilter("priority", event.target.value as SupportTicketPriority | undefined)} className="min-h-11 rounded-xl border border-outline-variant bg-surface px-3">
            <option value="">Tất cả mức ưu tiên</option>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={query.assignment ?? ""} onChange={(event) => setFilter("assignment", event.target.value as "assigned" | "unassigned" | undefined)} className="min-h-11 rounded-xl border border-outline-variant bg-surface px-3">
            <option value="">Tất cả phân công</option>
            <option value="unassigned">Chưa phân công</option>
            <option value="assigned">Đã phân công</option>
          </select>
        </div>
      </section>

      <AsyncState loading={loading} error={error} empty={!items.length} emptyMessage="Không có yêu cầu hỗ trợ phù hợp." onRetry={load}>
        <div className="overflow-x-auto rounded-2xl border border-outline-variant/40 bg-surface-container-lowest">
          <table className="w-full min-w-[980px] text-left">
            <thead className="bg-surface-container-low text-sm">
              <tr>
                <th className="p-4">Yêu cầu</th>
                <th className="p-4">Người gửi</th>
                <th className="p-4">Ưu tiên</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4">Phụ trách</th>
                <th className="p-4">Thời gian chờ</th>
                <th className="p-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((ticket) => (
                <tr key={ticket._id} className="border-t border-outline-variant/30 align-top">
                  <td className="max-w-sm p-4">
                    <p className="truncate font-bold">{ticket.subject}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">{CATEGORY_LABELS[ticket.category]} · #{ticket._id.slice(-8).toUpperCase()}</p>
                  </td>
                  <td className="p-4">
                    <p className="font-semibold">{ticket.requesterId.fullName}</p>
                    <p className="text-xs text-on-surface-variant">{ticket.requesterId.email}</p>
                  </td>
                  <td className="p-4"><PriorityBadge priority={ticket.priority} /></td>
                  <td className="p-4"><StatusBadge status={ticket.status} /></td>
                  <td className="p-4 text-sm">{ticket.assignedAdminId?.fullName || <span className="text-error">Chưa phân công</span>}</td>
                  <td className="p-4 text-sm"><Clock3 size={15} className="mr-1 inline" />{ticketAge(ticket.createdAt)}</td>
                  <td className="p-4 text-right">
                    <button type="button" onClick={() => void openTicket(ticket._id)} className="inline-grid h-9 w-9 place-items-center rounded-lg border border-outline-variant text-primary hover:bg-primary/5" title="Xem và xử lý">
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AsyncState>

      <Pagination page={query.page ?? 1} totalPages={totalPages} onChange={(page) => setQuery((current) => ({ ...current, page }))} />

      <Modal open={Boolean(selected) || detailLoading} title="Chi tiết yêu cầu hỗ trợ" onClose={() => { setSelected(null); setActionError(""); }} size="xl" closeOnOverlayClick={!busy}>
        {detailLoading && !selected ? (
          <div className="p-10 text-center text-on-surface-variant">Đang tải chi tiết...</div>
        ) : selected ? (
          <TicketDetail
            key={selected._id + selected.updatedAt}
            ticket={selected}
            admins={admins}
            busy={busy}
            actionError={actionError}
            onAssign={(adminId) => runAction(() => adminSupportApi.assignTicket(selected._id, adminId))}
            onStatusChange={(status, note) => runAction(() => adminSupportApi.updateStatus(selected._id, status, note))}
            onRespond={(message) => runAction(() => adminSupportApi.respond(selected._id, message))}
            onCreateViolation={() => setViolationTicket(selected)}
          />
        ) : null}
      </Modal>
      {violationTicket && (
        <ViolationFormModal
          open
          sourceType="SUPPORT_TICKET"
          sourceId={violationTicket._id}
          orderId={violationTicket.orderId?._id}
          onClose={() => setViolationTicket(null)}
          onCreated={() => {
            setViolationTicket(null);
            setSelected(null);
            void load();
          }}
        />
      )}
    </DashboardShell>
  );
}
