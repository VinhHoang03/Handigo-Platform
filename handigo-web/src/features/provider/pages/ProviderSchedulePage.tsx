import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardShell } from '@/components/common/DashboardShell';
import type { Order } from '@/types/booking';
import { providerOrderApi } from '../api/providerOrder.api';
import { useProviderAvailability } from '../hooks/useProviderAvailability';
import { formatMoney, getCustomer, providerStatusLabels, providerStatusStyles } from '../utils/providerOrder.utils';

const dateKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
const orderDate = (order: Order) => new Date(order.scheduledAt || order.createdAt);

const formatAddress = (order: Order) => {
  const address = order.addressId;
  return [address?.detailAddress, address?.ward, address?.district, address?.province]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
};

export default function ProviderSchedulePage() {
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  const { isOnline, toggleAvailability } = useProviderAvailability();
  const [visibleMonth, setVisibleMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      try {
        const result = await providerOrderApi.getProviderOrders(1, 100);
        if (!cancelled) setOrders(result.items);
      } catch {
        if (!cancelled) setError('Không thể tải lịch làm việc.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const ordersByDate = useMemo(() => orders.reduce<Record<string, Order[]>>((result, order) => {
    const key = dateKey(orderDate(order));
    result[key] = [...(result[key] || []), order];
    return result;
  }, {}), [orders]);

  const selectedOrders = ordersByDate[dateKey(selectedDate)] || [];
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const previousMonthDays = new Date(year, month, 0).getDate();

  const cells = Array.from({ length: 42 }, (_, index) => {
    const offset = index - firstWeekday + 1;
    if (offset < 1) return { date: new Date(year, month - 1, previousMonthDays + offset), outside: true };
    if (offset > daysInMonth) return { date: new Date(year, month + 1, offset - daysInMonth), outside: true };
    return { date: new Date(year, month, offset), outside: false };
  });

  const changeMonth = (offset: number) => {
    const nextMonth = new Date(year, month + offset, 1);
    setVisibleMonth(nextMonth);
    setSelectedDate(nextMonth);
  };

  return (
    <DashboardShell role="PROVIDER" showStatusToggle isOnline={isOnline} onStatusToggle={toggleAvailability}>
      <div className="space-y-gutter">
        <header>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Lịch làm việc</h1>
          <p className="mt-1 text-on-surface-variant">Theo dõi lịch hẹn và công việc được phân công theo ngày.</p>
        </header>

        {error && <div className="rounded-2xl bg-error/10 px-4 py-3 text-sm text-error">{error}</div>}

        {loading ? (
          <div className="grid gap-gutter xl:grid-cols-12" aria-busy="true">
            <div className="h-[620px] animate-pulse rounded-3xl bg-surface-container xl:col-span-9" />
            <div className="h-[420px] animate-pulse rounded-3xl bg-surface-container xl:col-span-3" />
          </div>
        ) : (
          <div className="grid items-start gap-gutter xl:grid-cols-12">
            <section className="min-w-0 rounded-3xl border border-outline-variant/30 bg-white p-4 shadow-sm sm:p-md xl:col-span-9">
              <div className="mb-md flex items-center justify-between gap-3">
                <h2 className="font-headline-md text-headline-md capitalize text-on-surface">
                  {visibleMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
                </h2>
                <div className="flex gap-2">
                  <button type="button" onClick={() => changeMonth(-1)} aria-label="Tháng trước" className="grid h-10 w-10 place-items-center rounded-xl border border-outline-variant/40 hover:bg-surface-container-low"><span className="material-symbols-outlined">chevron_left</span></button>
                  <button type="button" onClick={() => changeMonth(1)} aria-label="Tháng sau" className="grid h-10 w-10 place-items-center rounded-xl border border-outline-variant/40 hover:bg-surface-container-low"><span className="material-symbols-outlined">chevron_right</span></button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-outline-variant/30">
                <div className="min-w-[700px]">
                  <div className="grid grid-cols-7 bg-surface-container-low">
                    {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'].map((day) => <div key={day} className="py-3 text-center text-xs font-bold text-on-surface-variant">{day}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-px bg-outline-variant/30">
                    {cells.map(({ date, outside }) => {
                      const dayOrders = ordersByDate[dateKey(date)] || [];
                      const selected = dateKey(date) === dateKey(selectedDate);
                      const current = dateKey(date) === dateKey(today);
                      return (
                        <button
                          key={date.toISOString()}
                          type="button"
                          onClick={() => { setSelectedDate(date); setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1)); }}
                          className={`min-h-28 bg-white p-2 text-left align-top transition hover:bg-primary/5 ${outside ? 'text-outline/50' : ''} ${selected ? 'ring-2 ring-inset ring-primary' : ''}`}
                        >
                          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${current ? 'bg-primary text-white' : ''}`}>{date.getDate()}</span>
                          <span className="mt-1 block space-y-1">
                            {dayOrders.slice(0, 2).map((order) => (
                              <span key={order._id} className={`block truncate rounded-md px-1.5 py-1 text-[10px] font-bold ${providerStatusStyles[order.status]}`}>{orderDate(order).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · {order.serviceId?.name || 'Dịch vụ'}</span>
                            ))}
                            {dayOrders.length > 2 && <span className="block px-1 text-[10px] font-bold text-primary">+{dayOrders.length - 2} công việc</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <aside className="rounded-3xl border border-outline-variant/30 bg-white p-4 shadow-sm sm:p-md xl:sticky xl:top-24 xl:col-span-3">
              <div className="mb-md flex items-end justify-between gap-3 border-b border-outline-variant/30 pb-md">
                <div>
                  <h2 className="font-headline-md text-headline-md">{dateKey(selectedDate) === dateKey(today) ? 'Hôm nay' : `Ngày ${selectedDate.getDate()}`}</h2>
                  <p className="mt-1 text-xs capitalize text-on-surface-variant">{selectedDate.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
                </div>
                <span className="rounded-xl bg-primary/10 px-3 py-2 text-sm font-bold text-primary">{selectedOrders.length}</span>
              </div>

              {selectedOrders.length ? (
                <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
                  {selectedOrders.map((order) => {
                    const customer = getCustomer(order);
                    return (
                      <article key={order._id} className="rounded-2xl border border-outline-variant/30 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${providerStatusStyles[order.status]}`}>{providerStatusLabels[order.status]}</span>
                          <span className="text-xs text-on-surface-variant">{orderDate(order).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <h3 className="mt-3 font-bold text-on-surface">{order.serviceId?.name || 'Dịch vụ'}</h3>
                        {customer?.fullName && <p className="mt-2 text-sm text-on-surface-variant">{customer.fullName}</p>}
                        {formatAddress(order) && <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant">{formatAddress(order)}</p>}
                        <div className="mt-3 flex items-center justify-between border-t border-outline-variant/20 pt-3">
                          <span className="font-bold text-primary">{formatMoney(order.pricing?.totalPaidAmount)}</span>
                          <Link to={`/provider/orders/${order._id}`} className="text-xs font-bold text-primary hover:underline">Chi tiết</Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-outline-variant/40 px-4 py-10 text-center">
                  <span className="material-symbols-outlined text-4xl text-outline">event_available</span>
                  <p className="mt-2 font-bold">Chưa có công việc</p>
                  <p className="mt-1 text-sm text-on-surface-variant">Ngày này chưa có lịch hẹn.</p>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
