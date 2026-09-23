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
  onConfirm: () => void;
  onReject: () => void;
};

/** Nội dung báo giá sửa chữa khi chuyên gia đã gửi báo giá. */
export const BookingQuotationDetails = ({
  quotation,
  busy,
  appliedDepositAmount,
  remainingQuotationAmount,
  onConfirm,
  onReject,
}: BookingQuotationDetailsProps) => (
  <>
    <div className="flex flex-col gap-3 mb-lg sm:flex-row sm:items-center sm:justify-between">
      <h3 className="font-headline-md text-headline-md text-primary flex min-w-0 items-center gap-2">
        <FileSpreadsheet aria-hidden="true" size={24} />
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
            Thời gian gửi
          </p>
          <p className="mt-1 font-semibold text-on-surface">
            {new Date(quotation.quotation.createdAt).toLocaleString("vi-VN")}
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
          <p className="font-headline-sm text-primary shrink-0 tabular-nums">
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
              <p className="text-label-sm font-bold uppercase text-on-surface-variant">
                Còn cần thanh toán
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Thanh toán trực tiếp theo thỏa thuận với chuyên gia
              </p>
            </div>
            <p className="shrink-0 text-headline-lg font-black leading-none text-primary tabular-nums">
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
          <button
            disabled={busy}
            onClick={onConfirm}
            className="px-8 py-3 bg-primary text-on-primary rounded-2xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {busy && (
              <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
            )}
            Đồng ý báo giá
          </button>
        </div>
      )}
    </div>

    {quotation.quotation.status === "approved" && (
      <div className="mt-md rounded-3xl border border-success/30 bg-success-container p-md text-on-success-container">
        <p className="font-bold">Bạn đã đồng ý báo giá</p>
        <p className="mt-1 text-sm text-on-success-container">
          Chuyên gia có thể bắt đầu thực hiện công việc ngay, không cần chờ thanh toán.
        </p>
        <div className="mt-3 grid gap-2 border-t border-success/30 pt-3 sm:grid-cols-3">
          <div>
            <p className="text-xs font-bold uppercase text-on-success-container">
              Tổng chi phí
            </p>
            <p className="mt-1 font-bold tabular-nums">
              {formatCurrency(quotation.quotation.finalAmount)}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-on-success-container">
              Tiền cọc qua Handigo
            </p>
            <p className="mt-1 font-bold tabular-nums">
              {formatCurrency(appliedDepositAmount)}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-on-success-container">
              Còn cần thanh toán
            </p>
            <p className="mt-1 font-bold tabular-nums">
              {formatCurrency(remainingQuotationAmount)}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-on-success-container">
          Bạn tự trao đổi phương thức và thanh toán số tiền còn lại trực tiếp với chuyên gia.
        </p>
      </div>
    )}

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
