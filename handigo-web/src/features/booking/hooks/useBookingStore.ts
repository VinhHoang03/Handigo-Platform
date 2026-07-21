import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { BookingState } from '../../../types/booking';
import { toggleServiceOption } from '../utils/serviceOptionSelection';

export const useBookingStore = create<BookingState>()(persist((set) => ({
  categoryId: undefined,
  serviceId: undefined,
  selectedOptionIds: [],
  selectedOptionQuantities: {},
  addressId: undefined,
  preferredProviderId: undefined,
  preferredProviderName: undefined,
  requestedProviderId: undefined,
  requestedProviderName: undefined,
  orderType: 'scheduled',
  scheduledAt: undefined,
  recurrenceUnit: 'weekly',
  recurrenceCount: 1,
  problemDescription: undefined,
  customerAttachments: [],
  paymentMethod: 'bank',

  setCategoryId: (id) => set({
    categoryId: id,
    serviceId: undefined,
    selectedOptionIds: [],
    selectedOptionQuantities: {},
    preferredProviderId: undefined,
    preferredProviderName: undefined,
    requestedProviderId: undefined,
    requestedProviderName: undefined,
  }),
  setServiceId: (id) => set({
    serviceId: id,
    selectedOptionIds: [],
    selectedOptionQuantities: {},
    preferredProviderId: undefined,
    preferredProviderName: undefined,
    requestedProviderId: undefined,
    requestedProviderName: undefined,
  }),
  selectService: (categoryId, serviceId, selectedOptionIds = [], selectedOptionQuantities = {}) =>
    set((state) => ({
      categoryId,
      serviceId,
      selectedOptionIds,
      selectedOptionQuantities: Object.fromEntries(
        selectedOptionIds.map((id) => [id, selectedOptionQuantities[id] ?? 1]),
      ),
      ...(state.serviceId !== serviceId && {
        preferredProviderId: undefined,
        preferredProviderName: undefined,
        requestedProviderId: undefined,
        requestedProviderName: undefined,
      }),
    })),
  toggleOption: (option, options) =>
    set((state) => {
      const selectedOptionIds = toggleServiceOption(
        state.selectedOptionIds,
        option,
        options,
      );
      return {
        selectedOptionIds,
        selectedOptionQuantities: Object.fromEntries(
          selectedOptionIds.map((id) => [id, state.selectedOptionQuantities?.[id] ?? 1]),
        ),
      };
    }),
  setOptionQuantity: (optionId, quantity) =>
    set((state) => ({
      selectedOptionQuantities: {
        ...(state.selectedOptionQuantities ?? {}),
        [optionId]: Math.min(Math.max(Math.trunc(quantity) || 1, 1), 99),
      },
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
  setRequestedProvider: (id, name) => set({
    requestedProviderId: id,
    requestedProviderName: id ? name : undefined,
  }),
  setOrderType: (type) => set({ orderType: type }),
  setScheduledAt: (date) => set({ scheduledAt: date }),
  setRecurrenceUnit: (unit) => set({ recurrenceUnit: unit }),
  setRecurrenceCount: (count) => set({ recurrenceCount: count }),
  setProblemDescription: (desc) => set({ problemDescription: desc }),
  setCustomerAttachments: (attachments) => set({ customerAttachments: attachments }),
  setPaymentMethod: (method) => set({ paymentMethod: method }),
  reset: () =>
    set({
      categoryId: undefined,
      serviceId: undefined,
      selectedOptionIds: [],
      selectedOptionQuantities: {},
      addressId: undefined,
      preferredProviderId: undefined,
      preferredProviderName: undefined,
      requestedProviderId: undefined,
      requestedProviderName: undefined,
      orderType: 'scheduled',
      scheduledAt: undefined,
      recurrenceUnit: 'weekly',
      recurrenceCount: 1,
      problemDescription: undefined,
      customerAttachments: [],
      paymentMethod: 'bank',
    }),
}), {
  name: 'handigo:booking-session',
  storage: createJSONStorage(() => sessionStorage),
}));
