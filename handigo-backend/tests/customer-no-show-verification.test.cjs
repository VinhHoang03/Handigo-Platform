const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { Types } = require('mongoose');
const now = Date.parse('2030-01-17T10:10:00+07:00');
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}
class AppError extends Error { constructor(message, statusCode) { super(message); this.statusCode = statusCode; } }
function load(relative, modules = {}, globals = {}) {
  const filename = path.join(__dirname, '../src', relative);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Date: Clock, Buffer, Number, Math, Set,
    process: { env: {} }, ...globals, require: name => modules[name] ?? {} }, { filename });
  return exports;
}
const query = value => ({ session() { return this; }, select() { return this; }, sort() { return this; }, limit() { return this; },
  lean() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
const evidenceTime = load('utils/customerNoShowEvidence.ts');
const analysis = overrides => ({ imageType: 'arrival', locationText: '12 Nguyễn Trãi', phoneNumbers: [], contactAt: null,
  providerMessage: null, contactOutcome: 'unknown', uncertainties: [], ...overrides });
const evidence = () => [
  { _id: new Types.ObjectId(), kind: 'arrival', sha256: 'dia-chi', analysisStatus: 'analyzed', analysis: analysis() },
  { _id: new Types.ObjectId(), kind: 'contact', sha256: 'lien-he', analysisStatus: 'analyzed', analysis: analysis({
    imageType: 'chat', locationText: null, phoneNumbers: ['+84 900 000 000'],
    contactAt: '2030-01-17T10:02:00+07:00', providerMessage: 'Tôi đã đến nơi, anh chị vui lòng liên hệ.', contactOutcome: 'no_response',
  }) },
  { _id: new Types.ObjectId(), kind: 'contact', sha256: 'cuoc-goi', uploadedAt: new Date(now), analysisStatus: 'analyzed',
    analysis: analysis({ imageType: 'call', contactOutcome: 'no_answer', calls: ['10:01', '10:04', '10:08'].map(time => ({
      phoneNumber: '+84 900 000 000', dateLabel: 'Hôm nay', time, occurredAt: null, direction: 'outgoing', outcome: 'no_answer',
    })) }) },
];
const facts = () => ({ addressLine: '12 Nguyễn Trãi, Phường A, Thành phố B', customerPhone: '0900000000',
  waitStartedAt: now - 10 * 60000, now, locationValid: true, reusedEvidence: false, customerReplied: false,
  providerMessages: [{ content: 'Tôi đã đến nơi, anh chị vui lòng liên hệ.', createdAt: new Date(now - 8 * 60000) }] });
function service(options = {}) {
  const receipts = options.receipts ?? evidence();
  const modules = {
    '../utils/customerNoShowEvidence': evidenceTime,
    '../utils/appError': { AppError }, 'node:crypto': require('node:crypto'),
    '../utils/logger': { createLogger: () => ({ warn: (message, context) => options.logs?.push({ message, context }) }) },
    '../configs/cloudinary': { __esModule: true, default: { uploader: { upload_stream: (_, callback) => ({ end() { callback(null, { secure_url: 'https://example.com/anh.jpg' }); } }) } } },
    '../models/customerNoShowEvidence.model': { CustomerNoShowEvidence: {
      find: () => query(receipts), exists: () => query(options.reused ?? false),
      create: async item => { options.stored?.push(item); return { _id: new Types.ObjectId(), ...item }; },
    } },
    '../models/user.model': { __esModule: true, default: { findOne: () => query({ phone: options.customerPhone === undefined ? '0900000000' : options.customerPhone }) } },
    '../models/address.model': { Address: { findOne: () => query(null) } },
    '../models/location.model': { Location: { findOne: () => query({ coordinates: { coordinates: [106.7, 10.8] }, lastUpdatedAt: new Date(now - (options.locationAge ?? 0)) }) } },
    '../models/conversation.model': { Conversation: { findOne: () => query(options.noConversation ? null : { _id: new Types.ObjectId() }) } },
    '../models/message.model': { Message: { find: () => query(facts().providerMessages), exists: () => query(options.reply ?? false) } },
    './matching.service': { haversineMeters: () => options.distance ?? 0 },
    '../utils/customerNoShow': { CUSTOMER_NO_SHOW_ARRIVAL_RADIUS_METERS: 200, CUSTOMER_NO_SHOW_WAIT_MINUTES: 10, CUSTOMER_NO_SHOW_SKIP_WAIT_FOR_TESTING: options.skipWait ?? true,
      CUSTOMER_NO_SHOW_SKIP_DUPLICATE_EVIDENCE_FOR_TESTING: options.skipDuplicates ?? true },
    '../ai/customer-no-show/evidence-agent': { analyzeNoShowEvidence: async () => { if (options.aiError) throw options.aiError; if (options.aiFails) throw new Error('AI lỗi'); return analysis(); } },
  };
  return load('services/customerNoShowVerification.service.ts', modules);
}
const { evaluateNoShowEvidence } = service();

test('Hai nhóm ảnh, GPS và tin nhắn Handigo chưa được phản hồi đủ điều kiện tự duyệt', () => {
  const result = evaluateNoShowEvidence(evidence(), facts());
  assert.equal(result.decision, 'auto_eligible');
  assert.equal(+result.checkedAt, now);
  assert.equal(result.checks.calls.validCount, 3);
  assert.equal(result.checks.chat.passed, true);
  assert.equal(result.checks.waiting.requiredMinutes, 10);
});

test('Lưu kết quả từng điều kiện tại lúc xác minh, tách khỏi cấu hình và dữ liệu sau này', () => {
  const initial = { ...facts(), locationDistanceMeters: 98.8 };
  const saved = service({ skipWait: false }).evaluateNoShowEvidence(evidence(), initial);
  assert.equal(saved.checks.location.distanceMeters, 98.8);
  assert.equal(saved.checks.location.passed, true);
  assert.equal(saved.checks.waiting.skippedForTesting, false);
  assert.equal(saved.checks.waiting.passed, true);
  assert.equal(+saved.checks.waiting.waitStartedAt, initial.waitStartedAt);
  assert.equal(saved.checks.calls.validCount, 3);
  const changed = { ...initial, locationValid: false, locationDistanceMeters: 500, customerReplied: true, providerMessages: [] };
  service({ skipWait: true }).evaluateNoShowEvidence(evidence(), changed);
  assert.equal(saved.checks.location.distanceMeters, 98.8);
  assert.equal(saved.checks.chat.passed, true);
  assert.equal(saved.checks.waiting.skippedForTesting, false);
});
for (const [name, change] of [
  ['sai số điện thoại', (items) => { items[1].analysis.phoneNumbers = ['0911111111']; }],
  ['số điện thoại bị che', (items) => { items[1].analysis.phoneNumbers = ['090***0000']; }],
  ['ảnh cuộc gọi ngoài ứng dụng', (items) => { items[1].analysis.imageType = 'call'; items[1].analysis.contactOutcome = 'no_answer'; }],
  ['ngày giờ thuộc hôm trước', (items) => { items[1].analysis.contactAt = '2030-01-16T10:02:00+07:00'; }],
  ['ảnh giờ trong tương lai', (items) => { items[1].analysis.contactAt = '2030-01-18T10:02:00+07:00'; }],
  ['ảnh địa điểm không phù hợp', (items) => { items[0].analysis.imageType = 'other'; }],
  ['ảnh liên hệ mờ', (items) => { items[1].analysis.uncertainties = ['Không đọc rõ thông tin liên hệ']; }],
  ['AI không hoạt động', (items) => { items[0].analysisStatus = 'unavailable'; items[0].analysis = null; }],
  ['ảnh liên hệ có khách trả lời', (items) => { items[1].analysis.contactOutcome = 'answered'; }],
]) {
  test(`Chuyển admin khi ${name}, không tự chi tiền`, () => {
    const items = evidence(); change(items);
    assert.equal(evaluateNoShowEvidence(items, facts()).decision, 'manual_review');
  });
}

for (const locationText of [null, '12', 'Biển hiệu không có tên đường']) {
  test(`Ảnh địa điểm không bắt buộc có số nhà và đường: ${locationText}`, () => {
    const items = evidence(); items[0].analysis.locationText = locationText;
    items[0].analysis.uncertainties = ['Không có số nhà hoặc tên đường đọc được'];
    assert.equal(evaluateNoShowEvidence(items, facts()).decision, 'auto_eligible');
  });
}

test('Ảnh chat Handigo không cần hiện số điện thoại hoặc ngày giờ và không cần khớp giờ 90 giây', () => {
  const items = evidence();
  items[1].analysis.phoneNumbers = []; items[1].analysis.contactAt = null;
  assert.equal(evaluateNoShowEvidence(items, facts()).decision, 'auto_eligible');
  items[1].analysis.contactAt = '2030-01-17T10:06:00+07:00';
  assert.equal(evaluateNoShowEvidence(items, facts()).decision, 'auto_eligible');
});

test('Chat bên ngoài không thay thế được ảnh tin nhắn Handigo dù đúng số khách và thời điểm', () => {
  const items = evidence();
  items[1].analysis.providerMessage = 'Tôi đang chờ bạn ở cửa, xin phản hồi.';
  assert.equal(evaluateNoShowEvidence(items, facts()).decision, 'manual_review');
  assert.equal(evaluateNoShowEvidence(items, { ...facts(), providerMessages: [] }).decision, 'manual_review');
  items[1].analysis.contactAt = null;
  assert.equal(evaluateNoShowEvidence(items, facts()).decision, 'manual_review');
});

test('Tin nhắn ngoài khoảng chờ hoặc rỗng không đáp ứng tối thiểu một tin nhắn Handigo', () => {
  for (const providerMessages of [[{ content: ' ', createdAt: new Date(now) }],
    [{ content: 'Tôi đã đến.', createdAt: new Date(now - 86400000) }]]) {
    assert.equal(evaluateNoShowEvidence(evidence(), { ...facts(), providerMessages }).decision, 'manual_review');
  }
});

function callEvidence() {
  const items = evidence();
  return [items[0], items[2], items[1]];
}

test('Trường hợp thực tế 26/10: đến 22:19:07, gọi 22:20/22:21/22:22 phải tính 3/3', () => {
  const items = callEvidence();
  items[1].uploadedAt = new Date('2026-10-26T22:24:00+07:00');
  items[1].analysis.calls = ['22:22', '22:21', '22:20', '22:20'].map(time => ({
    phoneNumber: '+84773368198', dateLabel: 'Hôm nay', time, occurredAt: null, direction: 'outgoing', outcome: 'no_answer',
  }));
  items[2].analysis.phoneNumbers = []; items[2].analysis.contactAt = null;
  items[2].analysis.providerMessage = 'anh ở đâu rồi';
  const actual = { ...facts(), customerPhone: '0773368198',
    waitStartedAt: Date.parse('2026-10-26T22:19:07.985+07:00'), now: Date.parse('2026-10-26T22:25:00+07:00'),
    providerMessages: [{ content: 'anh ở đâu rồi', createdAt: new Date('2026-10-26T22:20:30+07:00') }] };
  const checker = service();
  assert.equal(checker.evaluateNoShowEvidence(items, actual).decision, 'auto_eligible');
  const checks = checker.inspectNoShowCalls(items, actual);
  assert.equal(checks.validCount, 3);
  assert.equal(checks.events[0].phoneMatched, true);
  assert.equal(checks.events[0].inWindow, true);
  assert.equal(checks.events[3].eligible, false);
  assert.match(checks.events[3].failures.join(), /cùng phút/);
  const wrongPhone = checker.inspectNoShowCalls(items, { ...actual, customerPhone: '0911111111' });
  assert.equal(wrongPhone.validCount, 0);
  assert.match(wrongPhone.events[0].failures.join(), /không khớp/);
  const wrongWindow = checker.inspectNoShowCalls(items, { ...actual, waitStartedAt: Date.parse('2026-10-27T08:00:00+07:00') });
  assert.equal(wrongWindow.validCount, 0);
  assert.match(wrongWindow.events[0].failures.join(), /ngoài khoảng/);
});

for (const imageType of ['arrival', 'chat', 'call']) {
  test(`Thiếu ảnh ${imageType} thì không tự duyệt dù dữ liệu khác hợp lệ`, () => {
    const items = evidence().filter(item => item.analysis.imageType !== imageType);
    assert.equal(evaluateNoShowEvidence(items, facts()).decision, 'manual_review');
  });
}

test('Tự duyệt ảnh ba cuộc gọi ngoài ứng dụng có Hôm nay và giờ riêng, kèm một tin Handigo', () => {
  assert.equal(evaluateNoShowEvidence(callEvidence(), facts()).decision, 'auto_eligible');
  assert.equal(evaluateNoShowEvidence(callEvidence(), { ...facts(), providerMessages: [] }).decision, 'manual_review');
});

for (const [name, change] of [
  ['chỉ có hai cuộc', items => { items[1].analysis.calls.pop(); }],
  ['chỉ có số gộp không có từng cuộc', items => { items[1].analysis.calls = []; }],
  ['sai số khách', items => { items[1].analysis.calls[0].phoneNumber = '0911111111'; }],
  ['số bị che', items => { items[1].analysis.calls[0].phoneNumber = '090***0000'; }],
  ['cuộc gọi đến', items => { items[1].analysis.calls[0].direction = 'incoming'; }],
  ['chưa rõ chiều gọi', items => { items[1].analysis.calls[0].direction = 'unknown'; }],
  ['cuộc gọi có kết nối', items => { items[1].analysis.calls[0].outcome = 'answered'; }],
  ['không có giờ', items => { items[1].analysis.calls[0].time = null; }],
  ['không có ngày', items => { items[1].analysis.calls[0].dateLabel = null; }],
  ['hôm qua ngoài khoảng chờ', items => { items[1].analysis.calls[0].dateLabel = 'Hôm qua'; }],
  ['trước giờ thợ đến', items => { items[1].analysis.calls[0].time = '09:59'; }],
  ['sau giờ tải ảnh', items => { items[1].analysis.calls[0].time = '10:11'; }],
  ['trùng cuộc trong cùng phút', items => { items[1].analysis.calls[1].time = '10:01'; }],
]) {
  test(`Cuộc gọi chuyển admin khi ${name}`, () => {
    const items = callEvidence(); change(items);
    assert.equal(evaluateNoShowEvidence(items, facts()).decision, 'manual_review');
  });
}

test('Không đếm lặp cuộc gọi khi thợ chụp nhiều ảnh cùng lịch sử', () => {
  const items = callEvidence();
  items[1].analysis.calls = items[1].analysis.calls.slice(0, 2);
  items.push({ ...items[1], sha256: 'anh-chup-khac', analysis: { ...items[1].analysis } });
  assert.equal(evaluateNoShowEvidence(items, facts()).decision, 'manual_review');
  items[3].analysis.calls = [{ ...items[1].analysis.calls[0], time: '10:08' }];
  assert.equal(evaluateNoShowEvidence(items, facts()).decision, 'auto_eligible');
});

test('Có ảnh cuộc gọi thì vẫn phải đủ ba cuộc dù kèm ảnh chat hợp lệ', () => {
  const items = callEvidence(); items[1].analysis.calls.pop();
  items.push({ ...evidence()[1], sha256: 'anh-chat' });
  assert.equal(evaluateNoShowEvidence(items, facts()).decision, 'manual_review');
});

test('Hôm qua hợp lệ khi ba cuộc gọi trong khoảng chờ kéo qua nửa đêm', () => {
  const items = callEvidence();
  const midnightNow = Date.parse('2030-01-18T00:05:00+07:00');
  items[1].uploadedAt = new Date(midnightNow);
  items[1].analysis.calls.forEach((call, index) => {
    call.dateLabel = index === 2 ? 'Hôm nay' : 'Hôm qua';
    call.time = ['23:57', '23:59', '00:01'][index];
  });
  const midnightFacts = { ...facts(), now: midnightNow, waitStartedAt: midnightNow - 10 * 60000,
    providerMessages: [{ content: 'Tôi đã đến, vui lòng phản hồi.', createdAt: new Date(midnightNow - 9 * 60000) }] };
  items[2].analysis.contactAt = null;
  items[2].analysis.providerMessage = midnightFacts.providerMessages[0].content;
  assert.equal(evaluateNoShowEvidence(items, midnightFacts).decision, 'auto_eligible');
});

test('Ngày Hôm nay luôn neo lần tải ảnh, không đổi khi kiểm tra lại vào ngày sau', () => {
  assert.equal(evaluateNoShowEvidence(callEvidence(), { ...facts(), now: now + 86400000 }).decision, 'auto_eligible');
});
for (const [name, overrides] of [
  ['GPS không hợp lệ', { locationValid: false }],
  ['khách đã trả lời', { customerReplied: true }], ['không có tin nhắn thật', { providerMessages: [] }],
]) {
  test(`Dữ liệu hệ thống ngăn tự duyệt: ${name}`, () => {
    assert.equal(evaluateNoShowEvidence(evidence(), { ...facts(), ...overrides }).decision, 'manual_review');
  });
}

test('Đối chiếu dữ liệu thật kiểm tra GPS mới, hội thoại và dấu phản hồi đồng thời', async () => {
  const order = { _id: new Types.ObjectId(), customerId: new Types.ObjectId(), providerId: new Types.ObjectId(), orderType: 'normal',
    arrival: { arrivedAt: new Date(now - 10 * 60000) }, addressSnapshot: { fullAddress: facts().addressLine, latitude: 10.8, longitude: 106.7 } };
  assert.equal((await service().verifyNoShowEvidence(order, 'tho', evidence())).decision, 'auto_eligible');
  for (const options of [{ locationAge: 120001 }, { noConversation: true }, { reply: true }, { distance: 201 }]) {
    assert.equal((await service(options).verifyNoShowEvidence(order, 'tho', evidence())).decision, 'manual_review');
  }
  assert.equal((await service().verifyNoShowEvidence({ ...order, customerNoShow: { customerRepliedAt: new Date(now) } }, 'tho', evidence())).decision, 'manual_review');
});

test('Đối chiếu số tài khoản đang hiển thị cho thợ thay vì số người nhận cũ trong snapshot', async () => {
  const items = callEvidence();
  items[1].analysis.calls.forEach(call => { call.phoneNumber = '+84773368198'; });
  items[2].analysis.phoneNumbers = [];
  const order = { _id: new Types.ObjectId(), customerId: new Types.ObjectId(), providerId: new Types.ObjectId(), orderType: 'normal',
    arrival: { arrivedAt: new Date(now - 10 * 60000) },
    addressSnapshot: { fullAddress: facts().addressLine, recipientPhone: '0345643125', latitude: 10.8, longitude: 106.7 } };
  assert.equal((await service({ customerPhone: '0773368198' }).verifyNoShowEvidence(order, 'tho', items)).decision, 'auto_eligible');
  assert.equal((await service({ customerPhone: '0345643125' }).verifyNoShowEvidence(order, 'tho', items)).decision, 'manual_review');
  order.addressSnapshot.recipientPhone = '0773368198';
  assert.equal((await service({ customerPhone: '' }).verifyNoShowEvidence(order, 'tho', items)).decision, 'auto_eligible');
  assert.equal((await service({ customerPhone: '0911111111' }).verifyNoShowEvidence(order, 'tho', items)).decision, 'manual_review');
});

test('Chế độ kiểm thử đối chiếu chat từ lúc đến nơi dù lịch hẹn ngày mai; tắt cờ sẽ khôi phục mốc hẹn', async () => {
  const order = { _id: new Types.ObjectId(), customerId: new Types.ObjectId(), providerId: new Types.ObjectId(),
    orderType: 'scheduled', scheduledAt: new Date(now + 86400000),
    arrival: { arrivedAt: new Date(now - 10 * 60000) },
    addressSnapshot: { fullAddress: facts().addressLine, latitude: 10.8, longitude: 106.7 } };
  assert.equal((await service({ skipWait: true }).verifyNoShowEvidence(order, 'tho', evidence())).decision, 'auto_eligible');
  assert.equal((await service({ skipWait: false }).verifyNoShowEvidence(order, 'tho', evidence())).decision, 'manual_review');
});

test('Không nhận bằng chứng sai loại, thiếu quyền sở hữu, trùng ID hoặc cùng nội dung ảnh', async () => {
  const items = evidence(), orderId = new Types.ObjectId();
  const arrival = [String(items[0]._id)], contact = [String(items[1]._id), String(items[2]._id)];
  assert.equal((await service({ receipts: items }).getNoShowEvidence(orderId, 'tho', arrival, contact)).length, 3);
  await assert.rejects(service({ receipts: [] }).getNoShowEvidence(orderId, 'tho', arrival, contact), /không đúng loại/);
  await assert.rejects(service({ receipts: items }).getNoShowEvidence(orderId, 'tho', contact, arrival), /không đúng loại/);
  await assert.rejects(service({ receipts: items }).getNoShowEvidence(orderId, 'tho', arrival, arrival), /không đúng loại/);
  items[1].sha256 = items[0].sha256;
  assert.equal((await service({ receipts: items }).getNoShowEvidence(orderId, 'tho', arrival, contact)).length, 3);
  await assert.rejects(service({ receipts: items, skipDuplicates: false }).getNoShowEvidence(orderId, 'tho', arrival, contact), /ảnh khác nhau/);
});

test('Cờ kiểm thử cho phép trùng nội dung ảnh và dùng lại ảnh ở đơn khác; tắt cờ khôi phục chặn', () => {
  for (const reused of [false, true]) {
    const items = evidence();
    if (!reused) items[1].sha256 = items[0].sha256;
    const data = { ...facts(), reusedEvidence: reused };
    assert.equal(service({ skipDuplicates: true }).evaluateNoShowEvidence(items, data).decision, 'auto_eligible');
    assert.equal(service({ skipDuplicates: false }).evaluateNoShowEvidence(items, data).decision, 'manual_review');
  }
});

test('AI lỗi vẫn lưu ảnh có dấu phân tích không sẵn sàng cho admin, không bỏ qua kiểm tra', async () => {
  const result = await service({ aiFails: true }).storeNoShowEvidence({ _id: new Types.ObjectId() }, 'tho', 'arrival', { buffer: Buffer.from('anh-gia-lap'), mimetype: 'image/jpeg' });
  assert.equal(result.kind, 'arrival');
  assert.ok(result.id);
});

for (const [fields, expected] of [
  [{ status: 429 }, 'hạn mức'], [{ status: 403 }, 'quyền truy cập'], [{ status: 404 }, 'model'],
  [{ status: 400 }, 'từ chối yêu cầu'], [{ status: 503 }, 'dịch vụ Gemini'],
  [{ name: 'NoShowAIConfigError' }, 'cấu hình'], [{ name: 'ZodError' }, 'cấu trúc'],
  [{ name: 'SyntaxError' }, 'JSON'], [{ name: 'GoogleGenerativeAIAbortError' }, 'thời gian chờ'],
]) {
  test(`Log chẩn đoán ${JSON.stringify(fields)} không chứa khóa, ảnh hoặc lỗi thô`, async () => {
    const logs = [];
    const stored = [];
    const aiError = Object.assign(new Error('https://example.com?key=KHOA_BI_MAT NOI_DUNG_ANH'), fields);
    await service({ aiError, logs, stored }).storeNoShowEvidence({ _id: new Types.ObjectId() }, 'tho', 'arrival', {
      buffer: Buffer.from('NOI_DUNG_ANH'), mimetype: 'image/jpeg',
    });
    assert.equal(logs.length, 1);
    assert.ok(logs[0].context.reason.toLocaleLowerCase('vi-VN').includes(expected.toLocaleLowerCase('vi-VN')));
    assert.equal(logs[0].context.httpStatus, fields.status ?? null);
    assert.doesNotMatch(JSON.stringify(logs), /KHOA_BI_MAT|NOI_DUNG_ANH|https:/);
    assert.equal(stored[0].analysisFailure.reason, logs[0].context.reason);
    assert.equal(stored[0].analysisFailure.httpStatus, fields.status ?? null);
    assert.equal(stored[0].analysisStatus, 'unavailable');
    assert.equal(+stored[0].uploadedAt, now);
    assert.doesNotMatch(JSON.stringify(stored[0].analysisFailure), /KHOA_BI_MAT|NOI_DUNG_ANH|https:/);
  });
}

test('Agent chỉ nhận ảnh và loại ảnh; kết quả thêm lệnh duyệt hoặc dữ liệu sai schema bị từ chối', async () => {
  let output = JSON.stringify(analysis());
  const agent = load('ai/customer-no-show/evidence-agent.ts', {
    zod: require('zod'), '@google/generative-ai': { GoogleGenerativeAI: class {
      getGenerativeModel() { return { generateContent: async () => ({ response: { text: () => output } }) }; }
    } },
  }, { process: { env: { GEMINI_API_KEY: 'gia-lap-kiem-thu' } } });
  assert.equal((await agent.analyzeNoShowEvidence(Buffer.from('anh'), 'image/jpeg', 'arrival')).imageType, 'arrival');
  output = JSON.stringify({ ...analysis({ imageType: 'chat' }), chatChannel: 'external' });
  assert.equal((await agent.analyzeNoShowEvidence(Buffer.from('anh'), 'image/jpeg', 'contact')).chatChannel, 'external');
  output = JSON.stringify({ ...analysis(), decision: 'approved', amount: 999999 });
  await assert.rejects(agent.analyzeNoShowEvidence(Buffer.from('anh'), 'image/jpeg', 'arrival'));
  output = JSON.stringify({ ...analysis(), contactAt: 'hôm nay' });
  await assert.rejects(agent.analyzeNoShowEvidence(Buffer.from('anh'), 'image/jpeg', 'arrival'));
  output = JSON.stringify(callEvidence()[1].analysis);
  const calls = await agent.analyzeNoShowEvidence(Buffer.from('anh'), 'image/jpeg', 'contact');
  assert.equal(calls.calls.length, 3);
  assert.equal(calls.calls[0].dateLabel, 'Hôm nay');
  assert.equal(calls.calls[0].occurredAt, null);
  output = JSON.stringify({ ...callEvidence()[1].analysis, calls: [{ ...calls.calls[0], count: 3 }] });
  await assert.rejects(agent.analyzeNoShowEvidence(Buffer.from('anh'), 'image/jpeg', 'contact'));
});

for (const [className, expected] of [
  ['GoogleGenerativeAIAbortError', 'thời gian chờ'],
  ['GoogleGenerativeAIResponseError', 'phản hồi bị chặn'],
  ['GoogleGenerativeAIRequestInputError', 'dữ liệu yêu cầu'],
  ['GoogleGenerativeAIError', 'kết nối hoặc dịch vụ'],
]) {
  test(`Nhận diện lớp lỗi SDK thật ${className} dù name vẫn là Error`, async () => {
    const sdk = require('@google/generative-ai');
    const aiError = new sdk[className]('KHOA_BI_MAT NOI_DUNG_ANH');
    assert.equal(aiError.name, 'Error');
    const stored = [];
    await service({ aiError, stored }).storeNoShowEvidence({ _id: new Types.ObjectId() }, 'tho', 'contact', {
      buffer: Buffer.from('anh'), mimetype: 'image/jpeg',
    });
    assert.ok(stored[0].analysisFailure.reason.includes(expected));
    assert.doesNotMatch(JSON.stringify(stored[0].analysisFailure), /KHOA_BI_MAT|NOI_DUNG_ANH/);
  });
}

function retryAgent({ status = 503, failures = 1, malformed = false, requestTime = 0, failureError } = {}) {
  let calls = 0;
  let elapsed = 0;
  const waits = [];
  const timeouts = [];
  class RetryClock extends Clock { static now() { return now + elapsed; } }
  const agent = load('ai/customer-no-show/evidence-agent.ts', {
    zod: require('zod'), '@google/generative-ai': { GoogleGenerativeAI: class {
      getGenerativeModel() { return { generateContent: async (_request, options) => {
        calls++; timeouts.push(options.timeout);
        const duration = Array.isArray(requestTime) ? requestTime[calls - 1] ?? 0 : requestTime;
        elapsed += Math.min(duration, options.timeout);
        if (calls <= failures) throw failureError ?? Object.assign(new Error('Dịch vụ lỗi'), { status });
        return { response: { text: () => malformed ? 'không phải JSON' : JSON.stringify(analysis()) } };
      } }; }
    } },
  }, { Date: RetryClock, process: { env: { GEMINI_API_KEY: 'gia-lap-kiem-thu' } },
    setTimeout: (resolve, delay) => { waits.push(delay); elapsed += delay; resolve(); } });
  return { waits, timeouts, calls: () => calls, elapsed: () => elapsed,
    run: () => agent.analyzeNoShowEvidence(Buffer.from('anh'), 'image/jpeg', 'arrival') };
}

for (const status of [502, 503, 504]) {
  test(`Thử lại khi Gemini trả ${status} và nhận được kết quả lần tiếp theo`, async () => {
    const agent = retryAgent({ status });
    assert.equal((await agent.run()).imageType, 'arrival');
    assert.equal(agent.calls(), 2);
    assert.equal(agent.waits.length, 1);
    assert.ok(agent.waits[0] >= 1000 && agent.waits[0] < 1250);
  });
}

test('Dừng sau tối đa ba lần gọi nếu Gemini tiếp tục lỗi 503', async () => {
  const agent = retryAgent({ failures: 10 });
  await assert.rejects(agent.run());
  assert.equal(agent.calls(), 3);
  assert.equal(agent.waits.length, 2);
  assert.ok(agent.waits[1] >= 2000 && agent.waits[1] < 2250);
});

for (const status of [400, 401, 403, 404, 429]) {
  test(`Không thử lại lỗi ${status}`, async () => {
    const agent = retryAgent({ status });
    await assert.rejects(agent.run());
    assert.equal(agent.calls(), 1);
    assert.equal(agent.waits.length, 0);
  });
}

test('Không thử lại khi AI trả JSON lỗi; tổng thời gian thử không vượt ngân sách 70 giây', async () => {
  const invalid = retryAgent({ failures: 0, malformed: true });
  await assert.rejects(invalid.run());
  assert.equal(invalid.calls(), 1);
  const slow = retryAgent({ requestTime: 70000, failures: 10 });
  await assert.rejects(slow.run());
  assert.equal(slow.calls(), 2);
  assert.equal(slow.elapsed(), 70000);
  assert.equal(slow.timeouts[0], 45000);
  assert.ok(slow.timeouts[1] < 25000);
});

test('Timeout SDK thật được thử lại với phần thời gian còn lại và có thể nhận kết quả', async () => {
  const { GoogleGenerativeAIAbortError } = require('@google/generative-ai');
  const failureError = new GoogleGenerativeAIAbortError('Yêu cầu quá thời gian');
  assert.equal(failureError.name, 'Error');
  const agent = retryAgent({ failureError, requestTime: [45000, 1000] });
  assert.equal((await agent.run()).imageType, 'arrival');
  assert.equal(agent.calls(), 2);
  assert.equal(agent.timeouts[0], 45000);
  assert.ok(agent.timeouts[1] < 25000 && agent.timeouts[1] > 23000);
  assert.ok(agent.elapsed() < 70000);
});

test('Timeout liên tục vẫn dừng sau tối đa ba lần và không tự coi ảnh hợp lệ', async () => {
  const agent = retryAgent({ failureError: Object.assign(new Error('Bị hủy'), { name: 'AbortError' }), failures: 10 });
  await assert.rejects(agent.run());
  assert.equal(agent.calls(), 3);
});

test('Tin khách trả lời ghi dấu trên đơn trước khi tạo tin; tin của thợ không tự chặn báo cáo', async () => {
  for (const role of ['CUSTOMER', 'PROVIDER']) {
    const events = [];
    const provider = { _id: new Types.ObjectId(), userId: new Types.ObjectId() };
    const order = { _id: new Types.ObjectId(), customerId: new Types.ObjectId(), providerId: provider._id, status: 'accepted' };
    const conversation = { _id: new Types.ObjectId(), orderId: order._id, providerId: provider._id, customerId: order.customerId, async save() { events.push('conversation'); } };
    const chat = load('services/chat.service.ts', {
      mongoose: { Types }, '../utils/appError': { AppError },
      '../models/order.model': { Order: {
        findOne: async () => order,
        async updateOne(filter, update) {
          assert.equal(filter['customerNoShow.status'], 'pending');
          assert.equal(filter.status, 'accepted');
          assert.equal(+update.$set['customerNoShow.customerRepliedAt'], now);
          events.push('reply-marker');
        },
      } },
      '../models/provider.model': { Provider: { findOne: async () => provider } },
      '../models/conversation.model': { Conversation: { findOne: async () => conversation } },
      '../models/message.model': { Message: {
        async create(payload) { events.push('message'); return { _id: new Types.ObjectId(), ...payload, createdAt: new Clock() }; },
        findById: () => ({ populate: async () => ({}) }),
      } },
    });
    await chat.sendMessage(String(role === 'CUSTOMER' ? order.customerId : provider.userId), role, String(conversation._id), { content: 'Tôi đang ở nhà, vui lòng đợi.' });
    assert.equal(events[0], role === 'CUSTOMER' ? 'reply-marker' : 'message');
    assert.equal(events.includes('reply-marker'), role === 'CUSTOMER');
  }
});
