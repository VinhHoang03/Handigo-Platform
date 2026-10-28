import { AdminPageTitle, AdminRefreshButton } from "@/features/admin/components/shared/AdminPageHeader";
import { useToastFeedback } from "@/components/common/Toast";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useSearchParams, Link } from "react-router-dom";
import { previousRevenueRange, revenueRangeFromSearch } from "../components/revenue/revenue-period";
import { currentDashboardMonth } from "../components/dashboard/dashboard-period";
import { RevenuePayments } from "../components/revenue/RevenuePayments";
import { RevenueProviderRanking } from "../components/revenue/RevenueProviderRanking";
import type { AdminRevenue, RevenueQuery } from "../types/adminRevenue.types";

export default function AdminRevenuePage() {
  const [params, setParams] = useSearchParams();
  const range = useMemo(() => revenueRangeFromSearch(params.toString()), [params]);
  return <RevenueReport key={`${range.fromDate}:${range.toDate}`} range={range} setRange={next => setParams({ fromDate: next.fromDate, toDate: next.toDate })} />;
}

function RevenueReport({ range, setRange }: { range: RevenueQuery; setRange: (range: RevenueQuery) => void }) {
  const [data, setData] = useState<AdminRevenue | null>(null);
  const [previous, setPrevious] = useState<AdminRevenue | null>(null);
  const comparisonRange = useMemo(() => previousRevenueRange(range), [range]);
  const requestRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useToastFeedback<string>("", "error");

  const load = useCallback(async () => {
    const id = ++requestRef.current;
    try {
      setLoading(true);
      setError("");
      const [current, prior] = await Promise.all([adminRevenueApi.getRevenue(range), adminRevenueApi.getRevenue({ fromDate: comparisonRange.fromDate, toDate: comparisonRange.toDate })]);
      if (id === requestRef.current) { setData(current); setPrevious(prior); }
    } catch (requestError) {
      if (id === requestRef.current) setError(getErrorMessage(requestError, "Không thể tải báo cáo doanh thu."));
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  }, [range, comparisonRange, setError]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => { requestRef.current += 1; window.clearTimeout(timeoutId); };
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
      <header className="admin-page-header admin-revenue-header">
        <div>
          <AdminPageTitle title="Doanh thu hệ thống" />
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
          <button type="button" onClick={() => setRange(currentDashboardMonth())} className="min-h-11 rounded-lg border border-outline-variant px-3 text-sm font-semibold">Tháng này</button>
          <RevenueRangeFilter range={range} onPreset={(days) => setRange(createRange(days))} onChange={setRange} />
          <AdminRefreshButton onRefresh={() => void load()} loading={loading} />
        </div>
      </header>

      <AsyncState loading={loading} error={error} empty={!data} onRetry={load}>
        {data && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-on-surface-variant"><h2 className="font-semibold text-on-surface">Doanh thu từ dịch vụ và thu tiền</h2><Link className="text-primary hover:underline" to={`/admin?${new URLSearchParams({ fromDate: range.fromDate, toDate: range.toDate })}`}>Về tổng quan</Link></div>
            <p className="text-xs text-on-surface-variant">So sánh {range.fromDate} – {range.toDate} với {comparisonRange.fromDate} – {comparisonRange.toDate}. Doanh thu ghi theo ngày giao dịch; thu và hoàn tiền ghi theo ngày phát sinh tương ứng.</p>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Phí nền tảng thực thu" value={data.platformFeeRevenue} previous={previous?.platformFeeRevenue} monthly={comparisonRange.monthly} description="Doanh thu thuộc Handigo từ các đơn đã hoàn tất." tone="success" />
              <MetricCard label="Tổng giá trị giao dịch đơn hoàn tất" value={data.completedOrderRevenue} previous={previous?.completedOrderRevenue} monthly={comparisonRange.monthly} description="Tổng giá trị dịch vụ đã hoàn tất, gồm cả tiền mặt." />
              <MetricCard label="Thu nhập nhà cung cấp" value={data.providerNetRevenue} previous={previous?.providerNetRevenue} monthly={comparisonRange.monthly} description="Phần doanh thu ròng được ghi nhận cho nhà cung cấp." tone="secondary" />
              <MetricCard label="Tiền thu ròng qua hệ thống" value={data.netCollectedPaymentRevenue} previous={previous?.netCollectedPaymentRevenue} monthly={comparisonRange.monthly} description="Khoản đã thu thành công trừ các khoản hoàn trong kỳ." tone="warning" />
            </section>

            <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <SelectableChartCard storageKey="revenue.monthly-composition" title="Cơ cấu doanh thu theo tháng"
                description="Đối soát tổng giá trị giao dịch với phí nền tảng và phần của nhà cung cấp."
                data={monthlyRows} onReload={async () => mergeMonthlyRevenue(await adminRevenueApi.getRevenue(range))}
                isEmpty={(rows) => !rows.length} options={revenueChartOptions} defaultType="line">
                {(rows, type) => <MonthlyChart rows={rows} type={type} />}
              </SelectableChartCard>

              <ReconciliationPanel data={data} difference={reconciliationDifference} />
            </section>

            <h2 className="text-title-lg font-bold">Thu tiền và hoàn tiền</h2>
            <SelectableChartCard storageKey="revenue.daily-collections" title="Dòng tiền thu theo ngày"
              description="Các khoản thanh toán đã thu, ghi theo ngày thu tiền trong khoảng đã chọn."
              data={data.collectedPaymentByDay} onReload={async () => (await adminRevenueApi.getRevenue(range)).collectedPaymentByDay}
              isEmpty={(points) => !points.length} options={trendChartOptions} defaultType="bar">
              {(points, type) => <CollectionChart points={points} type={type} />}
            </SelectableChartCard>
            <RevenuePayments range={range} />
            <RevenueProviderRanking range={range} />
          </>
        )}
      </AsyncState>
    </DashboardShell>
  );
}
