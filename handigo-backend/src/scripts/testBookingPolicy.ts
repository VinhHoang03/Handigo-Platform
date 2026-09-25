import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { bookingPolicySchema, DEFAULT_BOOKING_POLICY } from '../validations/bookingPolicy.validator';
import { calculateBookingSettlement, calculateDuration, calculateImmediateFee, intervalsConflict } from '../utils/bookingPolicy';
import { getOrderInterval, isWithinWorkingCalendar } from '../utils/providerSchedule';
import { previewBookingSchema } from '../validations/order.validator';

const policy = DEFAULT_BOOKING_POLICY;
const serviceId = '100000000000000000000001';
const optionId = '100000000000000000000002';
const extraId = '100000000000000000000003';
const providerId = '100000000000000000000004';

assert.equal(calculateImmediateFee(200000, false, 'normal', policy), 30000);
assert.equal(calculateImmediateFee(50000, false, 'urgent', policy), 20000);
assert.equal(calculateImmediateFee(1000000, false, 'normal', policy), 60000);
assert.equal(calculateImmediateFee(200000, false, 'scheduled', policy), 0);
assert.equal(calculateImmediateFee(200000, false, 'recurring', policy), 0);
assert.equal(calculateImmediateFee(50000, true, 'normal', policy), 20000);
assert.equal(calculateImmediateFee(1000000, true, 'normal', policy), 20000);
assert.deepEqual(calculateBookingSettlement(230000, 30000, 0.15, 80), { platformCommissionAmount: 36000, providerEarningAmount: 194000 });
assert.deepEqual(calculateBookingSettlement(210000, 30000, 0.15, 80), { platformCommissionAmount: 33000, providerEarningAmount: 177000 });
assert.deepEqual(calculateBookingSettlement(80000, 30000, 0, 80), { platformCommissionAmount: 6000, providerEarningAmount: 74000 });
assert.deepEqual(calculateBookingSettlement(30000, 30000, 0.15, 80), { platformCommissionAmount: 6000, providerEarningAmount: 24000 });

// Đơn báo giá: cọc thuộc hệ thống, không cộng tiền sửa chữa vào ví thợ.
assert.deepEqual(calculateBookingSettlement(40000, 0, 0, 80, true), { platformCommissionAmount: 40000, providerEarningAmount: 0 });
// Cọc 40.000đ + phụ phí 20.000đ; thợ nhận 80% phụ phí.
assert.deepEqual(calculateBookingSettlement(60000, 20000, 0, 80, true), { platformCommissionAmount: 44000, providerEarningAmount: 16000 });
// Voucher giảm cọc 10.000đ, không giảm phần phụ phí của thợ.
assert.deepEqual(calculateBookingSettlement(50000, 20000, 0, 80, true), { platformCommissionAmount: 34000, providerEarningAmount: 16000 });
assert.deepEqual(calculateBookingSettlement(20000, 20000, 0, 80, true), { platformCommissionAmount: 4000, providerEarningAmount: 16000 });
assert.deepEqual(calculateBookingSettlement(0, 0, 0, 80, true), { platformCommissionAmount: 0, providerEarningAmount: 0 });
// Tỷ lệ lấy từ cấu hình của đơn, không cố định ở mức 80%.
assert.deepEqual(calculateBookingSettlement(60000, 20000, 0, 65, true), { platformCommissionAmount: 47000, providerEarningAmount: 13000 });
assert.deepEqual(calculateBookingSettlement(60000, 20000, 0, 0, true), { platformCommissionAmount: 60000, providerEarningAmount: 0 });
assert.deepEqual(calculateBookingSettlement(60000, 20000, 0, 100, true), { platformCommissionAmount: 40000, providerEarningAmount: 20000 });

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

const at = (time: string) => Date.parse(`2026-09-28T${time}:00+07:00`);
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
