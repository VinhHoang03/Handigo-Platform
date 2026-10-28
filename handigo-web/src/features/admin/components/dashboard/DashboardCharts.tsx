import {
  CategoryChartView,
  SelectableChartCard,
  categoryChartOptions,
  rankingChartOptions,
  chartNumber,
} from "@/components/common/chart";
import { getOrderStatusMeta } from "@/utils/orderStatus";
import { adminOperationsApi, type DashboardQuery } from "../../api/adminOperations.api";
import type { AdminOrderAnalytics, AdminProviderAnalytics } from "../../types/adminOperations.types";
import { DashboardMonthlyTrend } from './DashboardMonthlyTrend';
import { currentDashboardMonth } from './dashboard-period';

const providerName = (provider: { fullName?: string; email?: string }) =>
  provider.fullName || provider.email || "Nhà cung cấp";

const statusData = (orders: AdminOrderAnalytics) => orders.ordersByStatus.map((item) => {
  const meta = getOrderStatusMeta(item.status);
  return { label: meta.label, value: item.count, tone: meta.tone };
});
const categoryData = (orders: AdminOrderAnalytics) => orders.ordersByServiceCategory.map((item) => ({ label: item.categoryName, value: item.count }));
const completedData = (providers: AdminProviderAnalytics) => providers.topProvidersByCompletedOrders.map((item) => ({ label: providerName(item), value: item.completedOrders }));
const countValue = (value: number) => chartNumber.format(value) + " đơn";

export function DashboardCharts({ orders, providers, query }: {
  orders: AdminOrderAnalytics;
  providers: AdminProviderAnalytics;
  query: DashboardQuery;
}) {
  const fallback = currentDashboardMonth();
  const fromMonth = (query.fromDate || fallback.fromDate).slice(0, 7);
  const toMonth = (query.toDate || fallback.toDate).slice(0, 7);
  const label = (month: string) => `${Number(month.slice(5))}/${month.slice(0, 4)}`;
  const statusTitle = `Trạng thái các đơn hiện tại (tháng ${fromMonth === toMonth ? label(toMonth) : `${label(fromMonth)} – ${label(toMonth)}`})`;
  return <>
    <DashboardMonthlyTrend key={`${query.fromDate}:${query.toDate}`} fromDate={query.fromDate} toDate={query.toDate} />
    <section className="grid min-w-0 gap-5 xl:grid-cols-2">
      <SelectableChartCard storageKey="dashboard.order-status" title={statusTitle}
        data={orders} onReload={() => adminOperationsApi.orderAnalytics(query)} isEmpty={(value) => !value.ordersByStatus.length}
        options={categoryChartOptions} defaultType="donut">
        {(value, type) => <CategoryChartView title={statusTitle} showDetails={false} data={statusData(value)} type={type} formatValue={countValue} />}
      </SelectableChartCard>
      <SelectableChartCard storageKey="dashboard.service-categories" title="Các dịch vụ đang chiếm phần lớn nhu cầu"
        data={orders} onReload={() => adminOperationsApi.orderAnalytics(query)} isEmpty={(value) => !value.ordersByServiceCategory.length}
        options={categoryChartOptions} defaultType="donut">
        {(value, type) => <CategoryChartView title="Các dịch vụ đang chiếm phần lớn nhu cầu" showDetails={false} data={categoryData(value)} type={type} formatValue={countValue} />}
      </SelectableChartCard>
    </section>
    <section className="min-w-0">
      <SelectableChartCard storageKey="dashboard.provider-completions" title="Nhà cung cấp theo đơn hoàn thành" description="Năm nhà cung cấp hoàn thành nhiều đơn nhất."
        data={providers} onReload={() => adminOperationsApi.providerAnalytics(query)} isEmpty={(value) => !value.topProvidersByCompletedOrders.length}
        options={rankingChartOptions} defaultType="horizontal">
        {(value, type) => <CategoryChartView title="Nhà cung cấp theo đơn hoàn thành" data={completedData(value)} type={type} formatValue={countValue} />}
      </SelectableChartCard>
    </section>
  </>;
}
