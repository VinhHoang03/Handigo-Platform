import type { ReactNode } from "react";
import { BarChart } from "./BarChart";
import { DonutChart, type DonutSlice } from "./DonutChart";
import { LineChart, type LineSeries } from "./LineChart";
import { ChartDataTable } from "./ChartDataTable";
import { chartNumber } from "./chart-format";

function DataDetails({ children }: { children: ReactNode }) {
  return <details className="mt-4 min-w-0 border-t border-outline-variant/30 pt-3">
    <summary className="min-h-11 cursor-pointer rounded-lg py-2 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary">Xem số liệu chi tiết</summary>
    <div className="mt-2">{children}</div>
  </details>;
}

export function CategoryChartView({ data, type, title, formatValue = (value) => chartNumber.format(value), formatAxisValue }: {
  data: DonutSlice[];
  type: string;
  title: string;
  formatValue?: (value: number) => string;
  formatAxisValue?: (value: number) => string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const table = <ChartDataTable caption={title} columns={["Hạng mục", "Giá trị", "Tỷ trọng"]}
    rows={data.map((item) => [item.label, formatValue(item.value), `${total ? (item.value / total * 100).toFixed(1) : "0"}%`])} />;
  if (type === "table") return table;
  return <>
    {type === "donut" || type === "pie"
      ? <DonutChart data={data} variant={type} ariaLabel={title} formatValue={formatValue} />
      : <div className="overflow-x-auto"><div style={{ minWidth: type === "vertical" && data.length > 6 ? data.length * 80 : 0 }}>
        <BarChart data={data} ariaLabel={title} orientation={type === "horizontal" ? "horizontal" : "vertical"}
          height={type === "horizontal" ? Math.max(280, data.length * 44 + 48) : 280}
          formatValue={formatValue} formatAxisValue={formatAxisValue} showValues />
      </div></div>}
    <DataDetails>{table}</DataDetails>
  </>;
}

export function SeriesChartView({ data, type, title, xKey, series, formatX = String, formatValue = String, formatY }: {
  data: Array<Record<string, string | number>>;
  type: string;
  title: string;
  xKey: string;
  series: LineSeries[];
  formatX?: (value: string) => string;
  formatValue?: (value: number) => string;
  formatY?: (value: number) => string;
}) {
  const table = <ChartDataTable caption={title} columns={["Kỳ", ...series.map((item) => item.name)]}
    rows={data.map((row) => [formatX(String(row[xKey])), ...series.map((item) => formatValue(Number(row[item.dataKey] ?? 0)))])} />;
  if (type === "table") return table;
  const variant = ["line", "step", "area", "bar", "stacked", "percent", "composed"].includes(type)
    ? type as "line" | "step" | "area" | "bar" | "stacked" | "percent" | "composed" : "line";
  return <>
    <LineChart data={data} xKey={xKey} series={series} ariaLabel={title} variant={variant}
      formatX={formatX} formatValue={formatValue} formatY={formatY} />
    <DataDetails>{table}</DataDetails>
  </>;
}
