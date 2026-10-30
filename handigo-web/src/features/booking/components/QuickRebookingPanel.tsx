import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/common/Modal';
import { useToast } from '@/components/common/Toast';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { formatCurrency } from '@/utils/currency';
import { getErrorMessage } from '@/utils/apiError';
import { isAirConditionerCleaning } from '@/utils/airConditionerCleaning';
import { WalletBalanceText } from '@/features/wallet/components/WalletBalanceText';
import { resetBookingSession, useBookingStore } from '../hooks/useBookingStore';
import { invalidateBookingPreview } from '../hooks/useBookingPreview';
import { useBookingPolicies } from '../hooks/useBookingPolicies';
import { useQuickRebookingQuote } from '../hooks/useQuickRebookingQuote';
import { getBookingFingerprint } from '../utils/bookingFingerprint';
import { assertNoPendingRebooking, submitQuickRebooking } from '../utils/submitQuickRebooking';
import { groupServiceOptions, toggleServiceOption } from '../utils/serviceOptionSelection';
import type { PreparedRebooking, RebookingDraft } from '../utils/rebooking';
import { getDefaultScheduledAt, getEarliestScheduledAt, getInitialScheduledAt, isWithinImmediateBookingHours, isWithinScheduledBookingHours } from './step2Helpers';
import { QuickRebookingSchedulePicker } from './QuickRebookingSchedulePicker';
import { QuickRebookingProviderPicker } from './QuickRebookingProviderPicker';
import { BookingPolicyConsent } from './BookingPolicyConsent';
import { ConfirmPaymentVoucherPanel } from './ConfirmPaymentVoucherPanel';
import { useConfirmPaymentVoucher } from './useConfirmPaymentVoucher';
import { ServiceOptionsPanel } from './ServiceOptionsPanel';
import { ServiceQuantityPanel } from './ServiceQuantityPanel';
import { BOOKING_CREATE_ATTEMPT_KEY, PENDING_ORDER_ID_KEY } from '../utils/bookingSessionStorage';
import { AddressBookModal } from '@/features/profile/components/AddressBookModal';
import { createUserAddress } from '@/features/profile/api/addressBook.api';
import type { UserAddressPayload } from '@/features/profile/types/profile.types';
import type { Address } from '@/types/booking';

export function QuickRebookingPanel({ prepared, onBusyChange }: {
  prepared: PreparedRebooking;
  onBusyChange: (busy: boolean) => void;
}) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const pendingVoucherToast = useRef<string | null>(null);
  const [manualVoucherCode, setManualVoucherCode] = useState('');
  const [draft, setDraft] = useState<RebookingDraft>(() => ({ ...prepared.draft,
    orderType: prepared.restoredAfterPayment ? prepared.draft.orderType : isWithinImmediateBookingHours() ? 'normal' : 'scheduled',
    scheduledAt: prepared.draft.scheduledAt ?? (!prepared.restoredAfterPayment && !isWithinImmediateBookingHours() ? getDefaultScheduledAt().slice(0, 16) : undefined),
    paymentMethod: prepared.service.serviceType === 'variable_price' && prepared.draft.paymentMethod === 'cash' ? 'bank' : prepared.draft.paymentMethod,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const [addresses, setAddresses] = useState(prepared.addresses);
  const [addressEditorOpen, setAddressEditorOpen] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState<string | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const addressSaveLock = useRef(false);
  const submitLock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const currentPrepared = { ...prepared, addresses };
  const isVariable = prepared.service.serviceType === 'variable_price';
  // Giá và điều kiện số tiền tối thiểu được kiểm tra bằng bản xem trước từ server.
  const voucher = useConfirmPaymentVoucher(undefined, isVariable, !recoveryRequired, prepared.draft.voucherCode ?? '');
  const currentDraft = { ...draft, voucherCode: voucher.appliedVoucher?.code };
  const quote = useQuickRebookingQuote(currentPrepared, currentDraft);
  useEffect(() => {
    if (pendingVoucherToast.current && pendingVoucherToast.current === currentDraft.voucherCode
      && quote.preview && !quote.loading && !quote.error) {
      pendingVoucherToast.current = null;
      addToast('Áp dụng mã giảm giá thành công.', 'success');
    }
  }, [currentDraft.voucherCode, quote.preview, quote.loading, quote.error, addToast]);
  const fingerprint = getBookingFingerprint({ ...draft, recurrenceUnit: 'weekly', recurrenceCount: 1 });
  const consentKey = JSON.stringify([fingerprint, draft.paymentMethod, draft.problemDescription,
    quote.preview?.bookingAmount, quote.preview?.discountedAmount, quote.key, voucher.voucherCode, currentDraft.voucherCode]);
  const policies = useBookingPolicies(consentKey);
  const isCleaning = isAirConditionerCleaning(prepared.service) && prepared.options.length === 0;
  const oldProvider = prepared.order.status === 'completed' ? prepared.order.providerId : null;
  const selectedProviderAvailable = !draft.preferredProviderId || quote.providers.some(provider => provider.id === draft.preferredProviderId);
  const address = addresses.find(item => item._id === draft.addressId);
  const inputClass = 'mt-1 min-h-11 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm';
  const update = (changes: Partial<RebookingDraft>) => { setDraft(current => ({ ...current, ...changes })); setError(''); };
  const showError = (message: string) => { if (alive.current) setError(message); };
  const canSubmit = quote.valid && Boolean(quote.preview) && !quote.loading && !quote.error && quote.providers.length > 0
    && !voucher.loading && (!voucher.voucherCode.trim() || Boolean(voucher.appliedVoucher))
    && selectedProviderAvailable && policies.accepted && !recoveryRequired && !addressEditorOpen && scheduleDraft === null;
  const scheduleDraftValid = Boolean(scheduleDraft
    && new Date(scheduleDraft).getTime() >= getEarliestScheduledAt().getTime()
    && isWithinScheduledBookingHours(scheduleDraft.split('T')[1]?.slice(0, 5) ?? ''));
  const closeSchedulePicker = () => { setScheduleDraft(null); onBusyChange(false); };

  const closeAddressEditor = () => {
    if (addressSaveLock.current) return;
    setAddressEditorOpen(false); onBusyChange(false);
  };
  const saveAddress = async (payload: UserAddressPayload) => {
    if (addressSaveLock.current) return;
    if (prepared.session !== useAuthStore.getState().sessionRevision) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng mở lại yêu cầu.');
    addressSaveLock.current = true; setSavingAddress(true);
    try {
      const saved = await createUserAddress(payload);
      if (!alive.current || prepared.session !== useAuthStore.getState().sessionRevision) return;
      const user = useAuthStore.getState().user;
      const newAddress: Address = { ...saved, _id: saved.id, userId: user?.id || user?._id || '',
        isDefault: Boolean(saved.isDefault), note: saved.note ?? undefined };
      setAddresses(current => [...current.filter(item => item._id !== saved.id).map(item => saved.isDefault ? { ...item, isDefault: false } : item), newAddress]);
      update({ addressId: saved.id });
    } finally {
      addressSaveLock.current = false;
      if (alive.current) setSavingAddress(false);
    }
  };

  const editFull = () => {
    if (submitLock.current) return;
    try {
      assertNoPendingRebooking();
      if (prepared.session !== useAuthStore.getState().sessionRevision) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng mở lại yêu cầu.');
      resetBookingSession(); invalidateBookingPreview();
      useBookingStore.setState({ ...currentDraft, requestedProviderId: draft.preferredProviderId,
        requestedProviderName: draft.preferredProviderName });
      navigate('/customer/bookings/new');
    } catch (cause) { showError(getErrorMessage(cause)); }
  };
  const confirm = async () => {
    if (submitLock.current || !canSubmit || !quote.preview) return;
    submitLock.current = true; setBusy(true); onBusyChange(true); setError('');
    try {
      let failed = false;
      await submitQuickRebooking({ prepared: currentPrepared, draft: currentDraft, appliedVoucher: voucher.appliedVoucher,
        preview: quote.preview, providers: quote.providers,
        policyAccepted: policies.accepted, navigate, setError: message => { if (message) failed = true; showError(message); } });
      if (alive.current && (sessionStorage.getItem(PENDING_ORDER_ID_KEY) || sessionStorage.getItem(BOOKING_CREATE_ATTEMPT_KEY))) {
        setRecoveryRequired(true);
      } else if (alive.current && failed) quote.retry();
    } catch (cause) { showError(getErrorMessage(cause, 'Không thể đặt lại. Vui lòng thử lại.')); }
    finally {
      submitLock.current = false;
      if (alive.current) { setBusy(false); onBusyChange(false); }
    }
  };

  return <div className="space-y-4 text-sm">
    <div><h3 className="text-lg font-bold">{prepared.service.name}</h3><p className="text-xs text-on-surface-variant">Từ đơn {prepared.order.orderCode}</p></div>
    {prepared.draft.rebookSource?.notices.map(notice => <p key={notice} className="rounded-lg bg-primary/5 p-2 text-xs text-on-surface-variant">{notice}</p>)}
    <fieldset disabled={busy || recoveryRequired} className="space-y-4 disabled:opacity-70">
      {isCleaning ? <ServiceQuantityPanel price={prepared.service.fixedPrice} quantity={draft.uniformQuantity} onChange={quantity => update({ uniformQuantity: quantity })} />
        : prepared.options.length > 0 && <details open={quote.missingOptions || undefined} className="rounded-xl border border-outline-variant/40 p-3">
          <summary className="cursor-pointer font-semibold">{draft.selectedOptionIds.map(id => {
            const option = prepared.options.find(item => item._id === id);
            return `${option?.name ?? 'Tùy chọn'} × ${draft.selectedOptionQuantities[id] ?? 1}`;
          }).join(' · ') || 'Chọn tùy chọn dịch vụ'} <span className="text-primary">· Đổi</span></summary>
          <ServiceOptionsPanel optionGroups={groupServiceOptions(prepared.options)} selectedOptionIds={draft.selectedOptionIds}
            selectedOptionQuantities={draft.selectedOptionQuantities} isVariablePrice={isVariable} requiresOptionSelection={prepared.service.requiresOptionSelection}
            onToggleOption={option => update({ selectedOptionIds: toggleServiceOption(draft.selectedOptionIds, option, prepared.options) })}
            onQuantityChange={(id, quantity) => update({ selectedOptionQuantities: { ...draft.selectedOptionQuantities, [id]: Math.min(99, Math.max(1, Math.trunc(quantity) || 1)) } })} />
        </details>}
      <label className="block font-semibold">Địa chỉ
        <select aria-label="Địa chỉ thực hiện" className={inputClass} value={draft.addressId ?? ''} onChange={event => update({ addressId: event.target.value || undefined })}>
          <option value="">Chọn địa chỉ thực hiện</option>
          {addresses.map(item => <option key={item._id} value={item._id}>{[item.fullAddress || item.detailAddress, item.ward, item.province].filter(Boolean).join(', ')}</option>)}
        </select>
      </label>
      <button type="button" className="min-h-10 font-semibold text-primary" onClick={() => { setAddressEditorOpen(true); onBusyChange(true); }}>+ Thêm địa chỉ mới</button>
      {address?.recipientName && <p className="text-xs text-on-surface-variant">Người nhận: {address.recipientName}{address.recipientPhone ? ` · ${address.recipientPhone}` : ''}</p>}
      {!addresses.length && <p role="status" className="text-on-surface-variant">Chưa có địa chỉ. Bạn có thể thêm địa chỉ mới ngay tại đây.</p>}
      <div className="space-y-2"><p className="font-semibold">Thời gian</p><div className="flex gap-2">
        <button type="button" aria-pressed={draft.orderType === 'normal'} onClick={() => update({ orderType: 'normal', scheduledAt: undefined })} disabled={!isWithinImmediateBookingHours()}
          className={`min-h-11 rounded-xl border px-4 ${draft.orderType === 'normal' ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant'}`}>Sớm nhất</button>
        <button type="button" aria-pressed={draft.orderType === 'scheduled'} onClick={() => {
          setScheduleDraft(getInitialScheduledAt(draft.scheduledAt).slice(0, 16)); onBusyChange(true);
        }}
          className={`min-h-11 rounded-xl border px-4 ${draft.orderType === 'scheduled' ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant'}`}>Chọn giờ</button>
      </div>
        {draft.orderType === 'scheduled' && draft.scheduledAt && Number.isFinite(new Date(draft.scheduledAt).getTime()) &&
          <p className="text-sm font-semibold">{new Date(draft.scheduledAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}
        {!quote.scheduleValid && <p role="alert" className="text-xs text-error">Vui lòng chọn thời gian hợp lệ, chưa qua và trong khung giờ từ 08:00 đến 21:00.</p>}
      </div>
      <QuickRebookingProviderPicker providers={quote.providers} selectedId={draft.preferredProviderId}
        oldProvider={oldProvider ? { id: oldProvider._id, name: oldProvider.userId?.fullName || oldProvider.name || 'Thợ đã phục vụ' } : undefined}
        disabled={busy || recoveryRequired} loading={quote.loading} onBusyChange={onBusyChange}
        onChange={(preferredProviderId, preferredProviderName) => update({ preferredProviderId, preferredProviderName })} />
      {!selectedProviderAvailable && !quote.loading && <p role="alert" className="text-xs text-error">Thợ đã chọn chưa khả dụng. Vui lòng chọn thợ khác hoặc Handigo điều phối.</p>}
      <label className="block font-semibold">Thanh toán
        <select aria-label="Phương thức thanh toán" className={inputClass} value={draft.paymentMethod} onChange={event => update({ paymentMethod: event.target.value as RebookingDraft['paymentMethod'] })}>
          <option value="wallet">Ví Handigo</option><option value="bank">Ngân hàng / PayOS</option>{!isVariable && <option value="cash">Tiền mặt</option>}
        </select>
      </label>
      {draft.paymentMethod === 'wallet' && <WalletBalanceText />}
      {isVariable && <label className="block font-semibold">Tình trạng cần kiểm tra lần này
        <textarea aria-label="Tình trạng cần kiểm tra lần này" maxLength={2000} rows={2} className={inputClass} value={draft.problemDescription ?? ''}
          onChange={event => update({ problemDescription: event.target.value })} placeholder="Mô tả ngắn tình trạng mới để thợ chuẩn bị." />
      </label>}
    </fieldset>
    <ConfirmPaymentVoucherPanel manualInputValue={manualVoucherCode} showAppliedVoucherNotice={false} voucherCode={voucher.voucherCode} availableVouchers={voucher.availableVouchers}
      appliedVoucher={voucher.appliedVoucher} voucherError={voucher.voucherError}
      voucherDiscountAmount={quote.preview?.voucherDiscountAmount ?? 0}
      isSubmitting={busy || recoveryRequired || voucher.loading}
      onSelectVoucher={code => { pendingVoucherToast.current = code || null; setManualVoucherCode(''); voucher.setVoucherCode(code); voucher.applyVoucherCode(code); setError(''); }}
      onManualInputChange={code => { pendingVoucherToast.current = null; setManualVoucherCode(code); voucher.setVoucherCode(code); voucher.setAppliedVoucher(null); voucher.setVoucherError(''); setError(''); }}
      onApplyClick={() => { pendingVoucherToast.current = manualVoucherCode.trim().toUpperCase() || null; voucher.applyVoucherCode(manualVoucherCode); setError(''); }}
      onRemoveVoucher={() => { pendingVoucherToast.current = null; setManualVoucherCode(''); voucher.setVoucherCode(''); voucher.setAppliedVoucher(null); voucher.setVoucherError(''); setError(''); }} />
    {voucher.loading ? <p role="status" className="text-xs text-on-surface-variant">Đang tải mã giảm giá...</p>
      : voucher.loadError ? <p role="alert" className="text-xs text-error">{voucher.loadError} <button type="button" disabled={busy || recoveryRequired} onClick={voucher.retry} className="font-semibold underline">Thử lại</button></p>
        : !voucher.availableVouchers.length && <p className="text-xs text-on-surface-variant">Chưa có mã giảm giá khả dụng cho dịch vụ này.</p>}
    <div aria-live="polite" className="rounded-xl bg-primary/5 p-4">
      {quote.loading ? <p role="status">Đang cập nhật giá và thợ phù hợp...</p> : quote.error ? <p role="alert" className="text-error">{quote.error} <button type="button" disabled={busy || recoveryRequired} onClick={quote.retry} className="font-bold underline">Thử lại</button></p>
        : quote.preview ? <><div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2">{isVariable ? 'Cọc / phí kiểm tra' : 'Tổng tiền hiện tại'}
          {isVariable && <span className="group/deposit relative inline-flex">
            <button type="button" aria-label="Đây là khoản cọc/phí kiểm tra. Chi phí sửa chữa được báo giá sau khi kiểm tra."
              className="grid h-5 w-5 place-items-center rounded-full border border-on-surface-variant/60 text-xs font-bold text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">!</button>
            <span role="tooltip" className="pointer-events-none invisible absolute bottom-full left-0 z-10 mb-2 w-56 rounded-lg bg-on-surface px-3 py-2 text-xs font-normal leading-5 text-surface opacity-0 transition-opacity group-hover/deposit:visible group-hover/deposit:opacity-100 group-focus-within/deposit:visible group-focus-within/deposit:opacity-100">Đây là khoản cọc/phí kiểm tra. Chi phí sửa chữa được báo giá sau khi kiểm tra.</span>
          </span>}
        </span><strong className="text-xl text-primary">{formatCurrency(quote.preview.discountedAmount)}</strong></div>
          {quote.preview.promotionSnapshot?.name && <p className="mt-1 text-xs">Ưu đãi hiện tại: {quote.preview.promotionSnapshot.name}</p>}
          {!quote.providers.length && <p className="mt-2 text-xs text-error">Chưa có thợ phù hợp. Vui lòng đổi địa chỉ hoặc thời gian.</p>}</>
          : <p>Chọn đủ thông tin để xem giá hiện tại.</p>}
    </div>
    <BookingPolicyConsent policies={policies.policies} loading={policies.loading} error={policies.error} accepted={policies.accepted}
      disabled={busy || recoveryRequired || !quote.preview} onChange={policies.setAccepted} onRetry={policies.retry}
      depositAmount={isVariable ? quote.preview?.depositAmount : undefined} payableDeposit={isVariable ? quote.preview?.discountedAmount : undefined} />
    {error && <p role="alert" className="text-error">{error}</p>}
    {recoveryRequired ? <button type="button" onClick={() => navigate('/customer/bookings/new/payment')} className="btn-primary w-full">Kiểm tra lần đặt vừa xác nhận</button>
      : <div className="sticky -bottom-5 space-y-2 border-t border-outline-variant/30 bg-surface py-3">
        <button type="button" disabled={busy || !canSubmit} onClick={() => void confirm()} className="min-h-12 w-full rounded-xl bg-primary px-4 py-3 font-bold text-on-primary disabled:opacity-50">
          {busy ? 'Đang xác nhận...' : `Xác nhận đặt${quote.preview ? ` · ${formatCurrency(quote.preview.discountedAmount)}` : ''}`}
        </button>
        <button type="button" disabled={busy} onClick={editFull} className="min-h-10 w-full font-semibold text-primary disabled:opacity-50">Chỉnh sửa đầy đủ</button>
      </div>}
    <Modal open={scheduleDraft !== null} title="Chọn ngày và giờ hẹn" onClose={closeSchedulePicker} size="sm">
      {scheduleDraft !== null && <form className="space-y-4" onSubmit={event => {
        event.preventDefault();
        if (!scheduleDraftValid || busy || recoveryRequired) return;
        update({ orderType: 'scheduled', scheduledAt: scheduleDraft }); closeSchedulePicker();
      }}>
        <QuickRebookingSchedulePicker value={scheduleDraft} disabled={busy || recoveryRequired} onChange={setScheduleDraft} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={closeSchedulePicker} className="min-h-11 rounded-xl border border-outline-variant px-4 font-semibold">Hủy</button>
          <button type="submit" disabled={!scheduleDraftValid || busy || recoveryRequired} className="min-h-11 rounded-xl bg-primary px-4 font-bold text-on-primary disabled:opacity-50">Xác nhận</button>
        </div>
      </form>}
    </Modal>
    {addressEditorOpen && <AddressBookModal open addressCount={addresses.length} isSaving={savingAddress}
      defaultRecipient={{ name: useAuthStore.getState().user?.fullName || '', phone: useAuthStore.getState().user?.phone || '' }}
      onClose={closeAddressEditor} onSubmit={saveAddress} />}
  </div>;
}
