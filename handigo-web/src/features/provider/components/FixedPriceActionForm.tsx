import { useState } from 'react';
import type { Order } from '@/types/booking';
import { formatMoney } from '../utils/providerOrder.utils';

interface FixedPriceActionFormProps {
  order: Order;
  onStart: () => void | Promise<void>;
  onComplete: () => void | Promise<void>;
  onCancel: () => void;
  busy?: boolean;
}

export function FixedPriceActionForm({
  order,
  onStart,
  onComplete,
  onCancel,
  busy,
}: FixedPriceActionFormProps) {
  const [note, setNote] = useState('');

  const showStart = order.status === 'accepted';
  const showComplete = order.status === 'in_progress';
  const showCancel = ['accepted', 'in_progress'].includes(order.status);

  return (
    <div className="glass-card flex flex-col space-y-md rounded-3xl p-md h-full">
      <div>
        <h3 className="font-headline-md text-on-surface">Thao tác dịch vụ</h3>
        <p className="mt-1 text-sm text-on-surface-variant">
          Dịch vụ này có giá cố định. Vui lòng cập nhật trạng thái thực hiện.
        </p>
      </div>

      <div className="flex-1 space-y-md">
        <div className="rounded-2xl bg-primary/5 p-md">
          <p className="text-xs text-on-surface-variant uppercase font-bold tracking-wider">Giá cố định</p>
          <p className="text-headline-md font-bold text-primary">{formatMoney(order.pricing.totalPaidAmount)}</p>
        </div>

        <label className="block space-y-2">
          <span className="text-label-sm text-on-surface-variant">Ghi chú thực hiện (tùy chọn)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            className="w-full rounded-2xl border border-outline-variant bg-white px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            placeholder="Ghi chú về quá trình thực hiện..."
          />
        </label>
      </div>

      <div className="space-y-sm pt-md">
        {showStart && (
          <button
            type="button"
            disabled={busy}
            onClick={onStart}
            className="btn-primary w-full py-3 text-base font-bold"
          >
            {busy ? 'Đang xử lý...' : 'Bắt đầu thực hiện'}
          </button>
        )}
        {showComplete && (
          <button
            type="button"
            disabled={busy}
            onClick={onComplete}
            className="btn-primary w-full py-3 text-base font-bold"
          >
            {busy ? 'Đang xử lý...' : 'Hoàn thành đơn'}
          </button>
        )}
        {showCancel && (
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="w-full py-2 text-sm font-medium text-error hover:bg-error/5 rounded-xl transition-colors"
          >
            Hủy đơn dịch vụ
          </button>
        )}
      </div>
    </div>
  );
}
