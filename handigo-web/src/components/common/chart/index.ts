/**
 * Điểm vào duy nhất cho biểu đồ.
 *
 * Page và feature component import từ đây, KHÔNG import `recharts` trực tiếp.
 * Hai lý do: giữ thư viện nằm trong chunk lazy-load của admin/provider để không
 * đội bundle của khách, và buộc màu series đi qua token M3 trong `chart-theme`.
 */
export { ChartCard } from "./ChartCard";
export { ChartA11yTable } from "./ChartA11yTable";
export { DonutChart, type DonutSlice } from "./DonutChart";
export { LineChart, type LineSeries } from "./LineChart";
export { BarChart, type BarDatum } from "./BarChart";
export {
  chartMoney,
  chartCompactMoney,
  chartNumber,
  monthLabel,
  shortMonthLabel,
  dayLabel,
  truncateLabel,
} from "./chart-format";
export { toneChartColors, categoricalChartColors, colorAtIndex } from "./chart-theme";
