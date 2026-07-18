import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, RefreshCw, TrendingUp } from "lucide-react";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { getErrorMessage } from "@/utils/apiError";
import { adminRevenueApi } from "../api/adminRevenue.api";
import type {
  AdminRevenue,
  RevenueQuery,
  RevenueSeriesPoint,
} from "../types/adminRevenue.types";

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const compactMoney = new Intl.NumberFormat("vi-VN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const toInputDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
};

const createRange = (days: number): RevenueQuery => {
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days + 1);
  return { fromDate: toInputDate(fromDate), toDate: toInputDate(toDate) };
};

const monthLabel = (value: string) => {
  const [year, month] = value.split("-");
  return "Tháng " + Number(month) + "/" + year;
};

interface MonthlyRevenue {
  month: string;
  gross: number;
  platform: number;
  provider: number;
}

const amountByMonth = (points: RevenueSeriesPoint[]) =>
  new Map(points.map((point) => [point.month, point.amount]));

const mergeMonthlyRevenue = (data: AdminRevenue): MonthlyRevenue[] => {
  const gross = amountByMonth(data.completedOrderRevenueByMonth);
  const platform = amountByMonth(data.platformFeeByMonth);
  const provider = amountByMonth(data.providerNetRevenueByMonth);
  const months = new Set(
    [
      ...data.completedOrderRevenueByMonth,
      ...data.platformFeeByMonth,
      ...data.providerNetRevenueByMonth,
    ]
      .map((point) => point.month)
      .filter((month): month is string => Boolean(month)),
  );

  return [...months].sort().map((month) => ({
    month,
    gross: gross.get(month) ?? 0,
    platform: platform.get(month) ?? 0,
    provider: provider.get(month) ?? 0,
  }));
};

function MetricCard({
  label,
  value,
  description,
  tone = "primary",
}: {
  label: string;
  value: number;
  description: string;
  tone?: "primary" | "secondary" | "success" | "warning";
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
  }[tone];

  return (
    <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
      <div className={"mb-4 grid h-10 w-10 place-items-center rounded-xl " + toneClass}>
        <span className="material-symbols-outlined">payments</span>
      </div>
      <p className="text-sm font-semibold text-on-surface-variant">{label}</p>
      <p className="mt-1 text-2xl font-bold text-on-surface">{money.format(value)}</p>
      <p className="mt-2 text-xs leading-5 text-on-surface-variant">{description}</p>
    </article>
  );
}

function MonthlyChart({ rows }: { rows: MonthlyRevenue[] }) {
  const maxAmount = Math.max(...rows.map((row) => row.gross), 1);

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-outline-variant p-8 text-center text-on-surface-variant">
        Chưa có đơn hoàn tất trong kỳ đã chọn.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {rows.map((row) => (
        <div key={row.month}>
          <div className="mb-2 flex items-center justify-between gap-4 text-sm">
            <span className="font-semibold">{monthLabel(row.month)}</span>
            <span className="text-on-surface-variant">{money.format(row.gross)}</span>
          </div>
          <div className="space-y-1.5">
            <div
              className="h-3 rounded-full bg-primary"
              style={{ width: Math.max((row.gross / maxAmount) * 100, 1) + "%" }}
              title={"GMV: " + money.format(row.gross)}
            />
            <div
              className="h-2.5 rounded-full bg-secondary"
              style={{ width: Math.max((row.provider / maxAmount) * 100, 1) + "%" }}
              title={"Thu nhập provider: " + money.format(row.provider)}
            />
            <div
              className="h-2.5 rounded-full bg-emerald-500"
              style={{ width: Math.max((row.platform / maxAmount) * 100, 1) + "%" }}
              title={"Phí nền tảng: " + money.format(row.platform)}
            />
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-4 text-xs text-on-surface-variant">
        <span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-primary" />GMV hoàn tất</span>
        <span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-secondary" />Thu nhập provider</span>
        <span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />Phí nền tảng</span>
      </div>
    </div>
  );
}

function CollectionChart({ points }: { points: RevenueSeriesPoint[] }) {
  const visiblePoints = points.slice(-31);
  const maxAmount = Math.max(...visiblePoints.map((point) => point.amount), 1);

  if (!visiblePoints.length) {
    return <p className="py-12 text-center text-on-surface-variant">Chưa có giao dịch thu tiền trong kỳ.</p>;
  }

  return (
    <div className="flex h-52 items-end gap-1 overflow-x-auto border-b border-outline-variant/50 px-1 pt-8">
      {visiblePoints.map((point) => (
        <div key={point.day} className="group flex min-w-3 flex-1 flex-col items-center justify-end">
          <span className="mb-1 hidden whitespace-nowrap rounded bg-on-surface px-2 py-1 text-xs text-surface group-hover:block">
            {point.day}: {money.format(point.amount)}
          </span>
          <div
            className="w-full min-w-2 rounded-t bg-primary/75 transition group-hover:bg-primary"
            style={{ height: Math.max((point.amount / maxAmount) * 160, 3) }}
            aria-label={(point.day ?? "") + ": " + money.format(point.amount)}
          />
        </div>
      ))}
    </div>
  );
}

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

  const applyPreset = (days: number) => setRange(createRange(days));

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

      <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {[7, 30, 90].map((days) => (
              <button key={days} type="button" onClick={() => applyPreset(days)} className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold hover:border-primary hover:text-primary">
                {days} ngày
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
            <label className="text-sm font-semibold text-on-surface">
              Từ ngày
              <span className="relative mt-1 block">
                <CalendarDays size={16} className="pointer-events-none absolute left-3 top-3 text-on-surface-variant" />
                <input type="date" value={range.fromDate} max={range.toDate} onChange={(event) => setRange((current) => ({ ...current, fromDate: event.target.value }))} className="min-h-10 rounded-lg border border-outline-variant bg-surface pl-9 pr-3 font-normal" />
              </span>
            </label>
            <label className="text-sm font-semibold text-on-surface">
              Đến ngày
              <span className="relative mt-1 block">
                <CalendarDays size={16} className="pointer-events-none absolute left-3 top-3 text-on-surface-variant" />
                <input type="date" value={range.toDate} min={range.fromDate} max={toInputDate(new Date())} onChange={(event) => setRange((current) => ({ ...current, toDate: event.target.value }))} className="min-h-10 rounded-lg border border-outline-variant bg-surface pl-9 pr-3 font-normal" />
              </span>
            </label>
          </div>
        </div>
      </section>

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

              <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5">
                <h2 className="text-title-lg font-bold">Đối soát trong kỳ</h2>
                <dl className="mt-5 space-y-4">
                  {[
                    ["Thu thành công qua hệ thống", data.collectedPaymentRevenue],
                    ["Hoàn tiền", -data.refundedRevenue],
                    ["GMV thanh toán online", data.onlineCompletedRevenue],
                    ["GMV thanh toán tiền mặt", data.cashCompletedRevenue],
                    ["Tiền đặt cọc đã thu", data.depositRevenue],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex items-center justify-between gap-4 border-b border-outline-variant/30 pb-3">
                      <dt className="text-sm text-on-surface-variant">{label}</dt>
                      <dd className="font-bold">{money.format(Number(value))}</dd>
                    </div>
                  ))}
                </dl>
                <div className={"mt-5 rounded-xl p-4 text-sm " + (Math.abs(reconciliationDifference) < 1 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800")}>
                  <p className="font-bold">Chênh lệch đối soát: {money.format(reconciliationDifference)}</p>
                  <p className="mt-1">GMV = phí nền tảng + thu nhập provider. Số liệu chuẩn khi chênh lệch bằng 0.</p>
                </div>
              </article>
            </section>

            <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5">
              <h2 className="text-title-lg font-bold">Dòng tiền thu theo ngày</h2>
              <p className="mt-1 text-sm text-on-surface-variant">Tối đa 31 ngày gần nhất trong khoảng đã chọn; không bao gồm tiền mặt.</p>
              <CollectionChart points={data.collectedPaymentByDay} />
              <p className="mt-3 text-right text-xs text-on-surface-variant">Đơn vị hiển thị: {compactMoney.format(Math.max(...data.collectedPaymentByDay.map((point) => point.amount), 0))} đỉnh kỳ</p>
            </section>
          </>
        )}
      </AsyncState>
    </DashboardShell>
  );
}
