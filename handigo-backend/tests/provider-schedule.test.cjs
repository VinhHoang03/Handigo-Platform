const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { Types } = require('mongoose');

function load(file, modules = {}) {
  const filename = path.join(__dirname, '../src', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Date, Map, Set, require(name) {
    if (!(name in modules)) throw new Error(`Module chưa được giả lập: ${name}`);
    return modules[name];
  } }, { filename });
  return exports;
}

const at = (day, hour) => new Date(`2030-01-${day}T${hour}:00+07:00`);
const interval = (day, hour) => ({ start: +at(day, hour), end: +at(day, hour) + 3600000, bufferMinutes: 15, travelMinutes: 30 });
const booking = load('utils/bookingPolicy.ts');
const schedule = load('utils/providerSchedule.ts', { './bookingPolicy': booking });
const policy = { defaultDurationMinutes: 60, inspectionDurationMinutes: 60, bufferMinutes: 15,
  travelMinutes: 30, workdayStart: 0, workdayEnd: 1440, services: {}, options: {}, providerCalendars: {} };

function setup(overrides = {}) {
  const providerId = new Types.ObjectId();
  const order = { _id: new Types.ObjectId(), providerId, serviceId: new Types.ObjectId(),
    status: 'completed', isDeleted: false, inspectionRequired: false, selectedOptionsSnapshot: [],
    scheduledAt: at('17', '10:00'),
    schedule: { durationMinutes: 60, bufferMinutes: 15, travelMinutes: 30,
      expectedStartAt: at('16', '08:00'), expectedEndAt: at('16', '09:00') },
    ...overrides,
  };
  const service = load('services/providerSchedule.service.ts', {
    mongoose: {}, '../models/provider.model': {}, '../utils/appError': { AppError: Error },
    '../utils/bookingPolicy': booking, '../utils/providerSchedule': schedule,
    './systemConfig.service': { getBookingPolicy: async () => policy }, './notification.service': {},
    '../models/order.model': { Order: { find(filter) {
      const matches = filter.status.$in.includes(order.status) && !order.isDeleted
        && !(filter.$nor && order.status === 'accepted' && order.customerNoShow?.status === 'pending')
        && filter.providerId.$in.some(id => String(id) === String(order.providerId))
        && !filter._id.$nin.some(id => String(id) === String(order._id));
      return { session: async () => matches ? [order] : [] };
    } } },
  });
  return { order, providerId, ...service };
}

for (const status of ['accepted', 'in_progress']) {
  test(`${status}: giữ khung giờ hẹn gốc khi công việc bắt đầu sớm ngày hôm trước`, async () => {
    const context = setup({ status });
    const available = await context.getAvailableProviderIds([context.providerId], [interval('17', '10:00')]);
    assert.equal(available.has(String(context.providerId)), false);
  });
}

test('Báo cáo khách vắng mặt chờ duyệt giải phóng cả khung thực tế và khung hẹn để nhận đơn mới', async () => {
  const ctx = setup({ status: 'accepted', customerNoShow: { status: 'pending', reportId: new Types.ObjectId() } });
  assert.equal((await ctx.getAvailableProviderIds([ctx.providerId], [interval('16', '08:30')])).size, 1);
  assert.equal((await ctx.getAvailableProviderIds([ctx.providerId], [interval('17', '10:00')])).size, 1);
});

test('Đơn đang thực hiện vẫn giữ lịch kể cả dữ liệu báo cáo còn pending', async () => {
  const ctx = setup({ status: 'in_progress', customerNoShow: { status: 'pending' } });
  assert.equal((await ctx.getAvailableProviderIds([ctx.providerId], [interval('17', '10:00')])).size, 0);
});

test('Báo cáo bị từ chối đưa đơn trở lại kiểm tra lịch trước khi tiếp tục', async () => {
  const ctx = setup({ status: 'accepted', customerNoShow: { status: 'rejected' } });
  assert.equal((await ctx.getAvailableProviderIds([ctx.providerId], [interval('17', '10:00')])).size, 0);
});

test('Thợ có thể nhận lịch mới tại khung giờ hẹn gốc của đơn đã hoàn thành sớm', async () => {
  const context = setup();
  const next = { _id: new Types.ObjectId(), serviceId: context.order.serviceId,
    status: 'created', scheduledAt: at('17', '10:00'), inspectionRequired: false,
    selectedOptionsSnapshot: [], schedule: { durationMinutes: 60, bufferMinutes: 15, travelMinutes: 30 } };
  next.toObject = () => ({ ...next });
  await context.assertProviderSchedule(context.providerId, [next], {}, policy);
});

test('Vẫn chặn trùng giờ thực hiện thực tế của đơn hoàn thành', async () => {
  const context = setup();
  const available = await context.getAvailableProviderIds([context.providerId], [interval('16', '08:30')]);
  assert.equal(available.has(String(context.providerId)), false);
});

test('Không khóa khoảng trống giữa giờ thực hiện sớm và lịch hẹn gốc', async () => {
  const context = setup();
  const available = await context.getAvailableProviderIds([context.providerId], [interval('16', '14:00')]);
  assert.equal(available.has(String(context.providerId)), true);
});

test('Giữ dự phòng và di chuyển sau khung giờ đã đặt, mở lại đúng ranh giới', async () => {
  const context = setup({ status: 'accepted' });
  assert.equal((await context.getAvailableProviderIds([context.providerId], [interval('17', '11:30')])).size, 0);
  assert.equal((await context.getAvailableProviderIds([context.providerId], [interval('17', '11:45')])).size, 1);
});

for (const overrides of [{ status: 'cancelled' }, { isDeleted: true }, { providerId: new Types.ObjectId() }]) {
  test(`Không giữ lịch của đơn không còn hiệu lực với thợ: ${JSON.stringify(overrides)}`, async () => {
    const context = setup(overrides);
    assert.equal((await context.getAvailableProviderIds([context.providerId], [interval('17', '10:00')])).size, 1);
  });
}

test('Bỏ qua chính đơn đang kiểm tra và hỗ trợ lịch cũ chưa có snapshot thời lượng', async () => {
  const context = setup({ schedule: null, status: 'accepted' });
  assert.equal((await context.getAvailableProviderIds([context.providerId], [interval('17', '10:00')])).size, 0);
  assert.equal((await context.getAvailableProviderIds([context.providerId], [interval('17', '10:00')],
    { excludeOrderIds: [context.order._id] })).size, 1);
});

test('Đơn từ tuần trước bắt đầu và hoàn thành hôm nay giải phóng giờ dự kiến còn lại sau khoảng đệm', async () => {
  const context = setup({
    createdAt: at('09', '10:00'), scheduledAt: at('09', '10:00'),
    confirmation: { providerConfirmedAt: at('16', '08:05') },
  });
  assert.equal((await context.getAvailableProviderIds([context.providerId], [interval('16', '08:49')])).size, 0);
  assert.equal((await context.getAvailableProviderIds([context.providerId], [interval('16', '08:50')])).size, 1);
});

test('Hoàn thành sớm giải phóng khung giờ hẹn gốc ở tương lai', async () => {
  const context = setup({ confirmation: { providerConfirmedAt: at('16', '08:05') } });
  assert.equal((await context.getAvailableProviderIds([context.providerId], [interval('17', '10:00')])).size, 1);
});

test('Hoàn thành trễ vẫn giữ lịch đến giờ hoàn thành thực tế và hết khoảng đệm', async () => {
  const context = setup({ confirmation: { providerConfirmedAt: at('16', '10:00') } });
  assert.equal((await context.getAvailableProviderIds([context.providerId], [interval('16', '10:44')])).size, 0);
  assert.equal((await context.getAvailableProviderIds([context.providerId], [interval('16', '10:45')])).size, 1);
});

test('Đơn hoàn thành cũ thiếu giờ xác nhận dùng giờ kết thúc dự kiến', async () => {
  const context = setup({ confirmation: { providerConfirmedAt: null } });
  assert.equal((await context.getAvailableProviderIds([context.providerId], [interval('16', '09:44')])).size, 0);
  assert.equal((await context.getAvailableProviderIds([context.providerId], [interval('16', '09:45')])).size, 1);
});

for (const status of ['accepted', 'in_progress']) {
  test(`${status}: đơn quá hạn vẫn chặn lịch đến khi hoàn thành`, () => {
    const context = setup({ status, confirmation: { providerConfirmedAt: at('16', '08:05') } });
    assert.equal(schedule.getOrderInterval(context.order, policy, +at('18', '10:00')).end, Infinity);
  });
}
