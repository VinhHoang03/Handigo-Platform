import { AdminPageTitle, AdminRefreshButton } from "@/features/admin/components/shared/AdminPageHeader";
import { StatCard } from "../shared/StatCard";
import { PauseCircle, Plus, Tag, Ticket } from "lucide-react";
export function PromotionHeader({
  stats,
  onCreate,
  onRefresh,
  loading,
}: {
  stats: { active: number; inactive: number; used: number };
  notice: string;
  error: string;
  onCreate: () => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  return (
    <>
      <div className="admin-page-header">
        <div>
          <AdminPageTitle title="Quản lý khuyến mãi" />
        </div>
        <button
          onClick={onCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary shadow-sm"
        >
          <Plus aria-hidden="true" size={20} />
          Tạo mã giảm giá
        </button>
      <AdminRefreshButton onRefresh={onRefresh} loading={loading} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Tag} label="Đang hoạt động" value={stats.active} />
        <StatCard icon={PauseCircle} label="Tạm dừng" value={stats.inactive} />
        <StatCard icon={Ticket} label="Lượt đã dùng" value={stats.used} />
      </div>

    </>
  );
}
