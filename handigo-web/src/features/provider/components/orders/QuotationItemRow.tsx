import type { QuotationItem } from '../../types/providerOrder.types';
import { formatMoney } from '../../utils/providerOrder.utils';
import { quotationItemTypes, type QuotationFormItem } from './quotationForm.types';

interface QuotationItemRowProps {
  item: QuotationFormItem;
  removable: boolean;
  maxTitleLength: number;
  onUpdate: (patch: Partial<QuotationFormItem>) => void;
  onRemove: () => void;
}

export function QuotationItemRow({ item, removable, maxTitleLength, onUpdate, onRemove }: QuotationItemRowProps) {
  return (
    <div className="grid min-w-0 gap-sm rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-sm md:grid-cols-12">
      <input
        value={item.title}
        maxLength={maxTitleLength}
        onChange={(event) => onUpdate({ title: event.target.value })}
        placeholder="Tên hạng mục"
        className="min-w-0 rounded-xl border border-outline-variant px-3 py-2 md:col-span-4"
      />
      <select
        value={item.itemType}
        onChange={(event) => onUpdate({ itemType: event.target.value as QuotationItem['itemType'] })}
        className="min-w-0 rounded-xl border border-outline-variant px-3 py-2 md:col-span-2"
      >
        {quotationItemTypes.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={1}
        max={1000}
        step={1}
        value={item.quantity}
        onChange={(event) => onUpdate({ quantity: Number(event.target.value) })}
        aria-label="Số lượng"
        placeholder="Số lượng"
        className="min-w-0 rounded-xl border border-outline-variant px-3 py-2 md:col-span-1"
      />
      <input
        type="number"
        min={0}
        step={1}
        value={item.unitPrice}
        onChange={(event) => {
          const unitPrice = event.target.value.replace(/^0+(?=\d)/, '');
          onUpdate({ unitPrice: Number(unitPrice) });
        }}
        aria-label="Đơn giá (VND)"
        placeholder="Đơn giá (VND)"
        className="min-w-0 rounded-xl border border-outline-variant px-3 py-2 md:col-span-2"
      />
      <div className="flex items-center justify-between gap-2 md:col-span-2">
        <div>
          <span className="block text-xs text-on-surface-variant md:hidden">Thành tiền</span>
          <span className="text-sm font-semibold tabular-nums text-primary">{formatMoney(item.quantity * item.unitPrice)}</span>
        </div>
        {removable && (
          <button type="button" onClick={onRemove} className="text-error">
            <span className="material-symbols-outlined text-base">delete</span>
          </button>
        )}
      </div>
    </div>
  );
}
