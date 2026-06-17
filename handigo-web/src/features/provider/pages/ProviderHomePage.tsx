import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { bookingApi } from "@/api/booking";
import { providerOrderApi } from "../api/providerOrder.api";
import type { Order, OrderCustomer } from "@/types/booking";
import { DashboardShell } from "@/components/common/DashboardShell";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useProviderAvailability } from "../hooks/useProviderAvailability";

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const statusLabels: Record<Order["status"], string> = {
  created: "Đang chờ",
  accepted: "Đã nhận",
  in_progress: "Đang làm",
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
};

const statusStyles: Record<Order["status"], string> = {
  created: "border-primary text-primary",
  accepted: "border-accent-cyan text-accent-cyan",
  in_progress: "border-secondary text-secondary",
  completed: "border-emerald-500 text-emerald-600",
  cancelled: "border-error text-error",
};

const weeklyRevenue = [
  { label: "Thứ 2", value: 60 },
  { label: "Thứ 3", value: 85 },
  { label: "Thứ 4", value: 45 },
  { label: "Thứ 5", value: 70 },
  { label: "Thứ 6", value: 95 },
  { label: "Thứ 7", value: 55 },
  { label: "CN", value: 30 },
];

const fallbackSchedule = [
  {
    time: "08:00 - 09:30",
    title: "Bảo trì hệ thống lạnh",
    address: "Landmark 81, Bình Thạnh",
    active: false,
  },
  {
    time: "10:00 - 11:30",
    title: "Sửa bình nóng lạnh",
    address: "Vinhomes Central Park",
    active: true,
  },
  {
    time: "14:00 - 15:30",
    title: "Lắp đặt camera",
    address: "Thảo Điền, Quận 2",
    active: false,
  },
];

function getCustomer(order: Order): OrderCustomer | null {
  return typeof order.customerId === "object" ? order.customerId : null;
}

function formatMoney(value?: number) {
  return currencyFormatter.format(value ?? 0);
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa chọn thời gian";

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

function shortAddress(order: Order) {
  const address = order.addressId;
  if (!address) return '';
  return [
    (address as { fullAddress?: string }).fullAddress,
    address.ward,
    address.district,
    address.province,
  ]
    .filter(Boolean)
    .join(', ');
}

function getOrderLoadError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response
  ) {
    const data = error.response.data as { message?: string; error?: string };
    if (data.message === "Route not found") {
      return "Backend chưa nhận route /orders/provider/recent. Hãy restart backend rồi thử lại.";
    }
    if (data.message || data.error) {
      return data.message || data.error || "Không thể tải booking gần nhất.";
    }
  }

  return "Không thể tải booking gần nhất.";
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="glass-card flex items-center gap-md rounded-3xl p-md transition-transform hover:-translate-y-1">
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div>
        <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
          {label}
        </p>
        <p className="text-headline-md font-bold text-on-surface">{value}</p>
      </div>
    </div>
  );
}

function BookingItem({ order }: { order: Order }) {
  const customer = getCustomer(order);
  const avatar =
    customer?.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(customer?.fullName || order.orderCode)}&background=4f46e5&color=fff`;

  return (
    <Link
      to={`/provider/orders/${order._id}`}
      className={`group flex flex-col gap-md rounded-2xl border-l-4 bg-surface-container-low p-md transition-all hover:bg-white sm:flex-row sm:items-center sm:justify-between ${statusStyles[order.status]}`}
    >
      <div className="flex min-w-0 items-center gap-md">
        <img
          src={avatar}
          alt="Khách hàng"
          className="h-12 w-12 rounded-full object-cover"
        />
        <div className="min-w-0">
          <h4 className="truncate font-bold text-on-surface">
            {customer?.fullName || "Khách hàng"}
          </h4>
          <p className="truncate text-sm text-on-surface-variant">
            {order.serviceId.name}
            {shortAddress(order) ? ` - ${shortAddress(order)}` : ""}
          </p>
          <div className="mt-1 flex items-center gap-xs">
            <span className="material-symbols-outlined text-[14px] text-on-surface-variant">
              schedule
            </span>
            <span className="text-xs text-on-surface-variant">
              {formatDateTime(order.scheduledAt || order.createdAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-sm sm:block sm:text-right">
        <p className="font-bold text-primary">
          {formatMoney(order.pricing.providerEarningAmount)}
        </p>
        <span className="text-[10px] font-bold uppercase tracking-tight">
          {statusLabels[order.status]}
        </span>
      </div>
    </Link>
  );
}

const ProviderHomePage = () => {
  const user = useAuthStore((state) => state.user);
  const { isOnline, toggleAvailability } = useProviderAvailability();
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    bookingApi
      .getProviderRecentOrders(5)
      .then((items) => {
        if (!cancelled) {
          setRecentOrders(items);
          setOrdersError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setOrdersError(getOrderLoadError(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingOrders(false);
        }
      });

    providerOrderApi.getProviderOrders(1, 1).then((res) => {
      if (!cancelled) {
        setTotalOrders(res.pagination.total);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeOrders = recentOrders.filter((order) =>
    ["created", "accepted", "in_progress"].includes(order.status),
  ).length;
  const todayIncome = recentOrders
    .filter((order) => order.status !== "cancelled")
    .reduce((sum, order) => sum + order.pricing.providerEarningAmount, 0);

  return (
    <DashboardShell
      role="PROVIDER"
      showStatusToggle
      isOnline={isOnline}
      onStatusToggle={toggleAvailability}
    >
      <div className="space-y-gutter">
        <section className="flex flex-col justify-between gap-md md:flex-row md:items-end">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-primary">
              Chào buổi sáng, {user?.fullName?.split(" ")[0] || "Provider"}!
            </h2>
            <p className="text-body-lg text-on-surface-variant">
              Hôm nay bạn có {activeOrders} đơn đang được thực hiện.
            </p>
          </div>
          <div className="flex flex-wrap gap-sm">
            <Link
              to="/provider/orders"
              className="flex items-center gap-base rounded-xl bg-primary px-md py-sm font-label-md text-white shadow-md transition-all hover:scale-105"
            >
              <span className="material-symbols-outlined">bolt</span>
              Xem đơn mới
            </Link>
            <button className="flex items-center gap-base rounded-xl bg-surface-container-high px-md py-sm font-label-md text-primary transition-all hover:bg-primary-fixed">
              <span className="material-symbols-outlined">chat</span>
              Tin nhắn
            </button>
            <Link
              to="/provider/wallet"
              className="flex items-center gap-base rounded-xl bg-surface-container-high px-md py-sm font-label-md text-primary transition-all hover:bg-primary-fixed"
            >
              <span className="material-symbols-outlined">payments</span>
              Rút tiền
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon="inventory"
            label="Tổng số đơn"
            value={String(totalOrders)}
            tone="bg-primary-container/20 text-primary"
          />
          <StatCard
            icon="pending_actions"
            label="Đang thực hiện"
            value={String(activeOrders)}
            tone="bg-secondary-container/30 text-secondary"
          />
          <StatCard
            icon="monetization_on"
            label="Thu nhập gần đây"
            value={formatMoney(todayIncome)}
            tone="bg-accent-cyan/10 text-accent-cyan"
          />
          <StatCard
            icon="star"
            label="Đánh giá"
            value="4.9/5"
            tone="bg-tertiary-fixed/30 text-tertiary"
          />
        </section>

        <section className="grid grid-cols-1 gap-gutter lg:grid-cols-12">
          <div className="space-y-gutter lg:col-span-8">
            <div className="glass-card rounded-3xl p-md">
              <div className="mb-md flex items-center justify-between">
                <h3 className="font-headline-md text-on-surface">
                  Doanh thu tuần
                </h3>
                <select className="rounded-lg border-none bg-surface-container py-xs pl-sm pr-xl text-label-sm focus:ring-primary">
                  <option>7 ngày qua</option>
                  <option>30 ngày qua</option>
                </select>
              </div>
              <div className="flex h-64 items-end justify-between gap-base px-sm">
                {weeklyRevenue.map((day) => (
                  <div key={day.label} className="flex flex-1 flex-col items-center gap-sm">
                    <div className="group relative h-40 w-full rounded-t-lg bg-primary-container/20">
                      <div
                        className="absolute bottom-0 w-full rounded-t-lg bg-primary transition-all duration-500 group-hover:brightness-110"
                        style={{ height: `${day.value}%` }}
                      />
                    </div>
                    <span className="text-xs font-label-sm text-on-surface-variant">
                      {day.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card rounded-3xl p-md">
              <div className="mb-md flex items-center justify-between">
                <h3 className="font-headline-md text-on-surface">
                  Booking gần nhất
                </h3>
                <Link to="/provider/orders" className="font-label-md text-primary hover:underline">
                  Xem tất cả
                </Link>
              </div>

              <div className="space-y-sm">
                {isLoadingOrders && (
                  <div className="rounded-2xl bg-surface-container-low p-md text-on-surface-variant">
                    Đang tải booking gần nhất...
                  </div>
                )}
                {!isLoadingOrders && ordersError && (
                  <div className="rounded-2xl bg-error-container p-md text-on-error-container">
                    {ordersError}
                  </div>
                )}
                {!isLoadingOrders && !ordersError && recentOrders.length === 0 && (
                  <div className="rounded-2xl bg-surface-container-low p-md text-on-surface-variant">
                    Chưa có booking nào được phân công cho bạn.
                  </div>
                )}
                {!isLoadingOrders &&
                  !ordersError &&
                  recentOrders.map((order) => (
                    <BookingItem key={order._id} order={order} />
                  ))}
              </div>
            </div>
          </div>

          <div className="space-y-gutter lg:col-span-4">
            <div className="glass-card rounded-3xl p-md">
              <div className="mb-md flex items-center justify-between">
                <h3 className="font-headline-md text-on-surface">
                  Lịch hôm nay
                </h3>
                <button className="rounded-full p-xs transition-colors hover:bg-surface-container">
                  <span className="material-symbols-outlined text-outline">
                    more_horiz
                  </span>
                </button>
              </div>
              <div className="relative space-y-md before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-[2px] before:bg-surface-variant before:content-['']">
                {fallbackSchedule.map((item) => (
                  <div key={`${item.time}-${item.title}`} className="relative pl-xl">
                    <div
                      className={`absolute left-0 top-1 z-10 h-6 w-6 rounded-full border-4 border-surface-container-high ${item.active ? "bg-primary" : "bg-outline-variant"
                        }`}
                    />
                    <div
                      className={`rounded-2xl p-sm ${item.active
                        ? "border-l-4 border-primary bg-primary/5"
                        : "bg-surface-container-low"
                        }`}
                    >
                      {item.active && (
                        <span className="mb-1 inline-flex rounded-full bg-primary px-sm text-[10px] font-bold text-white">
                          ĐANG THỰC HIỆN
                        </span>
                      )}
                      <p className="text-xs font-bold uppercase text-primary">
                        {item.time}
                      </p>
                      <h4 className="text-sm font-bold">{item.title}</h4>
                      <p className="text-xs text-on-surface-variant">
                        {item.address}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card overflow-hidden rounded-3xl">
              <div className="relative h-48 bg-[radial-gradient(circle_at_20%_20%,rgba(53,37,205,0.18),transparent_30%),linear-gradient(135deg,#eef0ff,#dae2fc)]">
                <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(53,37,205,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(53,37,205,0.12)_1px,transparent_1px)] [background-size:28px_28px]" />
                <div className="absolute bottom-sm left-sm right-sm flex items-center justify-between">
                  <div className="rounded-lg border border-glass-border bg-white/90 px-sm py-xs shadow-sm backdrop-blur">
                    <p className="text-[10px] font-bold uppercase text-on-surface-variant">
                      Khu vực hoạt động
                    </p>
                    <p className="text-xs font-bold text-primary">
                      TP. Hồ Chí Minh
                    </p>
                  </div>
                  <button className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-110">
                    <span className="material-symbols-outlined">near_me</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
};

export default ProviderHomePage;
