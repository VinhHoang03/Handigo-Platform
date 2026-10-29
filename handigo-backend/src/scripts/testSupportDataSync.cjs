const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { Types } = require('mongoose');
const { AppError } = require('../utils/appError');

// Cô lập database, kiểm tra filter thật của service và tổng phân trang.
const owner = String(new Types.ObjectId());
const other = String(new Types.ObjectId());
const adminA = String(new Types.ObjectId());
const adminB = String(new Types.ObjectId());
const rows = [
  { requesterId: owner, subject: 'Lỗi [đơn]', description: 'Nội dung thử', assignedAdminId: adminA, isDeleted: false },
  { requesterId: owner, subject: 'Tài khoản', description: 'Cần kiểm tra [đơn]', assignedAdminId: adminB, isDeleted: false },
  { requesterId: owner, subject: 'Không khớp', description: 'Không có từ khóa', assignedAdminId: null, isDeleted: false },
  { requesterId: other, subject: 'Lỗi [đơn]', description: 'Không được xem', assignedAdminId: null, isDeleted: false },
  { requesterId: owner, subject: 'Lỗi [đơn]', description: 'Đã xóa', assignedAdminId: null, isDeleted: true },
];
const matches = (row, filter) => Object.entries(filter).every(([key, value]) => {
  if (key === '$or') return value.some(part => matches(row, part));
  if (key === '$and') return value.every(part => matches(row, part));
  if (Object.prototype.toString.call(value) === '[object RegExp]') return value.test(row[key]);
  if (value && '$ne' in Object(value)) return String(row[key]) !== String(value.$ne);
  return String(row[key]) === String(value);
});
function query(filter, count = false) {
  let skip = 0, limit = rows.length;
  return { sort() { return this; }, populate() { return this; },
    skip(value) { skip = value; return this; }, limit(value) { limit = value; return this; },
    then(resolve, reject) {
      const result = rows.filter(row => matches(row, filter));
      return Promise.resolve(count ? result.length : result.slice(skip, skip + limit)).then(resolve, reject);
    } };
}
const SupportTicket = { find: filter => query(filter), countDocuments: filter => query(filter, true), aggregate: async () => [] };
const dependencies = {
  mongoose: { Types }, '../utils/appError': { AppError }, '../models/order.model': {},
  '../models/provider.model': {}, '../models/user.model': {}, '../models/supportTicket.model': { SupportTicket },
};
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../services/supportTicket.service'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, { exports: exportsObject, Date, require: name => {
  assert.ok(name in dependencies, `Phụ thuộc ngoài giả lập: ${name}`); return dependencies[name];
} });

async function run() {
  const result = await exportsObject.getMySupportTickets(owner, { keyword: '[đơn]', page: 1, limit: 1 });
  assert.equal(result.items.length, 1);
  assert.equal(result.pagination.total, 2);
  assert.equal(result.pagination.totalPages, 2);
  const second = await exportsObject.getMySupportTickets(owner, { keyword: '[đơn]', page: 2, limit: 1 });
  assert.equal(second.items[0].subject, 'Tài khoản');
  assert.ok(result.items.every(row => row.requesterId === owner && !row.isDeleted));
  const escaped = await exportsObject.getMySupportTickets(owner, { keyword: '.*' });
  assert.equal(escaped.pagination.total, 0, 'Từ khóa đặc biệt phải được coi là văn bản, không chạy như regex.');
  const blank = await exportsObject.getMySupportTickets(owner, { keyword: '  ' });
  assert.equal(blank.pagination.total, 3);
  const assigned = await exportsObject.getAdminSupportTickets({ assignment: 'assigned', assignedAdminId: adminA });
  assert.equal(assigned.pagination.total, 1); assert.equal(assigned.items[0].assignedAdminId, adminA);
  const impossible = await exportsObject.getAdminSupportTickets({ assignment: 'unassigned', assignedAdminId: adminA });
  assert.equal(impossible.pagination.total, 0);
  const unassigned = await exportsObject.getAdminSupportTickets({ assignment: 'unassigned' });
  assert.equal(unassigned.pagination.total, 2);
  console.log('Đạt: tìm kiếm hỗ trợ đúng quyền, escape ký tự, phân trang/tổng số và giao nhau bộ lọc phân công.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
