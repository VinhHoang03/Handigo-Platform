import { useId, useState } from 'react';
import { Modal } from '@/components/common/Modal';
import type { BookingPolicies } from '../types/bookingPolicy.types';
import { BookingPolicyContent } from './BookingPolicyContent';

export function BookingPolicyConsent({ policies, loading, error, accepted, disabled, onChange, onRetry, depositAmount, payableDeposit }: {
  policies: BookingPolicies | null;
  loading: boolean;
  error: string;
  accepted: boolean;
  disabled: boolean;
  onChange: (accepted: boolean) => void;
  onRetry: () => void;
  depositAmount?: number;
  payableDeposit?: number;
}) {
  const [open, setOpen] = useState(false);
  const checkboxId = useId();
  const canAccept = Boolean(policies && !loading && !error && !disabled);
  const status = loading ? <p role="status" className="text-sm text-on-surface-variant">Đang tải chính sách Handigo…</p>
    : error ? <p role="alert" className="text-sm text-error">{error} <button type="button" onClick={onRetry} className="font-semibold underline">Thử lại</button></p> : null;
  return <div className="mt-4 space-y-2 border-t border-outline-variant/30 pt-4">
    <div className="flex items-start gap-2.5">
      <input id={checkboxId} type="checkbox" checked={accepted} disabled={!canAccept}
        onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-primary" />
      <p className="text-xs leading-5 text-on-surface-variant">
        <label htmlFor={checkboxId} className="cursor-pointer">Tôi đã đọc và đồng ý với </label>
        <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}
          className="font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">chính sách Handigo</button>.
      </p>
    </div>
    {status}
    {!accepted && !loading && !error && <p className="text-xs text-on-surface-variant">Vui lòng đồng ý với chính sách trước khi xác nhận đặt đơn.</p>}
    <Modal open={open} title="Chính sách đặt dịch vụ Handigo" onClose={() => setOpen(false)} size="lg"
      footer={<div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Đóng</button>
        <button type="button" disabled={!canAccept} onClick={() => { onChange(true); setOpen(false); }} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50">Đồng ý với chính sách</button>
      </div>}>
      {status}
      {policies && !loading && !error && <BookingPolicyContent policies={policies} depositAmount={depositAmount} payableDeposit={payableDeposit} />}
    </Modal>
  </div>;
}
