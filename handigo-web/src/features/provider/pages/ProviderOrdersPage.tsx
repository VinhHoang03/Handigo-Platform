import { useToast, useToastFeedback } from "@/components/common/Toast";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { bookingApi } from '@/features/booking/api/booking.api';
import { DashboardShell } from '@/components/common/DashboardShell';
import { Pagination } from '@/components/common/Pagination';
import { providerOrderApi } from '../api/providerOrder.api';
import { ProviderOrderCard } from '../components/ProviderOrderCard';
import { PendingAssignmentsSection } from '../components/orders/PendingAssignmentsSection';
import { ProviderOrdersListSkeleton } from '../components/orders/ProviderOrdersListSkeleton';
import type { OrderAssignment } from '../types/providerOrder.types';
import type { Order, Pagination as PaginationData } from '@/types/booking';
import { Search } from "lucide-react";

const filters = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Đã nhận', value: 'accepted' },
  { label: 'Đang làm', value: 'in_progress' },
  { label: 'Hoàn tất', value: 'completed' },
  { label: 'Đã hủy', value: 'cancelled' },
];
const ORDERS_PER_PAGE = 5;

export default function ProviderOrdersPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestedAssignment = searchParams.get('assignmentId');
  const requestedOrder = searchParams.get('orderId');
  const { addToast } = useToast();
  const [assignments, setAssignments] = useState<OrderAssignment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: ORDERS_PER_PAGE,
    total: 0,
    totalPages: 0,
  });
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<{ assignmentId: string; text: string } | null>(null);
  const [loadedAssignment, setLoadedAssignment] = useState<string | null | undefined>(undefined);
  const assignmentRevision = useRef(0);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useToastFeedback<string | null>(null, "error");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const loadAssignments = useCallback(async () => {
    const revision = ++assignmentRevision.current;
    setLoadingAssignments(true);
    try {
      const data = await providerOrderApi.getPendingAssignments();
      if (revision !== assignmentRevision.current) return;
      setAssignments(data);
      setAssignmentError(null);
    } catch {
      if (revision !== assignmentRevision.current) return;
      setAssignments([]);
      setAssignmentError('Không thể tải đề nghị nhận việc. Vui lòng thử lại.');
    } finally {
      if (revision === assignmentRevision.current) {
        setLoadedAssignment(requestedAssignment);
        setLoadingAssignments(false);
      }
    }
  }, [requestedAssignment]);

  useEffect(() => {
    if (!requestedAssignment || !requestedOrder || loadingAssignments || loadedAssignment !== requestedAssignment || assignmentError) return;
    if (assignments.some(item => item._id === requestedAssignment)) return;
    let active = true;
    void bookingApi.getOrderById(requestedOrder).then(() => {
      if (active) navigate(`/provider/orders/${encodeURIComponent(requestedOrder)}`, { replace: true });
    }).catch((error: unknown) => {
      const unavailable = isAxiosError(error) && [403, 404].includes(error.response?.status ?? 0);
      if (active) setNotificationMessage({ assignmentId: requestedAssignment, text: unavailable
        ? 'Đề nghị nhận việc đã hết hạn hoặc không còn khả dụng.'
        : 'Không thể kiểm tra trạng thái đề nghị. Vui lòng bấm Làm mới để thử lại.' });
    });
    return () => { active = false; };
  }, [requestedAssignment, requestedOrder, loadingAssignments, loadedAssignment, assignmentError, assignments, navigate]);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const statusParam = activeFilter === 'all' ? undefined : activeFilter;
      const data = await providerOrderApi.getProviderOrders(
        page,
        ORDERS_PER_PAGE,
        statusParam,
        debouncedSearch,
      );
      setOrders(data.items);
      setPagination(data.pagination);
      setError(null);
    } catch {
      setError('Không thể tải danh sách đơn dịch vụ.');
      setOrders([]);
      setPagination((current) => ({ ...current, total: 0, totalPages: 0 }));
    } finally {
      setLoadingOrders(false);
    }
  }, [activeFilter, debouncedSearch, page, setError]);

  useEffect(() => {
    let active = true;
    const revisions = assignmentRevision;
    void Promise.resolve().then(() => { if (active) return loadAssignments(); });
    return () => { active = false; revisions.current++; };
  }, [loadAssignments]);

  useEffect(() => {
    void Promise.resolve().then(loadOrders);
  }, [loadOrders]);

  const handleAccept = async (assignmentId: string) => {
    try {
      setActionBusy(true);
      await providerOrderApi.acceptAssignment(assignmentId);
      addToast("Đã nhận đơn dịch vụ.", "success");
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
      addToast("Đã từ chối đơn dịch vụ.", "success");
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

        <PendingAssignmentsSection
          visible={Boolean(requestedAssignment)}
          assignments={requestedAssignment ? assignments.filter(item => item._id === requestedAssignment) : assignments}
          loading={loadingAssignments || loadedAssignment !== requestedAssignment}
          busy={actionBusy}
          onRefresh={loadAssignments}
          onAccept={handleAccept}
          onReject={handleReject}
        />
        {requestedAssignment && (assignmentError || notificationMessage?.assignmentId === requestedAssignment) && (
          <div className="rounded-2xl bg-surface-container-low p-md text-on-surface-variant" role="status">
            {assignmentError || notificationMessage?.text}
          </div>
        )}

        <section className="space-y-md">
          <div className="flex justify-start">
            <div className="relative w-full min-w-0 lg:max-w-3xl">
              <Search aria-hidden="true" size={24} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tìm mã đơn, dịch vụ..."
                aria-label="Tìm kiếm đơn dịch vụ"
                className="min-h-12 w-full min-w-0 rounded-full border border-outline-variant/40 bg-surface-container-lowest py-3 pl-12 pr-4 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
            </div>
          </div>

          <div className="flex gap-sm overflow-x-auto pb-1">
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => {
                  setActiveFilter(filter.value);
                  setPage(1);
                }}
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
            <ProviderOrdersListSkeleton />
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
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                onChange={setPage}
              />
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
