import { useEffect, useState } from 'react';
import { bookingApi, type BookingPreview } from '../api/booking.api';
import { customerServiceApi, type NearbyProvider } from '@/features/customer-service/api/customerService.api';
import { getErrorMessage } from '@/utils/apiError';
import { getEarliestScheduledAt, isWithinImmediateBookingHours } from '../components/step2Helpers';
import { isRequiredOptionSelectionMissing } from '../utils/serviceOptionSelection';
import type { PreparedRebooking, RebookingDraft } from '../utils/rebooking';

/** Giá và danh sách thợ phải thuộc cùng lựa chọn đang hiển thị. */
export function useQuickRebookingQuote(prepared: PreparedRebooking, draft: RebookingDraft) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; preview?: BookingPreview; providers?: NearbyProvider[]; error?: string }>({ key: '' });
  const selectedOptions = draft.selectedOptionIds.map(optionId => ({ optionId, quantity: draft.selectedOptionQuantities[optionId] ?? 1 }));
  const request = {
    serviceId: draft.serviceId!, orderType: draft.orderType, selectedOptions,
    uniformQuantity: draft.uniformQuantity > 1 ? draft.uniformQuantity : undefined,
  };
  const key = JSON.stringify({ ...request, addressId: draft.addressId, scheduledAt: draft.scheduledAt, attempt });
  const missingOptions = isRequiredOptionSelectionMissing(prepared.service, draft.selectedOptionIds, prepared.options);
  const scheduledTime = draft.scheduledAt ? new Date(draft.scheduledAt).getTime() : NaN;
  const scheduleValid = draft.orderType === 'normal' ? isWithinImmediateBookingHours()
    : Number.isFinite(scheduledTime) && scheduledTime >= getEarliestScheduledAt().getTime();
  const valid = Boolean(draft.addressId && scheduleValid && !missingOptions);

  useEffect(() => {
    if (!valid) return;
    let active = true;
    const input = JSON.parse(key) as typeof request & { addressId: string; scheduledAt?: string };
    const timer = window.setTimeout(() => {
      void Promise.all([
        bookingApi.preview({ serviceId: input.serviceId, orderType: input.orderType,
          selectedOptions: input.selectedOptions, uniformQuantity: input.uniformQuantity }),
        customerServiceApi.nearbyProviders(input.serviceId, input.addressId,
          input.orderType === 'scheduled' && input.scheduledAt ? new Date(input.scheduledAt).toISOString() : undefined,
          undefined, undefined, undefined, JSON.stringify(input.selectedOptions)),
      ]).then(([preview, providers]) => {
        if (active) setResult({ key, preview, providers });
      }).catch(cause => {
        if (active) setResult({ key, error: getErrorMessage(cause, 'Không thể cập nhật giá và thợ phù hợp. Vui lòng thử lại.') });
      });
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [key, valid]);

  const current = valid && result.key === key;
  return {
    key, valid, missingOptions, scheduleValid,
    loading: valid && !current,
    preview: current ? result.preview : undefined,
    providers: current ? result.providers ?? [] : [],
    error: current ? result.error : undefined,
    retry: () => setAttempt(value => value + 1),
  };
}
