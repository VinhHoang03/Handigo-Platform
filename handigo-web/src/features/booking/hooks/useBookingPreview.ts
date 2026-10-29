import { useEffect } from 'react';
import { create } from 'zustand';
import { bookingApi, type BookingPreview } from '../api/booking.api';
import { useBookingStore } from './useBookingStore';
import { getConfirmPaymentErrorMessage } from '../components/confirmPaymentSubmitTypes';

const usePreviewState = create<{
  key: string;
  request: number;
  data?: BookingPreview;
  error?: string;
  loading: boolean;
}>(() => ({ key: '', request: 0, loading: false }));

export const invalidateBookingPreview = () => {
  usePreviewState.setState(state => ({ key: '', request: state.request + 1, data: undefined, error: undefined, loading: false }));
};

const loadPreview = async (key: string, force = false) => {
  const current = usePreviewState.getState();
  if (current.key === key && (current.loading || (!force && (current.data || current.error)))) return;
  const request = current.request + 1;
  usePreviewState.setState({ key, request, data: undefined, error: undefined, loading: true });
  try {
    const data = await bookingApi.preview(JSON.parse(key));
    if (usePreviewState.getState().request === request) usePreviewState.setState({ data, loading: false });
  } catch (error: unknown) {
    if (usePreviewState.getState().request === request) {
      usePreviewState.setState({ error: getConfirmPaymentErrorMessage(error), loading: false });
    }
  }
};

export function useBookingPreview(voucherCode?: string, enabled = true) {
  const { serviceId, orderType, selectedOptionIds, selectedOptionQuantities, uniformQuantity } = useBookingStore();
  const key = JSON.stringify({ serviceId, orderType, voucherCode, uniformQuantity: uniformQuantity > 1 ? uniformQuantity : undefined, selectedOptions: selectedOptionIds.map((optionId) => ({ optionId, quantity: selectedOptionQuantities?.[optionId] ?? 1 })) });
  const state = usePreviewState();
  useEffect(() => {
    if (serviceId && enabled) void loadPreview(key);
  }, [key, serviceId, enabled]);
  const current = state.key === key;
  return {
    preview: enabled && current ? state.data : undefined,
    error: enabled && current ? state.error : undefined,
    loading: Boolean(enabled && serviceId && (!current || state.loading)),
    retry: () => { if (serviceId && enabled) void loadPreview(key, true); },
  };
}
