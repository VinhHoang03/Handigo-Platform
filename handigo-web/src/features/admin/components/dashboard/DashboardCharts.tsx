import {
  CategoryChartView,
  SelectableChartCard,
  categoryChartOptions,
  chartNumber,
} from "@/components/common/chart";
import { getOrderStatusMeta } from "@/utils/orderStatus";
import { adminOperationsApi, type DashboardQuery } from "../../api/adminOperations.api";
import type { AdminOrderAnalytics } from "../../types/adminOperations.types";
import { DashboardMonthlyTrend } from './DashboardMonthlyTrend';
import { DashboardRecentOrders } from './DashboardRecentOrders';
import { currentDashboardMonth } from './dashboard-period';

const statusData = (orders: AdminOrderAnalytics) => orders.ordersByStatus.map((item) => {
  const meta = getOrderStatusMeta(item.status);
  return { label: meta.label, value: item.count, tone: meta.tone };
});
const categoryData = (orders: AdminOrderAnalytics) => orders.ordersByServiceCategory.map((item) => ({ label: item.categoryName, value: item.count }));
const countValue = (value: number) => chartNumber.format(value) + " đơn";

export function DashboardCharts({ orders, query }: {
  orders: AdminOrderAnalytics;
  query: DashboardQuery;
}) {
  const fallback = currentDashboardMonth();
  const fromMonth = (query.fromDate || fallback.fromDate).slice(0, 7);
  const toMonth = (query.toDate || fallback.toDate).slice(0, 7);
  const label = (month: string) => `${Number(month.slice(5))}/${month.slice(0, 4)}`;
  const statusTitle = `Trạng thái các đơn hiện tại (tháng ${fromMonth === toMonth ? label(toMonth) : `${label(fromMonth)} – ${label(toMonth)}`})`;
  return <>
    <section className="grid min-w-0 items-start gap-5 min-[80rem]:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
      <div className="min-w-0"><DashboardMonthlyTrend fromDate={query.fromDate} toDate={query.toDate} /></div>
      <DashboardRecentOrders />
    </section>
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
  </>;
}
