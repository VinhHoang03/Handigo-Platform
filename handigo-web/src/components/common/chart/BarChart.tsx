import {
  Bar,
  CartesianGrid,
  Cell,
  BarChart as RechartsBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StatusTone } from "@/utils/statusTone";
import { ChartA11yTable } from "./ChartA11yTable";
import { truncateLabel } from "./chart-format";
import { chartAxisStyle, chartGridStroke, chartTooltipStyle, colorAtIndex, toneChartColors } from "./chart-theme";
import { useElementWidth } from "./use-element-width";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

/**
 * Tick tự vẽ cho trục danh mục. `Text` mặc định của Recharts ngắt dòng theo từ
 * khi `width` bị giới hạn, nên tên hai chữ trở lên tràn xuống dòng thứ hai,
 * nhìn lệch hẳn so với tên ngắn nằm một dòng. Recharts hợp nhất `x`/`y`/`payload`
 * vào phần tử được truyền qua prop `tick`, nên chỉ cần nhận thêm `maxChars`.
 */
function CategoryTick({
  x,
  y,
  payload,
  maxChars,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
  maxChars: number;
}) {
  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      fontSize={chartAxisStyle.fontSize}
      fill={chartAxisStyle.fill}
    >
      {truncateLabel(payload?.value ?? "", maxChars)}
    </text>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  tone?: StatusTone;
  /** Tên đầy đủ cho tooltip và bảng a11y khi `label` đã bị cắt ngắn. */
  fullLabel?: string;
}

interface BarChartProps {
  data: BarDatum[];
  ariaLabel: string;
  /** `vertical` = cột đứng (theo thời gian); `horizontal` = cột ngang (xếp hạng). */
  orientation?: "vertical" | "horizontal";
  height?: number;
  formatValue?: (value: number) => string;
  formatAxisValue?: (value: number) => string;
  /** Dùng một màu cho mọi cột khi dữ liệu không phân loại. */
  singleColor?: boolean;
}

export function BarChart({
  data,
  ariaLabel,
  orientation = "vertical",
  height = 280,
  formatValue = String,
  formatAxisValue,
  singleColor = false,
}: BarChartProps) {
  const reducedMotion = usePrefersReducedMotion();
  const isHorizontal = orientation === "horizontal";
  const { ref, width: containerWidth } = useElementWidth<HTMLDivElement>();

  // Trục Y chiếm tối đa 38% khung, kẹp trong [76, 140]. Số ký tự nhãn suy ra từ
  // chính bề rộng đó để chữ không bị xuống hai dòng.
  const yAxisWidth = containerWidth
    ? Math.round(Math.min(140, Math.max(76, containerWidth * 0.38)))
    : 140;
  const labelMaxChars = Math.max(9, Math.floor(yAxisWidth / 7.5));


  const barColor = (datum: BarDatum, index: number) => {
    if (datum.tone) return toneChartColors[datum.tone];
    if (singleColor) return "var(--color-primary)";
    return colorAtIndex(index);
  };

  return (
    <>
      <div role="img" aria-label={ariaLabel} ref={ref}>
        <ResponsiveContainer width="100%" height={height}>
          <RechartsBarChart
            data={data}
            layout={isHorizontal ? "vertical" : "horizontal"}
            margin={{ top: 8, right: 16, bottom: 4, left: isHorizontal ? 8 : 4 }}
          >
            <CartesianGrid
              stroke={chartGridStroke}
              strokeDasharray="3 3"
              vertical={isHorizontal}
              horizontal={!isHorizontal}
            />
            {isHorizontal ? (
              <>
                <XAxis
                  type="number"
                  tickFormatter={formatAxisValue}
                  tick={{ fontSize: chartAxisStyle.fontSize, fill: chartAxisStyle.fill }}
                  stroke={chartAxisStyle.stroke}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={yAxisWidth}
                  tick={<CategoryTick maxChars={labelMaxChars} />}
                  stroke={chartAxisStyle.stroke}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: chartAxisStyle.fontSize, fill: chartAxisStyle.fill }}
                  stroke={chartAxisStyle.stroke}
                />
                <YAxis
                  tickFormatter={formatAxisValue}
                  tick={{ fontSize: chartAxisStyle.fontSize, fill: chartAxisStyle.fill }}
                  stroke={chartAxisStyle.stroke}
                  width={64}
                />
              </>
            )}
            <Tooltip
              {...chartTooltipStyle}
              cursor={{ fill: "var(--color-primary)", fillOpacity: 0.06 }}
              labelFormatter={(label) => {
                const match = data.find((datum) => datum.label === label);
                return match?.fullLabel || String(label);
              }}
              formatter={(value) => [formatValue(Number(value)), ""]}
            />
            <Bar dataKey="value" radius={isHorizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} isAnimationActive={!reducedMotion}>
              {data.map((datum, index) => (
                <Cell key={datum.label} fill={barColor(datum, index)} />
              ))}
            </Bar>
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>

      <ChartA11yTable
        caption={ariaLabel}
        columns={["Hạng mục", "Giá trị"]}
        rows={data.map((datum) => ({
          key: datum.label,
          cells: [datum.fullLabel || datum.label, formatValue(datum.value)],
        }))}
      />
    </>
  );
}
