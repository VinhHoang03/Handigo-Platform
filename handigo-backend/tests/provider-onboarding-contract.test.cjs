const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
require('ts-node').register({ transpileOnly: true, project: path.join(__dirname, '../tsconfig.json') });
const { createProviderApplicationSchema, saveProviderApplicationDraftSchema, providerApplicationListQuerySchema } = require('../src/validations/providerApplication.validator');
const { updateProviderProfileSchema } = require('../src/validations/providerProfile.validator');
const { Provider } = require('../src/models/provider.model');
const { ProviderApplication } = require('../src/models/providerApplication.model');
const application = {
  description: 'Có kinh nghiệm vệ sinh điều hòa', experienceYears: 2,
  serviceIds: ['507f1f77bcf86cd799439014'],
  identityDocument: { type: 'cccd', documentNumber: '123456789012', fullName: 'Nguyễn Văn An', frontImageUrl: 'https://example.com/cccd.jpg' },
  certificates: [],
};

test('Khoảng ngày lọc hồ sơ bao gồm trọn ngày theo giờ Việt Nam và giữ phân trang', () => {
  const query = providerApplicationListQuerySchema.parse({
    fromDate: '2026-10-01', toDate: '2026-10-27', page: '2', limit: '20', status: 'pending',
  });
  assert.equal(query.fromDate.toISOString(), '2026-09-30T17:00:00.000Z');
  assert.equal(query.toDate.toISOString(), '2026-10-27T16:59:59.999Z');
  assert.equal(query.page, 2);
  assert.equal(query.limit, 20);
  assert.equal(query.status, 'pending');
  assert.equal(providerApplicationListQuerySchema.safeParse({ fromDate: '2026-02-30' }).success, false);
  assert.equal(providerApplicationListQuerySchema.safeParse({ fromDate: '2026-10-28', toDate: '2026-10-27' }).success, false);
  assert.equal(providerApplicationListQuerySchema.safeParse({ fromDate: '2026-10-27', toDate: '2026-10-27' }).success, true);
  assert.equal(providerApplicationListQuerySchema.safeParse({ toDate: '2026-10-27' }).success, true);
  assert.equal(providerApplicationListQuerySchema.safeParse({}).success, true);
});

test('Gửi hồ sơ ban đầu không cần khu vực hoạt động', () => {
  const result = createProviderApplicationSchema.safeParse(application);
  assert.equal(result.success, true);
  assert.equal(Object.hasOwn(result.data, 'workingAreas'), false);
});

test('Trường khu vực từ app cũ bị bỏ qua khi gửi, lưu nháp và cập nhật hồ sơ', () => {
  const legacy = { workingAreas: ['Nội dung cũ không còn cần kiểm tra'], serviceArea: { province: 'Dữ liệu cũ', ward: 'Dữ liệu cũ' } };
  for (const result of [
    createProviderApplicationSchema.parse({ ...application, ...legacy }),
    saveProviderApplicationDraftSchema.parse({ ...application, ...legacy }),
    updateProviderProfileSchema.parse({ bio: 'Giới thiệu', ...legacy }),
  ]) {
    assert.equal(Object.hasOwn(result, 'workingAreas'), false);
    assert.equal(Object.hasOwn(result, 'serviceArea'), false);
  }
});

test('Bỏ khu vực vẫn bắt buộc dịch vụ và giấy tờ xác minh', () => {
  assert.equal(createProviderApplicationSchema.safeParse({ ...application, serviceIds: [] }).success, false);
  assert.equal(createProviderApplicationSchema.safeParse({ ...application, identityDocument: undefined }).success, false);
});

test('Dữ liệu khu vực cũ bị ẩn mặc định và không được tạo mới theo default', () => {
  for (const schema of [Provider.schema, ProviderApplication.schema]) {
    const field = schema.path('workingAreas');
    assert.equal(field.options.select, false);
    assert.equal(field.options.default, undefined);
  }
  assert.equal(Provider.schema.path('serviceArea').options.select, false);
  assert.equal(Provider.schema.indexes().some(([fields]) => Object.keys(fields).some(key => key.startsWith('serviceArea.'))), false);
});
