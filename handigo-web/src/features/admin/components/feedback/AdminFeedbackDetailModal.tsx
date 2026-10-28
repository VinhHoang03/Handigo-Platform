import { useEffect, useState } from 'react';
import { CheckCircle2, History, Star, UserRound } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { AsyncState } from '@/components/common/AsyncState';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { ReliableImage } from '@/components/common/ReliableImage';
import { StatusBadge } from '@/components/common/StatusBadge';
import { feedbackApi, type AdminFeedbackDetail } from '@/features/feedback/api/feedback.api';
import { FeedbackCard } from '@/features/feedback/components/FeedbackCard';
import { CustomerInformationCard } from '@/features/provider/components/orders/CustomerInformationCard';
import { PaymentSummaryCard } from '@/features/provider/components/orders/PaymentSummaryCard';
import { CardTitle } from '@/features/provider/components/orders/CardTitle';
import { formatDateTime, getCustomer } from '@/features/provider/utils/providerOrder.utils';
import { getPaymentStatusLabel, orderTypeLabels } from '@/features/provider/utils/providerOrderDetailLabels';
import { getOrderStatusMeta } from '@/utils/orderStatus';
import { toneOutlineClasses } from '@/utils/statusTone';
import { getErrorMessage } from '@/utils/apiError';
import { normalizeImageUrl } from '@/utils/imageUrl';
import { adminDashboardApi } from '../../api/adminDashboard.api';
import type { Feedback } from '@/features/feedback/types/feedback.types';

const panelClass = 'min-w-0 rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-4 sm:p-5';
const roleLabels: Record<string, string> = { customer: 'Khách hàng', provider: 'Thợ', admin: 'Quản trị viên', system: 'Hệ thống' };

function EvidenceImages({ images, label }: { images?: string[]; label: string }) {
  if (!images?.length) return <p className="text-sm text-on-surface-variant">Chưa có hình ảnh.</p>;
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {images.map((url, index) => <a key={`${url}-${index}`} href={normalizeImageUrl(url)} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-outline-variant/30 focus-visible:outline-2 focus-visible:outline-primary">
      <ReliableImage src={url} alt={`${label} ${index + 1}`} className="aspect-square w-full object-cover" />
      <span className="block p-2 text-center text-xs text-primary">Xem ảnh {index + 1}</span>
    </a>)}
  </div>;
}

export function AdminFeedbackDetailModal({ feedbackId, orderId, onClose }: { onClose: () => void } & ({ feedbackId: string; orderId?: never } | { orderId: string; feedbackId?: never })) {
  const [data, setData] = useState<(Omit<AdminFeedbackDetail, 'feedback'> & { feedback: Feedback | null }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const request = orderId
      ? adminDashboardApi.orderDetail(orderId).then((value) => ({ ...value, feedback: null }))
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
  const completed = order?.statusHistory?.filter((item) => item.status === 'completed').at(-1);

  return <Modal open title={orderId ? 'Chi tiết đơn hàng' : 'Chi tiết đơn hàng và đánh giá'} onClose={onClose} size="xl">
    <AsyncState loading={loading} error={error} empty={!data} onRetry={retry}>
      {data && <div className="space-y-4">
        {order && status ? <>
          <header className={`${panelClass} flex flex-wrap items-center justify-between gap-3`}>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-primary">{order.orderCode}</p>
              <h3 className="mt-1 break-words text-xl font-bold">{order.serviceId?.name || 'Chi tiết đơn dịch vụ'}</h3>
              <p className="mt-1 text-sm text-on-surface-variant">Ngày đặt: {formatDateTime(order.createdAt)}</p>
            </div>
            <span className={`rounded-full border px-3 py-2 text-sm font-semibold ${toneOutlineClasses[status.tone]}`}>{status.label}</span>
          </header>
          <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
            <CustomerInformationCard order={order} customer={getCustomer(order)} addressLine={addressLine} orderType={orderTypeLabels[order.orderType]} />
            <PaymentSummaryCard order={order} paymentStatus={getPaymentStatusLabel(order)} quotation={data.quotation} />
            <section className={`${panelClass} order-2 lg:order-3`}>
              <CardTitle icon={UserRound} title="Thông tin thợ" />
              <div className="my-4 flex items-center gap-3">
                <InitialsAvatar name={provider?.fullName || 'Thợ'} src={provider?.avatar} className="h-12 w-12 shrink-0" rounded="rounded-xl" />
                <p className="min-w-0 break-words font-semibold">{provider?.fullName || 'Chưa có thông tin'}</p>
              </div>
              <p className="text-sm text-on-surface-variant">Số điện thoại</p>
              <p className="mt-1 text-sm font-semibold">{provider?.phone || 'Chưa cập nhật'}</p>
            </section>
          </div>
          {!!order.selectedOptionsSnapshot?.length && <section className={panelClass}>
            <h3 className="mb-3 font-semibold">Hạng mục dịch vụ</h3>
            <ul className="space-y-2 text-sm">{order.selectedOptionsSnapshot.map((item, index) => <li key={`${item.optionId}-${index}`} className="flex justify-between gap-3"><span>{item.name}</span><span>Số lượng: {item.quantity ?? 1}</span></li>)}</ul>
          </section>}
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <section className={panelClass}>
              <CardTitle icon={History} title="Lịch sử trạng thái đơn" />
              {order.statusHistory?.length ? <ol className="mt-4 space-y-4 border-l-2 border-primary/20 pl-4">
                {order.statusHistory.map((item) => <li key={item._id}>
                  <p className="text-sm font-semibold">{getOrderStatusMeta(item.status).label}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">{formatDateTime(item.createdAt)} · {roleLabels[item.changedByRole] || 'Chưa có thông tin'}</p>
                  {item.note && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.note}</p>}
                </li>)}
              </ol> : <p className="mt-4 text-sm text-on-surface-variant">Chưa có lịch sử trạng thái.</p>}
            </section>
            <section className={panelClass}>
              <CardTitle icon={CheckCircle2} title="Xác nhận hoàn thành" />
              <p className="mt-4 text-sm">{completed ? `Đã xác nhận lúc ${formatDateTime(completed.createdAt)} bởi ${roleLabels[completed.changedByRole] || 'Chưa có thông tin'}` : 'Chưa ghi nhận thời điểm xác nhận hoàn thành.'}</p>
              <dl className="mt-3 space-y-2 text-sm">
                <div><dt className="font-medium">Thợ xác nhận</dt><dd className="text-on-surface-variant">{order.confirmation?.providerConfirmedAt ? formatDateTime(order.confirmation.providerConfirmedAt) : 'Chưa ghi nhận xác nhận'}</dd></div>
                <div><dt className="font-medium">Khách hàng xác nhận</dt><dd className="text-on-surface-variant">{order.confirmation?.customerConfirmedAt ? formatDateTime(order.confirmation.customerConfirmedAt) : 'Chưa ghi nhận xác nhận'}</dd></div>
              </dl>
              {order.completionNote && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{order.completionNote}</p>}
              <div className="mt-3"><EvidenceImages images={order.completionEvidenceImages} label="Bằng chứng hoàn thành" /></div>
            </section>
          </div>
        </> : <p role="status" className="rounded-xl bg-surface-container-low p-4 text-sm">Đơn hàng không còn tồn tại. Thông tin đánh giá vẫn được hiển thị bên dưới.</p>}
        {data.feedback && <section className={panelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <CardTitle icon={Star} title="Đánh giá và phản hồi" />
            <StatusBadge value={data.feedback.isVisible ? 'visible' : 'hidden'} />
          </div>
          <FeedbackCard feedback={{ ...data.feedback, images: [] }} replyLabel="Phản hồi của thợ" />
          <h4 className="mb-2 mt-4 text-sm font-semibold">Hình ảnh đánh giá</h4>
          <EvidenceImages images={data.feedback.images} label="Ảnh đánh giá" />
          {!!data.feedback.providerReply?.images?.length && <>
            <h4 className="mb-2 mt-4 text-sm font-semibold">Hình ảnh phản hồi của thợ</h4>
            <EvidenceImages images={data.feedback.providerReply.images} label="Ảnh phản hồi" />
          </>}
          {!data.feedback.providerReply && <p className="mt-4 text-sm text-on-surface-variant">Thợ chưa phản hồi đánh giá.</p>}
        </section>}
      </div>}
    </AsyncState>
  </Modal>;
}
