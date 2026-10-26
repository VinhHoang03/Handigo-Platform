export const PENDING_ORDER_ID_KEY = 'pendingBookingOrderId';
export const PENDING_ORDER_FINGERPRINT_KEY = 'pendingBookingFingerprint';
export const PENDING_ORDER_VOUCHER_KEY = 'pendingBookingVoucherCode';
export const BOOKING_CREATE_ATTEMPT_KEY = 'bookingCreateAttempt';

let sessionRevision = 0;
export const getBookingSessionRevision = () => sessionRevision;

export const clearPendingBooking = () => {
  sessionStorage.removeItem(PENDING_ORDER_ID_KEY);
  sessionStorage.removeItem(PENDING_ORDER_FINGERPRINT_KEY);
  sessionStorage.removeItem(PENDING_ORDER_VOUCHER_KEY);
  sessionStorage.removeItem(BOOKING_CREATE_ATTEMPT_KEY);
};

export const invalidateBookingSession = () => {
  sessionRevision++;
  clearPendingBooking();
  sessionStorage.removeItem('latestBookingOrderId');
};
