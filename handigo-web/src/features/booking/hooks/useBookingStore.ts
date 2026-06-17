import { create } from 'zustand';
import type { BookingState } from '../../../types/booking';

export const useBookingStore = create<BookingState>((set) => ({
  categoryId: undefined,
  serviceId: undefined,
  selectedOptionIds: [],
  addressId: undefined,
  orderType: 'scheduled',
  scheduledAt: undefined,
  problemDescription: undefined,
  customerAttachments: [],
  paymentMethod: 'wallet',

  setCategoryId: (id) => set({ categoryId: id, serviceId: undefined, selectedOptionIds: [] }),
  setServiceId: (id) => set({ serviceId: id, selectedOptionIds: [] }),
  toggleOption: (id) =>
    set((state) => ({
      selectedOptionIds: state.selectedOptionIds.includes(id)
        ? state.selectedOptionIds.filter((oid) => oid !== id)
        : [...state.selectedOptionIds, id],
    })),
  setAddressId: (id) => set({ addressId: id }),
  setOrderType: (type) => set({ orderType: type }),
  setScheduledAt: (date) => set({ scheduledAt: date }),
  setProblemDescription: (desc) => set({ problemDescription: desc }),
  setCustomerAttachments: (attachments) => set({ customerAttachments: attachments }),
  setPaymentMethod: (method) => set({ paymentMethod: method }),
  reset: () =>
    set({
      categoryId: undefined,
      serviceId: undefined,
      selectedOptionIds: [],
      addressId: undefined,
      orderType: 'scheduled',
      scheduledAt: undefined,
      problemDescription: undefined,
      customerAttachments: [],
      paymentMethod: 'wallet',
    }),
}));
