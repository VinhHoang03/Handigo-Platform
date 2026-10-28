export const categoryChartOptions = [
  { value: "donut", label: "Vành khuyên" },
  { value: "pie", label: "Hình tròn" },
  { value: "horizontal", label: "Thanh ngang" },
  { value: "vertical", label: "Cột đứng" },
  { value: "table", label: "Bảng số liệu" },
];

export const rankingChartOptions = categoryChartOptions.filter((option) =>
  ["horizontal", "vertical", "table"].includes(option.value),
);

export const trendChartOptions = [
  { value: "line", label: "Đường" },
  { value: "step", label: "Đường bậc thang" },
  { value: "area", label: "Miền" },
  { value: "bar", label: "Cột đứng" },
  { value: "table", label: "Bảng số liệu" },
];

export const revenueChartOptions = [
  ...trendChartOptions.filter((option) => option.value !== "table"),
  { value: "composed", label: "Cột kết hợp đường" },
  { value: "stacked", label: "Cột chồng thành phần" },
  { value: "percent", label: "Cột chồng 100%" },
  { value: "table", label: "Bảng số liệu" },
];
