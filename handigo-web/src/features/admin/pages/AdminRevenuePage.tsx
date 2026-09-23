import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, TrendingUp } from "lucide-react";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { getErrorMessage } from "@/utils/apiError";
import { adminRevenueApi } from "../api/adminRevenue.api";
import { CollectionChart } from "../components/revenue/CollectionChart";
import { MetricCard } from "../components/revenue/MetricCard";
import { MonthlyChart } from "../components/revenue/MonthlyChart";
import { ReconciliationPanel } from "../components/revenue/ReconciliationPanel";
import { RevenueRangeFilter } from "../components/revenue/RevenueRangeFilter";
import { compactMoney, createRange, mergeMonthlyRevenue } from "../components/revenue/revenue-format";
import type { AdminRevenue, RevenueQuery } from "../types/adminRevenue.types";

export default function AdminRevenuePage() {
  const [range, setRange] = useState<RevenueQuery>(() => createRange(30));
  const [data, setData] = useState<AdminRevenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
  }, [range]);

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
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-headline-lg font-bold">Doanh thu hệ thống</h1>
          <p className="mt-1 max-w-3xl text-on-surface-variant">
            Theo dõi GMV đơn hoàn tất, phí nền tảng thực thu và dòng tiền qua hệ thống.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2.5 font-semibold text-primary disabled:opacity-50">
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} /> Làm mới
        </button>
      </header>

      <RevenueRangeFilter range={range} onPreset={(days) => setRange(createRange(days))} onChange={setRange} />

      <AsyncState loading={loading} error={error} empty={!data} onRetry={load}>
        {data && (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Phí nền tảng thực thu" value={data.platformFeeRevenue} description="Doanh thu thuộc Handigo từ các đơn đã hoàn tất." tone="success" />
              <MetricCard label="GMV đơn hoàn tất" value={data.completedOrderRevenue} description="Tổng giá trị dịch vụ đã hoàn tất, gồm cả tiền mặt." />
              <MetricCard label="Thu nhập provider" value={data.providerNetRevenue} description="Phần doanh thu ròng được ghi nhận cho provider." tone="secondary" />
              <MetricCard label="Tiền thu ròng qua hệ thống" value={data.netCollectedPaymentRevenue} description="Khoản đã thu thành công trừ các khoản hoàn trong kỳ." tone="warning" />
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
              <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5">
                <div className="mb-6 flex items-center gap-3">
                  <TrendingUp className="text-primary" />
                  <div>
                    <h2 className="text-title-lg font-bold">Cơ cấu doanh thu theo tháng</h2>
                    <p className="text-sm text-on-surface-variant">Đối soát GMV với phí nền tảng và phần của provider.</p>
                  </div>
                </div>
                <MonthlyChart rows={monthlyRows} />
              </article>

              <ReconciliationPanel data={data} difference={reconciliationDifference} />
            </section>

            <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5">
              <h2 className="text-title-lg font-bold">Dòng tiền thu theo ngày</h2>
              <p className="mt-1 text-sm text-on-surface-variant">Tối đa 31 ngày gần nhất trong khoảng đã chọn; không bao gồm tiền mặt.</p>
              <CollectionChart points={data.collectedPaymentByDay} />
              <p className="mt-3 text-right text-xs tabular-nums text-on-surface-variant">Đơn vị hiển thị: {compactMoney.format(Math.max(...data.collectedPaymentByDay.map((point) => point.amount), 0))} đỉnh kỳ</p>
            </section>
          </>
        )}
      </AsyncState>
    </DashboardShell>
  );
}
