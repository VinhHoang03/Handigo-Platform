import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { BookingState } from '../../../types/booking';
import { toggleServiceOption } from '../utils/serviceOptionSelection';

export const useBookingStore = create<BookingState>()(persist((set) => ({
  categoryId: undefined,
  serviceId: undefined,
  selectedOptionIds: [],
  addressId: undefined,
  preferredProviderId: undefined,
  preferredProviderName: undefined,
  orderType: 'scheduled',
  scheduledAt: undefined,
  problemDescription: undefined,
  customerAttachments: [],
  paymentMethod: 'bank',

  setCategoryId: (id) => set({
    categoryId: id,
    serviceId: undefined,
    selectedOptionIds: [],
    preferredProviderId: undefined,
    preferredProviderName: undefined,
  }),
  setServiceId: (id) => set({
    serviceId: id,
    selectedOptionIds: [],
    preferredProviderId: undefined,
    preferredProviderName: undefined,
  }),
  selectService: (categoryId, serviceId, selectedOptionIds = []) =>
    set((state) => ({
      categoryId,
      serviceId,
      selectedOptionIds,
      ...(state.serviceId !== serviceId && {
        preferredProviderId: undefined,
        preferredProviderName: undefined,
      }),
    })),
  toggleOption: (option, options) =>
    set((state) => ({
      selectedOptionIds: toggleServiceOption(
        state.selectedOptionIds,
        option,
        options,
      ),
    })),
  setAddressId: (id) =>
    set((state) => ({
      addressId: id,
      ...(state.addressId !== id && {
        preferredProviderId: undefined,
        preferredProviderName: undefined,
      }),
    })),
  setPreferredProviderId: (id, name) => set({
    preferredProviderId: id,
    preferredProviderName: id ? name : undefined,
  }),
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
      preferredProviderId: undefined,
      preferredProviderName: undefined,
      orderType: 'scheduled',
      scheduledAt: undefined,
      problemDescription: undefined,
      customerAttachments: [],
      paymentMethod: 'bank',
    }),
}), {
  name: 'handigo:booking-session',
  storage: createJSONStorage(() => sessionStorage),
}));
