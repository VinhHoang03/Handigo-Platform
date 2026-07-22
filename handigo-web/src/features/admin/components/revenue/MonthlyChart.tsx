import { money, monthLabel, type MonthlyRevenue } from "./revenue-format";

export function MonthlyChart({ rows }: { rows: MonthlyRevenue[] }) {
  const maxAmount = Math.max(...rows.map((row) => row.gross), 1);

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-outline-variant p-8 text-center text-on-surface-variant">
        Chưa có đơn hoàn tất trong kỳ đã chọn.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {rows.map((row) => (
        <div key={row.month}>
          <div className="mb-2 flex items-center justify-between gap-4 text-sm">
            <span className="font-semibold">{monthLabel(row.month)}</span>
            <span className="tabular-nums text-on-surface-variant">{money.format(row.gross)}</span>
          </div>
          <div className="space-y-1.5">
            <div
              className="h-3 rounded-full bg-primary"
              style={{ width: Math.max((row.gross / maxAmount) * 100, 1) + "%" }}
              title={"GMV: " + money.format(row.gross)}
            />
            <div
              className="h-2.5 rounded-full bg-secondary"
              style={{ width: Math.max((row.provider / maxAmount) * 100, 1) + "%" }}
              title={"Thu nhập provider: " + money.format(row.provider)}
            />
            <div
              className="h-2.5 rounded-full bg-success"
              style={{ width: Math.max((row.platform / maxAmount) * 100, 1) + "%" }}
              title={"Phí nền tảng: " + money.format(row.platform)}
            />
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-4 text-xs text-on-surface-variant">
        <span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-primary" />GMV hoàn tất</span>
        <span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-secondary" />Thu nhập provider</span>
        <span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-success" />Phí nền tảng</span>
      </div>
    </div>
  );
}
