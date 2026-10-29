import { useEffect, useState } from 'react';
import { CalendarDays, Clock3, Phone, Star, UserRound } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { AsyncState } from '@/components/common/AsyncState';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { ReliableImage } from '@/components/common/ReliableImage';
import { feedbackApi, type AdminFeedbackDetail } from '@/features/feedback/api/feedback.api';
import { CustomerInformationCard } from '@/features/provider/components/orders/CustomerInformationCard';
import { PaymentSummaryCard } from '@/features/provider/components/orders/PaymentSummaryCard';
import { CardTitle } from '@/features/provider/components/orders/CardTitle';
import { BookingStatusTimeline } from '@/features/booking/components/detail/BookingStatusTimeline';
import { buildOrderTimeline } from '@/features/booking/components/detail/bookingDetailTimeline';
import { formatDateTime, getCustomer } from '@/features/provider/utils/providerOrder.utils';
import { getPaymentStatusLabel, orderTypeLabels } from '@/features/provider/utils/providerOrderDetailLabels';
import { getOrderStatusMeta } from '@/utils/orderStatus';
import { toneOutlineClasses } from '@/utils/statusTone';
import { getErrorMessage } from '@/utils/apiError';
import { normalizeImageUrl } from '@/utils/imageUrl';
import { adminDashboardApi } from '../../api/adminDashboard.api';
import type { Feedback } from '@/features/feedback/types/feedback.types';

const panelClass = 'min-w-0 rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-4 sm:p-5';

function EvidenceImages({ images, label }: { images?: string[]; label: string }) {
  if (!images?.length) return null;
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {images.map((url, index) => <a key={`${url}-${index}`} href={normalizeImageUrl(url)} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-outline-variant/30 focus-visible:outline-2 focus-visible:outline-primary">
      <ReliableImage src={url} alt={`${label} ${index + 1}`} className="aspect-square w-full object-cover" />
      <span className="block p-2 text-center text-xs text-primary">Xem ảnh {index + 1}</span>
    </a>)}
  </div>;
}

function FeedbackDetailsPanel({ feedback, className = '' }: { feedback: Feedback | null; className?: string }) {
  return <section className={`min-w-0 rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-md sm:p-lg ${className}`}>
    <div className="flex min-h-6 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Star size={20} aria-hidden="true" className="shrink-0 text-primary" />
        <h3 className="font-label-sm text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">Đánh giá và phản hồi</h3>
      </div>
      {feedback && <div className="flex shrink-0 items-center gap-3 text-right">
        <span className="inline-flex items-center gap-1 text-xs font-semibold" aria-label={`${feedback.rating} trên 5 sao`}>
          <Star size={14} fill="currentColor" aria-hidden="true" className="text-amber-500" />
          {feedback.rating.toLocaleString('vi-VN')}/5
        </span>
        <time dateTime={feedback.createdAt} className="whitespace-nowrap text-[11px] leading-4 text-on-surface-variant">{formatDateTime(feedback.createdAt)}</time>
      </div>}
    </div>
    {feedback ? <div className="mt-4 space-y-4">
      {feedback.comment && <p className="whitespace-pre-wrap break-words text-sm leading-6">{feedback.comment}</p>}
      <EvidenceImages images={feedback.images} label="Ảnh đánh giá" />
      {feedback.providerReply && <div className="space-y-3 border-t border-outline-variant/30 pt-4">
        <div>
          <h4 className="text-sm font-semibold">Phản hồi của thợ</h4>
          {feedback.providerReply.repliedAt && <p className="mt-1 text-xs text-on-surface-variant"><time dateTime={feedback.providerReply.repliedAt}>{formatDateTime(feedback.providerReply.repliedAt)}</time></p>}
        </div>
        {feedback.providerReply.content && <p className="whitespace-pre-wrap break-words text-sm leading-6">{feedback.providerReply.content}</p>}
        <EvidenceImages images={feedback.providerReply.images} label="Ảnh phản hồi của thợ" />
      </div>}
    </div> : <p className="mt-4 text-sm text-on-surface-variant">Đơn hàng chưa có đánh giá.</p>}
  </section>;
}

export function AdminFeedbackDetailModal({ feedbackId, orderId, onClose }: { onClose: () => void } & ({ feedbackId: string; orderId?: never } | { orderId: string; feedbackId?: never })) {
  const [data, setData] = useState<(Omit<AdminFeedbackDetail, 'feedback'> & { feedback: Feedback | null }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const request = orderId
      ? adminDashboardApi.orderDetail(orderId).then((value) => ({ ...value, feedback: value.feedback ?? null }))
      : feedbackApi.adminDetail(feedbackId ?? '');
    request
      .then((value) => { if (active) setData(value); })
      .catch((requestError: unknown) => { if (active) setError(getErrorMessage(requestError, 'Không thể tải chi tiết đơn hàng.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [feedbackId, orderId, attempt]);
  const retry = () => { setLoading(true); setError(''); setAttempt((value) => value + 1); };
  const order = data?.order;
  const provider = order?.providerId?.userId;
  const address = order?.addressId;
  const addressLine = address?.fullAddress || [address?.detailAddress, address?.ward, address?.district, address?.province].filter(Boolean).join(', ');
  const status = order ? getOrderStatusMeta(order.status) : null;

  return <Modal open title={orderId ? 'Chi tiết đơn hàng' : 'Chi tiết đơn hàng và đánh giá'} onClose={onClose} size="xl">
    <AsyncState loading={loading} error={error} empty={!data} onRetry={retry}>
      {data && <div className="space-y-4">
        {order && status ? <>
          <header className={`${panelClass} flex flex-wrap items-center justify-between gap-3`}>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-primary">{order.orderCode}</p>
              <h3 className="mt-1 break-words text-xl font-bold">{order.serviceId?.name || 'Chi tiết đơn dịch vụ'}</h3>
              <div className="mt-2 space-y-2 text-sm text-on-surface-variant">
                <p className="flex items-center gap-2"><Clock3 size={18} aria-hidden="true" className="shrink-0 text-primary" /><span>Ngày đặt: {formatDateTime(order.createdAt)}</span></p>
                <p className="flex items-center gap-2"><CalendarDays size={18} aria-hidden="true" className="shrink-0 text-primary" /><span>Thời gian đặt lịch: {formatDateTime(order.scheduledAt || order.createdAt)}</span></p>
              </div>
            </div>
            <span className={`rounded-full border px-3 py-2 text-sm font-semibold ${toneOutlineClasses[status.tone]}`}>{status.label}</span>
            {(order.problemDescription || !!order.customerAttachments?.length) && <div className="w-full min-w-0 space-y-3 border-t border-outline-variant/30 pt-3">
              {order.problemDescription && <div>
                <h4 className="text-sm font-semibold">Mô tả yêu cầu</h4>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{order.problemDescription}</p>
              </div>}
              <EvidenceImages images={order.customerAttachments} label="Ảnh mô tả yêu cầu" />
            </div>}
          </header>
          <div className="grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
            <CustomerInformationCard order={order} customer={getCustomer(order)} addressLine={addressLine} orderType={orderTypeLabels[order.orderType]} showOrderDetails={false} />
            <PaymentSummaryCard order={order} paymentStatus={getPaymentStatusLabel(order)} quotation={data.quotation} />
            <section className="order-2 h-full min-w-0 rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-md sm:p-lg lg:order-3">
              <CardTitle icon={UserRound} title="Thông tin thợ" />
              <div className="my-4 flex items-center gap-3">
                <InitialsAvatar name={provider?.fullName || 'Thợ'} src={provider?.avatar} className="h-12 w-12 shrink-0" rounded="rounded-xl" />
                <p className="min-w-0 break-words font-semibold">{provider?.fullName || 'Chưa có thông tin'}</p>
              </div>
              <div className="flex items-start gap-3">
                <Phone size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-xs text-on-surface-variant">Số điện thoại</p>
                  <p className="mt-0.5 break-words text-sm font-semibold">{provider?.phone || 'Chưa cập nhật'}</p>
                </div>
              </div>
            </section>
          </div>
          {!!order.selectedOptionsSnapshot?.length && <section className={panelClass}>
            <h3 className="mb-3 font-semibold">Hạng mục dịch vụ</h3>
            <ul className="space-y-2 text-sm">{order.selectedOptionsSnapshot.map((item, index) => <li key={`${item.optionId}-${index}`} className="flex justify-between gap-3"><span>{item.name}</span><span>Số lượng: {item.quantity ?? 1}</span></li>)}</ul>
          </section>}
          <div className="grid items-stretch gap-4 lg:grid-cols-2">
            <BookingStatusTimeline status={order.status} statusLabel={status.label} timeline={buildOrderTimeline(order)} />
            <div className="relative min-w-0">
              <FeedbackDetailsPanel feedback={data.feedback} className="max-h-[36rem] overflow-y-auto overscroll-contain lg:absolute lg:inset-0 lg:max-h-none" />
            </div>
          </div>
        </> : <>
          <p role="status" className="rounded-xl bg-surface-container-low p-4 text-sm">Đơn hàng không còn tồn tại. Thông tin đánh giá vẫn được hiển thị bên dưới.</p>
          <FeedbackDetailsPanel feedback={data.feedback} />
        </>}
      </div>}
    </AsyncState>
  </Modal>;
}
