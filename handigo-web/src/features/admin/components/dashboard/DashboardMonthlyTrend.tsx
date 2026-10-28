import { useEffect, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AsyncState } from '@/components/common/AsyncState';
import { ChartDataTable, SelectableChartCard, chartCompactMoney, chartMoney, chartNumber, monthLabel } from '@/components/common/chart';
import { ChartA11yTable } from '@/components/common/chart/ChartA11yTable';
import { chartAxisStyle, chartGridStroke, chartTooltipStyle } from '@/components/common/chart/chart-theme';
import { usePrefersReducedMotion } from '@/components/common/chart/use-prefers-reduced-motion';
import { getErrorMessage } from '@/utils/apiError';
import { adminDashboardApi } from '../../api/adminDashboard.api';
import type { AdminMonthlyTrend } from '../../types/adminDashboard.types';

const options = [
  { value: 'composed', label: 'Cột số đơn và đường doanh thu' },
  { value: 'bar', label: 'Hai cột: số đơn và doanh thu' },
  { value: 'table', label: 'Bảng số liệu' },
];

export function MonthlyOperationsChart({ points, type }: { points: AdminMonthlyTrend['points']; type: string }) {
  const reducedMotion = usePrefersReducedMotion();
  const columns = ['Tháng', 'Số đơn', 'Doanh thu hệ thống (₫)'];
  const rows = points.map(item => [monthLabel(item.month), chartNumber.format(item.orders), chartMoney.format(item.platformRevenue)]);
  if (type === 'table') return <ChartDataTable caption="Số đơn và doanh thu theo tháng" columns={columns} rows={rows} />;
  return <>
    <div className="min-w-0 overflow-x-auto" role="img" aria-label="Cột số đơn theo trục trái, doanh thu hệ thống theo trục phải">
      <div style={{ minWidth: points.length * 72 }}>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={points} margin={{ top: 32, right: 12, left: 4, bottom: 8 }}>
            <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickFormatter={monthLabel} tick={chartAxisStyle} />
            <YAxis yAxisId="orders" allowDecimals={false} width={52} domain={[0, 'auto']} tick={chartAxisStyle}
              label={{ value: 'Số đơn', position: 'insideTopLeft', offset: -24, fill: chartAxisStyle.fill }} />
            <YAxis yAxisId="revenue" orientation="right" width={76} domain={[0, 'auto']} tickFormatter={value => chartCompactMoney.format(Number(value))} tick={chartAxisStyle}
              label={{ value: 'Doanh thu (₫)', position: 'insideTopRight', offset: -24, fill: chartAxisStyle.fill }} />
            <Tooltip {...chartTooltipStyle} labelFormatter={value => monthLabel(String(value))}
              formatter={(value, name) => [name === 'Số đơn' ? `${chartNumber.format(Number(value))} đơn` : chartMoney.format(Number(value)), String(name)]} />
            <Bar yAxisId="orders" dataKey="orders" name="Số đơn" fill="var(--color-primary)" maxBarSize={32} isAnimationActive={!reducedMotion} />
            {type === 'bar'
              ? <Bar yAxisId="revenue" dataKey="platformRevenue" name="Doanh thu hệ thống" fill="var(--color-secondary)" maxBarSize={32} isAnimationActive={!reducedMotion} />
              : <Line yAxisId="revenue" type="monotone" dataKey="platformRevenue" name="Doanh thu hệ thống" stroke="var(--color-secondary)" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={!reducedMotion} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
    <ul className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-on-surface-variant">
      <li className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-primary" aria-hidden="true" />Số đơn · trục trái</li>
      <li className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-secondary" aria-hidden="true" />Doanh thu hệ thống (₫) · trục phải</li>
    </ul>
    <ChartA11yTable caption="Số đơn và doanh thu theo tháng" columns={columns} rows={rows.map((cells, index) => ({ key: points[index].month, cells }))} />
  </>;
}

export function DashboardMonthlyTrend({ fromDate, toDate }: { fromDate?: string; toDate?: string }) {
  const [data, setData] = useState<AdminMonthlyTrend | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    adminDashboardApi.monthlyTrend({ fromDate, toDate })
      .then(value => { if (active) setData(value); })
      .catch((cause: unknown) => { if (active) setError(getErrorMessage(cause, 'Không thể tải số đơn và doanh thu theo tháng.')); });
    return () => { active = false; };
  }, [fromDate, toDate, attempt]);
  return <AsyncState loading={!data && !error} error={error} onRetry={() => { setError(''); setAttempt(value => value + 1); }}>
    {data && <SelectableChartCard storageKey="dashboard.monthly-orders" title="Số đơn và doanh thu hệ thống theo tháng"
      description="Lịch sử tối thiểu 6 tháng · Doanh thu hệ thống là phí nền tảng thực thu."
      data={data} onReload={() => adminDashboardApi.monthlyTrend({ fromDate, toDate })} isEmpty={value => !value.points.length}
      options={options} defaultType="composed">
      {(value, type) => <MonthlyOperationsChart points={value.points} type={type} />}
    </SelectableChartCard>}
  </AsyncState>;
}
