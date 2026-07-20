import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { bookingApi } from '@/features/booking/api/booking.api';
import { DashboardShell } from '@/components/common/DashboardShell';
import { providerOrderApi } from '../api/providerOrder.api';
import { RepairQuotationForm } from '../components/RepairQuotationForm';
import { PendingAssignmentCard } from '../components/PendingAssignmentCard';
import type { OrderAssignment, QuotationDetail } from '../types/providerOrder.types';
import type { Order } from '@/types/booking';
import { useProviderAvailability } from '../hooks/useProviderAvailability';
import {
  formatDateTime,
  formatMoney,
  getCustomer,
  getPaymentMethodLabel,
  providerStatusLabels,
  providerStatusStyles,
} from '../utils/providerOrder.utils';
import { FixedPriceActionForm } from '../components/FixedPriceActionForm';
import { OrderChatButton } from '@/features/chat/components/OrderChatButton';
import { ReliableImage } from '@/components/common/ReliableImage';
import { Modal } from '@/components/common/Modal';
import { normalizeImageUrl } from '@/utils/imageUrl';
import { ProviderOrderFeedbackThread } from '../components/ProviderOrderFeedbackThread';
import { OrderTrackingMap } from '@/features/tracking/components/OrderTrackingMap';

export default function ProviderOrderDetailPage() {
  const { orderId } = useParams();
  const { isOnline, toggleAvailability } = useProviderAvailability();
  const [order, setOrder] = useState<Order | null>(null);
  const [assignment, setAssignment] = useState<OrderAssignment | null>(null);
  const [quotation, setQuotation] = useState<QuotationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelExplanation, setCancelExplanation] = useState('');
  const [cancelError, setCancelError] = useState('');

  const loadData = useCallback(async () => {
    if (!orderId) return;

    setLoading(true);
    try {
      const [orderData, pendingAssignments] = await Promise.all([
        bookingApi.getOrderById(orderId),
        providerOrderApi.getPendingAssignments(),
      ]);

      setOrder(orderData);
      const matchedAssignment = pendingAssignments.find((item) => {
        const relatedOrder =
          typeof item.orderId === 'object' ? item.orderId._id : item.orderId;
        return relatedOrder === orderId;
      });
      setAssignment(matchedAssignment ?? null);

      if (orderData.inspectionRequired && orderData.status !== 'created') {
        const quotationData = await providerOrderApi.getQuotation(orderId);
        setQuotation(quotationData);
      } else {
        setQuotation(null);
      }

      setError(null);
    } catch {
      setError('Không thể tải chi tiết đơn dịch vụ.');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  const runAction = async (action: () => Promise<void>, fallbackMessage: string) => {
    try {
      setBusy(true);
      setError(null);
      await action();
      await loadData();
    } catch (err: unknown) {
      const message =
        typeof err === 'object' &&
          err !== null &&
          'response' in err &&
          typeof err.response === 'object' &&
          err.response !== null &&
          'data' in err.response
          ? ((err.response.data as { message?: string }).message ?? fallbackMessage)
          : fallbackMessage;
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = async () => {
    if (!assignment) return;
    await runAction(async () => {
      await providerOrderApi.acceptAssignment(assignment._id);
    }, 'Không thể nhận đơn.');
  };

  const handleReject = async () => {
    if (!assignment) return;
    const reason = window.prompt('Lý do từ chối (tùy chọn):') ?? undefined;
    await runAction(async () => {
      await providerOrderApi.rejectAssignment(assignment._id, reason);
    }, 'Không thể từ chối đơn.');
  };

  const handleStart = async () => {
    if (!order) return;
    await runAction(async () => {
      await providerOrderApi.startOrder(order._id);
    }, 'Không thể bắt đầu đơn.');
  };

  const handleComplete = async (files: File[], completionNote: string) => {
    if (!order) return;
    await runAction(async () => {
      const completionEvidenceImages = await Promise.all(
        files.map((file) => bookingApi.uploadOrderAttachment(file)),
      );
      await providerOrderApi.completeOrder(order._id, {
        completionEvidenceImages,
        completionNote,
      });
    }, 'Không thể hoàn thành đơn.');
  };

  const requestCancelConfirmation = () => {
    const reason = cancelReason.trim();
    const explanation = cancelExplanation.trim();
    if (!reason) {
      setCancelError('Vui lòng chọn lý do hủy đơn.');
      return;
    }
    if (reason === 'Lý do khác' && explanation.length < 10) {
      setCancelError('Vui lòng nhập nội dung giải thích ít nhất 10 ký tự.');
      return;
    }
    if (explanation && explanation.length < 10) {
      setCancelError('Nội dung giải thích phải có ít nhất 10 ký tự.');
      return;
    }
    setCancelError('');
    setCancelConfirmOpen(true);
  };

  const handleCancel = async () => {
    if (!order) return;
    const reason = cancelReason.trim();
    const explanation = cancelExplanation.trim();
    const cancellationReason = explanation ? `${reason}: ${explanation}` : reason;
    await runAction(async () => {
      await providerOrderApi.cancelOrder(order._id, cancellationReason);
      setCancelConfirmOpen(false);
      setCancelOpen(false);
      setCancelReason('');
      setCancelExplanation('');
    }, 'Không thể hủy đơn.');
  };

  const handleCreateQuotation = async (payload: Parameters<typeof providerOrderApi.createQuotation>[1]) => {
    if (!orderId) return;
    await runAction(async () => {
      await providerOrderApi.createQuotation(orderId, payload);
    }, 'Không thể gửi báo giá.');
  };

  if (loading) {
    return (
      <DashboardShell role="PROVIDER" showStatusToggle isOnline={isOnline} onStatusToggle={toggleAvailability}>
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-sm">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <p className="text-on-surface-variant">Đang tải chi tiết đơn...</p>
        </div>
      </DashboardShell>
    );
  }

  if (!order) {
    return (
      <DashboardShell role="PROVIDER" showStatusToggle isOnline={isOnline} onStatusToggle={toggleAvailability}>
        <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined mb-2 text-6xl text-error/60">error_outline</span>
          <h2 className="font-headline-md">{error || 'Không tìm thấy đơn dịch vụ'}</h2>
          <Link to="/provider/orders" className="btn-primary mt-md">
            Quay lại danh sách
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const customer = getCustomer(order);
  const address = order.addressId as {
    fullAddress?: string;
    detailAddress?: string;
    ward?: string;
    district?: string;
    province?: string;
    note?: string;
  };
  const addressLine =
    address.fullAddress?.trim() ||
    [address.detailAddress, address.ward, address.district, address.province]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(', ');
  const paymentStatusLabels: Record<Order['paymentStatus'], string> = {
    unpaid: 'Chưa thanh toán',
    partially_paid: 'Đã thanh toán một phần',
    paid: 'Đã thanh toán',
    refunded: 'Đã hoàn tiền',
  };
  const paymentStatusLabel =
    order.status === 'cancelled' &&
    ['paid', 'partially_paid'].includes(order.paymentStatus)
      ? 'Đang xử lý hoàn tiền'
      : order.status === 'cancelled' &&
          order.paymentStatus === 'refunded' &&
          order.cancellation?.refundPolicy &&
          order.cancellation.refundPolicy.refundRate < 100
        ? `Đã hoàn ${order.cancellation.refundPolicy.refundRate}% cho khách`
        : paymentStatusLabels[order.paymentStatus];
  const orderTypeLabels: Record<Order['orderType'], string> = {
    normal: 'Thực hiện sớm nhất',
    urgent: 'Khẩn cấp',
    scheduled: 'Theo lịch hẹn',
    recurring: 'Định kỳ',
  };
  const showQuotationForm =
    order.inspectionRequired &&
    ['accepted', 'in_progress'].includes(order.status) &&
    !quotation;

  return (
    <DashboardShell role="PROVIDER" showStatusToggle isOnline={isOnline} onStatusToggle={toggleAvailability}>
      <div className="space-y-gutter">
        <Link to="/provider/orders" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Quay lại danh sách
        </Link>

        {error && (
          <div className="rounded-2xl bg-error/10 px-md py-sm text-sm text-error">{error}</div>
        )}

        {assignment && (
          <PendingAssignmentCard
            assignment={assignment}
            onAccept={handleAccept}
            onReject={handleReject}
            busy={busy}
          />
        )}

        <header className="glass-card flex flex-col gap-md rounded-3xl border border-outline-variant/30 p-md sm:flex-row sm:items-center sm:justify-between sm:p-lg">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Chi tiết đơn dịch vụ</p>
            <h1 className="mt-1 break-words font-headline-lg text-headline-lg text-on-surface">
              {order.serviceId?.name || 'Chi tiết đơn dịch vụ'}
            </h1>
            <p className="mt-1 text-sm text-on-surface-variant">Theo dõi thông tin, tài chính và tiến độ trên cùng một màn hình.</p>
          </div>
          <div className="flex flex-wrap items-center gap-sm">
            <span className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-bold ${providerStatusStyles[order.status]}`}>
              {providerStatusLabels[order.status]}
            </span>
            {['accepted', 'in_progress'].includes(order.status) && <OrderChatButton orderId={order._id} />}
          </div>
        </header>

        <div className="grid grid-cols-1 items-start gap-gutter md:grid-cols-2 lg:grid-cols-3">
          <CustomerInformationCard
            order={order}
            customer={customer}
            addressLine={addressLine}
            addressNote={address.note}
            orderType={orderTypeLabels[order.orderType]}
          />
          <PaymentSummaryCard
            order={order}
            paymentStatus={paymentStatusLabel}
          />
          <OrderProgressCard order={order} />
        </div>

        <OrderTrackingMap order={order} viewerRole="PROVIDER" />

        <div className="grid grid-cols-1 items-start gap-gutter lg:grid-cols-2">
            {order.inspectionRequired ? (
              <>
                {quotation && (
                  <section className="glass-card h-full space-y-md rounded-3xl p-md">
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
                          <p className="shrink-0 font-semibold text-primary">{formatMoney(item.totalPrice)}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-sm border-t border-outline-variant/20 pt-md">
                      <span className="font-medium text-on-surface">Tổng báo giá</span>
                      <span className="text-headline-md font-bold text-primary">
                        {formatMoney(quotation.quotation.finalAmount)}
                      </span>
                    </div>

                  </section>
                )}

                {showQuotationForm && (
                  <div className="h-full lg:col-span-2">
                    <RepairQuotationForm
                      onSubmit={handleCreateQuotation}
                      onCancel={() => setCancelOpen(true)}
                      busy={busy}
                    />
                  </div>
                )}

                {!quotation && !showQuotationForm && (
                  <div className="glass-card flex h-full flex-col items-center justify-center p-md text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-4xl mb-2">hourglass_empty</span>
                    <p>Chờ khách hàng hoặc bước tiếp theo</p>
                  </div>
                )}

                {(quotation || order.status === 'completed') && (
                  <FixedPriceActionForm
                    order={order}
                    onStart={handleStart}
                    onComplete={handleComplete}
                    onCancel={() => setCancelOpen(true)}
                    busy={busy}
                  />
                )}
              </>
            ) : (
              <FixedPriceActionForm
                order={order}
                onStart={handleStart}
                onComplete={handleComplete}
                onCancel={() => setCancelOpen(true)}
                busy={busy}
              />
            )}
        </div>

        {order.status === 'completed' && <ProviderOrderFeedbackThread orderId={order._id} />}
      </div>

      {cancelOpen && !cancelConfirmOpen && (
        <CancellationDialog
          reason={cancelReason}
          explanation={cancelExplanation}
          error={cancelError}
          busy={busy}
          onReasonChange={(value) => { setCancelReason(value); setCancelError(''); }}
          onExplanationChange={(value) => { setCancelExplanation(value); setCancelError(''); }}
          onClose={() => { setCancelOpen(false); setCancelError(''); }}
          onConfirm={requestCancelConfirmation}
        />
      )}
      {cancelConfirmOpen && (
        <CancelConfirmationDialog
          reason={cancelReason}
          busy={busy}
          onBack={() => setCancelConfirmOpen(false)}
          onConfirm={() => void handleCancel()}
        />
      )}
    </DashboardShell>
  );
}

const cancellationReasons = [
  'Không thể sửa chữa hoặc thực hiện dịch vụ',
  'Khách hàng cung cấp thông tin chưa đầy đủ',
  'Không thể liên hệ với khách hàng',
  'Lịch hẹn không còn phù hợp',
  'Lý do khác',
];

function CancellationDialog({
  reason,
  explanation,
  error,
  busy,
  onReasonChange,
  onExplanationChange,
  onClose,
  onConfirm,
}: {
  reason: string;
  explanation: string;
  error: string;
  busy: boolean;
  onReasonChange: (value: string) => void;
  onExplanationChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open title="Hủy đơn dịch vụ" onClose={onClose} size="lg" closeOnOverlayClick={!busy} closeOnEsc={!busy} danger>
        <p className="text-sm text-on-surface-variant">Lý do hủy sẽ được lưu cùng đơn hàng và thông báo cho khách hàng.</p>
        <div className="mt-md space-y-2">
          {cancellationReasons.map((item) => (
            <label key={item} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${reason === item ? 'border-error bg-error/5' : 'border-outline-variant/40 hover:bg-surface-container-low'}`}>
              <input type="radio" name="cancel-reason" value={item} checked={reason === item} onChange={() => onReasonChange(item)} className="mt-1 text-error focus:ring-error" />
              <span className="text-sm font-medium text-on-surface">{item}</span>
            </label>
          ))}
        </div>
        <label className="mt-md block">
          <span className="text-sm font-medium text-on-surface">Giải thích thêm {reason === 'Lý do khác' && <span className="text-error">*</span>}</span>
          <textarea value={explanation} onChange={(event) => onExplanationChange(event.target.value)} maxLength={500} rows={5} aria-invalid={Boolean(error)} className="mt-2 w-full resize-none rounded-2xl border border-outline-variant px-4 py-3 outline-none focus:border-error focus:ring-4 focus:ring-error/10" placeholder={reason === 'Lý do khác' ? 'Mô tả cụ thể lý do hủy (ít nhất 10 ký tự)...' : 'Bổ sung thông tin để khách hàng hiểu rõ hơn (không bắt buộc)...'} />
          <span className="mt-1 block text-right text-xs text-on-surface-variant">{explanation.length}/500</span>
        </label>
        {error && <p className="mt-2 text-sm text-error">{error}</p>}
        <div className="mt-md flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">Quay lại</button>
          <button type="button" onClick={onConfirm} disabled={busy} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-error px-5 py-3 font-bold text-on-error shadow-md transition hover:brightness-95 active:scale-[0.98] disabled:opacity-50"><span className="material-symbols-outlined">warning</span>Tiếp tục hủy đơn</button>
        </div>
    </Modal>
  );
}

function CancelConfirmationDialog({
  reason,
  busy,
  onBack,
  onConfirm,
}: {
  reason: string;
  busy: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open title="Xác nhận hủy đơn?" onClose={onBack} size="md" closeOnOverlayClick={!busy} closeOnEsc={!busy} danger>
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-error/10 text-error">
          <span className="material-symbols-outlined text-3xl">warning</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">Hành động này sẽ hủy đơn dịch vụ và thông báo cho khách hàng. Vui lòng kiểm tra lại trước khi xác nhận.</p>
        <div className="mt-4 rounded-2xl bg-error/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-error">Lý do đã chọn</p>
          <p className="mt-1 text-sm font-medium text-on-surface">{reason}</p>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onBack} disabled={busy} className="btn-secondary min-h-12">Kiểm tra lại</button>
          <button type="button" onClick={onConfirm} disabled={busy} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-error px-5 py-3 font-bold text-on-error shadow-md transition hover:brightness-95 active:scale-[0.98] disabled:opacity-50">
            <span className="material-symbols-outlined">delete_forever</span>
            {busy ? 'Đang hủy đơn...' : 'Hủy đơn ngay'}
          </button>
        </div>
    </Modal>
  );
}

function CustomerInformationCard({
  order,
  customer,
  addressLine,
  addressNote,
  orderType,
}: {
  order: Order;
  customer: ReturnType<typeof getCustomer>;
  addressLine: string;
  addressNote?: string;
  orderType: string;
}) {
  const details = [
    { icon: 'phone', label: 'Số điện thoại', value: customer?.phone || 'Chưa cập nhật' },
    { icon: 'location_on', label: 'Địa chỉ thực hiện', value: addressLine || 'Chưa cập nhật' },
    { icon: 'home_repair_service', label: 'Loại dịch vụ', value: order.serviceId?.name || 'Chưa cập nhật' },
    { icon: 'event', label: 'Thời gian đặt lịch', value: formatDateTime(order.scheduledAt || order.createdAt) },
    { icon: 'confirmation_number', label: 'Mã đơn hàng', value: order.orderCode },
  ];

  return (
    <section className="glass-card order-1 h-full overflow-hidden rounded-3xl border border-outline-variant/30 p-md sm:p-lg">
      <CardTitle icon="person" title="Thông tin khách hàng" />
      <div className="mt-md flex items-center gap-3 rounded-2xl bg-primary/5 p-3">
        <ReliableImage
          src={customer?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(customer?.fullName || 'KH')}&background=4f46e5&color=fff`}
          alt={customer?.fullName || 'Khách hàng'}
          className="h-14 w-14 shrink-0 rounded-2xl object-cover"
        />
        <div className="min-w-0">
          <p className="text-xs font-medium text-on-surface-variant">Khách hàng</p>
          <p className="truncate text-lg font-bold text-on-surface">{customer?.fullName || 'Khách hàng'}</p>
          <span className="mt-1 inline-flex rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-primary">{orderType}</span>
        </div>
      </div>
      <div className="mt-md divide-y divide-outline-variant/20">
        {details.map((item) => (
          <div key={item.label} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <span className="material-symbols-outlined mt-0.5 text-xl text-primary">{item.icon}</span>
            <div className="min-w-0">
              <p className="text-xs text-on-surface-variant">{item.label}</p>
              <p className="mt-0.5 break-words text-sm font-semibold text-on-surface">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
      {(order.problemDescription || addressNote) && (
        <div className="mt-md rounded-2xl bg-surface-container-low p-3 text-sm">
          {order.problemDescription && <p className="whitespace-pre-wrap text-on-surface"><strong>Mô tả:</strong> {order.problemDescription}</p>}
          {addressNote && <p className="mt-2 whitespace-pre-wrap text-on-surface"><strong>Ghi chú địa chỉ:</strong> {addressNote}</p>}
        </div>
      )}
      {order.customerAttachments?.length ? (
        <div className="mt-md">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-on-surface-variant">Ảnh mô tả</p>
          <div className="grid grid-cols-3 gap-2">
            {order.customerAttachments.map((url, index) => (
              <a key={`${url}-${index}`} href={normalizeImageUrl(url)} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-xl bg-surface-container-low">
                <ReliableImage src={url} alt={`Ảnh mô tả ${index + 1}`} className="h-full w-full object-cover transition hover:scale-105" />
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PaymentSummaryCard({ order, paymentStatus }: { order: Order; paymentStatus: string }) {
  const discount = (order.pricing?.promotionDiscountAmount || 0) + (order.pricing?.voucherDiscountAmount || 0);
  const discountCode = order.voucherSnapshot?.code || order.promotionSnapshot?.code;
  return (
    <section className="glass-card order-3 h-full rounded-3xl border border-outline-variant/30 p-md sm:p-lg md:col-span-2 lg:order-2 lg:col-span-1">
      <CardTitle icon="account_balance_wallet" title="Thanh toán và thu nhập" />
      <div className="mt-md flex items-center justify-between gap-3 rounded-2xl bg-surface-container-low p-3">
        <span className="text-sm text-on-surface-variant">Trạng thái thanh toán</span>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{paymentStatus}</span>
      </div>
      <div className="mt-md space-y-3 text-sm">
        <FinancialRow label="Giá trị đơn hàng" value={formatMoney(order.pricing?.totalPaidAmount)} strong />
        {(order.cancellation?.refundPolicy?.providerCompensation || 0) > 0 && (
          <FinancialRow
            label="Bồi thường phí hủy"
            value={formatMoney(order.cancellation?.refundPolicy?.providerCompensation)}
            strong
          />
        )}
        {discountCode && <FinancialRow label="Mã giảm giá" value={discountCode} />}
        <FinancialRow label="Số tiền giảm giá" value={`-${formatMoney(discount)}`} tone="discount" />
        <FinancialRow label="Phí nền tảng" value={`-${formatMoney(order.pricing?.platformCommissionAmount)}`} tone="fee" />
        <FinancialRow label="Tỷ lệ phí nền tảng" value={`${Math.round((order.pricing?.platformCommissionRate || 0) * 100)}%`} />
        <FinancialRow label="Phương thức thanh toán" value={getPaymentMethodLabel(order.paymentMethod)} />
      </div>
      <div className="mt-md rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Thu nhập thực nhận</p>
        <p className="mt-1 text-2xl font-bold text-emerald-700">{formatMoney(order.pricing?.providerEarningAmount)}</p>
      </div>
    </section>
  );
}

function OrderProgressCard({ order }: { order: Order }) {
  const rank: Record<Order['status'], number> = { created: 0, accepted: 1, in_progress: 2, completed: 3, cancelled: 0 };
  const currentRank = rank[order.status];
  const steps = [
    { key: 'accepted', label: 'Đã nhận đơn', icon: 'assignment_turned_in', note: 'Provider đã nhận đơn hàng.' },
    { key: 'in_progress', label: 'Đang thực hiện', icon: 'construction', note: 'Provider bắt đầu thực hiện dịch vụ.' },
    { key: 'completed', label: 'Đã hoàn thành', icon: 'task_alt', note: order.completionNote || 'Provider xác nhận hoàn thành dịch vụ.' },
  ] as const;

  return (
    <section className="glass-card order-2 h-full rounded-3xl border border-outline-variant/30 p-md sm:p-lg lg:order-3">
      <CardTitle icon="route" title="Tiến độ thực hiện" />
      <div className="mt-lg flex" aria-label="Tiến độ đơn hàng">
        {steps.map((step, index) => {
          const reached = currentRank >= index + 1;
          const current = currentRank === index + 1;
          return (
            <div key={step.key} className="relative flex flex-1 flex-col items-center text-center">
              {index > 0 && <span className={`absolute right-1/2 top-4 h-0.5 w-full ${reached ? 'bg-primary' : 'bg-outline-variant/50'}`} />}
              <span className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 ${reached ? 'border-primary bg-primary text-white' : 'border-outline-variant bg-surface text-on-surface-variant'}`}>
                <span className="material-symbols-outlined text-lg">{reached && !current ? 'check' : step.icon}</span>
              </span>
              <p className={`mt-2 text-[11px] font-bold sm:text-xs ${reached ? 'text-primary' : 'text-on-surface-variant'}`}>{step.label}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-lg space-y-0">
        {steps.map((step, index) => {
          const reached = currentRank >= index + 1;
          const isCurrent = currentRank === index + 1;
          return (
            <div key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
              {index < steps.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-outline-variant/60" />}
              <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${reached ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-outline'}`}>
                <span className="material-symbols-outlined text-lg">{step.icon}</span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-on-surface">{step.label}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${reached ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>{reached ? 'Đã cập nhật' : 'Chưa thực hiện'}</span>
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">{isCurrent ? formatDateTime(order.updatedAt) : reached ? 'Chưa có dữ liệu thời gian' : '—'}</p>
                <p className="mt-1 text-xs leading-5 text-on-surface-variant">{reached ? step.note : 'Đang chờ giai đoạn trước hoàn tất.'}</p>
                {reached && <p className="mt-1 text-[11px] font-medium text-primary">Cập nhật bởi Provider</p>}
                {step.key === 'completed' && reached && order.completionEvidenceImages?.length ? <p className="mt-1 text-xs text-on-surface-variant">Đã tải lên {order.completionEvidenceImages.length} ảnh hoàn thành.</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CardTitle({ icon, title }: { icon: string; title: string }) {
  return <div className="flex items-center gap-2"><span className="material-symbols-outlined text-primary">{icon}</span><h2 className="font-headline-md text-on-surface">{title}</h2></div>;
}

function FinancialRow({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'discount' | 'fee' }) {
  const valueColor = tone === 'discount' ? 'text-emerald-700' : tone === 'fee' ? 'text-error' : 'text-on-surface';
  return <div className="flex items-start justify-between gap-4 border-b border-outline-variant/20 pb-3 last:border-0 last:pb-0"><span className="text-on-surface-variant">{label}</span><span className={`text-right ${strong ? 'font-bold' : 'font-semibold'} ${valueColor}`}>{value}</span></div>;
}
