import { useId, useState } from 'react';
import type { NearbyProvider } from '@/features/customer-service/api/customerService.api';
import { BookingProviderDetails } from './BookingProviderDetails';

export function QuickRebookingProviderPicker({ providers, selectedId, oldProvider, disabled, loading, onChange, onBusyChange }: {
  providers: NearbyProvider[];
  selectedId?: string;
  oldProvider?: { id: string; name: string };
  disabled: boolean;
  loading: boolean;
  onChange: (id?: string, name?: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const groupId = useId();
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const viewingProvider = providers.find(provider => provider.id === viewingId);
  const canSelectProfile = !disabled && !loading && Boolean(viewingProvider);
  const closeProfile = () => { setViewingId(null); onBusyChange(false); };
  const choices = providers.map(provider => ({ id: provider.id, name: provider.user.fullName, available: true }));
  if (oldProvider && !providers.some(provider => provider.id === oldProvider.id)) {
    choices.unshift({ ...oldProvider, available: false });
  }

  return <>
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="mb-2 font-semibold">Thợ thực hiện</legend>
      <details open={expanded && !disabled} onToggle={event => setExpanded(event.currentTarget.open)}
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setExpanded(false); }}
        className="relative rounded-xl border border-outline-variant bg-surface">
        <summary aria-label="Thợ thực hiện" onClick={event => { if (disabled) event.preventDefault(); }}
          className="min-h-11 cursor-pointer px-3 py-2 text-sm font-semibold">
          {selectedId ? choices.find(provider => provider.id === selectedId)?.name ?? 'Thợ đã chọn' : 'Handigo điều phối'}
        </summary>
        {expanded && !disabled && <div className="absolute inset-x-0 top-full z-20 mt-1 space-y-2 rounded-xl border border-outline-variant bg-surface p-2 shadow-lg">
      <label className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border p-3 ${!selectedId ? 'border-primary bg-primary/5' : 'border-outline-variant'}`}>
        <input type="radio" name={groupId} checked={!selectedId} onChange={() => { if (!disabled) { onChange(undefined, undefined); setExpanded(false); } }} className="accent-primary" />
        <span className="font-semibold">Handigo điều phối</span>
      </label>
      <div className="max-h-60 space-y-2 overflow-y-auto">
        {choices.map(provider => <div key={provider.id} className={`flex items-center gap-2 rounded-xl border p-3 ${selectedId === provider.id ? 'border-primary bg-primary/5' : 'border-outline-variant'}`}>
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
            <input type="radio" name={groupId} checked={selectedId === provider.id} disabled={!provider.available || disabled || loading}
              onChange={() => { if (!disabled && !loading && provider.available) { onChange(provider.id, provider.name); setExpanded(false); } }} className="accent-primary" />
            <span className="min-w-0 text-sm"><span className="block font-semibold">{provider.id === oldProvider?.id ? 'Thợ cũ: ' : ''}{provider.name}</span>
              {!provider.available && <span className="text-xs text-on-surface-variant">Chưa khả dụng</span>}
            </span>
          </label>
          <button type="button" aria-label={`Xem hồ sơ thợ ${provider.name}`} onClick={() => {
            if (disabled) return;
            setExpanded(false); setViewingId(provider.id); onBusyChange(true);
          }} className="min-h-11 shrink-0 px-1 text-xs font-semibold text-primary underline">Xem hồ sơ</button>
        </div>)}
      </div>
      {loading && <p role="status" className="text-xs text-on-surface-variant">Đang tìm thợ phù hợp...</p>}
      {!loading && !providers.length && <p role="status" className="text-xs text-on-surface-variant">Chưa có thợ phù hợp với thông tin đã chọn.</p>}
        </div>}
      </details>
    </fieldset>
    {viewingId && <BookingProviderDetails key={viewingId} providerId={viewingId} canSelect={canSelectProfile} onClose={closeProfile}
      onSelect={() => {
        if (!canSelectProfile || !viewingProvider) return;
        onChange(viewingProvider.id, viewingProvider.user.fullName); closeProfile();
      }} />}
  </>;
}
