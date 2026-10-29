import { Link } from 'react-router-dom';
import { ChartCard, chartMoney } from '@/components/common/chart';
import type { AdminRevenueInsights } from '../../types/adminRevenue.types';

const percentage = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const colors = ['bg-primary', 'bg-violet-400', 'bg-emerald-500', 'bg-amber-500', 'bg-cyan-500'];

export function RevenueServiceBreakdown({ data, monthly }: { data: AdminRevenueInsights; monthly: boolean }) {
  return <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
    <ChartCard title="Doanh thu theo dịch vụ" description="Tổng giá trị dịch vụ hoàn tất và mức tăng trưởng."
      action={<span className="rounded-full bg-primary/5 px-2 py-1 text-xs text-primary">{data.services.filter(row => row.revenue > 0).length} dịch vụ</span>}
      isEmpty={!data.services.length} emptyMessage="Chưa có doanh thu dịch vụ để so sánh.">
      <div className="max-h-96 space-y-5 overflow-y-auto pr-1">
        {data.services.map((row, index) => <div key={row.serviceId ?? 'unknown'}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="flex min-w-0 flex-wrap items-center gap-2"><span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-sm ${colors[index % colors.length]}`} />
              <span className="font-medium">{row.name}</span>
              <span className={`rounded px-1.5 py-0.5 text-xs ${row.changePercent === null || row.changePercent >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {row.changePercent === null ? row.revenue ? 'Mới phát sinh' : 'Chưa phát sinh' : `${row.changePercent > 0 ? '+' : ''}${percentage.format(row.changePercent)}%`}
              </span>
            </div>
            <span className="shrink-0 text-right"><strong>{chartMoney.format(row.revenue)}</strong> <span className="text-xs text-on-surface-variant">({percentage.format(row.share)}%)</span></span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container-high"><div className={`h-full rounded-full ${colors[index % colors.length]}`} style={{ width: `${Math.min(100, row.share)}%` }} /></div>
          <p className="mt-1 text-xs text-on-surface-variant">{row.categoryName} · {monthly ? 'Tháng trước' : 'Khoảng trước'}: {chartMoney.format(row.previous)}</p>
        </div>)}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/30 pt-3 text-xs">
        <span>Tổng doanh thu dịch vụ: <strong>{chartMoney.format(data.totalServiceRevenue)}</strong></span>
        <Link to="/admin/categories" className="font-medium text-primary hover:underline">Quản lý danh mục & dịch vụ →</Link>
      </div>
    </ChartCard>
    <ChartCard title="Top 5 dịch vụ hoàn tất" description="Theo số đơn có ghi nhận doanh thu trong khoảng đã chọn."
      isEmpty={!data.topServices.length} emptyMessage="Chưa có dịch vụ hoàn tất trong khoảng đã chọn.">
      <ol className="divide-y divide-outline-variant/30">
        {data.topServices.map((row, index) => <li key={row.serviceId ?? 'unknown'} className="flex items-start justify-between gap-3 py-3 first:pt-0">
          <div className="min-w-0"><p className="text-sm font-semibold"><span className="text-primary">{index + 1}. </span>{row.name}</p>
            <p className="mt-1 text-xs text-on-surface-variant">{chartMoney.format(row.revenue)} · {row.categoryName}</p></div>
          <span className="shrink-0 text-sm font-bold text-primary">{row.completedOrders} đơn</span>
        </li>)}
      </ol>
    </ChartCard>
  </div>;
}
