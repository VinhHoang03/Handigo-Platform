import type { BookingPolicy } from "../validations/bookingPolicy.validator";

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

export const getEarliestScheduledAt = (now = new Date()) => {
  const earliest = new Date(now);
  earliest.setSeconds(0, 0);
  const vietnamTime = new Date(earliest.getTime() + VIETNAM_OFFSET_MS);
  if (vietnamTime.getUTCHours() < 8) {
    vietnamTime.setUTCHours(8, 0, 0, 0);
    return new Date(vietnamTime.getTime() - VIETNAM_OFFSET_MS);
  }
  return earliest;
};

export const calculateBookingSettlement = (paidAmount: number, commissionRate: number, inspectionRequired = false) => {
  if (inspectionRequired) {
    // Cọc thực thu thuộc hệ thống.
    // Tiền sửa chữa theo báo giá được khách thanh toán trực tiếp cho thợ.
    return { platformCommissionAmount: paidAmount, providerEarningAmount: 0 };
  }
  const platformCommissionAmount = Math.min(paidAmount, Math.round(paidAmount * commissionRate));
  return { platformCommissionAmount, providerEarningAmount: paidAmount - platformCommissionAmount };
};

export const calculateDuration = (
  serviceId: string,
  inspection: boolean,
  options: Array<{ optionId: { toString(): string } | null; quantity?: number }>,
  policy: BookingPolicy,
) => {
  const service = policy.services[serviceId];
  if (inspection) return service?.inspectionMinutes ?? policy.inspectionDurationMinutes;
  let base = service?.durationMinutes ?? policy.defaultDurationMinutes;
  let extra = 0;
  const replacements: number[] = [];
  for (const option of options) {
    if (!option.optionId) continue;
    const rule = policy.options[option.optionId.toString()];
    if (!rule) continue;
    const time = rule.minutes * (option.quantity ?? 1);
    if (rule.mode === "replace") replacements.push(time);
    else extra += time;
  }
  if (replacements.length) base = Math.max(...replacements);
  return base + extra;
};

export interface ScheduleInterval {
  start: number;
  end: number;
  bufferMinutes: number;
  travelMinutes: number;
}

export const intervalsConflict = (a: ScheduleInterval, b: ScheduleInterval) => {
  const [first, second] = a.start <= b.start ? [a, b] : [b, a];
  return first.end + (first.bufferMinutes + Math.max(first.travelMinutes, second.travelMinutes)) * 60000 > second.start;
};
