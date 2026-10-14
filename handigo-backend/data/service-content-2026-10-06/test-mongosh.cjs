const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const payload = JSON.parse(fs.readFileSync(path.join(__dirname, 'content-update.json'), 'utf8'));
const source = fs.readFileSync(path.join(__dirname, 'paste-into-mongosh.js'), 'utf8');

function fixture({ conflict = false, failWrite = false } = {}) {
  let state = {};
  for (const collection of ['categories', 'services']) {
    state[collection] = payload[collection].map((entry) => ({
      _id: entry.id, name: entry.name, isDeleted: entry.isDeleted,
      isActive: !entry.isDeleted, fixedPrice: 123456,
      updatedAt: new Date('2026-10-01T00:00:00Z'), ...structuredClone(entry.previous),
    }));
  }
  if (conflict) state.services[0].description = 'Mô tả đã được sửa sau khi xuất dữ liệu.';
  const original = structuredClone(state);
  const messages = [];
  const backups = [];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const matches = (doc, filter) => Object.entries(filter).every(([key, value]) => {
    if (value && typeof value === 'object' && '$exists' in value) {
      return Object.hasOwn(doc, key) === value.$exists && (!('$eq' in value) || same(doc[key], value.$eq));
    }
    return same(doc[key], value);
  });
  const collection = (name) => ({
    insertOne: (document) => {
      assert.equal(name, 'handigo_content_backups');
      backups.push(structuredClone(document));
      return { insertedId: 'bản-sao-lưu-mô-phỏng' };
    },
    find: (filter) => ({ toArray: () => structuredClone(state[name].filter((doc) => filter._id.$in.includes(doc._id))) }),
    bulkWrite: (operations) => {
      if (failWrite && name === 'services') throw new Error('Lỗi ghi mô phỏng.');
      let matchedCount = 0;
      for (const { updateOne } of operations) {
        assert.equal(updateOne.upsert, false);
        const doc = state[name].find((item) => matches(item, updateOne.filter));
        if (doc) {
          Object.assign(doc, structuredClone(updateOne.update.$set));
          matchedCount++;
        }
      }
      return { matchedCount };
    },
  });
  const database = {
    getCollection: collection,
    getMongo: () => ({ startSession: () => ({
      getDatabase: (name) => { assert.equal(name, 'FixNow'); return database; },
      withTransaction: (callback) => {
        const before = structuredClone(state);
        try { callback(); } catch (error) { state = before; throw error; }
      },
      endSession: () => {},
    }) }),
  };
  const context = {
    db: { getSiblingDB: (name) => { assert.equal(name, 'FixNow'); return database; } },
    ObjectId: (id) => id,
    EJSON: { stringify: JSON.stringify },
    print: (message) => messages.push(message),
    require: () => { throw new Error('Shell giao diện không hỗ trợ require.'); },
  };
  return { run: () => vm.runInNewContext(`(async () => { ${source} })()`, context), getState: () => state, original, messages, backups };
}

test('Cập nhật đủ 44 bản ghi, giữ nguyên giá và trạng thái kể cả dịch vụ đã xóa', async () => {
  const task = fixture();
  await task.run();
  assert.equal(task.backups[0].documents.length, 44);
  for (const collection of ['categories', 'services']) {
    const docs = task.getState()[collection];
    for (let index = 0; index < docs.length; index++) {
      for (const [key, value] of Object.entries(payload[collection][index].set)) assert.deepEqual(docs[index][key], value);
      for (const key of ['isDeleted', 'isActive', 'fixedPrice', '_id', 'name']) assert.deepEqual(docs[index][key], task.original[collection][index][key]);
    }
  }
  assert(task.messages.some((message) => message.includes('44 bản ghi thành công')));
});

test('Chạy lại bỏ qua toàn bộ nội dung đã cập nhật', async () => {
  const task = fixture();
  await task.run();
  await task.run();
  assert.equal(task.backups.length, 1);
  assert(task.messages.some((message) => message.includes('Không cần cập nhật thêm')));
});

test('Nội dung khác bản xuất bị chặn trước khi ghi hoặc tạo sao lưu', async () => {
  const task = fixture({ conflict: true });
  await assert.rejects(task.run(), /Nội dung đã thay đổi/);
  assert.deepEqual(task.getState(), task.original);
  assert.equal(task.backups.length, 0);
});

test('Lỗi trong giao dịch khôi phục cả hai collection trong mô phỏng', async () => {
  const task = fixture({ failWrite: true });
  await assert.rejects(task.run(), /Lỗi ghi mô phỏng/);
  assert.deepEqual(task.getState(), task.original);
  assert.equal(task.backups.length, 1);
});
