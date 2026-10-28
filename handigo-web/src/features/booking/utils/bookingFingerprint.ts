import type { BookingState } from '@/types/booking';

export const getBookingFingerprint = (booking: Pick<BookingState,
  'serviceId' | 'selectedOptionIds' | 'selectedOptionQuantities' | 'uniformQuantity' | 'addressId' |
  'orderType' | 'preferredProviderId' | 'scheduledAt' | 'recurrenceUnit' | 'recurrenceCount'>) => JSON.stringify({
  serviceId: booking.serviceId,
  selectedOptionIds: [...booking.selectedOptionIds].sort(),
  selectedOptionQuantities: booking.selectedOptionQuantities,
  uniformQuantity: booking.uniformQuantity,
  addressId: booking.addressId,
  orderType: booking.orderType,
  preferredProviderId: booking.preferredProviderId,
  scheduledAt: booking.scheduledAt,
  recurrenceUnit: booking.recurrenceUnit,
  recurrenceCount: booking.recurrenceCount,
});
