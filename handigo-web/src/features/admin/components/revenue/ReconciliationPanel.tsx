import { money } from "./revenue-format";
import type { AdminRevenue } from "../../types/adminRevenue.types";

export function ReconciliationPanel({
  data,
  difference,
}: {
  data: AdminRevenue;
  difference: number;
}) {
  const rows: Array<[string, number]> = [
    ["Thu thành công qua hệ thống", data.collectedPaymentRevenue],
    ["Hoàn tiền", -data.refundedRevenue],
    ["Tổng giá trị giao dịch thanh toán trực tuyến", data.onlineCompletedRevenue],
    ["Tổng giá trị giao dịch thanh toán tiền mặt", data.cashCompletedRevenue],
    ["Tiền đặt cọc đã thu", data.depositRevenue],
  ];

  return (
    <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5">
      <h2 className="text-title-lg font-bold">Thu tiền, hoàn tiền và đối soát</h2>
      <dl className="mt-5 space-y-4">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 border-b border-outline-variant/30 pb-3">
            <dt className="text-sm text-on-surface-variant">{label}</dt>
            <dd className="tabular-nums font-bold">{money.format(value)}</dd>
          </div>
        ))}
      </dl>
      <div className={"mt-5 rounded-xl p-4 text-sm " + (Math.abs(difference) < 1 ? "bg-success-container text-on-success-container" : "bg-warning-container text-on-warning-container")}>
        <p className="tabular-nums font-bold">Chênh lệch đối soát: {money.format(difference)}</p>
        <p className="mt-1">Đối chiếu giá trị đơn hoàn tất với phí nền tảng và thu nhập nhà cung cấp. Chênh lệch cần được kiểm tra theo thời điểm ghi nhận, chưa phải kết luận sai số liệu.</p>
        <a href="#revenue-payments" className="mt-2 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">Xem các khoản thu và hoàn tiền</a>
      </div>
    </article>
  );
}
