import { ChartCard, chartMoney } from "@/components/common/chart";
import { adminOperationsApi } from "../../api/adminOperations.api";
import type { AdminProviderAnalytics } from "../../types/adminOperations.types";
import type { RevenueQuery } from "../../types/adminRevenue.types";
import { AsyncState } from "@/components/common/AsyncState";
import { useAdminRead } from "../../hooks/useAdminRead";
import { Link } from "react-router-dom";

export function RevenueProviderRanking({ range, providers }: { range: RevenueQuery; providers?: AdminProviderAnalytics }) {
  const key = range.fromDate + ':' + range.toDate;
  const state = useAdminRead(key, signal => adminOperationsApi.providerAnalytics({ ...range, topLimit: 5 }, signal), { delay: 0, enabled: !providers, errorMessage: "Không thể tải xếp hạng nhà cung cấp." });
  const data = providers ?? (state.dataKey === key ? state.data : null);
  return <AsyncState loading={!data && state.loading} error={state.error} onRetry={state.reload}>
    {data && <ChartCard title="Bảng xếp hạng doanh thu theo thợ" description="Top 5 theo thu nhập ròng được ghi nhận trong khoảng đã chọn. Điểm và số đơn hoàn tất là lũy kế hồ sơ."
      isEmpty={!data.topProvidersByRevenue.length}>
        <ol className="divide-y divide-outline-variant/30">
          {data.topProvidersByRevenue.map((item, index) => <li key={item.providerId} className="flex flex-wrap items-center gap-3 py-4 first:pt-0">
            <span aria-label={`Hạng ${index + 1}`} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white ${index === 0 ? 'bg-primary' : index === 1 ? 'bg-emerald-500' : 'bg-amber-500'}`}>{index + 1}</span>
            <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{item.fullName || 'Thợ chưa có tên'}</p><p className="mt-1 text-xs text-on-surface-variant">Mã thợ: {item.providerId.slice(-6).toUpperCase()}</p></div>
            <div className="text-right"><p className="text-sm font-semibold">{item.averageRating.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} <span aria-label="sao" className="text-amber-500">★</span></p><p className="mt-1 text-xs text-on-surface-variant">{item.completedOrders} đơn hoàn tất</p></div>
            <strong className="min-w-28 text-right text-sm text-emerald-700">{chartMoney.format(item.revenue)}</strong>
          </li>)}
        </ol>
        <Link to="/admin/users" className="mt-3 inline-block text-xs font-medium text-primary hover:underline">Quản lý người dùng & thợ →</Link>
    </ChartCard>}
  </AsyncState>;
}
