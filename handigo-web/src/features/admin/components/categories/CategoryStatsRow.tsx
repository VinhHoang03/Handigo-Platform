import { categoryMoney } from './category.helpers';
import { TrendingUp } from "lucide-react";

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
}

function StatCard({ icon, label, value, trend, trendUp }: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/10 bg-primary-container/5 p-6">
      <div className="relative z-10">
        <p className="font-label-md uppercase tracking-wide text-on-surface-variant">{label}</p>
        <p className="mt-2 font-headline-md text-headline-md font-bold">{value}</p>
        {trend && (
          <div className={`mt-4 flex items-center gap-2 text-label-sm ${trendUp ? 'text-success' : 'text-on-surface-variant'}`}>
            {trendUp && <TrendingUp aria-hidden="true" size={18} />}
            <span>{trend}</span>
          </div>
        )}
      </div>
      <div className="absolute -bottom-4 -right-4 opacity-5">
        <span className="material-symbols-outlined text-[120px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          {icon}
        </span>
      </div>
    </div>
  );
}

interface CategoryStatsRowProps {
  totalServices: number;
  activeCount: number;
  total: number;
}

/** Hàng 3 thẻ thống kê phía trên bảng danh mục. */
export function CategoryStatsRow({ totalServices, activeCount, total }: CategoryStatsRowProps) {
  return (
    <div className="grid gap-gutter sm:grid-cols-3">
      <StatCard icon="construction" label="Tổng dịch vụ hoạt động" value={categoryMoney.format(totalServices)} trend="+12% so với tháng trước" trendUp />
      <StatCard icon="notifications_active" label="Danh mục đang hoạt động" value={String(activeCount)} />
      <StatCard icon="category" label="Tổng danh mục" value={String(total)} />
    </div>
  );
}
