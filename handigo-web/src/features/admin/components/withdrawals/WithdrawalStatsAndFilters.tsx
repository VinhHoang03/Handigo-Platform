import { RefreshCw } from "lucide-react";
import { TableToolbar } from "@/components/common/dashboard/TableToolbar";
import type { WithdrawalStatus } from "../../types/admin.types";
import { withdrawalFilterOptions } from "./withdrawal-table-columns";

interface WithdrawalStatsAndFiltersProps {
  stats: Array<{ label: string; value: string }>;
  /** Giá trị hiện tại từ `AdminQuery.status` (`string`) — so khớp với `option.value` khi render. */
  statusValue: string;
  onStatusChange: (value: WithdrawalStatus | "") => void;
  loading: boolean;
  onRefresh: () => void;
}

/** Ô thống kê + bộ lọc trạng thái/nút làm mới, tách khỏi trang để giữ dưới 200 dòng. */
export function WithdrawalStatsAndFilters({
  stats,
  statusValue,
  onStatusChange,
  loading,
  onRefresh,
}: WithdrawalStatsAndFiltersProps) {
  return (
    <>
      <section className="grid gap-3 sm:grid-cols-3">
        {stats.map((item) => (
          <div key={item.label} className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-4">
            <p className="text-sm text-on-surface-variant">{item.label}</p>
            <p className="mt-1 text-title-lg font-bold text-on-surface">{item.value}</p>
          </div>
        ))}
      </section>

      <TableToolbar
        filters={
          <div className="flex flex-wrap gap-2">
            {withdrawalFilterOptions.map((option) => {
              const active = statusValue === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => onStatusChange(option.value)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-primary text-on-primary shadow-[0_8px_18px_rgba(53,37,205,0.18)]"
                      : "border border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        }
        actions={
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            Làm mới
          </button>
        }
      />
    </>
  );
}
