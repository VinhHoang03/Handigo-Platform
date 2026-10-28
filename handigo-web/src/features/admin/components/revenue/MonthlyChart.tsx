import { SeriesChartView, chartCompactMoney, chartMoney, monthLabel } from "@/components/common/chart";
import type { MonthlyRevenue } from "./revenue-format";

export function MonthlyChart({ rows, type = "line" }: { rows: MonthlyRevenue[]; type?: string }) {
  const componentsOnly = type === "stacked" || type === "percent";
  const series = [
    ...(!componentsOnly ? [{ dataKey: "gross", name: "Tổng giá trị giao dịch hoàn tất", color: "var(--color-primary)" }] : []),
    { dataKey: "provider", name: "Thu nhập nhà cung cấp", color: "var(--color-secondary)" },
    { dataKey: "platform", name: "Phí nền tảng", color: "var(--color-success)" },
  ];
  return <>
    {componentsOnly && <p className="mb-3 text-sm text-on-surface-variant">Chỉ chồng thu nhập nhà cung cấp và phí nền tảng; không cộng thêm tổng giá trị giao dịch. Tỷ trọng tính trên tổng hai thành phần.</p>}
    <SeriesChartView title="Cơ cấu doanh thu theo tháng" data={rows.map((row) => ({ ...row }))}
      type={type} xKey="month" series={series} formatX={monthLabel}
      formatValue={(value) => chartMoney.format(value)} formatY={(value) => chartCompactMoney.format(value)} />
  </>;
}
