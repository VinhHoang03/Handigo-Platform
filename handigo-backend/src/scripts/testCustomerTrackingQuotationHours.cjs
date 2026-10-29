const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { Types } = require('mongoose');
const { AppError } = require('../utils/appError');
const webRoot = path.resolve(__dirname, '../../../handigo-web');
let now = Date.parse('2026-10-25T12:00:00+07:00');
class ClockDate extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}
// Chạy module thật với đồng hồ và dịch vụ ngoài cô lập, không đọc cấu hình bí mật.
function load(file, dependencies = {}, extras = {}) {
  const filename = path.isAbsolute(file) ? file : require.resolve(file);
  const context = { exports: {}, Date: ClockDate, Set, Map, Number, Intl,
    setTimeout, clearTimeout, require: name => {
      assert.ok(name in dependencies, `Chưa giả lập phụ thuộc ${name} của ${path.basename(filename)}`);
      return dependencies[name];
    }, ...extras };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context);
  return context.exports;
}
const query = value => ({ select() { return this; }, sort() { return this; }, lean: async () => value });
async function testTracking() {
  const orderId = new Types.ObjectId().toString();
  const users = { customer: { id: 'khach', role: 'CUSTOMER' },
    a: { id: 'tho-cu', role: 'PROVIDER' }, b: { id: 'tho-moi', role: 'PROVIDER' },
    outsider: { id: 'nguoi-ngoai', role: 'CUSTOMER' } };
  const order = { _id: orderId, customerId: users.customer.id, providerId: 'A', status: 'accepted',
    createdAt: new Date(), addressSnapshot: { latitude: 10, longitude: 106 } };
  let afterSave;
  let saves = 0;
  const tracking = load('../services/orderTracking.service', {
    '../models/order.model': { Order: { findById: () => query({ ...order }) } },
    '../models/provider.model': { Provider: { findById: providerId => query({ userId: providerId === 'A' ? users.a.id : users.b.id }) } },
    '../models/location.model': { Location: { findOne: () => query(null) } },
    '../models/address.model': {}, '../utils/appError': { AppError }, './routing.service': {},
    './location.service': { updateCurrentLocation: async () => {
      saves++; if (afterSave) afterSave(); return { lastUpdatedAt: new Date() };
    } },
  });
  const sockets = [];
  let connection;
  class Server {
    use() {}
    on(event, callback) { if (event === 'connection') connection = callback; }
    in(room) { return { fetchSockets: async () => sockets.filter(socket => socket.rooms.has(room)) }; }
    to(ids) {
      const targets = Array.isArray(ids) ? ids : [ids];
      return { emit: (event, payload) => sockets.filter(socket => targets.some(target => socket.rooms.has(target)))
        .forEach(socket => socket.received.push({ event, payload })) };
    }
  }
  load('../sockets/initSocket', {
    'socket.io': { Server }, jsonwebtoken: {}, '../models/user.model': { default: {
      findOne: filter => query({ role: Object.values(users).find(user => user.id === filter._id).role,
        status: 'active', tokenVersion: 0 }),
    }, __esModule: true },
    '../services/chat.service': {}, '../services/orderTracking.service': tracking,
    './socketServer': { setSocketServer() {} }, '../configs/cors': {},
    '../validations/chat.validator': {},
    '../validations/location.validator': { currentLocationSchema: require('../validations/location.validator').currentLocationSchema },
    '../validations/order.validator': { orderIdParamSchema: require('../validations/order.validator').orderIdParamSchema },
    '../services/providerPresence.service': {}, '../utils/logger': { createLogger: () => ({ warn() {}, error() {} }) },
    '../utils/token': { isTokenVersionCurrent: () => true },
  }).initSocket({});
  function connect(name, user) {
    const handlers = {};
    const socket = { id: name, user, rooms: new Set([name]), received: [],
      on(event, callback) { handlers[event] = callback; }, use() {},
      join(room) { socket.rooms.add(room); }, disconnect() { assert.fail('Không được ngắt tài khoản hợp lệ.'); },
      async send(event, payload) {
        let response;
        await handlers[event](payload, value => { response = value; });
        return response;
      },
    };
    sockets.push(socket); connection(socket); return socket;
  }
  const customer = connect('socket-khach', users.customer);
  const secondDevice = connect('socket-khach-thu-hai', users.customer);
  const oldProvider = connect('socket-A', users.a);
  const newProvider = connect('socket-B', users.b);
  const outsider = connect('socket-ngoai', users.outsider);
  for (const socket of [customer, oldProvider]) {
    assert.equal((await socket.send('order:tracking:join', { orderId })).success, true);
  }
  assert.equal((await outsider.send('order:tracking:join', { orderId })).success, false);
  // Giữ nguyên room của A sau khi đổi thợ để tái hiện lỗi ban đầu.
  order.providerId = 'B';
  assert.equal((await newProvider.send('order:tracking:join', { orderId })).success, true);
  const location = { orderId, latitude: 10.5, longitude: 106.5 };
  assert.equal((await newProvider.send('order:location:update', location)).success, true);
  assert.equal(customer.received.length, 1); assert.equal(newProvider.received.length, 1);
  assert.equal(customer.received[0].payload.latitude, 10.5);
  assert.equal(oldProvider.received.length, 0); assert.equal(outsider.received.length, 0);
  assert.equal(secondDevice.received.length, 0, 'Thiết bị chưa theo dõi đơn không nhận sự kiện vị trí.');
  assert.ok(oldProvider.rooms.has(`order:${orderId}`));
  assert.equal((await oldProvider.send('order:location:update', location)).success, false);
  assert.equal(saves, 1, 'Thợ đã rời đơn không được ghi vị trí.');
  assert.equal((await oldProvider.send('order:tracking:join', { orderId })).success, false);
  afterSave = () => { order.providerId = 'A'; };
  assert.equal((await newProvider.send('order:location:update', location)).success, false);
  assert.equal(customer.received.length, 1, 'Đổi phân công trong lúc lưu phải được kiểm tra lại trước khi phát.');
  afterSave = null; order.providerId = 'B'; order.status = 'completed';
  assert.equal((await newProvider.send('order:location:update', location)).success, false);
  assert.equal(customer.received.length, 1);
}
function testQuotations() {
  const payment = load(path.join(webRoot, 'src/utils/quotationPayment.ts'));
  const paidDeposit = { status: 'paid', paymentType: 'inspection_deposit', amount: 100000 };
  const order = { _id: 'don', status: 'completed', inspectionRequired: true, paymentStatus: 'paid',
    depositPaidAt: '2026-10-25T02:00:00Z', pricing: { baseAmount: 100000, totalPaidAmount: 100000 } };
  const quotation = { _id: 'bao-gia', status: 'approved', finalAmount: 500000 };
  const data = { order, quotation: { quotation, items: [] }, payments: [paidDeposit] };
  const hook = load(path.join(webRoot, 'src/features/booking/components/detail/useBookingDetail.ts'), {
    react: { useState: value => [value, () => {}] }, 'react-router-dom': { useParams: () => ({ bookingId: 'don' }) },
    '@/utils/quotationPayment': payment, './useBookingDetailData': { useBookingDetailData: () => data },
    './useMatchingCountdown': { useMatchingCountdown: () => ({}) },
    './useBookingPaymentFlow': { useBookingPaymentFlow: () => ({}) },
    './useBookingCancellationFlow': { useBookingCancellationFlow: () => ({}) },
    './useBookingReassignmentFlow': { useBookingReassignmentFlow: () => ({}) },
    './bookingDetailTimeline': { buildOrderTimeline: () => [] },
    './bookingDetailFormatters': { getPaymentStatusDisplay: () => '' },
    './bookingDetailProvider': { getProviderInfo: () => null },
  }).useBookingDetail;
  const agent = load('../services/agentQuotation.service', {
    zod: require('zod'), './assignment.service': { AssignmentService: { getQuotationByOrder: async () => data.quotation } },
    './order.service': {}, '../models/payment.model': { Payment: { find: () => query([paidDeposit]) } },
    './agentBookingHistory.service': { ownedBooking: async () => order },
    '../utils/appError': { AppError }, '../utils/actionPreconditionError': {},
  }).AgentQuotationService;
  const react = require(require.resolve('react', { paths: [webRoot] }));
  const jsx = require(require.resolve('react/jsx-runtime', { paths: [webRoot] }));
  const { renderToStaticMarkup } = require(require.resolve('react-dom/server', { paths: [webRoot] }));
  const Details = load(path.join(webRoot, 'src/features/booking/components/detail/BookingQuotationDetails.tsx'), {
    'react/jsx-runtime': jsx, 'lucide-react': { FileSpreadsheet: () => null },
    './bookingDetailFormatters': { formatCurrency: value => `${value} đ`,
      getQuotationStatusClass: () => '', getQuotationStatusLabel: status => status },
  }).BookingQuotationDetails;
  return (async () => {
    const cases = [
      { status: 'approved', confirmedAt: null, confirmed: 400000, expected: 400000 },
      { status: 'approved', confirmedAt: '2026-10-25T03:00:00Z', confirmed: 400000, expected: 0 },
      { status: 'approved', confirmedAt: '2026-10-25T03:00:00Z', confirmed: 100000, expected: 300000 },
      { status: 'approved', confirmedAt: '2026-10-25T03:00:00Z', confirmed: 900000, expected: 0 },
      { status: 'approved', confirmedAt: '2026-10-25T03:00:00Z', confirmed: null, expected: 400000 },
      ...['rejected', 'cancelled', 'expired'].map(status => ({ status, expected: 0 })),
      { status: 'pending', expected: 400000 }, { status: 'saved', expected: 400000 },
    ];
    for (const item of cases) {
      quotation.status = item.status; quotation.directPaymentConfirmedAt = item.confirmedAt;
      quotation.directPaymentConfirmedAmount = item.confirmed;
      assert.equal(hook().remainingQuotationAmount, item.expected);
      assert.equal((await agent.get('khach', 'don')).quotation.remainingDirectPaymentAmount, item.expected);
      const html = renderToStaticMarkup(react.createElement(Details, {
        quotation: data.quotation, orderStatus: order.status, appliedDepositAmount: 100000,
        remainingQuotationAmount: hook().remainingQuotationAmount, busy: false, onReject() {},
      }));
      assert.ok(html.includes('Thợ xác nhận đã nhận trực tiếp'));
      if (item.confirmedAt) assert.ok(html.includes('Đây là ghi nhận của thợ'));
      if (['rejected', 'cancelled', 'expired'].includes(item.status)) assert.ok(html.includes('Không còn khoản phải thu'));
    }
    quotation.status = 'pending'; order.status = 'cancelled';
    assert.equal(hook().remainingQuotationAmount, 0);
    assert.equal((await agent.get('khach', 'don')).quotation.remainingDirectPaymentAmount, 0);
    const cancelled = renderToStaticMarkup(react.createElement(Details, {
      quotation: data.quotation, orderStatus: order.status, remainingQuotationAmount: 0,
      appliedDepositAmount: 100000, busy: false, onReject() {},
    }));
    assert.ok(cancelled.includes('Không còn khoản phải thu')); assert.ok(!cancelled.includes('<button'));
    order.status = 'completed'; quotation.status = 'approved'; quotation.directPaymentConfirmedAt = null;
    quotation.finalAmount = 50000;
    assert.equal(hook().remainingQuotationAmount, 0, 'Cọc vượt báo giá không tạo số tiền âm.');
    delete order.pricing.baseAmount; order.depositAmount = 100000;
    assert.equal(hook().appliedDepositAmount, 100000, 'Vẫn khấu trừ được cọc của dữ liệu cũ.');
  })();
}
async function testHours() {
  const policy = load('../utils/bookingPolicy');
  const helpers = load(path.join(webRoot, 'src/features/booking/components/step2Helpers.ts'), { axios: {} });
  let databaseCalls = 0;
  const { OrderService } = load('../services/order.service', new Proxy({
    mongoose: { Types }, '../utils/appError': { AppError }, '../utils/bookingPolicy': policy,
    '../models/service.model': { Service: { findOne: async () => { databaseCalls++; throw new Error('Đã qua kiểm tra thời gian'); } } },
  }, { has: () => true, get: (target, key) => target[key] ?? {} }));
  const bookingSchemas = load('../ai/tools/implementations/booking.schemas', {
    zod: require('zod'), '../../../validations/order.validator': require('../validations/order.validator'),
    '../../../utils/bookingPolicy': policy, '../../agent/booking-attachments': require('../ai/agent/booking-attachments'),
  });
  const { bookingSchema } = bookingSchemas;
  const payload = { serviceId: new Types.ObjectId().toString(), addressId: new Types.ObjectId().toString(),
    paymentMethod: 'wallet', orderType: 'normal' };
  for (const [time, allowed] of [['07:59:59.999', false], ['08:00:00.000', true],
    ['20:59:59.999', true], ['21:00:00.000', true], ['21:00:00.001', true], ['21:01:00.000', false], ['00:00:00.000', false]]) {
    now = Date.parse(`2026-10-25T${time}+07:00`);
    const before = databaseCalls;
    assert.equal(helpers.isWithinImmediateBookingHours(new ClockDate()), allowed);
    assert.equal(bookingSchema.safeParse(payload).success, allowed);
    for (const orderType of ['normal', undefined]) {
      await assert.rejects(OrderService.createOrder({ ...payload, orderType }), allowed
        ? /Đã qua kiểm tra thời gian/ : error => error.statusCode === 400 && error.message.includes('Đặt ngay'));
    }
    assert.equal(databaseCalls - before, allowed ? 2 : 0, 'Chặn ngoài giờ trước khi truy cập dữ liệu.');
  }
  now = Date.parse('2026-10-25T23:00:00+07:00');
  await assert.rejects(OrderService.createOrder({ ...payload, scheduledAt: '2026-10-26T10:00:00+07:00' }), /Đặt ngay/);
  const scheduled = { ...payload, orderType: 'scheduled', scheduledAt: '2026-10-26T10:00:00+07:00' };
  assert.equal(bookingSchema.safeParse(scheduled).success, true);
  await assert.rejects(OrderService.createOrder(scheduled), /Đã qua kiểm tra thời gian/);
  await assert.rejects(OrderService.createOrder({ ...scheduled, scheduledAt: '2026-10-26T21:00:01+07:00' }), /Đã qua kiểm tra thời gian/);
  await assert.rejects(OrderService.createOrder({ ...scheduled, scheduledAt: '2026-10-24T22:00:00+07:00' }), /Vui lòng chọn giờ/);
  const draftModule = load('../ai/agent/booking-draft', {
    zod: require('zod'), '../../utils/appError': { AppError },
    '../tools/implementations/booking.schemas': bookingSchemas,
    '../../utils/bookingPolicy': policy,
    '../../utils/uniformServicePrice': require('../utils/uniformServicePrice'),
    './booking-attachments': require('../ai/agent/booking-attachments'),
  });
  const draft = await draftModule.updateBookingDraft(undefined, { mode: 'update', ...payload }, 'khach', {
    search: async () => [], service: async () => ({ id: payload.serviceId, name: 'Dịch vụ thử',
      serviceType: 'fixed_price', fixedPrice: 100000, options: [] }),
    addresses: async () => [{ id: payload.addressId, fullAddress: 'Địa chỉ thử', ward: 'Phường thử', province: 'TP.HCM' }],
  });
  assert.ok(draft.missing.some(message => message.includes('Đặt ngay chỉ khả dụng')));
  assert.equal(draft.values.orderType, 'normal', 'Trợ lý không tự đổi sang hẹn giờ thay khách.');
  assert.equal(draftModule.readyBookingArguments(draft), null);
}
(async () => {
  await testTracking(); await testQuotations(); await testHours();
  console.log('Đạt: không phát vị trí cho thợ cũ, kiểm tra lại phân công sau khi lưu, công nợ web/trợ lý nhất quán và giờ đặt ngay theo Việt Nam.');
})().catch(error => { console.error(error); process.exitCode = 1; });
