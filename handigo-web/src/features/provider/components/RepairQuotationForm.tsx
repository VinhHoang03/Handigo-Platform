import { useState, type FormEvent } from 'react';
import type { CreateQuotationPayload } from '../types/providerOrder.types';
import { formatMoney } from '../utils/providerOrder.utils';
import { QuotationItemRow } from './orders/QuotationItemRow';
import { QuotationNotesFields } from './orders/QuotationNotesFields';
import type { QuotationFormItem } from './orders/quotationForm.types';

const emptyItem: QuotationFormItem = {
  title: '',
  description: '',
  itemType: 'labor',
  quantity: 1,
  unitPrice: 0,
  note: '',
};

const MAX_QUOTATION_ITEMS = 100;
const MAX_GENERAL_TEXT_LENGTH = 2000;
const MAX_ITEM_TITLE_LENGTH = 200;
const MAX_ITEM_NOTE_LENGTH = 1000;

interface RepairQuotationFormProps {
  onSubmit: (payload: CreateQuotationPayload) => Promise<void>;
  onCancel: () => void;
  busy?: boolean;
}

export function RepairQuotationForm({ onSubmit, onCancel, busy }: RepairQuotationFormProps) {
  const [inspectionNote, setInspectionNote] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [error, setError] = useState<string | null>(null);

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const updateItem = (index: number, patch: Partial<QuotationFormItem>) => {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validItems = items.filter((item) => item.title.trim() && item.unitPrice > 0);
    if (!validItems.length) {
      setError('Vui lòng thêm ít nhất một hạng mục báo giá hợp lệ.');
      return;
    }
    if (
      inspectionNote.trim().length > MAX_GENERAL_TEXT_LENGTH ||
      recommendation.trim().length > MAX_GENERAL_TEXT_LENGTH
    ) {
      setError('Ghi chú khảo sát và đề xuất không được vượt quá 2000 ký tự.');
      return;
    }
    if (
      validItems.some(
        (item) =>
          item.title.trim().length > MAX_ITEM_TITLE_LENGTH ||
          item.description.trim().length > MAX_GENERAL_TEXT_LENGTH ||
          item.note.trim().length > MAX_ITEM_NOTE_LENGTH ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > 1000 ||
          !Number.isFinite(item.unitPrice) ||
          item.unitPrice < 0,
      )
    ) {
      setError('Có hạng mục báo giá chưa hợp lệ.');
      return;
    }
    setError(null);
    await onSubmit({
      inspectionNote: inspectionNote.trim() || undefined,
      recommendation: recommendation.trim() || undefined,
      items: validItems.map((item) => ({
        title: item.title.trim(),
        description: item.description.trim() || undefined,
        itemType: item.itemType,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        note: item.note.trim() || undefined,
      })),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="h-full space-y-md rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-md"
    >
      <div>
        <h3 className="font-headline-md text-on-surface">Tạo báo giá sửa chữa</h3>
        <p className="mt-1 text-sm text-on-surface-variant">Ghi nhận kết quả khảo sát và các hạng mục cần thực hiện.</p>
      </div>

      {error && <div className="rounded-2xl bg-error/10 px-md py-sm text-sm text-error">{error}</div>}

      <QuotationNotesFields
        inspectionNote={inspectionNote}
        recommendation={recommendation}
        maxLength={MAX_GENERAL_TEXT_LENGTH}
        onInspectionNoteChange={setInspectionNote}
        onRecommendationChange={setRecommendation}
      />

      <div className="space-y-sm">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-label-md text-on-surface">Hạng mục báo giá</h4>
            <p className="mt-1 text-xs text-on-surface-variant">Thành tiền từng hạng mục = Số lượng × Đơn giá.</p>
          </div>
          <button
            type="button"
            disabled={items.length >= MAX_QUOTATION_ITEMS}
            onClick={() => setItems((current) => [...current, { ...emptyItem }])}
            className="text-sm font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Thêm hạng mục
          </button>
        </div>

        <div className="hidden grid-cols-12 gap-sm px-sm text-xs font-medium text-on-surface-variant md:grid">
          <span className="md:col-span-4">Tên hạng mục</span>
          <span className="md:col-span-2">Loại</span>
          <span className="md:col-span-1">Số lượng</span>
          <span className="md:col-span-2">Đơn giá (VND)</span>
          <span className="md:col-span-2">Thành tiền</span>
        </div>

        {items.map((item, index) => (
          <QuotationItemRow
            key={`quotation-item-${index}`}
            item={item}
            removable={items.length > 1}
            maxTitleLength={MAX_ITEM_TITLE_LENGTH}
            onUpdate={(patch) => updateItem(index, patch)}
            onRemove={() => setItems((current) => current.filter((_, i) => i !== index))}
          />
        ))}
      </div>

      <div className="flex justify-end">
        <div className="rounded-2xl bg-primary/5 px-md py-sm text-right">
          <p className="text-xs text-on-surface-variant">Tổng báo giá (tổng thành tiền các hạng mục)</p>
          <p className="text-headline-md font-bold tabular-nums text-primary">{formatMoney(subtotal)}</p>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-sm border-t border-outline-variant/30 pt-md sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-sm font-bold text-error transition hover:border-error/50 hover:bg-error/10 active:scale-[0.98] disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-xl">warning</span>
          Hủy đơn hàng
        </button>
        <button type="submit" disabled={busy} className="btn-primary w-full sm:w-auto">
          {busy ? 'Đang gửi báo giá...' : 'Gửi báo giá cho khách hàng'}
        </button>
      </div>
    </form>
  );
}
