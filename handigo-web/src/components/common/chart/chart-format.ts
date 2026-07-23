/**
 * Định dạng dùng chung cho biểu đồ. Gom về một chỗ để trục, tooltip và bảng dữ
 * liệu ẩn không hiển thị cùng một con số theo ba kiểu khác nhau.
 */

export const chartMoney = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

/** Rút gọn cho nhãn trục — "1,2 Tr" thay vì "1.200.000 ₫". */
export const chartCompactMoney = new Intl.NumberFormat("vi-VN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const chartNumber = new Intl.NumberFormat("vi-VN");

/** `"2026-07"` → `"Tháng 7/2026"` */
export const monthLabel = (value: string) => {
  const [year, month] = value.split("-");
  return `Tháng ${Number(month)}/${year}`;
};

/** `"2026-07"` → `"T7"` — bản ngắn cho nhãn trục khi nhiều điểm. */
export const shortMonthLabel = (value: string) => `T${Number(value.split("-")[1])}`;

/** `"2026-07-20"` → `"20/07"` */
export const dayLabel = (value: string) => {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
};

/** Cắt tên dài để nhãn trục không tràn; tooltip vẫn giữ tên đầy đủ. */
export const truncateLabel = (value: string, max = 18) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;
