import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { bookingPolicySchema, DEFAULT_BOOKING_POLICY } from '../validations/bookingPolicy.validator';
import { calculateBookingSettlement, calculateDuration, getEarliestScheduledAt, intervalsConflict } from '../utils/bookingPolicy';
import { getOrderInterval, isWithinWorkingCalendar } from '../utils/providerSchedule';
import { createOrderSchema, previewBookingSchema } from '../validations/order.validator';

const policy = DEFAULT_BOOKING_POLICY;
const serviceId = '100000000000000000000001';
const optionId = '100000000000000000000002';
const extraId = '100000000000000000000003';
const providerId = '100000000000000000000004';

assert.deepEqual(calculateBookingSettlement(200000, 0.15), { platformCommissionAmount: 30000, providerEarningAmount: 170000 });
assert.deepEqual(calculateBookingSettlement(180000, 0.15), { platformCommissionAmount: 27000, providerEarningAmount: 153000 });
assert.deepEqual(calculateBookingSettlement(80000, 0), { platformCommissionAmount: 0, providerEarningAmount: 80000 });
assert.deepEqual(calculateBookingSettlement(0, 0.15), { platformCommissionAmount: 0, providerEarningAmount: 0 });

// Đơn báo giá: cọc thuộc hệ thống, không cộng tiền sửa chữa vào ví thợ.
assert.deepEqual(calculateBookingSettlement(40000, 0, true), { platformCommissionAmount: 40000, providerEarningAmount: 0 });
// Voucher giảm tiền cọc thực thu của hệ thống.
assert.deepEqual(calculateBookingSettlement(30000, 0, true), { platformCommissionAmount: 30000, providerEarningAmount: 0 });
assert.deepEqual(calculateBookingSettlement(0, 0, true), { platformCommissionAmount: 0, providerEarningAmount: 0 });

const custom = bookingPolicySchema.parse({
  services: { [serviceId]: { durationMinutes: 90, inspectionMinutes: 45 } },
  options: { [optionId]: { minutes: 120, mode: 'replace' }, [extraId]: { minutes: 30, mode: 'add' } },
});
const options = [{ optionId, quantity: 1 }, { optionId: extraId, quantity: 2 }];
assert.equal(calculateDuration(serviceId, false, options, custom), 180);
assert.equal(calculateDuration(serviceId, true, options, custom), 45);
assert.equal(calculateDuration(serviceId, false, [], policy), 60);
assert.equal(bookingPolicySchema.safeParse({ immediateMin: 80000, immediateMax: 60000 }).success, false);
assert.equal(bookingPolicySchema.safeParse({ travelMinutes: -1 }).success, false);
assert.equal(bookingPolicySchema.safeParse({ defaultDurationMinutes: 0 }).success, false);
assert.equal(bookingPolicySchema.safeParse({ workdayStart: 1200, workdayEnd: 480 }).success, false);
assert.equal(bookingPolicySchema.safeParse({ services: { invalid: { durationMinutes: 60 } } }).success, false);
assert.equal(previewBookingSchema.safeParse({ serviceId, orderType: 'normal', selectedOptions: [{ optionId, quantity: 2 }] }).success, true);
// Giữ số lượng máy qua validation của cả xem trước giá và tạo đơn.
for (const uniformQuantity of [1, 2, 3, 99]) {
  assert.equal(previewBookingSchema.parse({ serviceId, uniformQuantity }).uniformQuantity, uniformQuantity);
  assert.equal(createOrderSchema.parse({ serviceId, uniformQuantity, addressId: extraId, paymentMethod: 'bank' }).uniformQuantity, uniformQuantity);
}
for (const uniformQuantity of [0, -1, 1.5, 100]) {
  assert.equal(previewBookingSchema.safeParse({ serviceId, uniformQuantity }).success, false);
  assert.equal(createOrderSchema.safeParse({ serviceId, uniformQuantity, addressId: extraId, paymentMethod: 'bank' }).success, false);
}
assert.equal(previewBookingSchema.parse({ serviceId }).uniformQuantity, undefined);

const at = (time: string) => Date.parse(`2026-09-28T${time}:00+07:00`);
// Cho phép đặt sát thời gian hiện tại từ 08:00, không cần đặt trước 2 tiếng.
assert.equal(getEarliestScheduledAt(new Date(at('05:00'))).getTime(), at('08:00'));
assert.equal(getEarliestScheduledAt(new Date(at('06:00'))).getTime(), at('08:00'));
assert.equal(getEarliestScheduledAt(new Date(at('09:30'))).getTime(), at('09:30'));
assert.equal(getEarliestScheduledAt(new Date('2026-09-28T09:30:47+07:00')).getTime(), at('09:30'));
assert.equal(getEarliestScheduledAt(new Date('2026-09-28T09:30:59+07:00')).getTime(), at('09:30'));
assert.equal(getEarliestScheduledAt(new Date('2026-09-28T09:31:00+07:00')).getTime(), at('09:31'));
assert.equal(getEarliestScheduledAt(new Date(at('15:00'))).getTime(), at('15:00'));
assert.equal(getEarliestScheduledAt(new Date(at('23:30'))).getTime(), at('23:30'));
assert.equal(getEarliestScheduledAt(new Date('2026-09-29T00:30:00+07:00')).getTime(), Date.parse('2026-09-29T08:00:00+07:00'));
const earliest = getEarliestScheduledAt(new Date(at('09:30'))).getTime();
assert.equal(at('09:00') >= earliest, false);
assert.equal(at('10:00') >= earliest, true);
assert.equal(at('11:00') >= earliest, true);
const interval = (start: string, end: string) => ({ start: at(start), end: at(end), bufferMinutes: 15, travelMinutes: 30 });
const first = interval('09:00', '10:30');
assert.equal(intervalsConflict(first, interval('11:00', '12:00')), true);
assert.equal(intervalsConflict(first, interval('11:15', '12:15')), false);
assert.equal(intervalsConflict(interval('11:15', '12:15'), first), false);
assert.equal(intervalsConflict(first, interval('09:30', '10:00')), true);
assert.equal(intervalsConflict({ ...first, end: Infinity }, interval('18:00', '19:00')), true);
assert.equal(intervalsConflict(interval('13:00', '14:00'), interval('14:30', '15:30')), true);

const calendar = bookingPolicySchema.parse({ providerCalendars: { [providerId]: {
  weekly: { '1': [{ start: 480, end: 720 }, { start: 780, end: 1200 }] },
  absences: [{ start: '2026-09-28T15:00:00+07:00', end: '2026-09-28T16:00:00+07:00' }],
} } });
assert.equal(isWithinWorkingCalendar(providerId, first, calendar), true);
assert.equal(isWithinWorkingCalendar(providerId, interval('11:00', '12:00'), calendar), false);
assert.equal(isWithinWorkingCalendar(providerId, interval('15:30', '16:30'), calendar), false);
assert.equal(isWithinWorkingCalendar(providerId, interval('16:00', '17:00'), calendar), true);
assert.equal(isWithinWorkingCalendar(providerId, { ...first, start: first.start + 86400000, end: first.end + 86400000 }, calendar), false);

const legacy = {
  serviceId: new Types.ObjectId(serviceId), inspectionRequired: false, selectedOptionsSnapshot: [],
  scheduledAt: new Date(at('09:00')), status: 'accepted' as const,
};
assert.equal(getOrderInterval(legacy, policy, at('08:00')).end, at('10:00'));
assert.equal(getOrderInterval(legacy, policy, at('11:00')).end, Infinity);
assert.equal(getOrderInterval({ ...legacy, schedule: { durationMinutes: 90, bufferMinutes: 10, travelMinutes: 20 } }, custom, at('08:00')).end, at('10:30'));
console.log('Đã kiểm tra phí, phân chia thu nhập, thời lượng, ranh giới lịch, ca làm việc và dữ liệu cũ.');
