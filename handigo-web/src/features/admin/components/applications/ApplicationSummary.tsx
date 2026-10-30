import type { AdminQuery } from '../../types/admin.types';
import { applicationSummaryFilters } from './application-summary.utils';

export function ApplicationSummary({ query, counts, loading, onChange }: {
  query: AdminQuery;
  counts: number[] | null;
  loading: boolean;
  onChange: (query: AdminQuery) => void;
}) {
  return <section aria-label="Thống kê hồ sơ và lọc nhanh" aria-busy={loading}>
    <div className="application-summary-grid">
      {applicationSummaryFilters.map(({ key, label, status, applicationType, icon: Icon, tone }, index) => {
        const active = (query.status || '') === status && (query.applicationType || '') === applicationType;
        return <button key={key} type="button" className={`application-summary-card application-summary-card--${tone}`}
          aria-pressed={active} onClick={() => onChange({ ...query, status, applicationType, page: 1 })}>
          <span className="min-w-0"><span className="block text-xs font-medium">{label}</span>
            <span className="mt-1 block text-xl font-bold tabular-nums">{loading ? '…' : counts ? counts[index].toLocaleString('vi-VN') : '—'}</span>
          </span>
          <span className="application-summary-icon"><Icon size={18} aria-hidden="true" /></span>
        </button>;
      })}
    </div>
  </section>;
}
