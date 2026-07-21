import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { BookingHistoryCard, BookingPageHeader, BookingShell } from '../components/BookingComponents';
import { bookingApi } from '@/features/booking/api/booking.api';
import type { BookingListItem, BookingStatusTone } from '../types/booking.types';
import type { Order } from '../../../types/booking';

const filters = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Đang xử lý', value: 'created' },
  { label: 'Đang thực hiện', value: 'in_progress' },
  { label: 'Đã hoàn thành', value: 'completed' },
  { label: 'Đã hủy', value: 'cancelled' },
];

const BookingHistoryPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Handle debouncing search term to avoid too many API calls
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchOrders = useCallback(async (filter: string, search: string, targetPage: number, append = false) => {
    // Avoid synchronous setState warning in build
    setTimeout(() => setLoading(true), 0);
    try {
      // Map 'all' to undefined for the API
      const statusParam = filter === 'all' ? undefined : filter;
      const data = await bookingApi.getMyOrders(targetPage, 10, statusParam, search);
      setOrders((current) => append ? [...current, ...data.items] : data.items);
      setTotal(data.pagination.total);
      setPage(targetPage);
      setError('');
    } catch {
      setError('Không thể tải lịch sử đặt dịch vụ. Vui lòng thử lại.');
    } finally {
      setTimeout(() => setLoading(false), 0);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrders(activeFilter, debouncedSearch, 1);
    }, 0);
    return () => clearTimeout(timer);
  }, [activeFilter, debouncedSearch, fetchOrders]);

  const mapStatusToTone = (status: string): BookingStatusTone => {
    switch (status) {
      case 'completed': return 'completed';
      case 'cancelled': return 'cancelled';
      case 'created':
      case 'accepted':
      case 'in_progress':
        return 'active';
      default: return 'pending';
    }
  };

  const mapStatusToLabel = (status: string): string => {
    switch (status) {
      case 'completed': return 'Đã hoàn thành';
      case 'cancelled': return 'Đã hủy';
      case 'created': return 'Đang xử lý';
      case 'accepted': return 'Đã chấp nhận';
      case 'in_progress': return 'Đang thực hiện';
      default: return status;
    }
  };

  const formattedBookings: BookingListItem[] = (orders || []).map(order => ({
    id: order?._id || 'unknown',
    serviceName: order?.serviceId?.name || 'Dịch vụ',
    statusLabel: mapStatusToLabel(order?.status || 'created'),
    statusTone: mapStatusToTone(order?.status || 'created'),
    status: order?.status || 'created',
    schedule: order?.scheduledAt ? new Date(order.scheduledAt).toLocaleString('vi-VN') : 'Sớm nhất',
    meta: order?.providerId ? `Chuyên gia: ${order.providerId.name || 'Đã phân công'}` : 'Đang tìm chuyên gia',
    price: `${order?.pricing?.totalPaidAmount?.toLocaleString() || '0'}đ`,
    imageUrl: order?.serviceId?.image,
    primaryAction: order?.status === 'completed' ? 'Đánh giá' : 'Xem chi tiết',
  }));

  return (
    <BookingShell>
      <BookingPageHeader
        title="Lịch sử đặt lịch"
        description="Quản lý và theo dõi các dịch vụ bạn đã đặt trên HandiGo."
        action={
          <div className="flex flex-col md:flex-row gap-md items-center justify-between w-full">
            <div className="relative w-full md:w-[400px]">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">search</span>
              <input
                className="w-full pl-12 pr-10 py-3 bg-primary/5 rounded-full border border-primary/10 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 outline-none text-body-md transition-all placeholder:text-on-surface-variant/60"
                placeholder="Tìm kiếm đơn đặt chỗ..."
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full hover:bg-on-surface/10 p-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm block">close</span>
                </button>
              )}
            </div>
            <Link
              to="/customer/bookings/new"
              className="w-full md:w-auto flex items-center justify-center gap-2 bg-primary text-on-primary px-lg py-3 rounded-xl font-label-md text-label-md shadow-md hover:bg-primary-container transition-all active:scale-95"
            >
              <span className="material-symbols-outlined">add</span>
              Tạo đơn dịch vụ mới
            </Link>
          </div>
        }
      />

      <div className="flex gap-sm overflow-x-auto pb-2 scrollbar-hide">
        {filters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setActiveFilter(filter.value)}
            className={`px-md py-2 rounded-full font-label-md text-label-md whitespace-nowrap transition-all ${activeFilter === filter.value
              ? 'bg-primary text-on-primary shadow-md'
              : 'bg-surface-container-high text-on-surface-variant hover:bg-primary/10'
              }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-md">
        {error && !loading ? (
          <div className="rounded-2xl border border-error/20 bg-error/10 p-md text-center text-error">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void fetchOrders(activeFilter, debouncedSearch, 1)}
              className="mt-3 rounded-xl bg-error px-4 py-2 font-semibold text-on-error"
            >
              Thử lại
            </button>
          </div>
        ) : loading ? (
          <div className="text-center py-xl flex flex-col items-center gap-2">
            <span className="animate-spin material-symbols-outlined text-primary text-4xl">progress_activity</span>
            <p className="text-on-surface-variant animate-pulse">Đang tải danh sách...</p>
          </div>
        ) : (
          <>
            {formattedBookings.map((booking, index) => (
              <BookingHistoryCard key={booking.id !== 'unknown' ? booking.id : `booking-${index}`} booking={booking} />
            ))}
            {formattedBookings.length === 0 && (
              <div className="py-xl text-center">
                <span className="material-symbols-outlined text-6xl text-on-surface-variant/30 mb-2">assignment_late</span>
                <p className="text-on-surface-variant font-medium">
                  {debouncedSearch ? `Không tìm thấy kết quả cho "${debouncedSearch}"` : 'Bạn chưa có đơn đặt lịch nào.'}
                </p>
                {activeFilter !== 'all' && (
                  <button
                    onClick={() => setActiveFilter('all')}
                    className="mt-4 text-primary font-label-md hover:underline"
                  >
                    Xem tất cả đơn hàng
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {!loading && total > 5 && formattedBookings.length < total && (
        <div className="pt-lg flex justify-center">
          <button type="button" onClick={() => void fetchOrders(activeFilter, debouncedSearch, page + 1, true)} className="px-lg py-3 border-2 border-primary/20 text-primary rounded-full font-label-md text-label-md hover:bg-primary/5 transition-all flex items-center gap-2 group">
            Xem thêm lịch sử
            <span className="material-symbols-outlined group-hover:translate-y-1 transition-transform">expand_more</span>
          </button>
        </div>
      )}
    </BookingShell>
  );
};

export default BookingHistoryPage;
