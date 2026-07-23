/** Thẻ số liệu nhỏ dùng lại giữa các trang admin (cấu hình hệ thống, khuyến mãi...). */
export function StatCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <span className="material-symbols-outlined block text-[24px] leading-none">
          {icon}
        </span>
      </span>
      <div>
        <p className="text-sm text-on-surface-variant">{label}</p>
        <p className="text-headline-md font-bold tabular-nums">{value}</p>
      </div>
    </div>
  );
}
