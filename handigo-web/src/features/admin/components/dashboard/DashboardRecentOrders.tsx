import { useEffect, useState } from 'react';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { AsyncState } from '@/components/common/AsyncState';
import { Modal } from '@/components/common/Modal';
import { Pagination } from '@/components/common/Pagination';
import { chartMoney, chartNumber } from '@/components/common/chart';
import { getOrderStatusMeta } from '@/utils/orderStatus';
import { toneChipClasses } from '@/utils/statusTone';
import { getErrorMessage } from '@/utils/apiError';
import { adminDashboardApi } from '../../api/adminDashboard.api';
import type { AdminRecentOrders } from '../../types/adminDashboard.types';
import { AdminFeedbackDetailModal } from '../feedback/AdminFeedbackDetailModal';

const dateFormat = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function RecentOrderRows({ items, onOpen }: { items: AdminRecentOrders['items']; onOpen: (id: string) => void }) {
  return <ul className="divide-y divide-outline-variant/25">
    {items.map(item => {
      const status = getOrderStatusMeta(item.status);
      return <li key={item._id}>
        <button type="button" onClick={() => onOpen(item._id)} className="flex min-h-20 w-full items-center gap-3 rounded-lg py-3 text-left hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-[10px] font-bold text-primary" title={item.orderCode}>#{item.orderCode.slice(-4)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold" title={item.serviceId?.name}>{item.serviceId?.name || 'Dịch vụ không còn tồn tại'}</span>
            <span className="mt-1 block truncate text-xs text-on-surface-variant">{item.orderCode} · {item.customerId?.fullName || 'Tài khoản không còn tồn tại'}</span>
            <time className="mt-1 block text-xs text-on-surface-variant" dateTime={item.createdAt}>{dateFormat.format(new Date(item.createdAt))}</time>
          </span>
          <span className="flex w-28 shrink-0 flex-col items-end gap-2 text-right">
            <span className="text-sm font-bold tabular-nums">{chartMoney.format(item.pricing.totalPaidAmount)}</span>
            <span className={`rounded px-2 py-1 text-[10px] font-medium ${toneChipClasses[status.tone]}`}>{status.label}</span>
          </span>
        </button>
      </li>;
    })}
  </ul>;
}

export function DashboardRecentOrders() {
  const [data, setData] = useState<AdminRecentOrders | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const [orderId, setOrderId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let inFlight = false;
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        setLoading(true);
        setError('');
        const value = await adminDashboardApi.recentOrders({ page, limit: expanded ? 20 : 5 });
        if (active) setData(value);
      } catch (cause) {
        if (active) setError(getErrorMessage(cause, 'Không thể tải đơn hàng mới. Vui lòng làm mới.'));
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [page, expanded, attempt]);
  const reload = () => setAttempt(value => value + 1);
  const close = () => { setExpanded(false); setPage(1); };
  return <>
    <article className="min-w-0 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 sm:p-5">
      <header className="mb-2 flex items-start justify-between gap-2">
        <h2 className="text-base font-bold">Đơn hàng mới tạo gần đây</h2>
        <button type="button" disabled={loading} onClick={reload} aria-label="Làm mới đơn hàng mới tạo" className="grid size-10 shrink-0 place-items-center rounded-xl text-on-surface-variant hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40"><RefreshCw size={16} aria-hidden="true" className={loading ? 'animate-spin motion-reduce:animate-none' : ''} /></button>
      </header>
      <p className="mb-2 text-xs text-on-surface-variant">Mới nhất toàn hệ thống · cập nhật mỗi phút</p>
      <AsyncState loading={loading && !data} error={error} empty={!data?.items.length} emptyMessage="Chưa có đơn hàng trong hệ thống." onRetry={reload}>
        <RecentOrderRows items={data?.items.slice(0, 5) ?? []} onOpen={setOrderId} />
      </AsyncState>
      {!!data?.pagination.total && <button type="button" onClick={() => { setPage(1); setExpanded(true); }} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary">Xem tất cả ({chartNumber.format(data.pagination.total)})<ChevronRight size={16} aria-hidden="true" /></button>}
    </article>
    <Modal open={expanded} title="Đơn hàng trong hệ thống" onClose={close} size="lg">
      <AsyncState loading={loading} error={error} empty={!data?.items.length} emptyMessage="Chưa có đơn hàng." onRetry={reload}>
        <RecentOrderRows items={data?.items ?? []} onOpen={setOrderId} />
      </AsyncState>
      <div className="mt-4 flex justify-center"><Pagination page={page} totalPages={data?.pagination.totalPages || 1} onChange={setPage} /></div>
    </Modal>
    {orderId && <AdminFeedbackDetailModal orderId={orderId} onClose={() => setOrderId(null)} />}
  </>;
}
