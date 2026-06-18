import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { bookingApi } from '@/api/booking';
import { DashboardShell } from '@/components/common/DashboardShell';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
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
  providerStatusLabels,
  providerStatusStyles,
} from '../utils/providerOrder.utils';
import { FixedPriceActionForm } from '../components/FixedPriceActionForm';

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

  const handleCancel = async () => {
    if (!order) return;
    await runAction(async () => {
      await providerOrderApi.cancelOrder(order._id, 'Provider hủy đơn do không thể thực hiện.');
      setCancelOpen(false);
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
    province?: string;
    note?: string;
  };
  const addressLine =
    address.fullAddress ||
    [address.detailAddress, address.ward, address.province].filter(Boolean).join(', ');
  const showQuotationForm =
    order.inspectionRequired &&
    ['accepted', 'in_progress'].includes(order.status) &&
    !quotation;

  return (
    <DashboardShell role="PROVIDER" showStatusToggle isOnline={isOnline} onStatusToggle={toggleAvailability}>
      <div className="space-y-gutter">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <div>
            <Link to="/provider/orders" className="mb-2 inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Quay lại danh sách
            </Link>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">
              {order.serviceId?.name || 'Chi tiết đơn dịch vụ'}
            </h1>
            <p className="text-on-surface-variant">{order.orderCode}</p>
          </div>
          <span
            className={`rounded-full px-4 py-2 text-sm font-bold ${providerStatusStyles[order.status]}`}
          >
            {providerStatusLabels[order.status]}
          </span>
        </div>

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

        <section className="glass-card space-y-md rounded-3xl p-md">
          <h2 className="font-headline-md text-on-surface">Thông tin khách hàng</h2>
          <div className="flex items-center gap-md">
            <img
              src={
                customer?.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(customer?.fullName || 'KH')}&background=4f46e5&color=fff`
              }
              alt=""
              className="h-14 w-14 rounded-full object-cover"
            />
            <div>
              <p className="font-bold text-on-surface">{customer?.fullName || 'Khách hàng'}</p>
              <p className="text-sm text-on-surface-variant">{customer?.phone || 'Chưa có số điện thoại'}</p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-gutter lg:grid-cols-2">
          <section className="glass-card flex flex-col space-y-md rounded-3xl p-md">
            <h2 className="font-headline-md text-on-surface">Chi tiết dịch vụ</h2>
            <div className="grid flex-1 gap-sm sm:grid-cols-2">
              <InfoItem label="Thời gian hẹn" value={formatDateTime(order.scheduledAt || order.createdAt)} />
              <InfoItem label="Loại đặt lịch" value={order.orderType} />
              <InfoItem label="Địa chỉ" value={addressLine} className="sm:col-span-2" />

              {order.problemDescription && (
                <div className="rounded-2xl bg-surface-container-low p-sm sm:col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                    Mô tả vấn đề
                  </p>
                  <p className="mt-1 text-sm text-on-surface">{order.problemDescription}</p>
                </div>
              )}

              {address.note && (
                <div className="rounded-2xl bg-surface-container-low p-sm sm:col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                    Ghi chú địa chỉ
                  </p>
                  <p className="mt-1 text-sm text-on-surface">{address.note}</p>
                </div>
              )}
            </div>

            {order.customerAttachments && order.customerAttachments.length > 0 && (
              <div className="pt-sm">
                <p className="mb-sm text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                  Ảnh mô tả
                </p>
                <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
                  {order.customerAttachments.map((url, index) => (
                    <a
                      key={`${url}-${index}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="group block aspect-square overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-low"
                    >
                      <img
                        src={url}
                        alt={`Ảnh mô tả ${index + 1}`}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>

          <div className="space-y-gutter">
            {order.inspectionRequired ? (
              <>
                {quotation && (
                  <section className="glass-card h-full space-y-md rounded-3xl p-md">
                    <div className="flex items-center justify-between gap-md">
                      <h2 className="font-headline-md text-on-surface">Báo giá sửa chữa</h2>
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                        {quotation.quotation.status}
                      </span>
                    </div>
                    {quotation.quotation.inspectionNote && (
                      <p className="text-sm text-on-surface-variant">{quotation.quotation.inspectionNote}</p>
                    )}
                    <div className="max-h-[300px] overflow-y-auto space-y-sm pr-1">
                      {quotation.items.map((item) => (
                        <div
                          key={item._id}
                          className="flex items-center justify-between rounded-2xl bg-surface-container-low px-sm py-3"
                        >
                          <div>
                            <p className="font-medium text-on-surface">{item.title}</p>
                            <p className="text-xs text-on-surface-variant">
                              {item.quantity} x {formatMoney(item.unitPrice)}
                            </p>
                          </div>
                          <p className="font-semibold text-primary">{formatMoney(item.totalPrice)}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between border-t border-outline-variant/20 pt-md">
                      <span className="font-medium text-on-surface">Tổng báo giá</span>
                      <span className="text-headline-md font-bold text-primary">
                        {formatMoney(quotation.quotation.finalAmount)}
                      </span>
                    </div>

                  </section>
                )}

                {showQuotationForm && (
                  <div className="h-full">
                    <RepairQuotationForm onSubmit={handleCreateQuotation} busy={busy} />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setCancelOpen(true)}
                      className="mt-md w-full py-2 text-sm text-error hover:bg-error/5 rounded-xl border border-error/20"
                    >
                      Hủy đơn (Không thể sửa chữa)
                    </button>
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
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title="Hủy đơn dịch vụ"
        message="Đơn sẽ bị hủy và khách hàng được thông báo. Bạn có chắc chắn muốn tiếp tục?"
        busy={busy}
        onCancel={() => setCancelOpen(false)}
        onConfirm={handleCancel}
      />
    </DashboardShell>
  );
}

function InfoItem({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl bg-surface-container-low p-sm ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="mt-1 text-sm font-medium text-on-surface">{value}</p>
    </div>
  );
}
