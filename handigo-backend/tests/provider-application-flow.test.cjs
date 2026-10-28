const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { Types } = require('mongoose');

const adminId = '507f1f77bcf86cd799439011';
const applicationId = '507f1f77bcf86cd799439012';
const userId = '507f1f77bcf86cd799439013';
const serviceId = '507f1f77bcf86cd799439014';

function loadSource(relativePath, modules) {
  const file = path.join(__dirname, relativePath);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => {
    if (!(name in modules)) throw new Error(`Module chưa được giả lập: ${name}`);
    return modules[name];
  } }, { filename: file });
  return exports;
}

function setup(applicationType = 'initial', status = 'pending', failCommit = false) {
  const events = [];
  const userUpdates = [];
  const application = {
    _id: applicationId, userId, applicationType, status, reviewHistory: [],
    description: 'Có kinh nghiệm', experienceYears: 2,
    serviceIds: [new Types.ObjectId(serviceId)], certificates: [],
    async save() { events.push('save'); },
  };
  const provider = { serviceIds: [], certificates: [], async save() { events.push('provider-save'); } };
  const session = {
    async withTransaction(callback) {
      await callback();
      if (failCommit) throw new Error('Không thể commit');
      events.push('commit');
    },
    async endSession() { events.push('end'); },
  };
  const models = {
    ProviderApplication: {
      findOne() {
        return {
          session: async () => application,
          populate() { return this; },
          then(resolve) { return Promise.resolve(application).then(resolve); },
        };
      },
    },
    Provider: {
      findOne: () => ({ session: async () => provider }),
      async findOneAndUpdate() { events.push('provider-create'); },
    },
    User: {
      async updateOne(filter, update) { userUpdates.push({ filter, update }); },
      async findOneAndUpdate(filter, update) { userUpdates.push({ filter, update }); return {}; },
    },
    Session: { async updateMany() { events.push('revoke'); } },
    Service: {},
  };
  const notifications = [];
  const modules = {
    mongoose: { __esModule: true, default: { startSession: async () => session }, Types },
    '../models/user.model': { __esModule: true, default: models.User },
    '../models/provider.model': { Provider: models.Provider },
    '../models/providerApplication.model': { ProviderApplication: models.ProviderApplication },
    '../models/session.model': { Session: models.Session },
    '../models/service.model': { Service: models.Service },
    '../utils/serviceImageResponse': { serviceImageResponse: (value) => value },
    '../utils/appError': { AppError: class extends Error {
      constructor(message, statusCode) { super(message); this.statusCode = statusCode; }
    } },
    './notification.service': {
      async createNotificationRecord(input, options) {
        assert.equal(options.session, session);
        assert.equal(options.deferRealtime, true);
        notifications.push(input);
        events.push('notification');
        return input;
      },
      emitRealtimeNotification() { events.push('emit'); },
    },
  };
  const exports = loadSource('../src/services/providerApplication.service.ts', modules);
  return { review: exports.reviewApplication, list: exports.getApplications, models, application, events, userUpdates, notifications, provider };
}

test('Danh sách ưu tiên hồ sơ cần duyệt trước khi phân trang và giữ thứ tự khi lấy chi tiết', async () => {
  const context = setup();
  const ids = [new Types.ObjectId(applicationId), new Types.ObjectId(userId)];
  const documents = ids.map((_id) => ({ _id, description: 'Hồ sơ thử nghiệm' }));
  let pipeline;
  let countFilter;
  const fromDate = new Date('2026-10-01T00:00:00+07:00');
  const toDate = new Date('2026-10-27T23:59:59.999+07:00');
  context.models.ProviderApplication.aggregate = async (stages) => {
    pipeline = stages;
    return ids.map((_id) => ({ _id }));
  };
  context.models.ProviderApplication.countDocuments = async (filter) => {
    countFilter = filter;
    return 22;
  };
  context.models.ProviderApplication.find = (filter) => {
    assert.deepEqual(filter._id.$in.map(String), ids.map(String));
    return {
      populate() { return this; },
      then(resolve) { return Promise.resolve([...documents].reverse()).then(resolve); },
    };
  };

  const result = await context.list({ page: 2, limit: 20, fromDate, toDate });
  const stages = JSON.parse(JSON.stringify(pipeline));
  assert.equal(stages[0].$match.isDeleted, false);
  assert.deepEqual(stages[0].$match.status, { $ne: 'draft' });
  assert.equal(countFilter.createdAt.$gte, fromDate);
  assert.equal(countFilter.createdAt.$lte, toDate);
  assert.deepEqual(stages[2].$addFields.reviewPriority.$cond, [
    { $in: ['$status', ['pending', 'resubmitted']] }, 0, 1,
  ]);
  assert.deepEqual(stages[3], { $sort: { reviewPriority: 1, createdAt: -1, _id: -1 } });
  assert.deepEqual(stages[4], { $skip: 20 });
  assert.deepEqual(stages[5], { $limit: 20 });
  assert.deepEqual(Array.from(result.items, (item) => String(item._id)), ids.map(String));
  assert.equal(result.pagination.totalPages, 2);
  assert.equal(result.items.some((item) => 'reviewPriority' in item), false);
});

test('Danh sách trống giữ bộ lọc trạng thái và không truy vấn chi tiết hồ sơ', async () => {
  const context = setup();
  context.models.ProviderApplication.aggregate = async (pipeline) => {
    assert.equal(pipeline[0].$match.status, 'approved');
    return [];
  };
  context.models.ProviderApplication.countDocuments = async () => 0;
  context.models.ProviderApplication.find = () => assert.fail('Không cần lấy chi tiết khi danh sách trống');
  const result = await context.list({ status: 'approved', limit: 20 });
  assert.equal(result.items.length, 0);
  assert.equal(result.pagination.total, 0);
});

test('Từ chối bổ sung dịch vụ không thay đổi quyền provider đã được duyệt', async () => {
  const context = setup('service_addition');
  await context.review(adminId, applicationId, {
    status: 'rejected', rejectionReason: 'Chứng chỉ chưa hợp lệ', rejectionNotes: 'Tải lại ảnh rõ nét.',
  });
  assert.equal(context.application.status, 'rejected');
  assert.equal(context.userUpdates.length, 0);
  assert.equal(context.notifications[0].data.actionUrl, '/provider/profile');
  assert.ok(context.events.indexOf('emit') > context.events.indexOf('commit'));
});

test('Từ chối hồ sơ ban đầu vẫn cập nhật onboarding và hướng dẫn gửi lại', async () => {
  const context = setup();
  await context.review(adminId, applicationId, {
    status: 'rejected', rejectionReason: 'Ảnh mờ', rejectionNotes: 'Chụp lại CCCD.',
  });
  assert.equal(context.userUpdates[0].update.$set.providerOnboardingStatus, 'REJECTED');
  assert.match(context.notifications[0].content, /Ảnh mờ/);
  assert.match(context.notifications[0].data.actionUrl, /applicationId=/);
});

test('Duyệt hồ sơ ban đầu tạo profile, cập nhật quyền và thông báo đăng nhập lại', async () => {
  const context = setup();
  await context.review(adminId, applicationId, { status: 'approved' });
  assert.equal(context.userUpdates[0].update.$set.role, 'PROVIDER');
  assert.equal(context.userUpdates[0].update.$set.providerOnboardingStatus, 'APPROVED');
  assert.ok(context.events.includes('revoke'));
  assert.match(context.notifications[0].content, /đăng nhập lại/);
  assert.ok(context.events.indexOf('emit') > context.events.indexOf('commit'));
});

test('Duyệt bổ sung chỉ thêm dịch vụ, không đổi quyền hoặc thu hồi phiên', async () => {
  const context = setup('service_addition');
  await context.review(adminId, applicationId, { status: 'approved' });
  assert.equal(String(context.provider.serviceIds[0]), serviceId);
  assert.equal(context.userUpdates.length, 0);
  assert.equal(context.events.includes('revoke'), false);
});

test('Không phát thông báo realtime khi transaction thất bại', async () => {
  const context = setup('initial', 'pending', true);
  await assert.rejects(context.review(adminId, applicationId, { status: 'approved' }), /commit/);
  assert.equal(context.events.includes('emit'), false);
});

test('Hồ sơ đã xét duyệt không được duyệt lại hoặc tạo thông báo mới', async () => {
  const context = setup('initial', 'approved');
  await assert.rejects(context.review(adminId, applicationId, { status: 'approved' }),
    (error) => error.statusCode === 400);
  assert.equal(context.notifications.length, 0);
});

test('Hook của model hoãn thông báo xét duyệt, thông báo thông thường vẫn phát như cũ', async () => {
  let schema;
  const emitted = [];
  class Schema {
    static Types = { Mixed: Object, ObjectId: Types.ObjectId };
    preHooks = [];
    postHooks = [];
    index() {}
    pre(_event, callback) { this.preHooks.push(callback); }
    post(_event, callback) { this.postHooks.push(callback); }
  }
  class Notification {
    constructor(value) { Object.assign(this, value); this.$locals = {}; this.isNew = true; }
    static async create(documents) {
      for (const document of documents) {
        schema.preHooks.forEach((callback) => callback.call(document));
        schema.postHooks.forEach((callback) => callback(document));
      }
      return documents;
    }
  }
  const socket = { emitToUser: (...args) => emitted.push(args) };
  const model = loadSource('../src/models/notification.model.ts', {
    mongoose: { Schema, Types, model: (_name, value) => { schema = value; return Notification; } },
    './common': { baseFields: {} }, '../sockets/socketServer': socket,
  });
  const service = loadSource('../src/services/notification.service.ts', {
    mongoose: { Types }, '../models/notification.model': model,
    '../models/order.model': { Order: {} }, '../models/provider.model': { Provider: {} },
    '../models/user.model': { __esModule: true, default: {} },
    '../utils/appError': { AppError: Error }, '../utils/mongo': { toObjectId: (id) => id },
    '../sockets/socketServer': socket,
  });
  const input = { userId, type: 'SYSTEM', title: 'Kết quả xét duyệt', content: 'Đã duyệt.' };
  const deferredNotification = await service.createNotificationRecord(input, { deferRealtime: true });
  assert.equal(emitted.length, 0);
  service.emitRealtimeNotification(deferredNotification);
  assert.equal(emitted.length, 1);
  await service.createNotificationRecord(input);
  assert.equal(emitted.length, 2);
});
