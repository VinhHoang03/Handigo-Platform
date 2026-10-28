import { AdminPageTitle, AdminRefreshButton } from "@/features/admin/components/shared/AdminPageHeader";
import { useToastFeedback } from "@/components/common/Toast";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SelectableChartCard, revenueChartOptions, trendChartOptions } from "@/components/common/chart";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { getErrorMessage } from "@/utils/apiError";
import { adminRevenueApi } from "../api/adminRevenue.api";
import { CollectionChart } from "../components/revenue/CollectionChart";
import { MetricCard } from "../components/revenue/MetricCard";
import { MonthlyChart } from "../components/revenue/MonthlyChart";
import { ReconciliationPanel } from "../components/revenue/ReconciliationPanel";
import { RevenueRangeFilter } from "../components/revenue/RevenueRangeFilter";
import { createRange, mergeMonthlyRevenue } from "../components/revenue/revenue-format";
import type { AdminRevenue, RevenueQuery } from "../types/adminRevenue.types";

export default function AdminRevenuePage() {
  const [range, setRange] = useState<RevenueQuery>(() => createRange(30));
  const [data, setData] = useState<AdminRevenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useToastFeedback<string>("", "error");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setData(await adminRevenueApi.getRevenue(range));
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Không thể tải báo cáo doanh thu."));
    } finally {
      setLoading(false);
    }
  }, [range, setError]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const monthlyRows = useMemo(
    () => (data ? mergeMonthlyRevenue(data) : []),
    [data],
  );
  const reconciliationDifference = data
    ? data.completedOrderRevenue - data.platformFeeRevenue - data.providerNetRevenue
    : 0;

  return (
    <DashboardShell role="ADMIN">
      <header className="admin-page-header">
        <div>
          <AdminPageTitle title="Doanh thu hệ thống" />
        </div>
        <AdminRefreshButton onRefresh={() => void load()} loading={loading} />
      </header>

      <RevenueRangeFilter range={range} onPreset={(days) => setRange(createRange(days))} onChange={setRange} />

      <AsyncState loading={loading} error={error} empty={!data} onRetry={load}>
        {data && (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Phí nền tảng thực thu" value={data.platformFeeRevenue} description="Doanh thu thuộc Handigo từ các đơn đã hoàn tất." tone="success" />
              <MetricCard label="Tổng giá trị giao dịch đơn hoàn tất" value={data.completedOrderRevenue} description="Tổng giá trị dịch vụ đã hoàn tất, gồm cả tiền mặt." />
              <MetricCard label="Thu nhập nhà cung cấp" value={data.providerNetRevenue} description="Phần doanh thu ròng được ghi nhận cho nhà cung cấp." tone="secondary" />
              <MetricCard label="Tiền thu ròng qua hệ thống" value={data.netCollectedPaymentRevenue} description="Khoản đã thu thành công trừ các khoản hoàn trong kỳ." tone="warning" />
            </section>

            <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <SelectableChartCard title="Cơ cấu doanh thu theo tháng"
                description="Đối soát tổng giá trị giao dịch với phí nền tảng và phần của nhà cung cấp."
                data={monthlyRows} onReload={async () => mergeMonthlyRevenue(await adminRevenueApi.getRevenue(range))}
                isEmpty={(rows) => !rows.length} options={revenueChartOptions} defaultType="line">
                {(rows, type) => <MonthlyChart rows={rows} type={type} />}
              </SelectableChartCard>

              <ReconciliationPanel data={data} difference={reconciliationDifference} />
            </section>

            <SelectableChartCard title="Dòng tiền thu theo ngày"
              description="Tối đa 31 ngày gần nhất trong khoảng đã chọn; không bao gồm tiền mặt."
              data={data.collectedPaymentByDay} onReload={async () => (await adminRevenueApi.getRevenue(range)).collectedPaymentByDay}
              isEmpty={(points) => !points.length} options={trendChartOptions} defaultType="bar">
              {(points, type) => <CollectionChart points={points} type={type} />}
            </SelectableChartCard>
          </>
        )}
      </AsyncState>
    </DashboardShell>
  );
}
