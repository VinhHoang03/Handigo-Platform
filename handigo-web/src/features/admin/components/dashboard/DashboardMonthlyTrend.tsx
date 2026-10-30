import { useId } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AsyncState } from "@/components/common/AsyncState";
import {
  ChartDataTable,
  SelectableChartCard,
  chartCompactMoney,
  chartMoney,
  chartNumber,
  monthLabel,
} from "@/components/common/chart";
import { ChartA11yTable } from "@/components/common/chart/ChartA11yTable";
import {
  chartAxisStyle,
  chartGridStroke,
  chartTooltipStyle,
} from "@/components/common/chart/chart-theme";
import { usePrefersReducedMotion } from "@/components/common/chart/use-prefers-reduced-motion";
import { useAdminRead } from "../../hooks/useAdminRead";
import { adminDashboardApi } from "../../api/adminDashboard.api";
import type { AdminMonthlyTrend } from "../../types/adminDashboard.types";

const options = [
  { value: "composed", label: "Đường và vùng tô" },
  { value: "line", label: "Ba đường so sánh" },
  { value: "bar", label: "Ba cột so sánh" },
  { value: "table", label: "Bảng số liệu" },
];

export function MonthlyOperationsChart({
  points,
  type,
}: {
  points: AdminMonthlyTrend["points"];
  type: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const gradientId = useId().replace(/:/g, "");
  const columns = [
    "Tháng",
    "Đơn hoàn thành",
    "Doanh thu (₫)",
    "Thu nhập nền tảng (₫)",
  ];
  const rows = points.map((item) => [
    monthLabel(item.month),
    chartNumber.format(item.orders),
    chartMoney.format(item.completedRevenue),
    chartMoney.format(item.platformRevenue),
  ]);
  if (type === "table")
    return (
      <ChartDataTable
        caption="Số đơn và doanh thu theo tháng"
        columns={columns}
        rows={rows}
      />
    );
  return (
    <>
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-on-surface-variant">
        <li className="flex items-center gap-2">
          <span
            className="size-2.5 rounded-full bg-primary"
            aria-hidden="true"
          />
          Doanh thu (₫)
        </li>
        <li className="flex items-center gap-2">
          <span
            className="size-2.5 rounded-full bg-green-500"
            aria-hidden="true"
          />
          Đơn hoàn thành
        </li>
        <li className="flex items-center gap-2">
          <span
            className="size-2.5 rounded-full bg-orange-500"
            aria-hidden="true"
          />
          Thu nhập nền tảng (₫)
        </li>
      </ul>
      <div className="mb-1 flex justify-between gap-3 text-xs text-on-surface-variant">
        <span>VNĐ · trục trái</span>
        <span>Số đơn · trục phải</span>
      </div>
      <div
        className="min-w-0 overflow-x-auto"
        role="img"
        aria-label="Doanh thu và thu nhập nền tảng theo trục tiền bên trái; số đơn hoàn thành theo trục bên phải"
      >
        <div style={{ minWidth: Math.max(280, points.length * 36) }}>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart
              data={points}
              margin={{ top: 16, right: 8, left: 0, bottom: 8 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-primary)"
                    stopOpacity={0.22}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-primary)"
                    stopOpacity={0.01}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke={chartGridStroke}
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tickFormatter={(value) =>
                  monthLabel(String(value)).replace("Tháng ", "")
                }
                minTickGap={18}
                tick={{ ...chartAxisStyle, stroke: "none" }}
              />
              <YAxis
                yAxisId="orders"
                orientation="right"
                allowDecimals={false}
                width={36}
                domain={[0, "auto"]}
                tick={{ ...chartAxisStyle, stroke: "none" }}
              />
              <YAxis
                yAxisId="revenue"
                width={52}
                domain={[0, "auto"]}
                tickFormatter={(value) =>
                  chartCompactMoney.format(Number(value))
                }
                tick={{ ...chartAxisStyle, stroke: "none" }}
              />
              <Tooltip
                {...chartTooltipStyle}
                labelFormatter={(value) => monthLabel(String(value))}
                formatter={(value, name) => [
                  name === "Đơn hoàn thành"
                    ? `${chartNumber.format(Number(value))} đơn`
                    : chartMoney.format(Number(value)),
                  String(name),
                ]}
              />
              {type === "bar" ? (
                <>
                  <Bar
                    yAxisId="revenue"
                    dataKey="completedRevenue"
                    name="Doanh thu"
                    fill="var(--color-primary)"
                    maxBarSize={24}
                    isAnimationActive={!reducedMotion}
                  />
                  <Bar
                    yAxisId="orders"
                    dataKey="orders"
                    name="Đơn hoàn thành"
                    fill="#22c55e"
                    maxBarSize={24}
                    isAnimationActive={!reducedMotion}
                  />
                  <Bar
                    yAxisId="revenue"
                    dataKey="platformRevenue"
                    name="Thu nhập nền tảng"
                    fill="#f97316"
                    maxBarSize={24}
                    isAnimationActive={!reducedMotion}
                  />
                </>
              ) : (
                <>
                  {type === "line" ? (
                    <Line
                      yAxisId="revenue"
                      type="monotone"
                      dataKey="completedRevenue"
                      name="Doanh thu"
                      stroke="var(--color-primary)"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      isAnimationActive={!reducedMotion}
                    />
                  ) : (
                    <Area
                      yAxisId="revenue"
                      type="monotone"
                      dataKey="completedRevenue"
                      name="Doanh thu"
                      stroke="var(--color-primary)"
                      strokeWidth={2.5}
                      fill={`url(#${gradientId})`}
                      dot={{
                        r: 3,
                        fill: "var(--color-primary)",
                        stroke: "white",
                        strokeWidth: 2,
                      }}
                      isAnimationActive={!reducedMotion}
                    />
                  )}
                  <Line
                    yAxisId="orders"
                    type="monotone"
                    dataKey="orders"
                    name="Đơn hoàn thành"
                    stroke="#22c55e"
                    strokeDasharray="2 4"
                    strokeWidth={2}
                    dot={{
                      r: 3,
                      fill: "#22c55e",
                      stroke: "white",
                      strokeWidth: 2,
                    }}
                    isAnimationActive={!reducedMotion}
                  />
                  <Line
                    yAxisId="revenue"
                    type="monotone"
                    dataKey="platformRevenue"
                    name="Thu nhập nền tảng"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={!reducedMotion}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-3 border-t border-outline-variant/30 pt-4 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-on-surface-variant">Đơn hoàn thành</dt>
          <dd className="mt-1 font-semibold tabular-nums">
            {chartNumber.format(
              points.reduce((sum, item) => sum + item.orders, 0),
            )}{" "}
            đơn
          </dd>
        </div>
        <div>
          <dt className="text-on-surface-variant">Doanh thu trong kỳ</dt>
          <dd className="mt-1 font-semibold tabular-nums text-primary">
            {chartMoney.format(
              points.reduce((sum, item) => sum + item.completedRevenue, 0),
            )}
          </dd>
        </div>
        <div>
          <dt className="text-on-surface-variant">
            Thu nhập nền tảng trong kỳ
          </dt>
          <dd className="mt-1 font-semibold tabular-nums text-orange-700">
            {chartMoney.format(
              points.reduce((sum, item) => sum + item.platformRevenue, 0),
            )}
          </dd>
        </div>
      </dl>
      <ChartA11yTable
        caption="Số đơn và doanh thu theo tháng"
        columns={columns}
        rows={rows.map((cells, index) => ({ key: points[index].month, cells }))}
      />
    </>
  );
}

export function DashboardMonthlyTrend({
  fromDate,
  toDate,
}: {
  fromDate?: string;
  toDate?: string;
}) {
  const key = String(fromDate) + ":" + String(toDate);
  const state = useAdminRead(key, signal => adminDashboardApi.monthlyTrend({ fromDate, toDate }, signal), { delay: 0, errorMessage: "Không thể tải số đơn và doanh thu theo tháng." });
  const data = state.dataKey === key ? state.data : null;
  const { error } = state;
  return (
    <AsyncState
      loading={!data && state.loading}
      error={error}
      onRetry={state.reload}
    >
      {data && (
        <SelectableChartCard
          storageKey="dashboard.monthly-orders"
          title="Số đơn, doanh thu và thu nhập theo tháng"
          data={data}
          onReload={() => adminDashboardApi.monthlyTrend({ fromDate, toDate })}
          isEmpty={(value) => !value.points.length}
          options={options}
          defaultType="composed"
        >
          {(value, type) => (
            <MonthlyOperationsChart points={value.points} type={type} />
          )}
        </SelectableChartCard>
      )}
    </AsyncState>
  );
}
