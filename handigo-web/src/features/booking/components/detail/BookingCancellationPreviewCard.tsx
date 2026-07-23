import type { CancellationPreview } from "@/types/booking";
import { formatCurrency } from "./bookingDetailFormatters";

type BookingCancellationPreviewCardProps = {
  cancellationPreview: CancellationPreview;
};

/** Xem trước chính sách hoàn tiền khi hủy đơn/chuỗi lịch — hiển thị trong modal xác nhận hủy. */
export const BookingCancellationPreviewCard = ({
  cancellationPreview,
}: BookingCancellationPreviewCardProps) => (
  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-bold text-on-surface">Chính sách hoàn tiền</p>
        <p className="mt-1 text-xs text-on-surface-variant">
          {cancellationPreview.scope === "series"
            ? `${cancellationPreview.orderCount} buổi được tính riêng theo thời gian bắt đầu.`
            : cancellationPreview.items[0]?.policyReason}
        </p>
      </div>
      <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-on-primary">
        Hoàn {cancellationPreview.items.length === 1
          ? `${cancellationPreview.items[0].refundRate}%`
          : "theo từng buổi"}
      </span>
    </div>

    {cancellationPreview.paidAmount > 0 ? (
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-surface-container-lowest p-2">
          <dt className="text-[11px] text-on-surface-variant">Đã thanh toán</dt>
          <dd className="mt-1 text-sm font-bold text-on-surface tabular-nums">
            {formatCurrency(cancellationPreview.paidAmount)}
          </dd>
        </div>
        <div className="rounded-xl bg-surface-container-lowest p-2">
          <dt className="text-[11px] text-on-surface-variant">Hoàn lại</dt>
          <dd className="mt-1 text-sm font-bold text-primary tabular-nums">
            {formatCurrency(cancellationPreview.refundAmount)}
          </dd>
        </div>
        <div className="rounded-xl bg-surface-container-lowest p-2">
          <dt className="text-[11px] text-on-surface-variant">Phí hủy</dt>
          <dd className="mt-1 text-sm font-bold text-error tabular-nums">
            {formatCurrency(cancellationPreview.cancellationFee)}
          </dd>
        </div>
      </dl>
    ) : (
      <p className="mt-3 rounded-xl bg-surface-container-lowest px-3 py-2 text-xs text-on-surface-variant">
        Chưa ghi nhận khoản thanh toán trực tuyến cần hoàn cho đơn này.
      </p>
    )}
  </div>
);
