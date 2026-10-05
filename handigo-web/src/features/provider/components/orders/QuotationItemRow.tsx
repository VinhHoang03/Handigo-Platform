import { useToastFeedback } from "@/components/common/Toast";
import type { QuotationItem } from '../../types/providerOrder.types';
import { formatMoney } from '../../utils/providerOrder.utils';
import { quotationItemTypes, type QuotationFormItem } from './quotationForm.types';
import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from 'react';
import { quotationAgentApi } from '../../api/quotationAgent.api';
import type { QuotationHistoryItem } from '../../types/quotationAgent.types';
import { getErrorMessage } from '@/utils/apiError';

interface QuotationItemRowProps {
  orderId: string;
  item: QuotationFormItem;
  removable: boolean;
  maxTitleLength: number;
  onUpdate: (patch: Partial<QuotationFormItem>) => void;
  onRemove: () => void;
  onHistory: (item: QuotationHistoryItem, expectedTitle: string) => void;
}

export function QuotationItemRow({ orderId, item, removable, maxTitleLength, onUpdate, onRemove, onHistory }: QuotationItemRowProps) {
  const [query, setQuery] = useState<string | null>(null);
  const [history, setHistory] = useState<QuotationHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useToastFeedback<string>('', "error");
  const historyCallback = useRef(onHistory);
  useEffect(() => { historyCallback.current = onHistory; }, [onHistory]);
  useEffect(() => {
    if (!query || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError('');
      try {
        const result = await quotationAgentApi.history(orderId, query, controller.signal);
        if (controller.signal.aborted) return;
        setHistory(result.items);
        const match = result.items.find((entry) => entry.id === result.autoFillId);
        if (match) { historyCallback.current(match, query); setQuery(null); }
      } catch (failure) { if (!controller.signal.aborted) setError(getErrorMessage(failure, 'Chưa tra cứu được lịch sử. Bạn có thể nhập thủ công.')); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 450);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, orderId, setError]);
  return (
    <div className="grid min-w-0 grid-cols-2 items-start gap-sm rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-sm md:grid-cols-12">
      <div className="col-span-2 min-w-0 space-y-2 md:col-span-4">
      <label htmlFor={`quotation-title-${item.rowId}`} className="block text-xs text-on-surface-variant md:sr-only">Tên hạng mục</label>
      <input
        id={`quotation-title-${item.rowId}`}
        value={item.title}
        maxLength={maxTitleLength}
        onChange={(event) => { onUpdate({ title: event.target.value }); setQuery(event.target.value); setHistory([]); setError(''); setLoading(false); }}
        aria-label="Tên hạng mục"
        placeholder="Tên hạng mục"
        className="w-full min-w-0 rounded-xl border border-outline-variant px-3 py-2"
      />
      {query && loading && <p role="status" className="text-xs">Đang tìm hạng mục đã báo giá…</p>}
      {error && <p role="alert" className="text-xs text-error">{error}</p>}
      {query && !loading && history.length > 0 && <div className="space-y-1 rounded-xl border p-2" aria-label="Gợi ý từ lịch sử báo giá">
        {history.map((entry) => <button key={entry.id} type="button" className="block w-full rounded-lg p-2 text-left text-xs hover:bg-primary/5"
          onClick={() => { onHistory(entry, query); setQuery(null); }}>
          <strong>{entry.title}</strong> — {formatMoney(entry.unitPrice)}<br />{entry.description}<br />{new Date(entry.usedAt).toLocaleDateString('vi-VN')}
        </button>)}
      </div>}
      {query && query.length >= 2 && !loading && !error && history.length === 0 && <p className="text-xs text-on-surface-variant">Chưa có gợi ý phù hợp; bạn có thể nhập tiếp.</p>}
      {item.historySource && <p className="text-xs text-on-surface-variant">Giá lịch sử ngày {new Date(item.historySource.usedAt).toLocaleDateString('vi-VN')}. Kiểm tra trước khi lưu.</p>}
      </div>
      <label className="col-span-2 min-w-0 space-y-2 md:col-span-2">
      <span className="block text-xs text-on-surface-variant md:sr-only">Loại hạng mục</span>
      <select
        aria-label="Loại hạng mục"
        value={item.itemType}
        onChange={(event) => onUpdate({ itemType: event.target.value as QuotationItem['itemType'] })}
        className="w-full min-w-0 rounded-xl border border-outline-variant px-3 py-2"
      >
        {quotationItemTypes.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </select>
      </label>
      <label className="min-w-0 space-y-2 md:col-span-1">
      <span className="block text-xs text-on-surface-variant md:sr-only">Số lượng</span>
      <input
        type="number"
        min={1}
        max={1000}
        step={1}
        value={item.quantity}
        onChange={(event) => onUpdate({ quantity: Number(event.target.value) })}
        aria-label="Số lượng"
        placeholder="Số lượng"
        className="w-full min-w-0 rounded-xl border border-outline-variant px-3 py-2"
      />
      </label>
      <label className="min-w-0 space-y-2 md:col-span-2">
      <span className="block text-xs text-on-surface-variant md:sr-only">Đơn giá (VND)</span>
      <input
        type="text"
        inputMode="numeric"
        value={item.unitPrice > 0 ? item.unitPrice.toLocaleString('vi-VN') : ''}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, '');
          const normalized = digits.replace(/^0+(?=\d)/, '');
          onUpdate({ unitPrice: normalized ? Number(normalized) : 0 });
        }}
        aria-label="Đơn giá (VND)"
        placeholder="Đơn giá (VND)"
        className="w-full min-w-0 rounded-xl border border-outline-variant px-3 py-2"
      />
      </label>
      <div className="col-span-2 flex items-center justify-between gap-2 md:col-span-3">
        <div>
          <span className="block text-xs text-on-surface-variant md:hidden">Thành tiền</span>
          <span className="text-sm font-semibold tabular-nums text-primary">{formatMoney(item.quantity * item.unitPrice)}</span>
        </div>
        {removable && (
          <button type="button" onClick={onRemove} aria-label={`Xóa hạng mục ${item.title || 'trống'}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-error hover:bg-error/5">
            <Trash2 aria-hidden="true" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
