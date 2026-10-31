import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/common/Modal';
import type { AdminUser, UpdateUserStatusPayload } from '../../types/admin.types';

type LockPayload = Extract<UpdateUserStatusPayload, { status: 'locked' }>;

export function LockUserModal({ user, busy, onClose, onConfirm }: {
  user: AdminUser;
  busy: boolean;
  onClose: () => void;
  onConfirm: (payload: LockPayload) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [severity, setSeverity] = useState<LockPayload['severity']>('MEDIUM');
  const [penaltyType, setPenaltyType] = useState<LockPayload['penaltyType']>('TEMPORARY_SUSPEND');
  const [duration, setDuration] = useState('');
  const [durationUnit, setDurationUnit] = useState<'hours' | 'days'>('days');
  const [error, setError] = useState('');
  const [openedAt] = useState(() => Date.now());
  const temporary = penaltyType === 'TEMPORARY_SUSPEND';
  const amount = Number(duration);
  const maxDuration = durationUnit === 'hours' ? 87600 : 3650;
  const validDuration = /^\d+$/.test(duration) && Number.isInteger(amount) && amount >= 1 && amount <= maxDuration;
  const expectedEnd = temporary && validDuration ? new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(openedAt + amount * (durationUnit === 'hours' ? 3_600_000 : 86_400_000))) : null;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (reason.trim().length < 5) { setError('Lý do vi phạm phải có ít nhất 5 ký tự.'); return; }
    if (temporary && !validDuration) { setError(`Thời hạn phải là số nguyên từ 1 đến ${maxDuration} ${durationUnit === 'hours' ? 'giờ' : 'ngày'}.`); return; }
    setError('');
    await onConfirm({ status: 'locked', reason: reason.trim(), severity, penaltyType,
      ...(temporary ? { duration: amount, durationUnit } : {}) });
  };
  const fieldClass = 'mt-2 min-h-12 w-full rounded-xl border border-outline-variant bg-surface px-3';
  return <Modal open title="Khóa tài khoản do vi phạm" size="sm" danger
    onClose={onClose} closeOnEsc={!busy} closeOnOverlayClick={!busy}>
    <form onSubmit={submit} className="space-y-4">
      <p className="break-words text-sm">Tài khoản: <strong>{user.fullName}</strong>{user.email && ` (${user.email})`}</p>
      <label className="block text-sm font-semibold">Lý do vi phạm
        <textarea required minLength={5} maxLength={3000} rows={4} disabled={busy}
          value={reason} onChange={event => setReason(event.target.value)}
          className={`${fieldClass} py-3`} />
      </label>
      <label className="block text-sm font-semibold">Mức độ vi phạm
        <select value={severity} disabled={busy} className={fieldClass}
          onChange={event => setSeverity(event.target.value as LockPayload['severity'])}>
          <option value="LOW">Thấp</option><option value="MEDIUM">Trung bình</option>
          <option value="HIGH">Cao</option><option value="CRITICAL">Nghiêm trọng</option>
        </select>
      </label>
      <label className="block text-sm font-semibold">Hình thức xử lý
        <select value={penaltyType} disabled={busy} className={fieldClass}
          onChange={event => setPenaltyType(event.target.value as LockPayload['penaltyType'])}>
          <option value="TEMPORARY_SUSPEND">Tạm khóa tài khoản</option>
          <option value="PERMANENT_BAN">Khóa tài khoản vĩnh viễn</option>
        </select>
      </label>
      {temporary && <fieldset className="space-y-2" disabled={busy}>
        <legend className="text-sm font-semibold">Thời hạn tạm khóa</legend>
        <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
          <label className="block text-sm">Số lượng
            <input type="text" inputMode="numeric" pattern="[0-9]+" maxLength={5} required disabled={busy}
              aria-describedby="lock-duration-hint" placeholder="Ví dụ: 8"
              value={duration} onChange={event => {
                if (/^\d{0,5}$/.test(event.target.value)) setDuration(event.target.value);
              }} className={fieldClass} />
          </label>
          <label className="block text-sm">Đơn vị
            <select value={durationUnit} disabled={busy} className={fieldClass}
              onChange={event => setDurationUnit(event.target.value as 'hours' | 'days')}>
              <option value="hours">Giờ</option><option value="days">Ngày</option>
            </select>
          </label>
        </div>
        <p id="lock-duration-hint" className="text-xs text-on-surface-variant">Chỉ nhập số nguyên từ 1 đến {maxDuration} {durationUnit === 'hours' ? 'giờ' : 'ngày'}. Không nhập chữ hoặc số thập phân.</p>
      </fieldset>}
      <div className="space-y-2 rounded-xl bg-surface-container-low p-3 text-sm text-on-surface-variant" aria-live="polite">
        {temporary ? <>
          <p>{validDuration ? `Tạm khóa ${amount} ${durationUnit === 'hours' ? 'giờ' : 'ngày'}. ` : ''}Thời hạn tính từ lúc xác nhận khóa; 1 ngày tương ứng 24 giờ.</p>
          {expectedEnd && <p>Dự kiến mở khóa vào {expectedEnd} (giờ Việt Nam). Email sẽ ghi ngày giờ chính xác khi lưu quyết định.</p>}
          <p>Tài khoản tự mở khi hết hạn nếu không có quyết định khóa khác đang hiệu lực.</p>
        </> : <p>Tài khoản không tự mở theo thời gian. Chỉ admin có thể quyết định mở khóa sớm hoặc xem xét lại.</p>}
        <p>Người dùng sẽ bị đăng xuất và không thể sử dụng các chức năng cần đăng nhập.</p>
        <p>{user.email ? 'Hệ thống sẽ gửi email thông báo lý do, hình phạt và thời hạn nếu có.' : 'Tài khoản chưa có email: quyết định vẫn có hiệu lực nhưng không thể gửi thông báo qua email.'}</p>
      </div>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" disabled={busy} onClick={onClose} className="rounded-xl border border-outline-variant px-4 py-3 disabled:opacity-50">Hủy</button>
        <button type="submit" disabled={busy} className="rounded-xl bg-error px-4 py-3 font-semibold text-on-error disabled:opacity-50">{busy ? 'Đang xử lý…' : 'Xác nhận khóa'}</button>
      </div>
    </form>
  </Modal>;
}
