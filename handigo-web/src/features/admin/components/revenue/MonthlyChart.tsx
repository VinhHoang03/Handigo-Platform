import { LineChart, chartCompactMoney, chartMoney, monthLabel } from "@/components/common/chart";
import type { MonthlyRevenue } from "./revenue-format";

/**
 * Trước đây mỗi tháng là ba thanh ngang xếp chồng nhau, nên không so sánh được
 * xu hướng giữa các tháng — mắt phải nhảy dọc để ghép cùng một series. Đường ba
 * series đọc được xu hướng ngay; đây là đổi kiểu biểu đồ có lý do, không chỉ
 * đổi cách vẽ.
 */
export function MonthlyChart({ rows }: { rows: MonthlyRevenue[] }) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-outline-variant p-8 text-center text-on-surface-variant">
        Chưa có đơn hoàn tất trong kỳ đã chọn.
      </div>
    );
  }

  return (
    <LineChart
      data={rows.map((row) => ({ ...row }))}
      xKey="month"
      ariaLabel="Cơ cấu doanh thu theo tháng"
      height={280}
      formatX={monthLabel}
      formatValue={(value) => chartMoney.format(value)}
      formatY={(value) => chartCompactMoney.format(value)}
      series={[
        { dataKey: "gross", name: "GMV hoàn tất", color: "var(--color-primary)" },
        { dataKey: "provider", name: "Thu nhập provider", color: "var(--color-secondary)" },
        { dataKey: "platform", name: "Phí nền tảng", color: "var(--color-success)" },
      ]}
    />
  );
}
