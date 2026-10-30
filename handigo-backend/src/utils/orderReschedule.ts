import type { RescheduleRequestStatus } from "../models/orderRescheduleRequest.model";

export const getVietnamMonthBounds = (now = new Date()) => {
  const shifted = new Date(now.getTime() + 7 * 3_600_000);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1) - 7 * 3_600_000),
    end: new Date(Date.UTC(year, month + 1, 1) - 7 * 3_600_000),
  };
};

export const RESCHEDULE_QUOTA_STATUSES: RescheduleRequestStatus[] = ["applied", "rejected"];

export const rescheduleConsumesQuota = (status: RescheduleRequestStatus) => RESCHEDULE_QUOTA_STATUSES.includes(status);

export const canUseRescheduleQuota = (appliedCount: number) => appliedCount < 1;

export const requiresProviderMonthlyWarning = (monthlyAppliedCount: number, threshold: number) =>
  monthlyAppliedCount >= Math.max(threshold, 1) - 1;
