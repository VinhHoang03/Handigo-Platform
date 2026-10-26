const { test } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');
const { Category } = require('../src/models/category.model');
const { Service } = require('../src/models/service.model');
const { ServiceOption } = require('../src/models/serviceOption.model');
const { searchCatalog } = require('../src/services/search.service');
const query = rows => ({ select() { return this; }, lean: async () => rows });

test('Tìm kiếm loại dịch vụ và tùy chọn khi danh mục cha ngừng hoạt động', async t => {
  t.mock.method(Category, 'find', filter => {
    assert.deepEqual(filter, { isActive: true, isDeleted: false });
    return query([{ _id: 'danh-muc-mo', name: 'Danh mục' }]);
  });
  t.mock.method(Service, 'find', () => query([
    { _id: 'dich-vu-mo', categoryId: 'danh-muc-mo', name: 'Sửa điện' },
    { _id: 'dich-vu-tat', categoryId: 'danh-muc-tat', name: 'Sửa điện cũ' },
  ]));
  t.mock.method(ServiceOption, 'find', () => query([
    { _id: 'goi-mo', serviceId: 'dich-vu-mo', name: 'Sửa công tắc' },
    { _id: 'goi-tat', serviceId: 'dich-vu-tat', name: 'Sửa ổ điện' },
  ]));
  const result = await searchCatalog({ q: 'sua', limit: 10 });
  assert.deepEqual(result.map(item => item.id).sort(), ['dich-vu-mo', 'goi-mo']);
});
