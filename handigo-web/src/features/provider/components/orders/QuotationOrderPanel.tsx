import type { Order } from '@/types/booking';
import type { CreateQuotationPayload, QuotationDetail } from '../../types/providerOrder.types';
import { formatMoney } from '../../utils/providerOrder.utils';
import { FixedPriceActionForm } from '../FixedPriceActionForm';
import { RepairQuotationForm } from '../RepairQuotationForm';

interface QuotationOrderPanelProps {
  order: Order;
  quotation: QuotationDetail | null;
  busy: boolean;
  isUnconfirmedAppointment: boolean;
  showQuotationForm: boolean | undefined;
  onStart: () => void | Promise<void>;
  onCreateQuotation: (payload: CreateQuotationPayload) => Promise<void>;
  onCancel: () => void;
  onComplete: (files: File[], note: string) => void | Promise<void>;
}

/** Nhánh đơn dịch vụ yêu cầu khảo sát: báo giá, chờ khách xác nhận lịch, hoặc thao tác thực hiện. */
export function QuotationOrderPanel({
  order,
  quotation,
  busy,
  isUnconfirmedAppointment,
  showQuotationForm,
  onStart,
  onCreateQuotation,
  onCancel,
  onComplete,
}: QuotationOrderPanelProps) {
  return (
    <>
      {isUnconfirmedAppointment ? (
        <div className="flex h-full flex-col items-center justify-center border border-outline-variant/30 bg-surface-container-lowest p-md text-center text-on-surface-variant lg:col-span-2">
          <span className="material-symbols-outlined mb-2 text-4xl">event_busy</span>
          <p className="font-bold text-on-surface">Đang chờ khách hàng thanh toán giữ lịch</p>
          <p className="mt-1 text-sm">Form báo giá sẽ hiển thị sau khi lịch hẹn được thanh toán và xác nhận.</p>
        </div>
      ) : quotation && (
        <section className="h-full space-y-md rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-md">
          <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
            <h2 className="min-w-0 break-words font-headline-md text-on-surface">Báo giá sửa chữa</h2>
            <span className="self-start rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              {quotation.quotation.status}
            </span>
          </div>
          {quotation.quotation.inspectionNote && (
            <p className="whitespace-pre-wrap break-words text-sm text-on-surface-variant">{quotation.quotation.inspectionNote}</p>
          )}
          <div className="space-y-sm">
            {quotation.items.map((item) => (
              <div
                key={item._id}
                className="flex min-w-0 flex-col gap-2 rounded-2xl bg-surface-container-low px-sm py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="break-words font-medium text-on-surface">{item.title}</p>
                  <p className="text-xs text-on-surface-variant">
                    {item.quantity} x {formatMoney(item.unitPrice)}
                  </p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums text-primary">{formatMoney(item.totalPrice)}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-sm border-t border-outline-variant/20 pt-md">
            <span className="font-medium text-on-surface">Tổng báo giá</span>
            <span className="text-headline-md font-bold tabular-nums text-primary">
              {formatMoney(quotation.quotation.finalAmount)}
            </span>
          </div>

          {quotation.quotation.status === 'approved' && (
            <div className="rounded-2xl bg-success-container p-3 text-sm text-on-success-container">
              <p className="font-bold">Khách hàng đã đồng ý báo giá</p>
              <p className="mt-1 text-on-success-container">
                {order.status === 'accepted'
                  ? 'Bạn có thể bắt đầu công việc ngay, không cần chờ khách hàng thanh toán.'
                  : 'Công việc đang được thực hiện.'}
              </p>
              {order.status === 'accepted' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onStart}
                  className="btn-primary mt-3 w-full py-3 text-base font-bold"
                >
                  {busy ? 'Đang xử lý...' : 'Bắt đầu làm việc'}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {showQuotationForm && (
        <div className="h-full lg:col-span-2">
          <RepairQuotationForm onSubmit={onCreateQuotation} onCancel={onCancel} busy={busy} />
        </div>
      )}

      {!isUnconfirmedAppointment && !quotation && !showQuotationForm && (
        <div className="flex h-full flex-col items-center justify-center border border-outline-variant/30 bg-surface-container-lowest p-md text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl mb-2">hourglass_empty</span>
          <p>Chờ khách hàng hoặc bước tiếp theo</p>
        </div>
      )}

      {['in_progress', 'completed'].includes(order.status) && (
        <FixedPriceActionForm order={order} onStart={onStart} onComplete={onComplete} onCancel={onCancel} busy={busy} />
      )}
    </>
  );
}
