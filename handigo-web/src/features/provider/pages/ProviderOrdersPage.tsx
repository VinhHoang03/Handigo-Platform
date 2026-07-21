import { useCallback, useEffect, useState } from 'react';
import { DashboardShell } from '@/components/common/DashboardShell';
import { providerOrderApi } from '../api/providerOrder.api';
import { PendingAssignmentCard } from '../components/PendingAssignmentCard';
import { ProviderOrderCard } from '../components/ProviderOrderCard';
import type { OrderAssignment } from '../types/providerOrder.types';
import type { Order } from '@/types/booking';

const filters = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Đã nhận', value: 'accepted' },
  { label: 'Đang làm', value: 'in_progress' },
  { label: 'Hoàn tất', value: 'completed' },
  { label: 'Đã hủy', value: 'cancelled' },
];

export default function ProviderOrdersPage() {
  const [assignments, setAssignments] = useState<OrderAssignment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const loadAssignments = useCallback(async () => {
    setLoadingAssignments(true);
    try {
      const data = await providerOrderApi.getPendingAssignments();
      setAssignments(data);
    } catch {
      setAssignments([]);
    } finally {
      setLoadingAssignments(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const statusParam = activeFilter === 'all' ? undefined : activeFilter;
      const data = await providerOrderApi.getProviderOrders(1, 20, statusParam, debouncedSearch);
      setOrders(data.items);
      setError(null);
    } catch {
      setError('Không thể tải danh sách đơn dịch vụ.');
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, [activeFilter, debouncedSearch]);

  useEffect(() => {
    void Promise.resolve().then(loadAssignments);
  }, [loadAssignments]);

  useEffect(() => {
    void Promise.resolve().then(loadOrders);
  }, [loadOrders]);

  const handleAccept = async (assignmentId: string) => {
    try {
      setActionBusy(true);
      await providerOrderApi.acceptAssignment(assignmentId);
      await Promise.all([loadAssignments(), loadOrders()]);
    } catch (err: unknown) {
      const message =
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof err.response === 'object' &&
        err.response !== null &&
        'data' in err.response
          ? ((err.response.data as { message?: string }).message ?? 'Không thể nhận đơn.')
          : 'Không thể nhận đơn.';
      setError(message);
    } finally {
      setActionBusy(false);
    }
  };

  const handleReject = async (assignmentId: string) => {
    const reason = window.prompt('Lý do từ chối (tùy chọn):') ?? undefined;
    try {
      setActionBusy(true);
      await providerOrderApi.rejectAssignment(assignmentId, reason);
      await loadAssignments();
    } catch {
      setError('Không thể từ chối đơn.');
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <DashboardShell role="PROVIDER">
      <div className="space-y-gutter">
        <header className="space-y-2">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Đơn dịch vụ</h1>
          <p className="text-on-surface-variant">
            Nhận đơn mới, theo dõi tiến độ và xử lý các yêu cầu được phân công.
          </p>
        </header>

        {error && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-error/10 px-md py-sm text-sm text-error">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void Promise.all([loadAssignments(), loadOrders()])}
              className="rounded-lg bg-error px-3 py-2 font-semibold text-on-error"
            >
              Thử lại
            </button>
          </div>
        )}

        <section className="hidden">
          <div className="flex items-center justify-between gap-md">
            <h2 className="font-headline-md text-on-surface">Đơn chờ phản hồi</h2>
            <button
              type="button"
              onClick={loadAssignments}
              className="text-sm font-medium text-primary hover:underline"
            >
              Làm mới
            </button>
          </div>

          {loadingAssignments ? (
            <div className="rounded-2xl bg-surface-container-low p-md text-on-surface-variant">
              Đang tải đơn chờ phản hồi...
            </div>
          ) : assignments.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-outline-variant bg-surface-container-low p-lg text-center text-on-surface-variant">
              Hiện chưa có đơn mới cần phản hồi.
            </div>
          ) : (
            <div className="grid gap-md">
              {assignments.map((assignment) => (
                <PendingAssignmentCard
                  key={assignment._id}
                  assignment={assignment}
                  onAccept={handleAccept}
                  onReject={handleReject}
                  busy={actionBusy}
                />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-md">
          <div className="flex flex-col gap-md md:flex-row md:items-center md:justify-between">
            <h2 className="font-headline-md text-on-surface">Đơn đã nhận</h2>
            <div className="relative w-full md:max-w-md">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                search
              </span>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tìm mã đơn, dịch vụ..."
                className="w-full rounded-full border border-outline-variant/40 bg-white py-3 pl-12 pr-4 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
            </div>
          </div>

          <div className="flex gap-sm overflow-x-auto pb-1">
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveFilter(filter.value)}
                className={`whitespace-nowrap rounded-full px-md py-2 text-sm font-medium transition-all ${
                  activeFilter === filter.value
                    ? 'bg-primary text-on-primary shadow-md'
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-primary/10'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {loadingOrders ? (
            <div className="rounded-2xl bg-surface-container-low p-md text-on-surface-variant">
              Đang tải danh sách đơn...
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-outline-variant bg-surface-container-low p-lg text-center text-on-surface-variant">
              {debouncedSearch
                ? `Không tìm thấy kết quả cho "${debouncedSearch}".`
                : 'Chưa có đơn dịch vụ nào trong danh sách này.'}
            </div>
          ) : (
            <div className="space-y-sm">
              {orders.map((order) => (
                <ProviderOrderCard key={order._id} order={order} />
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
