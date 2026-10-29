import { useEffect, useState } from 'react';
import { providerDashboardApi, type ProviderEarningPoint } from '../api/providerDashboard.api';
import { dateKey } from '../components/home/providerHome.utils';

export function useProviderCalendarRevenue(visibleMonth: Date) {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const fromDate = dateKey(new Date(year, month, 1));
  const toDate = dateKey(new Date(year, month + 1, 0));
  const [result, setResult] = useState<{
    fromDate: string;
    earnings: ProviderEarningPoint[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    providerDashboardApi.earnings(fromDate, toDate)
      .then(({ earningsByDay }) => {
        if (!cancelled) setResult({ fromDate, earnings: earningsByDay, error: null });
      })
      .catch(() => {
        if (!cancelled) setResult({ fromDate, earnings: [], error: 'Không thể tải doanh thu tháng này.' });
      });
    return () => { cancelled = true; };
  }, [fromDate, toDate]);

  const current = result?.fromDate === fromDate ? result : null;
  const earningsByDay = new Map((current?.earnings ?? []).map(({ day, amount }) => [day, amount]));
  return {
    earningsByDay,
    total: [...earningsByDay.values()].reduce((sum, amount) => sum + amount, 0),
    loading: !current,
    error: current?.error ?? null,
  };
}
