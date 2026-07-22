import { StatCard } from "../shared/StatCard";

export function PromotionHeader({
  stats,
  notice,
  error,
  onCreate,
}: {
  stats: { active: number; inactive: number; used: number };
  notice: string;
  error: string;
  onCreate: () => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-headline-lg font-bold text-on-background">Quản lý khuyến mãi</h1>
        </div>
        <button
          onClick={onCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary shadow-sm"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Tạo voucher
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon="local_offer" label="Đang hoạt động" value={stats.active} />
        <StatCard icon="pause_circle" label="Tạm dừng" value={stats.inactive} />
        <StatCard icon="confirmation_number" label="Lượt đã dùng" value={stats.used} />
      </div>

      {(notice || error) && (
        <div className={`rounded-xl px-4 py-3 ${error ? "bg-error/10 text-error" : "bg-emerald-100 text-emerald-700"}`}>
          {error || notice}
        </div>
      )}
    </>
  );
}
