import { AsyncState } from '@/components/common/AsyncState';
import { useAdminRead } from '../../hooks/useAdminRead';
import { adminRevenueApi } from '../../api/adminRevenue.api';
import type { RevenueQuery } from '../../types/adminRevenue.types';
import type { AdminProviderAnalytics } from '../../types/adminOperations.types';
import { RevenueServiceBreakdown } from './RevenueServiceBreakdown';
import { RevenueBehaviorRisks } from './RevenueBehaviorRisks';
import { RevenuePayments } from './RevenuePayments';
import { RevenueProviderRanking } from './RevenueProviderRanking';

export function RevenueOperationsInsights({ range, monthly, providers }: {
  range: RevenueQuery; monthly: boolean; providers?: AdminProviderAnalytics;
}) {
  const key = range.fromDate + ':' + range.toDate;
  const state = useAdminRead(key, signal => adminRevenueApi.getInsights(range, signal), { delay: 0, errorMessage: 'Không thể tải doanh thu dịch vụ và dòng tiền.' });
  const data = state.dataKey === key ? state.data : null;
  return <AsyncState loading={state.loading && !data} error={state.error} onRetry={state.reload}>
    {data && <div className="space-y-5">
      <RevenueServiceBreakdown data={data} monthly={monthly} />
      <div><p className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">Giám sát đối tác thợ</p><h3 className="mt-1 text-title-lg font-bold">Xếp hạng doanh thu & cảnh báo ứng xử</h3></div>
      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <RevenueProviderRanking range={range} providers={providers} />
        <RevenueBehaviorRisks risks={data.behaviorRisks} />
      </div>
      <RevenuePayments range={range} channels={data.channels} />
    </div>}
  </AsyncState>;
}
