import { categoryMoney } from './category.helpers';
import { BellRing, Grid2X2, HardHat, type LucideIcon, TrendingUp } from "lucide-react";
interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
}

function StatCard({ icon: Icon, label, value, trend, trendUp }: StatCardProps) {
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
        <Icon aria-hidden="true" size={120} />
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
      <StatCard icon={HardHat} label="Tổng dịch vụ hoạt động" value={categoryMoney.format(totalServices)} trend="+12% so với tháng trước" trendUp />
      <StatCard icon={BellRing} label="Danh mục đang hoạt động" value={String(activeCount)} />
      <StatCard icon={Grid2X2} label="Tổng danh mục" value={String(total)} />
    </div>
  );
}
