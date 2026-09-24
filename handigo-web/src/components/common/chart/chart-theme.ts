import type { StatusTone } from "@/utils/statusTone";

/**
 * Màu và kiểu dáng dùng chung cho mọi biểu đồ.
 *
 * Recharts render SVG nên nhận thẳng `var(--color-*)` — nhờ vậy biểu đồ ăn theo
 * token M3 và mọi thay đổi token về sau, không cần bảng màu thứ hai. Đây là lý
 * do chọn Recharts thay vì thư viện dựa trên canvas.
 */

/** Màu theo tông ngữ nghĩa — dùng khi dữ liệu là trạng thái. */
export const toneChartColors: Record<StatusTone, string> = {
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  error: "var(--color-error)",
  info: "var(--color-secondary)",
  neutral: "var(--color-outline)",
  brand: "var(--color-primary)",
};

/**
 * Dãy màu xoay vòng cho dữ liệu KHÔNG phải trạng thái (danh mục, provider...).
 *
 * Tiêu chí chọn là **tách biệt sắc độ**, không phải "màu nào hợp thương hiệu".
 * Bản đầu dùng `primary` + `primary-container` + `surface-tint` (#3525cd,
 * #4f46e5, #4d44e3) — ba sắc chàm gần trùng nhau, nên hai lát bánh cạnh nhau
 * trên biểu đồ tròn nhìn như một. Tương tự `secondary`/`on-secondary-container`
 * (#00687a, #006172) và `tertiary`/`tertiary-container` (#7e3000, #a44100).
 *
 * Dãy dưới đây mỗi màu một vùng sắc riêng. Có dùng cả token `success`/`warning`/
 * `error` cho dữ liệu phi trạng thái: ở đây chúng chỉ là màu, không mang nghĩa
 * trạng thái, và phân biệt được lát bánh quan trọng hơn sự thuần khiết ngữ nghĩa.
 */
export const categoricalChartColors = [
  "var(--color-primary)", // chàm
  "var(--color-secondary)", // xanh mòng két
  "var(--color-tertiary)", // nâu cháy
  "var(--color-success)", // xanh lá
  "var(--color-warning)", // ô liu
  "var(--color-error)", // đỏ
  "var(--color-secondary-fixed-dim)", // xanh lơ nhạt
  "var(--color-inverse-primary)", // tím lavender nhạt
];

export const colorAtIndex = (index: number) =>
  categoricalChartColors[index % categoricalChartColors.length];

export const chartAxisStyle = {
  stroke: "var(--color-outline-variant)",
  fontSize: 12,
  fill: "var(--color-on-surface-variant)",
} as const;

export const chartGridStroke = "var(--color-outline-variant)";

/** Kiểu hộp tooltip — Recharts nhận object style thuần, không nhận class. */
export const chartTooltipStyle = {
  contentStyle: {
    background: "var(--color-surface-container-lowest)",
    border: "1px solid var(--color-outline-variant)",
    borderRadius: "0.75rem",
    fontSize: "12px",
    color: "var(--color-on-surface)",
  },
  labelStyle: { color: "var(--color-on-surface-variant)", marginBottom: 4 },
  itemStyle: { color: "var(--color-on-surface)" },
} as const;
