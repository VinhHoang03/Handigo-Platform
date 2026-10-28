import {
  CartesianGrid,
  Area,
  Bar,
  LabelList,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartA11yTable } from "./ChartA11yTable";
import { chartAxisStyle, chartGridStroke, chartTooltipStyle, colorAtIndex } from "./chart-theme";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

export interface LineSeries {
  /** Khoá trong mỗi phần tử của `data`. */
  dataKey: string;
  name: string;
  color?: string;
}

interface LineChartProps {
  data: Array<Record<string, string | number>>;
  /** Khoá dùng cho trục hoành. */
  xKey: string;
  series: LineSeries[];
  ariaLabel: string;
  height?: number;
  /** Định dạng giá trị trong tooltip và bảng a11y. */
  formatValue?: (value: number) => string;
  /** Định dạng nhãn trục hoành. */
  formatX?: (value: string) => string;
  /** Định dạng nhãn trục tung — thường là bản rút gọn của `formatValue`. */
  formatY?: (value: number) => string;
  variant?: "line" | "step" | "area" | "bar" | "stacked" | "percent" | "composed";
}

export function LineChart({
  data,
  xKey,
  series,
  ariaLabel,
  height = 280,
  formatValue = String,
  formatX = String,
  formatY,
  variant = "line",
}: LineChartProps) {
  const reducedMotion = usePrefersReducedMotion();
  // Một điểm dữ liệu không vẽ được đường: hiện chấm to để không trông như lỗi.
  const singlePoint = data.length === 1;
  const stacked = variant === "stacked" || variant === "percent";
  const showBars = variant === "bar" || stacked || variant === "composed";

  return (
    <>
      <div role="img" aria-label={ariaLabel} className="min-w-0 overflow-x-auto">
        <div style={{ minWidth: data.length > 8 ? data.length * 52 : 0 }}>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} stackOffset={variant === "percent" ? "expand" : "none"} margin={{ top: 26, right: 20, bottom: 4, left: 4 }}>
            <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey={xKey}
              tickFormatter={formatX}
              tick={{ fontSize: chartAxisStyle.fontSize, fill: chartAxisStyle.fill }}
              stroke={chartAxisStyle.stroke}
            />
            <YAxis
              tickFormatter={variant === "percent" ? (value) => `${Math.round(Number(value) * 100)}%` : formatY}
              tick={{ fontSize: chartAxisStyle.fontSize, fill: chartAxisStyle.fill }}
              stroke={chartAxisStyle.stroke}
              width={64}
              domain={variant === "percent" ? [0, 1] : [0, "auto"]}
            />
            <Tooltip
              {...chartTooltipStyle}
              labelFormatter={(label) => formatX(String(label))}
              formatter={(value, name) => [formatValue(Number(value)), String(name)]}
            />
            {series.map((item, index) => variant === "area" ? (
              <Area key={item.dataKey} type="monotone" dataKey={item.dataKey} name={item.name}
                stroke={item.color || colorAtIndex(index)} fill={item.color || colorAtIndex(index)} fillOpacity={0.12}
                strokeWidth={2} dot={singlePoint ? { r: 5 } : false} isAnimationActive={!reducedMotion} />
            ) : showBars && (variant !== "composed" || index === 0) ? (
              <Bar key={item.dataKey} dataKey={item.dataKey} name={item.name} fill={item.color || colorAtIndex(index)}
                stackId={stacked ? "total" : undefined} maxBarSize={48} isAnimationActive={!reducedMotion}>
                {series.length === 1 && data.length <= 8 && !stacked && <LabelList dataKey={item.dataKey} position="top" fontSize={11} fill="var(--color-on-surface-variant)" formatter={(value) => formatY ? formatY(Number(value)) : String(value)} />}
              </Bar>
            ) : <Line
                key={item.dataKey}
                type={variant === "step" ? "stepAfter" : "monotone"}
                dataKey={item.dataKey}
                name={item.name}
                stroke={item.color || colorAtIndex(index)}
                strokeWidth={2}
                dot={singlePoint ? { r: 5 } : { r: 3 }}
                activeDot={{ r: 5 }}
                isAnimationActive={!reducedMotion}
              />)}
          </ComposedChart>
        </ResponsiveContainer>
        </div>
      </div>

      {series.length > 1 && <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-on-surface-variant">
        {series.map((item, index) => <li key={item.dataKey} className="flex min-w-0 items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color || colorAtIndex(index) }} />{item.name}</li>)}
      </ul>}

      <ChartA11yTable
        caption={ariaLabel}
        columns={["Kỳ", ...series.map((item) => item.name)]}
        rows={data.map((row) => ({
          key: String(row[xKey]),
          cells: [
            formatX(String(row[xKey])),
            ...series.map((item) => formatValue(Number(row[item.dataKey] ?? 0))),
          ],
        }))}
      />
    </>
  );
}
