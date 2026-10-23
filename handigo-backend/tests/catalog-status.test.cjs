const { test } = require('node:test');
const assert = require('node:assert/strict');

const imagePath = require.resolve('../dist/services/serviceImage.service');
require.cache[imagePath] = { id: imagePath, filename: imagePath, loaded: true, exports: { validateNewServiceImages: async () => {} } };
const { Category } = require('../dist/models/category.model');
const { Service } = require('../dist/models/service.model');
const { ServiceOption } = require('../dist/models/serviceOption.model');
const { Feedback } = require('../dist/models/feedback.model');
const { Order } = require('../dist/models/order.model');
const { getOptionsByServiceId } = require('../dist/services/serviceOption.service');
const categories = require('../dist/services/category.service');
const services = require('../dist/services/service.service');
const { catalogStatus, catalogStatusFilter } = require('../dist/utils/catalogStatus');
const id = '507f1f77bcf86cd799439011';
const categoryId = '507f1f77bcf86cd799439012';
const chain = items => ({ sort() { return this; }, skip() { return this; }, limit() { return Promise.resolve(items); }, populate() { return this; } });

test('Dữ liệu xóa mềm cũ chỉ được xem là ngừng hoạt động', () => {
  assert.equal(catalogStatus({ isDeleted: true, isActive: true }).isActive, false);
  assert.equal(catalogStatus({ isDeleted: false, isActive: true }).isActive, true);
  assert.deepEqual(catalogStatusFilter('false'), { $or: [{ isActive: false }, { isDeleted: true }] });
  assert.deepEqual(catalogStatusFilter('true'), { isActive: true, isDeleted: false });
});

test('Admin thấy bản ghi cũ, lọc trạng thái kết hợp tìm kiếm và đếm cùng điều kiện', async t => {
  const filters = [];
  t.mock.method(Category, 'find', filter => { filters.push(filter); return chain([{ toObject: () => ({ _id: id, isActive: true, isDeleted: true }) }]); });
  t.mock.method(Category, 'countDocuments', async filter => { filters.push(filter); return 1; });
  const result = await categories.listCategories({ isActive: 'false', search: 'thử' }, true);
  assert.equal(result.items[0].isActive, false);
  assert.equal(result.pagination.total, 1);
  assert.deepEqual(filters[0], filters[1]);
  assert.equal(filters[0].isDeleted, undefined);
  assert.deepEqual(filters[0].$and, [catalogStatusFilter('false')]);
  assert.equal(filters[0].$or.length, 2);
});

test('Ngừng danh mục có dịch vụ không xóa bản ghi và giữ trạng thái dịch vụ con', async t => {
  const category = { isActive: true, isDeleted: false, deletedAt: null, save: async () => category };
  t.mock.method(Category, 'findOne', async () => category);
  t.mock.method(Service, 'exists', () => { throw new Error('Không được chặn ngừng danh mục có dịch vụ'); });
  t.mock.method(Service, 'updateMany', () => { throw new Error('Không được thay đổi dịch vụ con'); });
  await categories.deleteCategory(id);
  assert.equal(category.isActive, false);
  assert.equal(category.isDeleted, false);
  assert.equal(category.deletedAt, null);
});

test('Ngừng dịch vụ giữ nguyên tùy chọn, có thể bật lại', async t => {
  const service = new Service({ _id: id, categoryId, name: 'Dịch vụ thử', slug: 'thu', serviceType: 'variable_price', depositAmount: 100000, isActive: true });
  service.save = async () => service;
  t.mock.method(Service, 'findOne', async () => service);
  t.mock.method(Service, 'exists', async () => null);
  t.mock.method(Category, 'findOne', async () => ({ isActive: true }));
  t.mock.method(ServiceOption, 'find', async () => []);
  t.mock.method(ServiceOption, 'updateMany', () => { throw new Error('Không được tắt tùy chọn'); });
  await services.deleteService(id);
  assert.equal(service.isActive, false);
  assert.equal(service.isDeleted, false);
  await services.updateService(id, { isActive: true });
  assert.equal(service.isActive, true);
});

test('Bật lại dịch vụ xóa mềm cũ chuẩn hóa cờ; chặn khi danh mục ngừng hoặc thiếu đặt cọc', async t => {
  const service = new Service({ _id: id, categoryId, name: 'Dịch vụ thử', slug: 'thu', serviceType: 'variable_price', depositAmount: 100000, isActive: false, isDeleted: true, deletedAt: new Date() });
  service.save = async () => service;
  t.mock.method(Service, 'findOne', async () => service);
  t.mock.method(Service, 'exists', async () => null);
  const parent = t.mock.method(Category, 'findOne', async () => ({ isActive: false }));
  t.mock.method(ServiceOption, 'find', async () => []);
  await assert.rejects(services.updateService(id, { isActive: true }), /danh mục đang tạm ngừng/);
  assert.equal(service.isDeleted, true);
  parent.mock.mockImplementation(async () => ({ isActive: true }));
  service.depositAmount = null;
  await assert.rejects(services.updateService(id, { isActive: true }), /tiền đặt cọc/);
  service.depositAmount = 100000;
  await services.updateService(id, { isActive: true });
  assert.equal(service.isActive, true);
  assert.equal(service.isDeleted, false);
  assert.equal(service.deletedAt, null);
});

test('Khôi phục danh mục kiểm tra màu trùng trước khi lưu', async t => {
  const category = { isActive: false, isDeleted: true, iconColor: '#123456', save: async () => category };
  t.mock.method(Category, 'init', async () => {});
  t.mock.method(Category, 'findOne', async () => category);
  const exists = t.mock.method(Category, 'exists', () => ({ collation: async () => true }));
  await assert.rejects(categories.updateCategory(id, { isActive: true }), /Mã màu này/);
  assert.equal(category.isDeleted, true);
  exists.mock.mockImplementation(() => ({ collation: async () => null }));
  await categories.updateCategory(id, { isActive: true });
  assert.equal(category.isDeleted, false);
  assert.equal(category.isActive, true);
});

test('Danh sách công khai chỉ lấy dịch vụ và danh mục đang hoạt động, admin lấy cả dữ liệu cũ', async t => {
  const filters = [];
  t.mock.method(Service, 'find', filter => { filters.push(filter); return chain([]); });
  t.mock.method(Service, 'countDocuments', async () => 0);
  t.mock.method(Category, 'find', filter => { assert.deepEqual(filter, { isActive: true, isDeleted: false }); return { select: async () => [{ _id: categoryId }] }; });
  t.mock.method(ServiceOption, 'aggregate', async () => []);
  t.mock.method(Feedback, 'aggregate', async () => []);
  await services.listServices({ isActive: 'false' });
  assert.equal(filters[0].isActive, true);
  assert.deepEqual(filters[0].categoryId, { $in: [categoryId] });
  await services.listServices({}, true);
  assert.equal(filters[1].isDeleted, undefined);
  assert.equal(filters[1].isActive, undefined);
});

test('Chi tiết và tùy chọn bị chặn công khai khi danh mục ngừng; admin vẫn xem được dữ liệu cũ', async t => {
  const service = new Service({ _id: id, categoryId, name: 'Dịch vụ thử', slug: 'thu', serviceType: 'variable_price', isDeleted: true, isActive: true });
  t.mock.method(Service, 'findOne', () => ({ populate: async () => service, then: resolve => resolve(service) }));
  t.mock.method(Category, 'exists', async () => false);
  t.mock.method(Feedback, 'aggregate', async () => []);
  t.mock.method(Order, 'countDocuments', async () => 0);
  t.mock.method(ServiceOption, 'find', () => ({ sort: async () => [] }));
  await assert.rejects(services.getServiceById(id), /ngừng hoạt động/);
  await assert.rejects(getOptionsByServiceId(id), /ngừng hoạt động/);
  const result = await services.getServiceById(id, true);
  assert.equal(result.isActive, false);
  assert.deepEqual(await getOptionsByServiceId(id, true), []);
});
