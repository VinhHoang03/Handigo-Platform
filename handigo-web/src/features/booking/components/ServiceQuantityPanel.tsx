import { money } from '@/features/customer-service/utils/serviceDisplay';
import { useId, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

export function ServiceQuantityPanel({ price, quantity, onChange }: {
  price?: number | null;
  quantity: number;
  onChange: (quantity: number) => void;
}) {
  const inputId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const normalizeQuantity = (value: string) => Math.min(99, Math.max(1, Math.trunc(Number(value)) || 1));
  const changeQuantity = (value: number) => {
    setDraft(null);
    onChange(value);
  };

  return (
    <section className="space-y-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6">
      <h2 className="text-lg font-bold">Vệ sinh điều hòa</h2>
      <p className="font-semibold text-primary">
        {price && price > 0 ? `${money.format(price)} / máy` : 'Chưa có giá dịch vụ'}
      </p>
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={inputId} className="font-semibold">Số lượng máy</label>
        <div className="flex items-center overflow-hidden rounded-lg border border-outline-variant bg-surface">
          <button type="button" aria-label="Giảm số lượng máy" disabled={quantity <= 1}
            onClick={() => changeQuantity(Math.max(1, quantity - 1))}
            className="flex h-11 w-11 items-center justify-center text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40">
            <Minus size={18} aria-hidden="true" />
          </button>
          <input id={inputId} type="number" inputMode="numeric" min={1} max={99} step={1}
            value={draft ?? quantity}
            onFocus={() => setDraft(String(quantity))}
            onChange={(event) => {
              const value = event.target.value;
              if (!/^\d*$/.test(value)) return;
              setDraft(value);
              if (value !== '') onChange(normalizeQuantity(value));
            }}
            onBlur={() => {
              if (draft !== null) onChange(normalizeQuantity(draft));
              setDraft(null);
            }}
            className="h-11 w-16 border-x border-outline-variant bg-surface text-center font-semibold tabular-nums [appearance:textfield] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
          <button type="button" aria-label="Tăng số lượng máy" disabled={quantity >= 99}
            onClick={() => changeQuantity(Math.min(99, quantity + 1))}
            className="flex h-11 w-11 items-center justify-center text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40">
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
