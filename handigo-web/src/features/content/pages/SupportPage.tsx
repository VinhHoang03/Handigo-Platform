import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Headphones, Plus, RefreshCw } from "lucide-react";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { Pagination } from "@/components/common/Pagination";
import { bookingApi } from "@/features/booking/api/booking.api";
import { caseManagementApi } from "@/features/case-management/api/caseManagement.api";
import { CreateCaseModal } from "@/features/case-management/components/CreateCaseModal";
import {
  CaseDetailModal,
  type SelectedCase,
} from "@/features/case-management/components/CaseDetailModal";
import type {
  CaseListQuery,
  SupportTicket,
} from "@/features/case-management/types/caseManagement.types";
import { providerOrderApi } from "@/features/provider/api/providerOrder.api";
import type { Order } from "@/types/booking";
import { getErrorMessage } from "@/utils/apiError";
import { PublicContentLayout } from "../components/PublicContentLayout";

type SupportRole = "CUSTOMER" | "PROVIDER";

interface SupportPageProps {
  role?: SupportRole;
}

const supportCategories = [
  ["manage_accounts", "Tài khoản", "Bảo mật, thông tin cá nhân và cài đặt ứng dụng."],
  ["payments", "Thanh toán", "Hóa đơn, hoàn tiền và phương thức thanh toán."],
  ["home_repair_service", "Dịch vụ", "Chất lượng dịch vụ, lịch hẹn và phản hồi thợ."],
  ["bug_report", "Lỗi kỹ thuật", "Sự cố ứng dụng hoặc lỗi trong quá trình đặt lịch."],
] as const;

const faqs = [
  [
    "Làm thế nào để thay đổi lịch hẹn?",
    "Mở chi tiết đơn dịch vụ và chọn thay đổi lịch nếu đơn chưa được nhà cung cấp bắt đầu.",
  ],
  [
    "Khi nào tôi nhận được tiền hoàn?",
    "Tiền hoàn được xử lý theo phương thức ban đầu, dự kiến từ 3 đến 7 ngày làm việc.",
  ],
  [
    "Tôi có thể liên hệ nhà cung cấp ở đâu?",
    "Mở cuộc trò chuyện từ biểu tượng tin nhắn sau khi đơn hàng được xác nhận.",
  ],
] as const;

const supportChannels = [
  ["support_agent", "Tổng đài hỗ trợ", "1900 1234", "Phục vụ hằng ngày từ 7:00 đến 22:00."],
  [
    "mail",
    "Email chăm sóc khách hàng",
    "support@handigo.vn",
    "Phù hợp cho yêu cầu cần mô tả chi tiết hoặc gửi kèm hình ảnh.",
  ],
  [
    "chat",
    "Hỗ trợ trong ứng dụng",
    "Trò chuyện với Handigo",
    "Theo dõi và phản hồi trực tiếp theo từng yêu cầu đã gửi.",
  ],
] as const;

const ticketDate = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" });

const TICKET_STATUS_LABELS: Record<string, string> = {
  open: "Mới tiếp nhận",
  in_progress: "Đang xử lý",
  waiting_user: "Chờ phản hồi",
  resolved: "Đã xử lý",
  closed: "Đã đóng",
  cancelled: "Đã hủy",
};

const TICKET_CATEGORY_LABELS: Record<string, string> = {
  ACCOUNT: "Tài khoản",
  PAYMENT: "Thanh toán",
  ORDER: "Đơn dịch vụ",
  TECHNICAL: "Kỹ thuật",
  SECURITY: "Bảo mật",
  APPEAL: "Khiếu nại quyết định",
  OTHER: "Khác",
};

const TICKET_PRIORITY_LABELS: Record<string, string> = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  URGENT: "Khẩn cấp",
};

const TICKET_PRIORITY_CLASSES: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-700",
  MEDIUM: "bg-sky-100 text-sky-700",
  HIGH: "bg-amber-100 text-amber-700",
  URGENT: "bg-rose-100 text-rose-700",
};

function IconTile({ icon, size = "md" }: { icon: string; size?: "sm" | "md" }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-xl bg-primary-fixed text-primary ${
        size === "sm" ? "h-10 w-10" : "h-12 w-12"
      }`}
    >
      <span
        className={`material-symbols-outlined leading-none ${
          size === "sm" ? "text-xl" : "text-2xl"
        }`}
      >
        {icon}
      </span>
    </span>
  );
}

function SupportChannels({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? "grid gap-4 md:grid-cols-3" : "space-y-4"}>
      {supportChannels.map(([icon, title, value, text]) => (
        <article
          key={title}
          className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <IconTile icon={icon} size="sm" />
            <div className="min-w-0">
              <h3 className="font-semibold text-on-surface">{title}</h3>
              <p className="mt-1 break-words text-sm font-bold text-secondary">{value}</p>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">{text}</p>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

function PublicSupportForm() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    event.currentTarget.reset();
  };

  return (
    <div className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm sm:p-8">
      <h2 className="font-headline-lg text-3xl font-bold text-primary">Gửi yêu cầu hỗ trợ</h2>
      <p className="mt-2 text-on-surface-variant">
        Nếu chưa tìm thấy câu trả lời, hãy gửi thông tin để chúng tôi hỗ trợ.
      </p>
      {submitted && (
        <div role="status" className="mt-5 rounded-xl bg-secondary/10 px-4 py-3 font-medium text-secondary">
          Yêu cầu đã được ghi nhận. Bộ phận hỗ trợ sẽ sớm liên hệ với bạn.
        </div>
      )}
      <form onSubmit={handleSubmit} className="mt-7 grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-on-surface">
          Chủ đề
          <input
            required
            className="mt-2 min-h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 font-normal outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            placeholder="Tóm tắt yêu cầu"
          />
        </label>
        <label className="block text-sm font-semibold text-on-surface">
          Danh mục
          <select
            required
            className="mt-2 min-h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 font-normal outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
          >
            <option value="">Chọn danh mục</option>
            <option>Tài khoản</option>
            <option>Thanh toán</option>
            <option>Dịch vụ</option>
            <option>Lỗi kỹ thuật</option>
          </select>
        </label>
        <label className="block text-sm font-semibold text-on-surface sm:col-span-2">
          Mã đơn hàng (nếu có)
          <input
            className="mt-2 min-h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 font-normal outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            placeholder="Ví dụ: #HG-12345"
          />
        </label>
        <label className="block text-sm font-semibold text-on-surface sm:col-span-2">
          Mô tả chi tiết
          <textarea
            required
            rows={5}
            className="mt-2 w-full resize-y rounded-xl border border-outline-variant bg-surface-container-low p-4 font-normal outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            placeholder="Mô tả vấn đề bạn đang gặp phải"
          />
        </label>
        <label className="block text-sm font-semibold text-on-surface sm:col-span-2">
          Đính kèm hình ảnh
          <input
            type="file"
            multiple
            accept="image/*"
            className="mt-2 block w-full rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-4 text-sm font-normal"
          />
          <span className="mt-2 block text-xs font-normal text-on-surface-variant">
            Tối đa 3 ảnh, mỗi ảnh nhỏ hơn 5 MB.
          </span>
        </label>
        <div className="sm:col-span-2">
          <button type="submit" className="btn-primary px-7">
            Gửi yêu cầu
          </button>
        </div>
      </form>
    </div>
  );
}

function TicketSection({ role }: { role: SupportRole }) {
  const [ticketQuery, setTicketQuery] = useState<CaseListQuery>({
    page: 1,
    limit: 10,
  });
  const [searchInput, setSearchInput] = useState("");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [selected, setSelected] = useState<SelectedCase | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await caseManagementApi.tickets(ticketQuery);
      setTickets(result.items);
      setTotalPages(result.pagination.totalPages || 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Không thể tải yêu cầu hỗ trợ."));
    } finally {
      setLoading(false);
    }
  }, [ticketQuery]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTickets();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadTickets]);

  useEffect(() => {
    const request =
      role === "CUSTOMER"
        ? bookingApi.getMyOrders(1, 50)
        : providerOrderApi.getProviderOrders(1, 50);
    request.then((result) => setOrders(result.items)).catch(() => setOrders([]));
  }, [role]);

  const openTicketDetail = async (ticketId: string) => {
    try {
      setDetailLoading(true);
      setActionError("");
      const ticket = await caseManagementApi.ticket(ticketId);
      setSelected({ kind: "ticket", item: ticket });
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Không thể tải chi tiết yêu cầu hỗ trợ."));
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshSelected = async (
    action: () => Promise<SupportTicket>,
    fallbackMessage: string,
  ) => {
    try {
      setBusy(true);
      setActionError("");
      const ticket = await action();
      setSelected({ kind: "ticket", item: ticket });
      await loadTickets();
      return true;
    } catch (requestError) {
      setActionError(getErrorMessage(requestError, fallbackMessage));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleCancelTicket = () => {
    if (!selected || selected.kind !== "ticket") return Promise.resolve(false);
    return refreshSelected(
      () => caseManagementApi.cancelTicket(selected.item._id),
      "Không thể hủy yêu cầu hỗ trợ.",
    );
  };

  const handleRespondTicket = (message: string, files: File[]) => {
    if (!selected || selected.kind !== "ticket") return Promise.resolve(false);
    return refreshSelected(async () => {
      const attachments = files.length
        ? await caseManagementApi.uploadImages(files)
        : undefined;
      return caseManagementApi.respondTicket(
        selected.item._id,
        message,
        attachments,
      );
    }, "Không thể gửi phản hồi.");
  };

  const hasPendingSearch = searchInput.trim() !== (ticketQuery.keyword || "");

  return (
    <>
      <section className="space-y-6 rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm sm:p-7">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-primary">
              Hỗ trợ của bạn
            </p>
            <h2 className="mt-2 font-headline-lg text-3xl font-bold text-on-surface">
              Theo dõi và trao đổi trên cùng một trang
            </h2>
            <p className="mt-2 max-w-3xl leading-6 text-on-surface-variant">
              Tạo yêu cầu mới, xem tiến độ xử lý và phản hồi từ bộ phận hỗ trợ mà
              không cần chuyển sang trang khác.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadTickets()}
              disabled={loading}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/30 bg-surface-container-lowest px-4 py-2.5 font-semibold text-primary transition hover:bg-primary/5 disabled:opacity-40"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              Làm mới
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="btn-primary"
            >
              <Plus size={18} />
              Tạo yêu cầu hỗ trợ
            </button>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <label className="text-sm font-semibold text-on-surface">
            Tìm theo tiêu đề hoặc nội dung
            <div className="mt-2 flex gap-2">
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Nhập từ khóa cần tìm"
                className="min-h-11 w-full rounded-xl border border-outline-variant/60 bg-surface-container-low px-4 font-normal outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
              <button
                type="button"
                onClick={() =>
                  setTicketQuery((current) => ({
                    ...current,
                    page: 1,
                    keyword: searchInput.trim() || undefined,
                  }))
                }
                className="rounded-xl border border-primary px-4 py-2.5 font-semibold text-primary transition hover:bg-primary/5"
              >
                Lọc
              </button>
            </div>
          </label>
          <label className="text-sm font-semibold text-on-surface">
            Trạng thái
            <select
              value={ticketQuery.status || ""}
              onChange={(event) =>
                setTicketQuery((current) => ({
                  ...current,
                  page: 1,
                  status: event.target.value || undefined,
                }))
              }
              className="mt-2 min-h-11 w-full rounded-xl border border-outline-variant/60 bg-surface-container-low px-4 font-normal outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            >
              <option value="">Tất cả</option>
              {Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {hasPendingSearch && (
          <p className="text-sm text-on-surface-variant">
            Có thay đổi từ khóa tìm kiếm chưa áp dụng. Chọn <b>Lọc</b> để cập nhật
            danh sách.
          </p>
        )}

        <AsyncState
          loading={loading}
          error={error}
          empty={!tickets.length}
          emptyMessage="Bạn chưa có yêu cầu hỗ trợ nào."
          onRetry={loadTickets}
        >
          <>
            <div className="grid gap-4">
              {tickets.map((ticket) => (
                <article
                  key={ticket._id}
                  className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm transition hover:border-primary/30 hover:shadow-md sm:p-6"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                        <span className="rounded-full bg-primary/10 px-3 py-1 font-bold text-primary">
                          {TICKET_STATUS_LABELS[ticket.status] || ticket.status}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 font-bold ${
                            TICKET_PRIORITY_CLASSES[ticket.priority] ||
                            "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {TICKET_PRIORITY_LABELS[ticket.priority] || ticket.priority}
                        </span>
                        <span>
                          {TICKET_CATEGORY_LABELS[ticket.category] || ticket.category}
                        </span>
                        <span>#{ticket._id.slice(-8).toUpperCase()}</span>
                        <span>{ticketDate.format(new Date(ticket.createdAt))}</span>
                      </div>
                      <h3 className="mt-3 text-lg font-bold text-on-surface">
                        {ticket.subject}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-on-surface-variant">
                        {ticket.description}
                      </p>
                      {ticket.orderId && (
                        <p className="mt-3 text-sm text-on-surface-variant">
                          Đơn liên quan: <b>{ticket.orderId.orderCode}</b>
                        </p>
                      )}
                      <div className="mt-3 flex items-center gap-2 text-xs text-on-surface-variant">
                        <Headphones size={14} />
                        <span>{ticket.responses.length} phản hồi</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void openTicketDetail(ticket._id)}
                      className="min-h-11 shrink-0 rounded-xl border border-primary px-4 py-2.5 font-semibold text-primary transition hover:bg-primary/5"
                    >
                      Xem chi tiết
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <Pagination
              page={ticketQuery.page || 1}
              totalPages={totalPages}
              onChange={(page) =>
                setTicketQuery((current) => ({ ...current, page }))
              }
            />
          </>
        </AsyncState>
      </section>

      {createOpen && (
        <CreateCaseModal
          open
          kind="ticket"
          role={role}
          orders={orders}
          onClose={() => setCreateOpen(false)}
          onCreated={() => void loadTickets()}
        />
      )}
      <CaseDetailModal
        selected={selected}
        loading={detailLoading}
        busy={busy}
        actionError={actionError}
        onClose={() => {
          setSelected(null);
          setActionError("");
        }}
        onCancel={handleCancelTicket}
        onAddEvidence={async () => false}
        onRespond={handleRespondTicket}
      />
    </>
  );
}

export default function SupportPage({ role }: SupportPageProps) {
  const [faqQuery, setFaqQuery] = useState("");
  const normalizedQuery = faqQuery.trim().toLocaleLowerCase("vi-VN");
  const filteredFaqs = useMemo(
    () =>
      faqs.filter(([question, answer]) =>
        `${question} ${answer}`.toLocaleLowerCase("vi-VN").includes(normalizedQuery),
      ),
    [normalizedQuery],
  );

  const content = (
    <>
      <section
        className={`bg-gradient-to-b from-primary-fixed to-background px-5 py-12 text-center sm:px-6 sm:py-16 ${
          role ? "rounded-3xl border border-outline-variant/20" : "sm:py-24"
        }`}
      >
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-secondary">
          Trung tâm trợ giúp
        </p>
        <h1 className="mt-4 font-headline-xl text-4xl font-bold text-primary sm:text-5xl">
          Chúng tôi có thể giúp gì cho bạn?
        </h1>
        <div className="relative mx-auto mt-8 max-w-2xl">
          <span className="absolute left-5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center text-on-surface-variant">
            <span className="material-symbols-outlined text-xl leading-none">
              search
            </span>
          </span>
          <input
            value={faqQuery}
            onChange={(event) => setFaqQuery(event.target.value)}
            className="min-h-14 w-full rounded-full border border-outline-variant/40 bg-surface-container-lowest py-4 pl-14 pr-5 shadow-lg outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            placeholder="Tìm kiếm câu hỏi thường gặp..."
            aria-label="Tìm kiếm hỗ trợ"
          />
        </div>
        {faqQuery && (
          <div className="mx-auto mt-3 max-w-2xl overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest text-left shadow-lg">
            {filteredFaqs.length ? (
              filteredFaqs.map(([question, answer]) => (
                <div key={question} className="border-b border-outline-variant/20 p-4 last:border-0">
                  <p className="font-semibold text-on-surface">{question}</p>
                  <p className="mt-1 text-sm leading-5 text-on-surface-variant">{answer}</p>
                </div>
              ))
            ) : (
              <p className="p-5 text-center text-on-surface-variant">
                Không tìm thấy câu trả lời phù hợp.
              </p>
            )}
          </div>
        )}
      </section>

      <section className={`mx-auto max-w-7xl ${role ? "py-4" : "px-6 pb-5 pt-8"}`}>
        <h2 className="mb-7 font-headline-lg text-3xl font-bold text-primary">
          Danh mục hỗ trợ
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {supportCategories.map(([icon, title, text]) => (
            <article
              key={title}
              className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
            >
              <IconTile icon={icon} />
              <h3 className="mt-5 text-xl font-bold text-on-surface">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">{text}</p>
            </article>
          ))}
        </div>
      </section>

      {role ? (
        <>
          <TicketSection role={role} />
          <section className="rounded-3xl bg-surface-container p-5 sm:p-6">
            <h2 className="mb-5 text-xl font-bold text-primary">Kênh hỗ trợ</h2>
            <SupportChannels compact />
          </section>
        </>
      ) : (
        <section className="mx-auto grid max-w-7xl gap-8 px-6 pb-4 pt-3 lg:grid-cols-[minmax(0,1fr)_360px]">
          <PublicSupportForm />
          <aside className="space-y-6">
            <div className="rounded-3xl bg-surface-container p-6">
              <h2 className="mb-5 text-xl font-bold text-primary">Kênh hỗ trợ</h2>
              <SupportChannels />
            </div>
            <div className="rounded-3xl bg-primary p-6 text-on-primary">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-white/15">
                <span className="material-symbols-outlined text-3xl leading-none">
                  support_agent
                </span>
              </span>
              <h3 className="mt-4 text-xl font-bold">Hỗ trợ khẩn cấp?</h3>
              <p className="mt-2 text-sm leading-6 text-on-primary/75">
                Gọi cho chúng tôi nếu bạn gặp sự cố cần giải quyết tức thì.
              </p>
              <a
                href="tel:19001234"
                className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-primary"
              >
                1900 1234
              </a>
            </div>
          </aside>
        </section>
      )}
    </>
  );

  return role ? (
    <DashboardShell role={role}>{content}</DashboardShell>
  ) : (
    <PublicContentLayout>{content}</PublicContentLayout>
  );
}
