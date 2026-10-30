import { useAuthStore } from '@/features/auth/store/auth.store';
import { useBookingStore } from '../hooks/useBookingStore';
import { QUICK_REBOOKING_RETURN_KEY } from './bookingSessionStorage';
import { prepareRebooking, type PreparedRebooking, type RebookingDraft } from './rebooking';

export const quickRebookingReturnPath = (orderId: string, sourcePath?: string) => {
  let savedPath: string | undefined;
  try {
    const saved = JSON.parse(sessionStorage.getItem(QUICK_REBOOKING_RETURN_KEY) ?? 'null');
    if (saved?.orderId === orderId && typeof saved.returnPath === 'string') savedPath = saved.returnPath;
  } catch { /* Bỏ qua ngữ cảnh quay về không hợp lệ. */ }
  const candidate = (sourcePath ?? savedPath ?? window.location?.pathname ?? '').split('?')[0];
  const path = candidate === '/customer/bookings' || candidate === `/customer/bookings/${orderId}`
    || /^\/customer\/services\/[a-f\d]{24}$/i.test(candidate) ? candidate : '/customer/bookings';
  return `${path}?quickRebook=${encodeURIComponent(orderId)}`;
};

export const rememberQuickRebookingReturn = (orderId: string, sourcePath?: string) => {
  const user = useAuthStore.getState().user;
  const returnPath = quickRebookingReturnPath(orderId, sourcePath);
  sessionStorage.setItem(QUICK_REBOOKING_RETURN_KEY, JSON.stringify({ orderId, userId: user?.id ?? user?._id, returnPath }));
  // Cả nút quay lại trình duyệt cũng về trang đã bắt đầu đặt và mở lại form.
  window.history.replaceState(window.history.state, '', returnPath);
};

/** Chỉ phục hồi nháp trong cùng tài khoản và đúng đơn gốc, không dựa vào query PayOS. */
export const getQuickRebookingReturn = (orderId: string) => {
  try {
    const raw = sessionStorage.getItem(QUICK_REBOOKING_RETURN_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { orderId?: string; userId?: string };
    const user = useAuthStore.getState().user;
    const userId = user?.id ?? user?._id;
    const booking = useBookingStore.getState();
    return userId && saved.userId === userId && saved.orderId === orderId
      && booking.rebookSource?.orderId === orderId && booking.paymentMethod === 'bank'
      ? booking : null;
  } catch {
    return null;
  }
};

/** Kiểm tra lại địa chỉ, tùy chọn và số lượng bằng dữ liệu mới trước khi mở form. */
export const restoreQuickRebookingDraft = (prepared: PreparedRebooking, saved: RebookingDraft): RebookingDraft => {
  if (saved.serviceId !== prepared.service._id) throw new Error('Nháp đặt lại đã thay đổi dịch vụ. Vui lòng mở lại yêu cầu.');
  const selectedOptionsSnapshot = saved.selectedOptionIds.length
    ? saved.selectedOptionIds.map(optionId => {
      const option = prepared.options.find(item => item._id === optionId);
      return { optionId, name: option?.name ?? '', optionType: option?.optionType ?? 'other',
        price: option?.price ?? 0, quantity: saved.selectedOptionQuantities[optionId] ?? 1 };
    })
    : [{ optionId: null, name: prepared.service.name, optionType: 'other',
      price: prepared.service.fixedPrice ?? 0, quantity: saved.uniformQuantity }];
  const draft = prepareRebooking({ ...prepared.order, addressSnapshot: undefined,
    addressId: prepared.addresses.find(address => address._id === saved.addressId) ?? null,
    selectedOptionIds: saved.selectedOptionIds, selectedOptionsSnapshot,
    paymentMethod: saved.paymentMethod,
  }, prepared.service, prepared.options, prepared.addresses);
  return { ...draft, orderType: saved.orderType, scheduledAt: saved.scheduledAt,
    preferredProviderId: saved.preferredProviderId, preferredProviderName: saved.preferredProviderName,
    problemDescription: saved.problemDescription, voucherCode: saved.voucherCode };
};
