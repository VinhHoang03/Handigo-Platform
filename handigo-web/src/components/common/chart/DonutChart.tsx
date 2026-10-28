import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { StatusTone } from "@/utils/statusTone";
import { ChartA11yTable } from "./ChartA11yTable";
import { chartNumber } from "./chart-format";
import { chartTooltipStyle, colorAtIndex, toneChartColors } from "./chart-theme";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

export interface DonutSlice {
  label: string;
  value: number;
  /** Có tông thì dùng màu ngữ nghĩa; không thì lấy dãy màu xoay vòng. */
  tone?: StatusTone;
}

interface DonutChartProps {
  data: DonutSlice[];
  /** Mô tả cho trình đọc màn hình, ví dụ "Đơn theo trạng thái". */
  ariaLabel: string;
  height?: number;
  valueUnit?: string;
  variant?: "donut" | "pie";
  formatValue?: (value: number) => string;
}

export function DonutChart({
  data,
  ariaLabel,
  height = 260,
  valueUnit = "đơn",
  variant = "donut",
  formatValue = (value) => `${chartNumber.format(value)} ${valueUnit}`,
}: DonutChartProps) {
  const reducedMotion = usePrefersReducedMotion();
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <>
      <div role="img" aria-label={`${ariaLabel}. Tổng ${chartNumber.format(total)} ${valueUnit}.`} className="min-w-0 overflow-hidden">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={variant === "pie" ? 0 : "55%"}
              outerRadius="80%"
              paddingAngle={2}
              isAnimationActive={!reducedMotion}
            >
              {data.map((slice, index) => (
                <Cell
                  key={slice.label}
                  fill={slice.tone ? toneChartColors[slice.tone] : colorAtIndex(index)}
                  stroke="var(--color-surface-container-lowest)"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip
              {...chartTooltipStyle}
              formatter={(value) => [formatValue(Number(value)), ""]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-2 grid gap-2 text-sm">
        {data.map((slice, index) => (
          <li key={`${slice.label}-${index}`} className="flex items-start justify-between gap-3">
            <span className="flex min-w-0 items-start gap-2">
              <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.tone ? toneChartColors[slice.tone] : colorAtIndex(index) }} />
              <span className="break-words text-on-surface-variant">{slice.label}</span>
            </span>
            <span className="shrink-0 text-right tabular-nums">{formatValue(slice.value)} <span className="text-xs text-on-surface-variant">({total ? (slice.value / total * 100).toFixed(1) : "0"}%)</span></span>
          </li>
        ))}
      </ul>

      <ChartA11yTable
        caption={ariaLabel}
        columns={["Hạng mục", `Số lượng (${valueUnit})`]}
        rows={data.map((slice) => ({
          key: slice.label,
          cells: [slice.label, formatValue(slice.value)],
        }))}
      />
    </>
  );
}
