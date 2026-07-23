import {
  BarChart,
  ChartCard,
  DonutChart,
  LineChart,
  chartMoney,
  chartNumber,
  monthLabel,
  type DonutSlice,
} from "@/components/common/chart";
import { getOrderStatusMeta } from "@/utils/orderStatus";
import type {
  AdminOrderAnalytics,
  AdminProviderAnalytics,
} from "../../types/adminOperations.types";

const providerName = (provider: { fullName?: string; email?: string }) =>
  provider.fullName || provider.email || "Provider";

export function DashboardCharts({
  orders,
  providers,
}: {
  orders: AdminOrderAnalytics;
  providers: AdminProviderAnalytics;
}) {
  // Nhãn và tông lấy từ nguồn dùng chung, nên "đã hủy" trên biểu đồ cùng màu với
  // chip "đã hủy" trong bảng.
  const statusSlices: DonutSlice[] = orders.ordersByStatus.map((item) => {
    const meta = getOrderStatusMeta(item.status);
    return { label: meta.label, value: item.count, tone: meta.tone };
  });

  const categorySlices: DonutSlice[] = orders.ordersByServiceCategory.map((item) => ({
    label: item.categoryName,
    value: item.count,
  }));

  const monthlyOrders = orders.ordersByMonth.map((item) => ({
    month: item.month,
    count: item.count,
  }));

  const topProviders = providers.topProvidersByRevenue.map((provider) => ({
    // Không cắt ở đây: `BarChart` đã tự cắt ở nhãn trục và giữ tên đầy đủ cho
    // tooltip lẫn bảng a11y. Cắt hai lần chỉ làm tên ngắn hơn mức cần thiết.
    label: providerName(provider),
    value: provider.revenue,
  }));

  const topByOrders = providers.topProvidersByCompletedOrders.map((provider) => ({
    // Không cắt ở đây: `BarChart` đã tự cắt ở nhãn trục và giữ tên đầy đủ cho
    // tooltip lẫn bảng a11y. Cắt hai lần chỉ làm tên ngắn hơn mức cần thiết.
    label: providerName(provider),
    value: provider.completedOrders,
  }));

  return (
    <>
      <section className="grid gap-5 xl:grid-cols-2">
        <ChartCard
          title="Đơn theo trạng thái"
          description="Phân bố toàn bộ đơn trong kỳ đã chọn."
          isEmpty={!statusSlices.length}
        >
          <DonutChart data={statusSlices} ariaLabel="Đơn theo trạng thái" />
        </ChartCard>

        <ChartCard
          title="Đơn theo danh mục dịch vụ"
          description="Danh mục nào đang kéo phần lớn nhu cầu."
          isEmpty={!categorySlices.length}
        >
          <DonutChart data={categorySlices} ariaLabel="Đơn theo danh mục dịch vụ" />
        </ChartCard>
      </section>

      <ChartCard
        title="Xu hướng đơn theo tháng"
        description="Số đơn tạo mới mỗi tháng trong kỳ đã chọn."
        isEmpty={!monthlyOrders.length}
      >
        <LineChart
          data={monthlyOrders}
          xKey="month"
          ariaLabel="Xu hướng đơn theo tháng"
          formatX={monthLabel}
          formatValue={(value) => `${chartNumber.format(value)} đơn`}
          formatY={(value) => chartNumber.format(value)}
          series={[{ dataKey: "count", name: "Số đơn", color: "var(--color-primary)" }]}
        />
      </ChartCard>

      <section className="grid gap-5 xl:grid-cols-2">
        <ChartCard
          title="Provider theo doanh thu"
          description="Năm provider đóng góp doanh thu cao nhất."
          isEmpty={!topProviders.length}
        >
          <BarChart
            data={topProviders}
            ariaLabel="Provider theo doanh thu"
            orientation="horizontal"
            singleColor
            formatValue={(value) => chartMoney.format(value)}
            formatAxisValue={(value) => chartNumber.format(value)}
          />
        </ChartCard>

        <ChartCard
          title="Provider theo đơn hoàn thành"
          description="Năm provider hoàn thành nhiều đơn nhất."
          isEmpty={!topByOrders.length}
        >
          <BarChart
            data={topByOrders}
            ariaLabel="Provider theo đơn hoàn thành"
            orientation="horizontal"
            singleColor
            formatValue={(value) => `${chartNumber.format(value)} đơn`}
            formatAxisValue={(value) => chartNumber.format(value)}
          />
        </ChartCard>
      </section>
    </>
  );
}
