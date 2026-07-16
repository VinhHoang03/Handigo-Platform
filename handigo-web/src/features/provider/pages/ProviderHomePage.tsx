import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { providerOrderApi } from "../api/providerOrder.api";
import type { Order, OrderCustomer } from "@/types/booking";
import { DashboardShell } from "@/components/common/DashboardShell";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useProviderAvailability } from "../hooks/useProviderAvailability";
import {
  providerDashboardApi,
  type ProviderEarningPoint,
} from "../api/providerDashboard.api";
import { providerProfileApi } from "../api/providerProfile.api";

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

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

type RevenuePeriod = "week" | "month";

const getRevenueRange = (period: RevenuePeriod) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  let dayCount = 7;

  if (period === "week") {
    const daysSinceMonday = (today.getDay() + 6) % 7;
    start.setDate(today.getDate() - daysSinceMonday);
  } else {
    start.setDate(1);
    dayCount = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
    ).getDate();
  }

  const dates = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });

  return {
    dates,
    label:
      period === "week"
        ? `${dates[0].toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} - ${dates[dates.length - 1].toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}`
        : `Tháng ${today.getMonth() + 1}/${today.getFullYear()}`,
  };
};

const getOrderDate = (order: Order) =>
  new Date(order.scheduledAt || order.createdAt);

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
  if (!address) return "";
  return [
    (address as { fullAddress?: string }).fullAddress,
    address.ward,
    address.district,
    address.province,
  ]
    .filter(Boolean)
    .join(", ");
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
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}
      >
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
  const [revenuePeriod, setRevenuePeriod] = useState<RevenuePeriod>("week");
  const [revenueEarnings, setRevenueEarnings] = useState<ProviderEarningPoint[]>([]);
  const [isLoadingEarnings, setIsLoadingEarnings] = useState(true);
  const [earningsError, setEarningsError] = useState<string | null>(null);
  const [todaySchedule, setTodaySchedule] = useState<Order[]>([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [workingAreas, setWorkingAreas] = useState<string[]>([]);
  const [isLoadingAreas, setIsLoadingAreas] = useState(true);
  const [areasError, setAreasError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    providerOrderApi
      .getRecentOrders(5)
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

    providerOrderApi
      .getProviderOrders(1, 100)
      .then((result) => {
        if (!cancelled) {
          const todayKey = dateKey(new Date());
          const schedule = result.items
            .filter(
              (order) =>
                order.status !== "cancelled" &&
                dateKey(getOrderDate(order)) === todayKey,
            )
            .sort(
              (first, second) =>
                getOrderDate(first).getTime() - getOrderDate(second).getTime(),
            );

          setTotalOrders(result.pagination.total);
          setTodaySchedule(schedule);
          setScheduleError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setScheduleError("Không thể tải lịch làm việc hôm nay.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSchedule(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    providerProfileApi
      .getProfile()
      .then((profile) => {
        if (cancelled) return;

        const configuredAreas = (profile.provider.workingAreas || [])
          .map((area) => area.trim())
          .filter(Boolean);
        const legacyArea = [
          profile.provider.serviceArea?.ward,
          profile.provider.serviceArea?.province,
        ]
          .map((area) => area?.trim())
          .filter(Boolean)
          .join(", ");

        setWorkingAreas(
          configuredAreas.length
            ? [...new Set(configuredAreas)]
            : legacyArea
              ? [legacyArea]
              : [],
        );
        setAreasError(null);
      })
      .catch(() => {
        if (!cancelled) {
          setAreasError("Không thể tải khu vực hoạt động.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingAreas(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const range = getRevenueRange(revenuePeriod);

    providerDashboardApi
      .earnings(
        dateKey(range.dates[0]),
        dateKey(range.dates[range.dates.length - 1]),
      )
      .then((result) => {
        if (!cancelled) {
          setRevenueEarnings(result.earningsByDay);
          setEarningsError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEarningsError("Không thể tải dữ liệu doanh thu.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingEarnings(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [revenuePeriod]);

  const activeOrders = recentOrders.filter((order) =>
    ["created", "accepted", "in_progress"].includes(order.status),
  ).length;
  const todayIncome = recentOrders
    .filter((order) => order.status !== "cancelled")
    .reduce((sum, order) => sum + order.pricing.providerEarningAmount, 0);
  const revenueRange = getRevenueRange(revenuePeriod);
  const earningsByDay = new Map(
    revenueEarnings.map((item) => [item.day, item.amount]),
  );
  const revenueChart = revenueRange.dates.map((date) => ({
    key: dateKey(date),
    label:
      revenuePeriod === "week"
        ? date.toLocaleDateString("vi-VN", { weekday: "short" })
        : String(date.getDate()),
    amount: earningsByDay.get(dateKey(date)) ?? 0,
  }));
  const maxRevenue = Math.max(
    ...revenueChart.map((item) => item.amount),
    0,
  );
  const revenueTotal = revenueChart.reduce(
    (total, item) => total + item.amount,
    0,
  );

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
              <div className="mb-md flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <h3 className="font-headline-md text-on-surface">
                  Doanh thu
                </h3>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-bold text-primary">
                      {formatMoney(revenueTotal)}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {revenueRange.label}
                    </p>
                  </div>
                  <select
                    value={revenuePeriod}
                    onChange={(event) => {
                      setRevenuePeriod(event.target.value as RevenuePeriod);
                      setIsLoadingEarnings(true);
                      setEarningsError(null);
                    }}
                    aria-label="Lọc biểu đồ doanh thu"
                    className="rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm font-semibold text-on-surface outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  >
                    <option value="week">Tuần này</option>
                    <option value="month">Tháng này</option>
                  </select>
                </div>
              </div>
              {isLoadingEarnings ? (
                <div className="h-64 animate-pulse rounded-2xl bg-surface-container-low" />
              ) : earningsError ? (
                <div className="flex h-64 items-center justify-center rounded-2xl bg-error/5 px-4 text-center text-sm text-error">
                  {earningsError}
                </div>
              ) : (
                <div className="overflow-x-auto pb-2">
                  <div
                    className={`relative ${revenuePeriod === "month" ? "min-w-[900px]" : "min-w-[520px]"}`}
                  >
                    {revenueTotal === 0 && (
                      <p className="absolute inset-x-0 top-1/2 z-20 -translate-y-1/2 text-center text-sm font-semibold text-on-surface-variant">
                        Chưa phát sinh doanh thu trong khoảng thời gian này.
                      </p>
                    )}
                    <div className="pointer-events-none absolute inset-x-0 bottom-8 top-8 flex flex-col justify-between">
                      {[0, 1, 2, 3].map((line) => (
                        <span
                          key={line}
                          className="block border-t border-dashed border-outline-variant/35"
                        />
                      ))}
                    </div>
                    <div className="relative z-10 flex h-64 items-end justify-between gap-1 px-sm pt-8 sm:gap-2">
                      {revenueChart.map((item) => {
                        const height = maxRevenue
                          ? Math.max(
                              (item.amount / maxRevenue) * 100,
                              item.amount > 0 ? 4 : 0,
                            )
                          : 0;

                        return (
                          <div
                            key={item.key}
                            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                          >
                            <div
                              className="group relative h-48 w-full rounded-t-md bg-primary-container/15"
                              title={`${item.label}: ${formatMoney(item.amount)}`}
                              aria-label={`${item.label}: ${formatMoney(item.amount)}`}
                            >
                              <div
                                className="absolute bottom-0 w-full rounded-t-md bg-primary transition-all duration-500 group-hover:bg-primary/85"
                                style={{ height: `${height}%` }}
                              />
                              <span className="pointer-events-none absolute -top-7 left-1/2 z-30 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-on-surface px-2 py-1 text-[10px] font-bold text-surface shadow-md group-hover:block">
                                {formatMoney(item.amount)}
                              </span>
                            </div>
                            <span className="text-[11px] font-label-sm capitalize text-on-surface-variant">
                              {item.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="glass-card rounded-3xl p-md">
              <div className="mb-md flex items-center justify-between">
                <h3 className="font-headline-md text-on-surface">
                  Booking gần nhất
                </h3>
                <Link
                  to="/provider/orders"
                  className="font-label-md text-primary hover:underline"
                >
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
                {!isLoadingOrders &&
                  !ordersError &&
                  recentOrders.length === 0 && (
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
                <Link
                  to="/provider/schedule"
                  aria-label="Xem lịch làm việc"
                  className="rounded-full p-xs transition-colors hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-outline">
                    arrow_forward
                  </span>
                </Link>
              </div>
              {isLoadingSchedule ? (
                <div className="h-64 animate-pulse rounded-2xl bg-surface-container-low" />
              ) : scheduleError ? (
                <div className="rounded-2xl bg-error/5 px-4 py-8 text-center text-sm text-error">
                  {scheduleError}
                </div>
              ) : todaySchedule.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-outline-variant/40 px-4 py-10 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-4xl">event_available</span>
                  <p className="mt-2 text-sm font-semibold">
                    Hôm nay chưa có lịch làm việc.
                  </p>
                </div>
              ) : (
                <div className="relative space-y-md before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-[2px] before:bg-surface-variant before:content-['']">
                  {todaySchedule.map((order) => {
                    const active = order.status === "in_progress";
                    const address = shortAddress(order);

                    return (
                      <div key={order._id} className="relative pl-xl">
                        <div
                          className={`absolute left-0 top-1 z-10 h-6 w-6 rounded-full border-4 border-surface-container-high ${active ? "bg-primary" : "bg-outline-variant"}`}
                        />
                        <Link
                          to={`/provider/orders/${order._id}`}
                          className={`block rounded-2xl p-sm transition hover:bg-primary/10 ${active ? "border-l-4 border-primary bg-primary/5" : "bg-surface-container-low"}`}
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            {active && (
                              <span className="inline-flex rounded-full bg-primary px-sm text-[10px] font-bold text-white">
                                ĐANG THỰC HIỆN
                              </span>
                            )}
                            <span className="text-[10px] font-bold uppercase text-on-surface-variant">
                              {statusLabels[order.status]}
                            </span>
                          </div>
                          <p className="text-xs font-bold uppercase text-primary">
                            {getOrderDate(order).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          <h4 className="text-sm font-bold">
                            {order.serviceId?.name || "Dịch vụ"}
                          </h4>
                          {address && (
                            <p className="line-clamp-2 text-xs text-on-surface-variant">
                              {address}
                            </p>
                          )}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="glass-card overflow-hidden rounded-3xl">
              <div className="relative h-48 bg-[radial-gradient(circle_at_20%_20%,rgba(53,37,205,0.18),transparent_30%),linear-gradient(135deg,#eef0ff,#dae2fc)]">
                <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(53,37,205,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(53,37,205,0.12)_1px,transparent_1px)] [background-size:28px_28px]" />
                <div className="absolute bottom-sm left-sm right-sm flex items-end justify-between gap-3">
                  <div className="min-w-0 flex-1 rounded-xl border border-glass-border bg-white/90 px-sm py-xs shadow-sm backdrop-blur">
                    <p className="text-[10px] font-bold uppercase text-on-surface-variant">
                      Khu vực hoạt động
                    </p>
                    {isLoadingAreas ? (
                      <div className="mt-1 h-5 w-32 animate-pulse rounded bg-primary/10" />
                    ) : areasError ? (
                      <p className="mt-1 text-xs font-semibold text-error">
                        {areasError}
                      </p>
                    ) : workingAreas.length ? (
                      <div className="mt-1 flex max-h-16 flex-wrap gap-1.5 overflow-y-auto">
                        {workingAreas.map((area) => (
                          <span
                            key={area}
                            className="max-w-full truncate rounded-full bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary"
                            title={area}
                          >
                            {area}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-xs font-semibold text-on-surface-variant">
                        Chưa cập nhật
                      </p>
                    )}
                  </div>
                  <Link
                    to="/provider/profile"
                    aria-label="Cập nhật khu vực hoạt động"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-110"
                  >
                    <span className="material-symbols-outlined">near_me</span>
                  </Link>
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
