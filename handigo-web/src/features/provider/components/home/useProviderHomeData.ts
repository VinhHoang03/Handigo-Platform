import { useProviderOrdersSchedule } from "./useProviderOrdersSchedule";
import { useProviderRevenue } from "./useProviderRevenue";
import { useProviderWorkingAreas } from "./useProviderWorkingAreas";

/**
 * Gộp state + effect tải dữ liệu cho trang chủ thợ. Tách khỏi component để
 * `ProviderHomePage.tsx` chỉ còn phần bố cục; mỗi mảng dữ liệu (đơn/lịch,
 * doanh thu, khu vực) sống trong hook riêng để dễ đọc và test độc lập.
 */
export function useProviderHomeData() {
  const ordersSchedule = useProviderOrdersSchedule();
  const revenue = useProviderRevenue();
  const areas = useProviderWorkingAreas();

  const activeOrders = ordersSchedule.recentOrders.filter((order) =>
    ["created", "accepted", "in_progress"].includes(order.status),
  ).length;
  const todayIncome = ordersSchedule.recentOrders
    .filter((order) => order.status !== "cancelled")
    .reduce((sum, order) => sum + order.pricing.providerEarningAmount, 0);

  return {
    ...ordersSchedule,
    ...revenue,
    ...areas,
    activeOrders,
    todayIncome,
  };
}
