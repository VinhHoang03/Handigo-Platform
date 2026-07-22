import type { Order } from '@/types/booking';
import { formatDateTime } from '../../utils/providerOrder.utils';
import { CardTitle } from './CardTitle';

const rank: Record<Order['status'], number> = { created: 0, accepted: 1, in_progress: 2, completed: 3, cancelled: 0 };

export function OrderProgressCard({ order }: { order: Order }) {
  const currentRank = rank[order.status];
  const steps = [
    { key: 'accepted', label: 'Đã nhận đơn', icon: 'assignment_turned_in', note: 'Provider đã nhận đơn hàng.' },
    { key: 'in_progress', label: 'Đang thực hiện', icon: 'construction', note: 'Provider bắt đầu thực hiện dịch vụ.' },
    { key: 'completed', label: 'Đã hoàn thành', icon: 'task_alt', note: order.completionNote || 'Provider xác nhận hoàn thành dịch vụ.' },
  ] as const;

  return (
    <section className="order-2 h-full rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-md sm:p-lg lg:order-3">
      <CardTitle icon="route" title="Tiến độ thực hiện" />
      <div className="mt-lg flex" aria-label="Tiến độ đơn hàng">
        {steps.map((step, index) => {
          const reached = currentRank >= index + 1;
          const current = currentRank === index + 1;
          return (
            <div key={step.key} className="relative flex flex-1 flex-col items-center text-center">
              {index > 0 && <span className={`absolute right-1/2 top-4 h-0.5 w-full ${reached ? 'bg-primary' : 'bg-outline-variant/50'}`} />}
              <span className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 ${reached ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant bg-surface text-on-surface-variant'}`}>
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
