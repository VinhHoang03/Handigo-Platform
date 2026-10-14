import { useState } from 'react';
import type { Order } from '@/types/booking';
import { getAppliedQuotationDeposit, getDirectRepairPayment } from '@/utils/quotationPayment';
import type { CreateQuotationPayload, QuotationDetail } from '../../types/providerOrder.types';
import { formatMoney } from '../../utils/providerOrder.utils';
import { FixedPriceActionForm } from '../FixedPriceActionForm';
import { RepairQuotationForm } from '../RepairQuotationForm';
import { CalendarX, Hourglass } from "lucide-react";
import { getQuotationStatusLabel } from '@/features/booking/components/detail/bookingDetailFormatters';

interface QuotationOrderPanelProps {
  order: Order;
  quotation: QuotationDetail | null;
  busy: boolean;
  isUnconfirmedAppointment: boolean;
  showQuotationForm: boolean | undefined;
  onStart: () => void | Promise<void>;
  onCreateQuotation: (payload: CreateQuotationPayload) => Promise<boolean>;
  onCancel: () => void;
  onComplete: (files: File[], note: string) => void | Promise<void>;
  onConfirmPayment: (quotationId: string, expectedRevision: number) => Promise<boolean>;
}

/** Nhánh đơn dịch vụ yêu cầu khảo sát: báo giá hoặc thao tác thực hiện. */
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
  onConfirmPayment,
}: QuotationOrderPanelProps) {
  const appliedDepositAmount = getAppliedQuotationDeposit(order);
  const [editing, setEditing] = useState(false);
  const canEdit = !isUnconfirmedAppointment && ['accepted', 'in_progress'].includes(order.status)
    && (!quotation || ['saved', 'approved'].includes(quotation.quotation.status));
  const showForm = canEdit && (showQuotationForm || editing);
  const usableQuotation = quotation && (quotation.quotation.status === 'saved' || quotation.quotation.status === 'approved');
  return (
    <>
      {isUnconfirmedAppointment ? (
        <div className="flex h-full flex-col items-center justify-center border border-outline-variant/30 bg-surface-container-lowest p-md text-center text-on-surface-variant lg:col-span-2">
          <CalendarX aria-hidden="true" size={36} className="mb-2" />
          <p className="font-bold text-on-surface">Đang chờ khách hàng thanh toán giữ lịch</p>
          <p className="mt-1 text-sm">Form báo giá sẽ hiển thị sau khi lịch hẹn được thanh toán và xác nhận.</p>
          {quotation && order.status === 'accepted' && !showForm && (
            <button type="button" disabled={busy} onClick={onCancel} className="btn-secondary mt-md text-error">Hủy đơn dịch vụ</button>
          )}
        </div>
      ) : quotation && !showForm && (
        <section className={`h-full space-y-md rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-md ${order.status === 'accepted' ? 'lg:col-span-2' : ''}`}>
          <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
            <h2 className="min-w-0 break-words font-headline-md text-on-surface">Báo giá sửa chữa</h2>
            <span className="self-start rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              {getQuotationStatusLabel(quotation.quotation.status)}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant">Mã báo giá: {quotation.quotation.quotationCode} · Cập nhật: {new Date(quotation.quotation.updatedAt ?? quotation.quotation.createdAt).toLocaleString('vi-VN')}</p>
          {!canEdit && ['completed', 'cancelled'].includes(order.status) && <p className="text-sm text-on-surface-variant">Báo giá đã khóa vì đơn đã kết thúc.</p>}
          {canEdit && quotation.quotation.directPaymentConfirmedAt && <p className="text-sm text-on-surface-variant">Nếu chỉnh sửa báo giá, bạn cần xác nhận thanh toán lại cho phiên bản mới.</p>}
          {quotation.quotation.inspectionNote && (
            <p className="whitespace-pre-wrap break-words text-sm text-on-surface-variant">{quotation.quotation.inspectionNote}</p>
          )}
          <div className="grid grid-cols-1 items-start gap-md lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="min-w-0 space-y-sm">
            <h3 className="text-sm font-semibold text-on-surface">Hạng mục báo giá</h3>
            <div className="divide-y divide-outline-variant/30 rounded-2xl border border-outline-variant/30 px-md">
            {quotation.items.map((item) => (
              <div
                key={item._id}
                className="flex min-w-0 flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="break-words font-medium text-on-surface">{item.title}</p>
                  <p className="mt-1 text-sm tabular-nums text-on-surface-variant">
                    {item.quantity} × {formatMoney(item.unitPrice)}
                  </p>
                </div>
                <p className="shrink-0 text-right font-semibold tabular-nums text-on-surface">{formatMoney(item.totalPrice)}</p>
              </div>
            ))}
            </div>
          </div>
          <div className="min-w-0 space-y-sm">
          <h3 className="text-sm font-semibold text-on-surface">Tổng tiền</h3>
          <dl className="space-y-3 rounded-2xl bg-primary/5 p-md">
          <div className="flex flex-wrap items-baseline justify-between gap-sm">
            <dt className="text-sm font-medium text-on-surface-variant">Tổng báo giá</dt>
            <dd className="ml-auto text-right text-base font-semibold tabular-nums text-on-surface">
              {formatMoney(quotation.quotation.finalAmount)}
            </dd>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-sm text-sm text-on-surface-variant">
            <dt>Khách đã thanh toán</dt>
            <dd className="ml-auto text-right tabular-nums">−{formatMoney(appliedDepositAmount)}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-sm border-t border-primary/15 pt-3">
            <dt className="text-base font-semibold text-primary">{quotation.quotation.directPaymentConfirmedAt ? 'Đã thu trực tiếp từ khách' : 'Thu trực tiếp từ khách'}</dt>
            <dd className="ml-auto text-right text-headline-md font-bold tabular-nums text-primary">
              {formatMoney(getDirectRepairPayment(quotation.quotation.finalAmount, appliedDepositAmount))}
            </dd>
          </div>
          </dl>
          </div>
          </div>
          {(canEdit || order.status === 'accepted') && (
            <div className="flex flex-col gap-sm border-t border-outline-variant/20 pt-md sm:flex-row sm:flex-wrap sm:items-center">
              {order.status === 'accepted' && <button type="button" disabled={busy} onClick={onCancel}
                className="order-3 flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-semibold text-error hover:bg-error/5 disabled:opacity-50 sm:order-none sm:mr-auto">
                Hủy đơn dịch vụ
              </button>}
              {canEdit && <button type="button" disabled={busy} onClick={() => setEditing(true)}
                className="btn-secondary order-2 sm:order-none sm:ml-auto">Chỉnh sửa báo giá</button>}
          {usableQuotation && order.status === 'accepted' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onStart}
                  className="btn-primary order-1 w-full py-3 text-base font-bold sm:order-none sm:w-auto"
                >
                  {busy ? 'Đang xử lý...' : 'Bắt đầu làm việc'}
                </button>
          )}
            </div>
          )}
        </section>
      )}

      {showForm && (
        <div className="h-full lg:col-span-2">
          <RepairQuotationForm
            key={quotation ? `${quotation.quotation._id}-${quotation.quotation.revision ?? 0}` : 'new'}
            initialQuotation={quotation}
            onDiscard={quotation ? () => setEditing(false) : undefined}
            depositAmount={order.depositAmount}
            appliedDepositAmount={appliedDepositAmount}
            defaultDurationMinutes={order.schedule?.durationMinutes}
            orderId={order._id}
            serviceName={order.serviceId.name}
            onSubmit={async (payload) => {
              const succeeded = await onCreateQuotation(payload);
              if (succeeded) setEditing(false);
              return succeeded;
            }}
            onCancel={onCancel}
            busy={busy}
          />
        </div>
      )}

      {!isUnconfirmedAppointment && !quotation && !showForm && (
        <div className="flex h-full flex-col items-center justify-center border border-outline-variant/30 bg-surface-container-lowest p-md text-center text-on-surface-variant">
          <Hourglass aria-hidden="true" size={36} className="mb-2" />
          <p>Chờ khách hàng hoặc bước tiếp theo</p>
        </div>
      )}

      {!showForm && ['in_progress', 'completed'].includes(order.status) && (
        <div className="space-y-md">
          <FixedPriceActionForm order={order} quotation={quotation} onConfirmPayment={onConfirmPayment} onStart={onStart} onComplete={onComplete} onCancel={onCancel} busy={busy} />
        </div>
      )}
    </>
  );
}
