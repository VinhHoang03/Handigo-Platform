import {
  CategoryChartView,
  SeriesChartView,
  SelectableChartCard,
  categoryChartOptions,
  rankingChartOptions,
  trendChartOptions,
  chartCompactMoney,
  chartMoney,
  chartNumber,
  monthLabel,
} from "@/components/common/chart";
import { getOrderStatusMeta } from "@/utils/orderStatus";
import { adminOperationsApi, type DashboardQuery } from "../../api/adminOperations.api";
import type { AdminOrderAnalytics, AdminProviderAnalytics } from "../../types/adminOperations.types";

const providerName = (provider: { fullName?: string; email?: string }) =>
  provider.fullName || provider.email || "Nhà cung cấp";

const statusData = (orders: AdminOrderAnalytics) => orders.ordersByStatus.map((item) => {
  const meta = getOrderStatusMeta(item.status);
  return { label: meta.label, value: item.count, tone: meta.tone };
});
const categoryData = (orders: AdminOrderAnalytics) => orders.ordersByServiceCategory.map((item) => ({ label: item.categoryName, value: item.count }));
const monthlyData = (orders: AdminOrderAnalytics) => orders.ordersByMonth.map((item) => ({ month: item.month, count: item.count }));
const revenueData = (providers: AdminProviderAnalytics) => providers.topProvidersByRevenue.map((item) => ({ label: providerName(item), value: item.revenue }));
const completedData = (providers: AdminProviderAnalytics) => providers.topProvidersByCompletedOrders.map((item) => ({ label: providerName(item), value: item.completedOrders }));
const countValue = (value: number) => chartNumber.format(value) + " đơn";
const moneyValue = (value: number) => chartMoney.format(value);

export function DashboardCharts({ orders, providers, query }: {
  orders: AdminOrderAnalytics;
  providers: AdminProviderAnalytics;
  query: DashboardQuery;
}) {
  return <>
    <section className="grid min-w-0 gap-5 xl:grid-cols-2">
      <SelectableChartCard title="Đơn theo trạng thái" description="Phân bố toàn bộ đơn trong kỳ đã chọn."
        data={orders} onReload={() => adminOperationsApi.orderAnalytics(query)} isEmpty={(value) => !value.ordersByStatus.length}
        options={categoryChartOptions} defaultType="donut">
        {(value, type) => <CategoryChartView title="Đơn theo trạng thái" data={statusData(value)} type={type} formatValue={countValue} />}
      </SelectableChartCard>
      <SelectableChartCard title="Đơn theo danh mục dịch vụ" description="Danh mục nào đang kéo phần lớn nhu cầu."
        data={orders} onReload={() => adminOperationsApi.orderAnalytics(query)} isEmpty={(value) => !value.ordersByServiceCategory.length}
        options={categoryChartOptions} defaultType="donut">
        {(value, type) => <CategoryChartView title="Đơn theo danh mục dịch vụ" data={categoryData(value)} type={type} formatValue={countValue} />}
      </SelectableChartCard>
    </section>
    <SelectableChartCard title="Xu hướng đơn theo tháng" description="Số đơn tạo mới mỗi tháng trong kỳ đã chọn."
      data={orders} onReload={() => adminOperationsApi.orderAnalytics(query)} isEmpty={(value) => !value.ordersByMonth.length}
      options={trendChartOptions} defaultType="line">
      {(value, type) => <SeriesChartView title="Xu hướng đơn theo tháng" data={monthlyData(value)} type={type} xKey="month"
        series={[{ dataKey: "count", name: "Số đơn" }]} formatX={monthLabel} formatValue={countValue} formatY={(number) => chartNumber.format(number)} />}
    </SelectableChartCard>
    <section className="grid min-w-0 gap-5 xl:grid-cols-2">
      <SelectableChartCard title="Nhà cung cấp theo doanh thu" description="Năm nhà cung cấp đóng góp doanh thu cao nhất."
        data={providers} onReload={() => adminOperationsApi.providerAnalytics(query)} isEmpty={(value) => !value.topProvidersByRevenue.length}
        options={rankingChartOptions} defaultType="horizontal">
        {(value, type) => <CategoryChartView title="Nhà cung cấp theo doanh thu" data={revenueData(value)} type={type} formatValue={moneyValue} formatAxisValue={(number) => chartCompactMoney.format(number)} />}
      </SelectableChartCard>
      <SelectableChartCard title="Nhà cung cấp theo đơn hoàn thành" description="Năm nhà cung cấp hoàn thành nhiều đơn nhất."
        data={providers} onReload={() => adminOperationsApi.providerAnalytics(query)} isEmpty={(value) => !value.topProvidersByCompletedOrders.length}
        options={rankingChartOptions} defaultType="horizontal">
        {(value, type) => <CategoryChartView title="Nhà cung cấp theo đơn hoàn thành" data={completedData(value)} type={type} formatValue={countValue} />}
      </SelectableChartCard>
    </section>
  </>;
}
