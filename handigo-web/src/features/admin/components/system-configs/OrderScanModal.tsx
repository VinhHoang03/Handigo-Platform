import { Modal } from "@/components/common/Modal";
import type { OrderScanReport } from "../../api/systemConfig.api";

const dateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

const orderLabels: Record<string, string> = {
  created: "Mới tạo", accepted: "Đã nhận", in_progress: "Đang thực hiện",
};
const paymentLabels: Record<string, string> = {
  unpaid: "Chưa thanh toán", paid: "Đã thanh toán", partially_paid: "Đã thanh toán một phần",
  refunded: "Đã hoàn tiền", pending: "Chờ thanh toán", failed: "Thanh toán thất bại",
};

function formatDuration(start: string, end: string) {
  const minutes = Math.max(0, Math.floor((Date.parse(end) - Date.parse(start)) / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor(minutes / 60) % 24;
  const remainder = minutes % 60;
  return [days && `${days} ngày`, hours && `${hours} giờ`, remainder && `${remainder} phút`]
    .filter(Boolean).join(" ") || "Dưới 1 phút";
}

export function OrderScanModal({ report, busy, error, onClose, onProcess }: {
  report: OrderScanReport;
  busy: boolean;
  error: string;
  onClose: () => void;
  onProcess: () => void;
}) {
  const { rows, scannedAt } = report;
  const overdue = rows.filter(row => row.dueAt && Date.parse(row.dueAt) <= Date.parse(scannedAt));
  const oldest = overdue.reduce<string | null>((earliest, row) =>
    row.dueAt && (!earliest || Date.parse(row.dueAt) < Date.parse(earliest)) ? row.dueAt : earliest, null);

  return (
    <Modal open title="Kết quả quét đơn hàng" size="lg" onClose={() => { if (!busy) onClose(); }}
      closeOnEsc={!busy} closeOnOverlayClick={!busy}
      footer={<div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-secondary" disabled={busy} onClick={onClose}>Đóng</button>
        {rows.length > 0 && <button type="button" className="btn-primary" disabled={busy || Boolean(error)} onClick={onProcess}>
          {busy ? "Đang xử lý…" : `Xử lý ${rows.length} đơn`}
        </button>}
      </div>}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-on-surface-variant">
          <p>Xem các đơn và thao tác dự kiến trước khi xác nhận.</p>
          <p>Quét lúc <time dateTime={scannedAt}>{dateTime.format(new Date(scannedAt))}</time></p>
        </div>
        <dl className="grid grid-cols-2 gap-4 rounded-xl bg-surface-container-low p-4 sm:grid-cols-3">
          <div><dt className="text-sm text-on-surface-variant">Đơn cần xử lý</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{rows.length}</dd></div>
          <div><dt className="text-sm text-on-surface-variant">Đã quá hạn</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{overdue.length}</dd></div>
          <div className="col-span-2 sm:col-span-1"><dt className="text-sm text-on-surface-variant">Quá hạn lâu nhất</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{oldest ? formatDuration(oldest, scannedAt) : "—"}</dd></div>
        </dl>
        {error && <p role="alert" className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{error} Đóng báo cáo và quét lại để cập nhật.</p>}
        {rows.length ? (
          <ul aria-label="Đơn cần xử lý" className="divide-y divide-outline-variant/40 border-y border-outline-variant/40">
            {rows.map(row => {
              const isOverdue = row.dueAt && Date.parse(row.dueAt) <= Date.parse(scannedAt);
              return <li key={row.id} className="grid gap-2 py-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] sm:gap-4">
                <div className="min-w-0">
                  <p className="break-words font-semibold text-on-surface">{row.orderCode}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">{orderLabels[row.status] ?? row.status} · {paymentLabels[row.paymentStatus] ?? row.paymentStatus}</p>
                </div>
                <div><p className="font-medium text-on-surface">{row.reason}</p><p className="mt-1 text-sm text-on-surface-variant">{row.action}</p></div>
                <div className="text-sm sm:text-right">
                  <p className={isOverdue ? "font-semibold text-error" : "font-medium text-on-surface"}>{isOverdue ? "Quá hạn " : "Đã chờ "}{formatDuration(isOverdue ? row.dueAt! : row.since, scannedAt)}</p>
                  {row.dueAt && <p className="mt-1 text-on-surface-variant">Hạn <time dateTime={row.dueAt}>{dateTime.format(new Date(row.dueAt))}</time></p>}
                </div>
              </li>;
            })}
          </ul>
        ) : <p role="status" className="py-4 text-center text-on-surface-variant">Không có đơn cần xử lý tại thời điểm quét.</p>}
      </div>
    </Modal>
  );
}
