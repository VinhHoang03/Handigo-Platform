import { useEffect, useState } from "react";
import { SelectableChartCard, CategoryChartView, rankingChartOptions, chartMoney, chartCompactMoney } from "@/components/common/chart";
import { adminOperationsApi } from "../../api/adminOperations.api";
import type { AdminProviderAnalytics } from "../../types/adminOperations.types";
import type { RevenueQuery } from "../../types/adminRevenue.types";
import { AsyncState } from "@/components/common/AsyncState";
import { getErrorMessage } from "@/utils/apiError";

export function RevenueProviderRanking({ range }: { range: RevenueQuery }) {
  const [data, setData] = useState<AdminProviderAnalytics | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void adminOperationsApi.providerAnalytics({ ...range, topLimit: 5 }).then(result => { if (active) { setData(result); setError(""); } })
      .catch(cause => { if (active) setError(getErrorMessage(cause, "Không thể tải xếp hạng nhà cung cấp.")); });
    return () => { active = false; };
  }, [range, attempt]);
  return <AsyncState loading={!data && !error} error={error} onRetry={() => setAttempt(value => value + 1)}>
    {data && <SelectableChartCard storageKey="dashboard.provider-revenue" title="Nhà cung cấp theo doanh thu" description="Năm nhà cung cấp có doanh thu cao nhất trong khoảng đã chọn."
      data={data} onReload={() => adminOperationsApi.providerAnalytics({ ...range, topLimit: 5 })} isEmpty={value => !value.topProvidersByRevenue.length} options={rankingChartOptions} defaultType="horizontal">
      {(value, type) => <CategoryChartView title="Nhà cung cấp theo doanh thu" data={value.topProvidersByRevenue.map(item => ({ label: item.fullName || item.email || 'Nhà cung cấp', value: item.revenue }))}
        type={type} formatValue={number => chartMoney.format(number)} formatAxisValue={number => chartCompactMoney.format(number)} />}
    </SelectableChartCard>}
  </AsyncState>;
}
