import { Link } from 'react-router-dom';
import { Flag } from 'lucide-react';
import { ChartCard } from '@/components/common/chart';
import type { AdminRevenueInsights } from '../../types/adminRevenue.types';

export function RevenueBehaviorRisks({ risks }: { risks: AdminRevenueInsights['behaviorRisks'] }) {
  return <ChartCard title="Cảnh báo rủi ro ứng xử" action={<span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">{risks.total} thợ cần xem xét</span>}>
    {risks.items.length ? <div className="space-y-3">
      {risks.items.map(item => <div key={item.userId} className={`rounded-xl border p-3 ${item.confirmed ? 'border-rose-100 bg-rose-50/60' : 'border-amber-100 bg-amber-50/60'}`}>
        <div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{item.fullName || 'Thợ chưa có tên'}</p><Flag size={15} aria-hidden="true" className="shrink-0 text-rose-500" /></div>
        <p className="mt-1 text-xs text-on-surface-variant">{item.reports} báo cáo · {item.confirmed} đã xác nhận · {item.reports - item.confirmed} chờ xem xét</p>
        <p className="mt-2 line-clamp-2 text-xs">{item.latestTitle}</p>
        <Link to={`/admin/cases?tab=reports&reportId=${encodeURIComponent(item.latestReportId)}`} className="mt-3 inline-flex min-h-9 items-center rounded-lg border border-outline-variant/40 bg-surface px-3 text-xs font-medium text-primary hover:bg-primary/5">Xem hồ sơ gần nhất →</Link>
      </div>)}
    </div> : <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Chưa có báo cáo ứng xử cần xem xét trong khoảng đã chọn.</p>}
  </ChartCard>;
}
