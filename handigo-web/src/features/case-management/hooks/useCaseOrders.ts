import { useCallback, useEffect, useRef, useState } from 'react';
import { bookingApi } from '@/features/booking/api/booking.api';
import { providerOrderApi } from '@/features/provider/api/providerOrder.api';
import type { Order } from '@/types/booking';
import { getErrorMessage } from '@/utils/apiError';

export function useCaseOrders(role: 'CUSTOMER' | 'PROVIDER', initialOrderId?: string, enabled = true) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const revision = useRef(0);
  const pending = useRef(false);
  const invalidate = useCallback(() => { revision.current++; }, []);

  const load = useCallback(async (nextPage = 1) => {
    if (!enabled || pending.current) return;
    pending.current = true;
    const request = ++revision.current;
    setLoading(true);
    setError('');
    try {
      const result = role === 'CUSTOMER'
        ? await bookingApi.getMyOrders(nextPage, 50)
        : await providerOrderApi.getProviderOrders(nextPage, 50);
      let items = result.items;
      if (nextPage === 1 && initialOrderId && !items.some((order) => order._id === initialOrderId)) {
        items = [await bookingApi.getOrderById(initialOrderId), ...items];
      }
      if (request !== revision.current) return;
      setOrders((current) => [...new Map([...(nextPage === 1 ? [] : current), ...items]
        .map((order) => [order._id, order])).values()]);
      setPage(nextPage);
      setHasMore(nextPage < result.pagination.totalPages);
    } catch (err) {
      if (request === revision.current) setError(getErrorMessage(err, 'Không thể tải danh sách đơn.'));
    } finally {
      if (request === revision.current) { pending.current = false; setLoading(false); }
    }
  }, [role, initialOrderId, enabled]);

  useEffect(() => {
    if (!enabled) return;
    pending.current = false;
    const timer = window.setTimeout(() => { setOrders([]); setPage(0); void load(); }, 0);
    return () => { window.clearTimeout(timer); invalidate(); };
  }, [load, invalidate, enabled]);

  return { orders, loading: enabled && loading, error, hasMore, loadMore: () => load(page + 1) };
}
