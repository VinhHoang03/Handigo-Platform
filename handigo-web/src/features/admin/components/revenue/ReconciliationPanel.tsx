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
    ["GMV thanh toán online", data.onlineCompletedRevenue],
    ["GMV thanh toán tiền mặt", data.cashCompletedRevenue],
    ["Tiền đặt cọc đã thu", data.depositRevenue],
  ];

  return (
    <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5">
      <h2 className="text-title-lg font-bold">Đối soát trong kỳ</h2>
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
        <p className="mt-1">GMV = phí nền tảng + thu nhập provider. Số liệu chuẩn khi chênh lệch bằng 0.</p>
      </div>
    </article>
  );
}
