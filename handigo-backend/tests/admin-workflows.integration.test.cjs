const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
require('ts-node/register/transpile-only');
const { MongoMemoryReplSet } = require(path.join(process.env.ADMIN_AI_TEST_RUNTIME || path.join(os.tmpdir(), 'handigo-admin-ai-test-runtime'), 'node_modules/mongodb-memory-server'));
const mongoose = require('mongoose');
const User = require('../src/models/user.model').default;
const { Provider } = require('../src/models/provider.model');
const { ProviderApplication } = require('../src/models/providerApplication.model');
const { Category } = require('../src/models/category.model');
const { Service } = require('../src/models/service.model');
const { ServiceSuggestion } = require('../src/models/serviceSuggestion.model');
const { Order } = require('../src/models/order.model');
const { Report } = require('../src/models/report.model');
const { SupportTicket } = require('../src/models/supportTicket.model');
const { Violation } = require('../src/models/violation.model');
const { ViolationEmail } = require('../src/models/violationEmail.model');
const { AuditLog } = require('../src/models/auditLog.model');
const { Notification } = require('../src/models/notification.model');
require('../src/models/complaint.model');
const { createViolation } = require('../src/services/violation.service');
const { updateSupportTicketStatus, getAdminSupportTickets } = require('../src/services/supportTicket.service');
const { updateServiceSuggestion } = require('../src/services/serviceSuggestion.service');
const { reviewApplication } = require('../src/services/providerApplication.service');
const { createConfig, updateConfig, getNumberConfigValue } = require('../src/services/systemConfig.service');

test('Hồi quy nghiệp vụ ADMIN từ mục 2 đến mục 8', { timeout: 120000 }, async t => {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  try {
    await mongoose.connect(replica.getUri(), { dbName: 'handigo_admin_workflows_test' });
    await Promise.all(Object.values(mongoose.models).map(model => model.init()));
    const admin = await User.create({ email: 'admin@example.test', fullName: 'Nguyễn Văn An', role: 'ADMIN' });
    const otherAdmin = await User.create({ email: 'admin-khac@example.test', fullName: 'Lê Văn Nam', role: 'ADMIN' });
    const actor = { id: String(admin._id), role: 'ADMIN' };
    let sequence = 0;
    async function fixture() {
      const id = ++sequence;
      const user = await User.create({ email: `khach${id}@example.test`, fullName: 'Trần Văn Bình' });
      const other = await User.create({ email: `khac${id}@example.test`, fullName: 'Phạm Văn Sơn' });
      const provider = await Provider.create({ userId: other._id, description: 'Hồ sơ kiểm thử' });
      const orderId = new mongoose.Types.ObjectId();
      await Order.collection.insertOne({ _id: orderId, customerId: user._id, providerId: provider._id,
        orderCode: `HD-ADMIN-${id}`, status: 'completed', isDeleted: false });
      const report = await Report.create({ reporterId: admin._id, targetUserId: user._id, orderId,
        targetType: 'user', reportType: 'spam_chat', title: 'Báo cáo tin rác', description: 'Nội dung kiểm thử báo cáo' });
      const ticket = await SupportTicket.create({ requesterId: user._id, orderId, category: 'SECURITY',
        subject: 'Yêu cầu kiểm tra vi phạm', description: 'Nội dung kiểm thử hỗ trợ' });
      const payload = { sourceType: 'REPORT', sourceId: String(report._id), violationType: 'Tin nhắn rác', severity: 'HIGH',
        reason: 'Lý do xử lý đã xác minh', adminDecision: 'Khóa tài khoản vi phạm', penalty: { type: 'PERMANENT_BAN' } };
      return { user, other, provider, orderId, report, ticket, payload };
    }
    async function assertNoViolation(f) {
      assert.equal(await Violation.countDocuments({ sourceId: { $in: [f.report._id, f.ticket._id] } }), 0);
      assert.equal(await ViolationEmail.countDocuments({ userId: { $in: [f.user._id, f.other._id] } }), 0);
      assert.equal((await User.findById(f.user._id)).status, 'active');
      assert.equal((await User.findById(f.other._id)).status, 'active');
    }

    for (const sourceType of ['REPORT', 'SUPPORT_TICKET']) {
      await t.test(`${sourceType}: chặn người không thuộc nguồn, không khóa nhầm tài khoản`, async () => {
        const f = await fixture();
        const unrelated = await User.create({ email: `ngoai${++sequence}@example.test`, fullName: 'Đỗ Văn Minh' });
        const payload = { ...f.payload, sourceType, sourceId: String(sourceType === 'REPORT' ? f.report._id : f.ticket._id),
          userId: String(sourceType === 'REPORT' ? f.other._id : unrelated._id) };
        await assert.rejects(createViolation(actor.id, payload), error => error.statusCode === 400);
        await assertNoViolation(f);
        assert.equal((await User.findById(unrelated._id)).status, 'active');
      });
      await t.test(`${sourceType}: chặn orderId không khớp, kể cả ID không tồn tại`, async () => {
        const f = await fixture();
        await assert.rejects(createViolation(actor.id, { ...f.payload, sourceType,
          sourceId: String(sourceType === 'REPORT' ? f.report._id : f.ticket._id),
          userId: String(f.user._id), orderId: String(new mongoose.Types.ObjectId()) }), error => error.statusCode === 400);
        await assertNoViolation(f);
      });
      await t.test(`${sourceType}: nguồn liên kết đơn đã xóa phải bị từ chối`, async () => {
        const f = await fixture();
        await Order.collection.updateOne({ _id: f.orderId }, { $set: { isDeleted: true } });
        await assert.rejects(createViolation(actor.id, { ...f.payload, sourceType,
          sourceId: String(sourceType === 'REPORT' ? f.report._id : f.ticket._id), userId: String(f.user._id) }), error => error.statusCode === 404);
        await assertNoViolation(f);
      });
    }

    await t.test('Báo cáo nhận ID khớp ở dạng chữ hoa và lấy ngữ cảnh từ database', async () => {
      const f = await fixture();
      const result = await createViolation(actor.id, { ...f.payload, userId: String(f.user._id).toUpperCase(), orderId: String(f.orderId).toUpperCase() });
      assert.equal(String(result.userId._id), String(f.user._id));
      assert.equal(String(result.orderId._id), String(f.orderId));
    });

    for (const target of ['requester', 'customer', 'provider']) {
      await t.test(`Ticket cho phép xử lý ${target} liên quan đúng đơn`, async () => {
        const f = await fixture();
        let userId = String(target === 'provider' ? f.other._id : f.user._id);
        if (target === 'requester') {
          const requester = await User.create({ email: `nguoigui${++sequence}@example.test`, fullName: 'Đỗ Văn Minh' });
          await SupportTicket.updateOne({ _id: f.ticket._id }, { requesterId: requester._id });
          userId = String(requester._id);
        }
        const result = await createViolation(actor.id, { ...f.payload, sourceType: 'SUPPORT_TICKET', sourceId: String(f.ticket._id), userId });
        assert.equal(String(result.userId._id), userId);
        assert.equal(String(result.orderId._id), String(f.orderId));
      });
    }

    await t.test('Ticket không có đơn không được nhận đơn do client chèn', async () => {
      const f = await fixture();
      await SupportTicket.updateOne({ _id: f.ticket._id }, { orderId: null });
      await assert.rejects(createViolation(actor.id, { ...f.payload, sourceType: 'SUPPORT_TICKET', sourceId: String(f.ticket._id),
        userId: String(f.user._id), orderId: String(f.orderId) }), error => error.statusCode === 400);
      await assertNoViolation(f);
    });

    await t.test('Ticket đã giải quyết phải mở lại hợp lệ trước khi tạo vi phạm', async () => {
      const f = await fixture();
      await updateSupportTicketStatus(actor.id, String(f.ticket._id), { status: 'resolved' });
      const payload = { ...f.payload, sourceType: 'SUPPORT_TICKET', sourceId: String(f.ticket._id), userId: String(f.user._id) };
      await assert.rejects(createViolation(actor.id, payload), error => error.statusCode === 400);
      await updateSupportTicketStatus(actor.id, String(f.ticket._id), { status: 'in_progress' });
      await assert.doesNotReject(createViolation(actor.id, payload));
    });

    await t.test('Ticket bị hủy đồng thời không được ghi đè thành resolved hoặc khóa tài khoản', async st => {
      const f = await fixture();
      let cancelled = false;
      const original = Violation.create;
      st.mock.method(Violation, 'create', async function (...args) {
        if (!cancelled) {
          cancelled = true;
          await SupportTicket.collection.updateOne({ _id: f.ticket._id }, { $set: { status: 'cancelled' }, $inc: { __v: 1 } });
        }
        return original.apply(this, args);
      });
      await assert.rejects(createViolation(actor.id, { ...f.payload, sourceType: 'SUPPORT_TICKET', sourceId: String(f.ticket._id),
        userId: String(f.user._id) }), error => error.statusCode === 400);
      assert.equal((await SupportTicket.findById(f.ticket._id)).status, 'cancelled');
      await assertNoViolation(f);
    });

    await t.test('Đóng hoặc cập nhật lại ticket không đổi người và ngày đã giải quyết', async () => {
      const f = await fixture();
      const resolvedAt = new Date(Date.now() - 7 * 86400000);
      await SupportTicket.updateOne({ _id: f.ticket._id }, { status: 'resolved', resolvedAt, resolvedBy: admin._id });
      const before = (await getAdminSupportTickets()).summary;
      await updateSupportTicketStatus(String(otherAdmin._id), String(f.ticket._id), { status: 'closed' });
      await updateSupportTicketStatus(String(otherAdmin._id), String(f.ticket._id), { status: 'closed', resolutionNote: 'Ghi chú bổ sung' });
      const saved = await SupportTicket.findById(f.ticket._id);
      const after = (await getAdminSupportTickets()).summary;
      assert.equal(saved.resolvedAt.getTime(), resolvedAt.getTime());
      assert.equal(String(saved.resolvedBy), actor.id);
      assert.equal(after.resolvedToday, before.resolvedToday);
      assert.equal(after.averageResolutionMs, before.averageResolutionMs);
    });

    await t.test('Mở lại rồi giải quyết lần nữa ghi nhận đúng lần xử lý mới', async () => {
      const f = await fixture();
      await updateSupportTicketStatus(actor.id, String(f.ticket._id), { status: 'resolved' });
      await updateSupportTicketStatus(String(otherAdmin._id), String(f.ticket._id), { status: 'in_progress' });
      const reopened = await SupportTicket.findById(f.ticket._id);
      assert.equal(reopened.resolvedAt, null);
      assert.equal(reopened.resolvedBy, null);
      await updateSupportTicketStatus(String(otherAdmin._id), String(f.ticket._id), { status: 'resolved' });
      assert.equal(String((await SupportTicket.findById(f.ticket._id)).resolvedBy), String(otherAdmin._id));
    });

    const configCollection = () => mongoose.connection.collection('system_configs');
    for (const value of [-1, 100.01, 150, '15', null]) {
      await t.test(`Phí nền tảng ${JSON.stringify(value)} bị chặn khi tạo và cập nhật`, async () => {
        await configCollection().deleteMany({ key: 'PLATFORM_FEE_PERCENT' });
        const input = { key: 'PLATFORM_FEE_PERCENT', type: 'NUMBER', value, isPublic: false };
        await assert.rejects(createConfig(actor, input), error => error.statusCode === 400);
        assert.equal(await configCollection().findOne({ key: input.key }), null);
        const saved = await createConfig(actor, { ...input, value: 15 });
        await assert.rejects(updateConfig(actor, input.key, { value }), error => error.statusCode === 400);
        assert.equal(await getNumberConfigValue(input.key, 0), 15);
        assert.equal(await AuditLog.countDocuments({ targetId: saved.id }), 1);
      });
    }
    await t.test('Phí nền tảng chấp nhận 0, số thập phân hợp lệ và 100; chặn đổi sang STRING', async () => {
      await configCollection().deleteMany({ key: 'PLATFORM_FEE_PERCENT' });
      await createConfig(actor, { key: 'PLATFORM_FEE_PERCENT', value: 0, type: 'NUMBER', isPublic: false });
      for (const value of [0, 15.5, 100]) {
        await updateConfig(actor, 'PLATFORM_FEE_PERCENT', { value });
        assert.equal(await getNumberConfigValue('PLATFORM_FEE_PERCENT', 15), value);
      }
      await assert.rejects(updateConfig(actor, 'PLATFORM_FEE_PERCENT', { value: '15', type: 'STRING' }), error => error.statusCode === 400);
    });
    await t.test('Dữ liệu cấu hình cũ vượt 100 không được dùng để tính phí', async () => {
      await configCollection().updateOne({ key: 'PLATFORM_FEE_PERCENT' }, { $set: { value: 150 } });
      await assert.rejects(getNumberConfigValue('PLATFORM_FEE_PERCENT', 15), error => error.statusCode === 503);
    });

    for (const action of ['create', 'update']) {
      await t.test(`Lỗi audit khi ${action} rollback cả cấu hình và log`, async st => {
        const key = `ADMIN_AUDIT_${action.toUpperCase()}`;
        let saved;
        if (action === 'update') saved = await createConfig(actor, { key, value: 10, type: 'NUMBER', isPublic: false });
        const original = AuditLog.create;
        st.mock.method(AuditLog, 'create', async function (...args) {
          await original.apply(this, args);
          throw new Error('Lỗi audit giả lập sau khi ghi');
        });
        await assert.rejects(action === 'create'
          ? createConfig(actor, { key, value: 20, type: 'NUMBER', isPublic: false })
          : updateConfig(actor, key, { value: 20 }), /Lỗi audit giả lập/);
        const current = await configCollection().findOne({ key });
        assert.equal(current?.value ?? null, action === 'create' ? null : 10);
        if (saved) assert.equal(await AuditLog.countDocuments({ targetId: saved.id }), 1);
        else assert.equal(await AuditLog.countDocuments({ 'newValue.key': key }), 0);
      });
    }
    await t.test('Cập nhật cấu hình đồng thời lưu audit trước/sau đúng từng giao dịch', async () => {
      const saved = await createConfig(actor, { key: 'ADMIN_CONCURRENT_CONFIG', value: 0, type: 'NUMBER', isPublic: false });
      await Promise.all([updateConfig(actor, 'ADMIN_CONCURRENT_CONFIG', { value: 1 }), updateConfig(actor, 'ADMIN_CONCURRENT_CONFIG', { value: 2 })]);
      const logs = await AuditLog.find({ targetId: saved.id, action: 'UPDATE_SYSTEM_CONFIG' });
      assert.equal(logs.length, 2);
      const first = logs.find(log => log.oldValue.value === 0);
      const second = logs.find(log => log.oldValue.value === first.newValue.value);
      assert.ok(first && second);
      assert.equal((await configCollection().findOne({ key: 'ADMIN_CONCURRENT_CONFIG' })).value, second.newValue.value);
    });

    async function suggestionFixture(type = 'service') {
      const f = await fixture();
      const category = await Category.create({ name: 'Danh mục kiểm thử', slug: `admin-category-${++sequence}` });
      const suggestion = await ServiceSuggestion.create({ providerId: f.provider._id, suggestionType: type,
        suggestedServiceName: `Dịch vụ ${sequence}`, suggestedCategoryName: `Danh mục ${sequence}`, categoryId: category._id });
      return { ...f, category, suggestion };
    }
    for (const type of ['service', 'category']) {
      await t.test(`Đề xuất ${type} đã duyệt không đổi trạng thái hoặc xóa liên kết, vẫn gửi được phản hồi`, async () => {
        const f = await suggestionFixture(type);
        await updateServiceSuggestion(String(f.suggestion._id), { status: 'approved' }, actor.id);
        const before = await ServiceSuggestion.findById(f.suggestion._id).lean();
        const link = type === 'service' ? 'createdServiceId' : 'createdCategoryId';
        for (const input of [{ status: 'rejected' }, { status: 'pending' }, { [link]: null }, { status: 'approved', [link]: null }, { categoryId: null }]) {
          await assert.rejects(updateServiceSuggestion(String(f.suggestion._id), input, actor.id), error => error.statusCode === 409);
        }
        await updateServiceSuggestion(String(f.suggestion._id), { adminNote: 'Phản hồi bổ sung' }, String(otherAdmin._id));
        const after = await ServiceSuggestion.findById(f.suggestion._id).lean();
        assert.equal(after.status, 'approved');
        assert.equal(String(after[link]), String(before[link]));
        assert.equal(String(after.reviewedBy), String(before.reviewedBy));
        assert.equal(after.reviewedAt.getTime(), before.reviewedAt.getTime());
      });
    }
    await t.test('Đề xuất đã từ chối không được duyệt lại qua API cũ', async () => {
      const f = await suggestionFixture();
      await updateServiceSuggestion(String(f.suggestion._id), { status: 'rejected' }, actor.id);
      await assert.rejects(updateServiceSuggestion(String(f.suggestion._id), { status: 'approved' }, actor.id), error => error.statusCode === 409);
      assert.equal(await Service.countDocuments({ categoryId: f.category._id }), 0);
    });
    await t.test('Duyệt và từ chối đồng thời một đề xuất chỉ có một quyết định được ghi', async () => {
      const f = await suggestionFixture();
      const results = await Promise.allSettled(['approved', 'rejected'].map(status => updateServiceSuggestion(String(f.suggestion._id), { status }, actor.id)));
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      assert.equal(results.find(result => result.status === 'rejected').reason.statusCode, 409);
      const saved = await ServiceSuggestion.findById(f.suggestion._id);
      assert.equal(await Service.countDocuments({ categoryId: f.category._id }), saved.status === 'approved' ? 1 : 0);
    });

    for (const applicationType of ['initial', 'service_addition']) {
      for (const state of ['inactive', 'deleted', 'missing', 'active']) {
        await t.test(`Duyệt hồ sơ ${applicationType} kiểm tra lại dịch vụ ${state}`, async () => {
          const f = await suggestionFixture();
          const service = await Service.create({ categoryId: f.category._id, name: 'Dịch vụ đăng ký', slug: `application-service-${++sequence}`,
            serviceType: 'variable_price', depositAmount: 10000, isActive: true });
          if (applicationType === 'service_addition') await User.updateOne({ _id: f.other._id }, { role: 'PROVIDER' });
          const userId = applicationType === 'initial' ? f.user._id : f.other._id;
          const application = await ProviderApplication.create({ userId, applicationType, status: 'pending',
            description: 'Hồ sơ đăng ký kiểm thử', experienceYears: 1, serviceIds: [service._id], certificates: [] });
          if (state === 'inactive') await Service.updateOne({ _id: service._id }, { isActive: false });
          if (state === 'deleted') await Service.updateOne({ _id: service._id }, { isDeleted: true });
          if (state === 'missing') await Service.deleteOne({ _id: service._id });
          if (state === 'active') {
            await assert.doesNotReject(reviewApplication(actor.id, String(application._id), { status: 'approved' }));
            assert.equal((await ProviderApplication.findById(application._id)).status, 'approved');
            assert.ok((await Provider.findOne({ userId })).serviceIds.some(id => String(id) === String(service._id)));
            assert.equal((await Service.findById(service._id)).updatedAt.getTime(), service.updatedAt.getTime());
          } else {
            await assert.rejects(reviewApplication(actor.id, String(application._id), { status: 'approved' }), error => error.statusCode === 400);
            const saved = await ProviderApplication.findById(application._id);
            assert.equal(saved.status, 'pending');
            assert.equal(saved.reviewHistory.length, 0);
            assert.equal(await Notification.countDocuments({ 'data.providerApplicationId': application._id }), 0);
            const provider = await Provider.findOne({ userId });
            assert.ok(!provider || !provider.serviceIds.some(id => String(id) === String(service._id)));
          }
        });
      }
    }
    await t.test('Từ chối hồ sơ có dịch vụ đã ngừng vẫn hoạt động', async () => {
      const f = await suggestionFixture();
      const application = await ProviderApplication.create({ userId: f.user._id, status: 'pending', applicationType: 'initial',
        description: 'Hồ sơ đăng ký kiểm thử', experienceYears: 1, serviceIds: [new mongoose.Types.ObjectId()], certificates: [] });
      await reviewApplication(actor.id, String(application._id), { status: 'rejected', rejectionReason: 'Dịch vụ đã ngừng', rejectionNotes: 'Vui lòng chọn lại dịch vụ.' });
      assert.equal((await ProviderApplication.findById(application._id)).status, 'rejected');
    });

    await t.test('Dịch vụ bị ngừng đồng thời giữa lúc duyệt phải rollback toàn bộ hồ sơ', async st => {
      const f = await suggestionFixture();
      const service = await Service.create({ categoryId: f.category._id, name: 'Dịch vụ kiểm tra đồng thời', slug: `concurrent-${++sequence}`,
        serviceType: 'variable_price', depositAmount: 10000, isActive: true });
      const application = await ProviderApplication.create({ userId: f.user._id, status: 'pending', applicationType: 'initial',
        description: 'Hồ sơ đăng ký kiểm thử', experienceYears: 1, serviceIds: [service._id], certificates: [] });
      const original = Service.updateMany;
      let disabled = false;
      st.mock.method(Service, 'updateMany', async function (...args) {
        if (!disabled) {
          disabled = true;
          await Service.collection.updateOne({ _id: service._id }, { $set: { isActive: false } });
        }
        return original.apply(this, args);
      });
      await assert.rejects(reviewApplication(actor.id, String(application._id), { status: 'approved' }), error => error.statusCode === 400);
      assert.equal((await ProviderApplication.findById(application._id)).status, 'pending');
      assert.equal(await Provider.countDocuments({ userId: f.user._id }), 0);
      assert.equal(await Notification.countDocuments({ 'data.providerApplicationId': application._id }), 0);
    });

    await t.test('Luồng tự duyệt dùng cùng kiểm tra dịch vụ hợp lệ và không bỏ qua bảo vệ', async () => {
      const f = await suggestionFixture();
      const service = await Service.create({ categoryId: f.category._id, name: 'Dịch vụ tự duyệt', slug: `auto-${++sequence}`,
        serviceType: 'variable_price', depositAmount: 10000, isActive: false });
      const application = await ProviderApplication.create({ userId: f.user._id, status: 'pending', applicationType: 'initial',
        description: 'Hồ sơ đăng ký kiểm thử', experienceYears: 1, serviceIds: [service._id], certificates: [] });
      const automation = { assessmentId: String(new mongoose.Types.ObjectId()), beforeWrite: async session => { assert.ok(session.inTransaction()); } };
      await assert.rejects(reviewApplication(actor.id, String(application._id), { status: 'approved' }, automation), error => error.statusCode === 400);
      await Service.updateOne({ _id: service._id }, { isActive: true });
      await reviewApplication(actor.id, String(application._id), { status: 'approved' }, automation);
      assert.equal((await ProviderApplication.findById(application._id)).reviewSource, 'ai');
    });
  } finally {
    await mongoose.disconnect();
    await replica.stop();
  }
});
