import { useEffect, useState } from 'react';
import { AsyncState } from '@/components/common/AsyncState';
import { getErrorMessage } from '@/utils/apiError';
import { adminRevenueApi } from '../../api/adminRevenue.api';
import type { AdminRevenueInsights, RevenueQuery } from '../../types/adminRevenue.types';
import { RevenueServiceBreakdown } from './RevenueServiceBreakdown';
import { RevenueBehaviorRisks } from './RevenueBehaviorRisks';
import { RevenuePayments } from './RevenuePayments';
import { RevenueProviderRanking } from './RevenueProviderRanking';

export function RevenueOperationsInsights({ range, monthly }: {
  range: RevenueQuery; monthly: boolean;
}) {
  const [data, setData] = useState<AdminRevenueInsights | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    adminRevenueApi.getInsights(range).then(value => { if (active) { setData(value); setError(''); } })
      .catch(cause => { if (active) setError(getErrorMessage(cause, 'Không thể tải doanh thu dịch vụ và dòng tiền.')); });
    return () => { active = false; };
  }, [range, attempt]);
  return <AsyncState loading={!data && !error} error={error} onRetry={() => setAttempt(value => value + 1)}>
    {data && <div className="space-y-5">
      <RevenueServiceBreakdown data={data} monthly={monthly} />
      <div><p className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">Giám sát đối tác thợ</p><h3 className="mt-1 text-title-lg font-bold">Xếp hạng doanh thu & cảnh báo ứng xử</h3></div>
      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <RevenueProviderRanking range={range} />
        <RevenueBehaviorRisks risks={data.behaviorRisks} />
      </div>
      <RevenuePayments range={range} channels={data.channels} />
    </div>}
  </AsyncState>;
}
