import { AsyncState } from '@/components/common/AsyncState';
import { Skeleton } from '@/components/common/Skeleton';
import { money } from './wallet-formatters';

export interface WalletStat {
  icon: string;
  label: string;
  value: number;
  strong?: boolean;
}

interface WalletStatsCardsProps {
  stats: WalletStat[];
  loading: boolean;
  error: string;
  onRetry: () => void;
}

const statsSkeleton = (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    {Array.from({ length: 4 }, (_, index) => (
      <div key={index} className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
        <Skeleton className="h-11 w-11" rounded="rounded-lg" />
        <Skeleton className="mt-4 h-4 w-24" />
        <Skeleton className="mt-2 h-7 w-32" />
      </div>
    ))}
  </div>
);

export function WalletStatsCards({ stats, loading, error, onRetry }: WalletStatsCardsProps) {
  return (
    <AsyncState loading={loading} error={error} empty={false} onRetry={onRetry} skeleton={statsSkeleton}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <span className="material-symbols-outlined block text-2xl leading-none">{item.icon}</span>
            </div>
            <p className="mt-4 text-sm text-on-surface-variant">{item.label}</p>
            <p className={`${item.strong ? 'text-headline-md' : 'text-title-lg'} mt-1 font-bold tabular-nums text-on-surface`}>
              {money.format(item.value)}
            </p>
          </div>
        ))}
      </div>
    </AsyncState>
  );
}
