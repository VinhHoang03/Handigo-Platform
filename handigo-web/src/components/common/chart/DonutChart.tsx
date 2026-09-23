import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
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
}

export function DonutChart({
  data,
  ariaLabel,
  height = 260,
  valueUnit = "đơn",
}: DonutChartProps) {
  const reducedMotion = usePrefersReducedMotion();
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <>
      <div role="img" aria-label={`${ariaLabel}. Tổng ${chartNumber.format(total)} ${valueUnit}.`}>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="55%"
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
              formatter={(value) => [`${chartNumber.format(Number(value))} ${valueUnit}`, ""]}
            />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              formatter={(value: string) => (
                <span className="text-xs text-on-surface-variant">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ChartA11yTable
        caption={ariaLabel}
        columns={["Hạng mục", `Số lượng (${valueUnit})`]}
        rows={data.map((slice) => ({
          key: slice.label,
          cells: [slice.label, chartNumber.format(slice.value)],
        }))}
      />
    </>
  );
}
