import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, MapPin, Search, UserRound } from "lucide-react";
import type { AgentBookingSearch } from "../types/agent.types";
import { agentDisplayText } from "../utils/agentDisplayText";
import { composeFullAddress } from "@/features/profile/utils/addressLineParsing.utils";

const statusLabels = { created: "Chờ xử lý", accepted: "Thợ đã nhận", in_progress: "Đang thực hiện", completed: "Đã hoàn thành", cancelled: "Đã hủy" };
const paymentLabels = { unpaid: "Chưa thanh toán", partially_paid: "Đã thanh toán một phần", paid: "Đã thanh toán", refunded: "Đã hoàn tiền" };
const dateLabel = (value: string) => Number.isNaN(Date.parse(value)) ? "Chưa có thời gian" : new Date(value)
  .toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
const buttonClass = "min-h-11 rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-3 py-2 text-xs font-medium text-on-surface transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-45";

export function AgentBookingSearchResults({ result, disabled, paginationDisabled, onSend }: {
  result: AgentBookingSearch; disabled: boolean; paginationDisabled: boolean; onSend: (message: string) => Promise<void>;
}) {
  const [rebookId, setRebookId] = useState<string | null>(null);
  const { items, pagination } = result;
  const previousProviders = result.kind === "previous_providers";
  const send = (action: string, item: AgentBookingSearch["items"][number]) => {
    void onSend(`${action} đơn ${item.orderId} (${item.orderCode}).`)
      .then(() => setRebookId(null)).catch(() => undefined);
  };
  const changePage = (page: number) => { void onSend(`Xem trang ${page} của ${previousProviders ? "danh sách thợ từng đặt" : "kết quả tìm đơn cũ"}.`).catch(() => undefined); };
  return <section aria-label="Kết quả tìm đơn cũ" className="mt-3 min-w-0 space-y-3">
    <div className="flex items-center justify-between gap-2 px-1 text-xs text-on-surface-variant">
      <span className="flex items-center gap-1.5 font-semibold"><Search size={14} aria-hidden="true" />{previousProviders ? "Thợ từng phục vụ" : "Đơn của bạn"}</span>
      <span>{pagination.total.toLocaleString("vi-VN")} đơn phù hợp</span>
    </div>
    {!items.length ? <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest p-4 text-sm text-on-surface-variant">
      <p>{previousProviders ? "Chưa tìm thấy thợ từng phục vụ phù hợp. Bạn có thể để hệ thống tìm thợ." : "Không tìm thấy đơn phù hợp. Hãy thử đổi dịch vụ, địa chỉ hoặc thời gian."}</p>
      <button type="button" className={`${buttonClass} mt-3`} disabled={disabled} onClick={() => {
        void onSend(previousProviders ? "Tôi muốn chọn lại thợ từng phục vụ."
          : "Tôi muốn tìm đơn cũ.").catch(() => undefined);
      }}>{previousProviders ? "Kiểm tra lại lịch sử thợ" : "Tìm tất cả đơn"}</button>
    </div> : items.map((item) => {
      const canRebook = !previousProviders && Boolean(item.serviceId) && ["completed", "cancelled"].includes(item.status);
      const canKeepProvider = item.status === "completed" && Boolean(item.providerId);
      const address = item.address ? composeFullAddress(item.address.fullAddress, item.address.ward, item.address.province) : "Địa chỉ không còn khả dụng";
      return <article key={item.orderId} aria-label={`Đơn ${item.orderCode}`} className="min-w-0 overflow-hidden rounded-2xl border border-outline-variant/45 bg-surface-container-lowest p-4 shadow-[0_2px_8px_-4px_rgba(19,27,46,0.1)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-primary">{agentDisplayText(item.orderCode)}</p>
          <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${item.status === "cancelled" ? "bg-error-container text-on-error-container" : "bg-surface-container text-on-surface-variant"}`}>{statusLabels[item.status]}</span>
        </div>
        <h4 className="mt-2 break-words text-sm font-semibold leading-6 text-on-surface">{agentDisplayText(previousProviders ? item.provider || "Thợ từng phục vụ" : item.service)}</h4>
        {previousProviders && <p className="mt-1 break-words text-xs leading-5 text-on-surface-variant">Dịch vụ đã làm: {agentDisplayText(item.service)}</p>}
        <div className="mt-2 space-y-2 text-xs leading-5 text-on-surface-variant">
          <p className="flex gap-2"><CalendarDays size={14} aria-hidden="true" className="mt-0.5 shrink-0" /><span>Đặt lúc {dateLabel(item.createdAt)}{item.scheduledAt && <span className="block">Lịch hẹn: {dateLabel(item.scheduledAt)}</span>}</span></p>
          <p className="flex gap-2"><MapPin size={14} aria-hidden="true" className="mt-0.5 shrink-0" /><span className="min-w-0 break-words">{agentDisplayText(address)}</span></p>
          {!previousProviders && item.provider && <p className="flex gap-2"><UserRound size={14} aria-hidden="true" className="mt-0.5 shrink-0" /><span>{agentDisplayText(item.provider)}</span></p>}
          <p>{paymentLabels[item.paymentStatus]}</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link to={`/customer/bookings/${item.orderId}`} className={`${buttonClass} flex items-center justify-center gap-1`}>Chi tiết đơn<ArrowUpRight size={13} aria-hidden="true" /></Link>
          {previousProviders && item.providerId && item.serviceId && <button type="button" className={buttonClass} disabled={disabled} onClick={() => {
            void onSend(`Chọn thợ từ đơn ${item.orderId} (${item.orderCode}).`).catch(() => undefined);
          }}>Chọn thợ này</button>}
          {canRebook && <button type="button" className={buttonClass} disabled={disabled} aria-expanded={canKeepProvider ? rebookId === item.orderId : undefined}
            onClick={() => canKeepProvider ? setRebookId(rebookId === item.orderId ? null : item.orderId) : send("Đặt lại", item)}>Đặt lại</button>}
          {!previousProviders && (item.serviceType === "variable_price" || item.hasQuotation) && <button type="button" className={buttonClass} disabled={disabled} onClick={() => send("Xem báo giá", item)}>Xem báo giá</button>}
          {!previousProviders && (item.status === "cancelled" || item.paymentStatus === "refunded") && <button type="button" className={buttonClass} disabled={disabled} onClick={() => send("Tra hoàn tiền", item)}>Tra hoàn tiền</button>}
        </div>
        {canRebook && canKeepProvider && rebookId === item.orderId && <div className="mt-3 rounded-xl bg-surface-container-low p-3">
          <p className="mb-2 text-xs leading-5 text-on-surface-variant">Bạn muốn giữ thợ cũ cho lần đặt lại? Hệ thống sẽ kiểm tra khả dụng sau khi bạn chọn lịch mới.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={buttonClass} disabled={disabled} onClick={() => send("Đặt lại cùng thợ cũ", item)}>Giữ thợ cũ</button>
            <button type="button" className={buttonClass} disabled={disabled} onClick={() => send("Đặt lại", item)}>Tìm thợ phù hợp</button>
          </div>
        </div>}
        {canRebook && <p className="mt-2 text-[11px] leading-5 text-on-surface-variant">Cần chọn lịch mới và xác nhận trước khi đặt lại.</p>}
        {previousProviders && <p className="mt-2 text-[11px] leading-5 text-on-surface-variant">Thợ sẽ được kiểm tra lịch trống trước khi đặt.</p>}
      </article>;
    })}
    {pagination.totalPages > 1 && <nav aria-label={previousProviders ? "Trang lịch sử thợ" : "Trang kết quả tìm đơn"} className="flex items-center justify-between gap-2">
      <button type="button" className={`${buttonClass} flex items-center gap-1`} disabled={disabled || paginationDisabled || pagination.page <= 1} onClick={() => changePage(pagination.page - 1)}><ChevronLeft size={14} aria-hidden="true" />Trước</button>
      <span className="text-xs text-on-surface-variant">Trang {pagination.page}/{pagination.totalPages}</span>
      <button type="button" className={`${buttonClass} flex items-center gap-1`} disabled={disabled || paginationDisabled || pagination.page >= pagination.totalPages} onClick={() => changePage(pagination.page + 1)}>Sau<ChevronRight size={14} aria-hidden="true" /></button>
    </nav>}
  </section>;
}
