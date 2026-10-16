import type { OrderQuotation } from "@/types/booking";
import {
  formatCurrency,
  getQuotationStatusClass,
  getQuotationStatusLabel,
} from "./bookingDetailFormatters";
import { FileSpreadsheet } from "lucide-react";

type BookingQuotationDetailsProps = {
  quotation: OrderQuotation;
  busy: boolean;
  appliedDepositAmount: number;
  remainingQuotationAmount: number;
  onReject: () => void;
  orderStatus?: string;
};

/** Hiển thị bản báo giá đã lưu gần nhất của chuyên gia. */
export const BookingQuotationDetails = ({
  quotation,
  busy,
  appliedDepositAmount,
  remainingQuotationAmount,
  onReject,
}: BookingQuotationDetailsProps) => (
  <>
    <div className="flex flex-col gap-3 mb-lg sm:flex-row sm:items-center sm:justify-between">
      <h3 className="font-headline-sm text-headline-sm text-primary flex min-w-0 items-center gap-2">
        <FileSpreadsheet aria-hidden="true" size={20} />
        Báo giá sửa chữa
      </h3>
      <span
        className={`inline-flex max-w-full whitespace-normal break-words px-3 py-1 rounded-full text-xs font-bold uppercase leading-snug ${getQuotationStatusClass(quotation.quotation.status)}`}
      >
        {getQuotationStatusLabel(quotation.quotation.status)}
      </span>
    </div>

    <div className="grid gap-sm mb-lg sm:grid-cols-2">
      {quotation.quotation.quotationCode && (
        <div className="rounded-2xl bg-surface-container-low p-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
            Mã báo giá
          </p>
          <p className="mt-1 font-semibold text-on-surface">
            {quotation.quotation.quotationCode}
          </p>
        </div>
      )}
      {quotation.quotation.createdAt && (
        <div className="rounded-2xl bg-surface-container-low p-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
            Cập nhật gần nhất
          </p>
          <p className="mt-1 font-semibold text-on-surface">
            {new Date(quotation.quotation.updatedAt ?? quotation.quotation.createdAt).toLocaleString("vi-VN")}
          </p>
        </div>
      )}
    </div>

    <div className="space-y-sm mb-lg">
      {quotation.items.map((item, idx) => (
        <div
          key={idx}
          className="flex justify-between items-center bg-surface-container-low p-md rounded-2xl"
        >
          <div className="flex-1 min-w-0 mr-md">
            <p className="font-bold text-on-surface truncate">{item.title}</p>
            <p className="text-sm text-on-surface-variant tabular-nums">
              {item.quantity} x {formatCurrency(item.unitPrice)}
            </p>
            {item.description && (
              <p className="mt-1 text-xs text-on-surface-variant line-clamp-2">
                {item.description}
              </p>
            )}
          </div>
          <p className="text-sm font-semibold text-primary shrink-0 tabular-nums">
            {formatCurrency(item.totalPrice)}
          </p>
        </div>
      ))}
    </div>

    <div className="flex flex-col gap-md p-lg bg-primary/5 rounded-3xl border border-primary/10 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        {typeof quotation.quotation.subtotalAmount === "number" && (
          <p className="text-sm text-on-surface-variant tabular-nums">
            Tạm tính:{" "}
            <span className="font-semibold text-on-surface">
              {formatCurrency(quotation.quotation.subtotalAmount)}
            </span>
          </p>
        )}
        {!!quotation.quotation.discountAmount && (
          <p className="text-sm text-success tabular-nums">
            Giảm giá: -{formatCurrency(quotation.quotation.discountAmount)}
          </p>
        )}
        <div className="mt-3 space-y-2 border-t border-primary/10 pt-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="font-medium text-on-surface-variant">
              Tổng chi phí theo báo giá
            </span>
            <span className="font-bold tabular-nums text-on-surface">
              {formatCurrency(quotation.quotation.finalAmount)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 text-sm text-success">
            <span>Tiền cọc đã thanh toán</span>
            <span className="font-bold tabular-nums">
              -{formatCurrency(appliedDepositAmount)}
            </span>
          </div>
          <div className="flex items-end justify-between gap-4 border-t border-primary/10 pt-3">
            <div>
              <p className="text-xs font-bold uppercase text-on-surface-variant">
                Còn cần thanh toán
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Thanh toán trực tiếp theo thỏa thuận với chuyên gia
              </p>
            </div>
            <p className="shrink-0 text-headline-sm font-bold leading-tight text-primary tabular-nums">
              {formatCurrency(remainingQuotationAmount)}
            </p>
          </div>
        </div>
      </div>
      {quotation.quotation.status === "pending" && (
        <div className="flex flex-col gap-sm sm:flex-row">
          <button
            disabled={busy}
            onClick={onReject}
            className="px-6 py-3 border-2 border-error/30 text-error rounded-2xl font-bold hover:bg-error/10 active:scale-95 transition-all disabled:opacity-50"
          >
            Từ chối
          </button>
        </div>
      )}
    </div>

    {quotation.quotation.inspectionNote && (
      <div className="mt-md p-md bg-surface-container rounded-2xl border border-outline-variant/30 italic text-on-surface-variant text-sm">
        <strong>Ghi chú khảo sát:</strong> {quotation.quotation.inspectionNote}
      </div>
    )}
    {quotation.quotation.recommendation && (
      <div className="mt-md p-md bg-surface-container rounded-2xl border border-outline-variant/30 text-on-surface-variant text-sm">
        <strong>Đề xuất xử lý:</strong> {quotation.quotation.recommendation}
      </div>
    )}
    {quotation.quotation.status === "rejected" &&
      quotation.quotation.rejectionReason && (
        <div className="mt-md p-md bg-error/8 rounded-2xl border border-error/30 text-error text-sm">
          <strong>Lý do từ chối:</strong> {quotation.quotation.rejectionReason}
        </div>
      )}
  </>
);
