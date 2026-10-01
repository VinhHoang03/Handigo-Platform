import type { BookingPolicy } from "../validations/bookingPolicy.validator";

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

export const getEarliestScheduledAt = (now = new Date()) => {
  const vietnamNow = new Date(now.getTime() + VIETNAM_OFFSET_MS);
  return new Date(Date.UTC(
    vietnamNow.getUTCFullYear(),
    vietnamNow.getUTCMonth(),
    vietnamNow.getUTCDate() + 1,
    1,
    0,
    0,
    0,
  ));
};

export const calculateImmediateFee = (amount: number, inspection: boolean, orderType: string, policy: BookingPolicy) => {
  if (!["normal", "urgent"].includes(orderType)) return 0;
  return inspection ? policy.immediateMin
    : Math.min(policy.immediateMax, Math.max(policy.immediateMin, Math.round(amount * policy.immediatePercent / 100)));
};

export const calculateBookingSettlement = (paidAmount: number, fee: number, commissionRate: number, providerFeePercent: number, inspectionRequired = false) => {
  if (inspectionRequired) {
    // Cọc thực thu thuộc hệ thống; thợ chỉ nhận phần phụ phí phục vụ ngay.
    // Tiền sửa chữa theo báo giá được khách thanh toán trực tiếp cho thợ.
    const providerEarningAmount = Math.min(paidAmount, Math.round(fee * providerFeePercent / 100));
    return { platformCommissionAmount: Math.max(paidAmount - providerEarningAmount, 0), providerEarningAmount };
  }
  const platformCommissionAmount = Math.min(paidAmount,
    Math.round(Math.max(paidAmount - fee, 0) * commissionRate) + fee - Math.round(fee * providerFeePercent / 100));
  return { platformCommissionAmount, providerEarningAmount: paidAmount - platformCommissionAmount };
};

export const calculateDuration = (
  serviceId: string,
  inspection: boolean,
  options: Array<{ optionId: { toString(): string }; quantity?: number }>,
  policy: BookingPolicy,
) => {
  const service = policy.services[serviceId];
  if (inspection) return service?.inspectionMinutes ?? policy.inspectionDurationMinutes;
  let base = service?.durationMinutes ?? policy.defaultDurationMinutes;
  let extra = 0;
  const replacements: number[] = [];
  for (const option of options) {
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
