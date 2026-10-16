import type { IOrder } from '../models/order.model';
import type { BookingPolicy } from '../validations/bookingPolicy.validator';
import { calculateDuration, type ScheduleInterval } from './bookingPolicy';

type ScheduleOrder = Pick<IOrder, "serviceId" | "inspectionRequired" | "selectedOptionsSnapshot" | "schedule" | "scheduledAt" | "status"> & { createdAt?: Date };

export const getOrderInterval = (order: ScheduleOrder, policy: BookingPolicy, now = Date.now()): ScheduleInterval => {
  const duration = order.schedule?.durationMinutes ?? calculateDuration(order.serviceId.toString(), order.inspectionRequired, order.selectedOptionsSnapshot ?? [], policy);
  const start = order.schedule?.expectedStartAt?.getTime() ?? order.scheduledAt?.getTime() ?? order.createdAt?.getTime() ?? now;
  let end = order.schedule?.expectedEndAt?.getTime() ?? start + duration * 60000;
  // Chưa hoàn tất thực tế thì không tự giải phóng lịch đã quá giờ dự kiến.
  if (["accepted", "in_progress"].includes(order.status) && end <= now) end = Infinity;
  return { start, end, bufferMinutes: order.schedule?.bufferMinutes ?? policy.bufferMinutes, travelMinutes: order.schedule?.travelMinutes ?? policy.travelMinutes };
};

export const isWithinWorkingCalendar = (providerId: string, interval: ScheduleInterval, policy: BookingPolicy) => {
  const calendar = policy.providerCalendars[providerId];
  const localStart = new Date(interval.start + 7 * 3600000);
  const localEnd = new Date(interval.end + interval.bufferMinutes * 60000 + 7 * 3600000);
  if (!Number.isFinite(interval.end)) return false;
  const midnight = Date.UTC(localStart.getUTCFullYear(), localStart.getUTCMonth(), localStart.getUTCDate());
  const startMinute = (localStart.getTime() - midnight) / 60000;
  const endMinute = (localEnd.getTime() - midnight) / 60000;
  const windows = calendar ? calendar.weekly[String(localStart.getUTCDay()) as keyof typeof calendar.weekly] ?? []
    : [{ start: policy.workdayStart, end: policy.workdayEnd }];
  if (!windows.some((window) => startMinute >= window.start && endMinute <= window.end)) return false;
  return !calendar?.absences.some((absence) => interval.start < Date.parse(absence.end) && interval.end + interval.bufferMinutes * 60000 > Date.parse(absence.start));
};
