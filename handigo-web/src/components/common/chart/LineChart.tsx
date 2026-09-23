import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
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
}: LineChartProps) {
  const reducedMotion = usePrefersReducedMotion();
  // Một điểm dữ liệu không vẽ được đường: hiện chấm to để không trông như lỗi.
  const singlePoint = data.length === 1;

  return (
    <>
      <div role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height={height}>
          <RechartsLineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey={xKey}
              tickFormatter={formatX}
              tick={{ fontSize: chartAxisStyle.fontSize, fill: chartAxisStyle.fill }}
              stroke={chartAxisStyle.stroke}
            />
            <YAxis
              tickFormatter={formatY}
              tick={{ fontSize: chartAxisStyle.fontSize, fill: chartAxisStyle.fill }}
              stroke={chartAxisStyle.stroke}
              width={64}
            />
            <Tooltip
              {...chartTooltipStyle}
              labelFormatter={(label) => formatX(String(label))}
              formatter={(value, name) => [formatValue(Number(value)), String(name)]}
            />
            {series.length > 1 && (
              <Legend
                verticalAlign="bottom"
                iconType="plainline"
                formatter={(value: string) => (
                  <span className="text-xs text-on-surface-variant">{value}</span>
                )}
              />
            )}
            {series.map((item, index) => (
              <Line
                key={item.dataKey}
                type="monotone"
                dataKey={item.dataKey}
                name={item.name}
                stroke={item.color || colorAtIndex(index)}
                strokeWidth={2}
                dot={singlePoint ? { r: 5 } : { r: 3 }}
                activeDot={{ r: 5 }}
                isAnimationActive={!reducedMotion}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>

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
