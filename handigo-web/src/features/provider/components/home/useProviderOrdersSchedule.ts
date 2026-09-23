import { useEffect, useState } from "react";
import { providerOrderApi } from "../../api/providerOrder.api";
import type { Order } from "@/types/booking";
import { dateKey, getOrderDate, getOrderLoadError } from "./providerHome.utils";

/** Booking gần nhất + lịch hôm nay — dùng chung nguồn dữ liệu `getProviderOrders`. */
export function useProviderOrdersSchedule() {
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [todaySchedule, setTodaySchedule] = useState<Order[]>([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

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

  return {
    recentOrders,
    totalOrders,
    isLoadingOrders,
    ordersError,
    todaySchedule,
    isLoadingSchedule,
    scheduleError,
  };
}
