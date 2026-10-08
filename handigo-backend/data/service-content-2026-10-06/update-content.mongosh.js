// Chạy bằng load(...) trong MongoDB Shell đã kết nối với cụm chứa FixNow.
await (async function updateHandigoContent() {
  const fs = require('fs');
  const directory = 'C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/data/service-content-2026-10-06';
  const payload = JSON.parse(fs.readFileSync(`${directory}/content-update.json`, 'utf8'));
  const target = db.getSiblingDB('FixNow');
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const pending = { categories: [], services: [] };
  const backup = { database: 'FixNow', createdAt: new Date(), documents: [] };

  for (const [collection, count] of [['categories', 11], ['services', 33]]) {
    const entries = payload[collection];
    if (!Array.isArray(entries) || entries.length !== count || new Set(entries.map((entry) => entry.id)).size !== count) {
      throw new Error(`Số bản ghi hoặc ID không hợp lệ trong ${collection}.`);
    }
    for (const entry of entries) {
      if (!/^[0-9a-f]{24}$/i.test(entry.id) || typeof entry.isDeleted !== 'boolean') throw new Error('ID hoặc trạng thái không hợp lệ.');
      const allowed = collection === 'services' ? ['description', 'processSteps'] : ['description'];
      if (!same(Object.keys(entry.set).sort(), allowed.sort()) || typeof entry.set.description !== 'string' || entry.set.description.trim().length < 200) {
        throw new Error(`Mô tả hoặc field cập nhật không hợp lệ: ${entry.name}.`);
      }
      if (collection === 'services') {
        const steps = entry.set.processSteps;
        if (!Array.isArray(steps) || steps.length < 4 || steps.length > 20 || steps.some((step) =>
          typeof step.title !== 'string' || !step.title.trim() || step.title.length > 120 ||
          typeof step.description !== 'string' || !step.description.trim() || step.description.length > 2000 ||
          !same(Object.keys(step).sort(), ['description', 'title']))) {
          throw new Error(`Quy trình không hợp lệ: ${entry.name}.`);
        }
      }
    }
    const documents = await target.getCollection(collection).find({ _id: { $in: entries.map((entry) => ObjectId(entry.id)) } }).toArray();
    const byId = new Map(documents.map((document) => [document._id.toString(), document]));
    for (const entry of entries) {
      const original = byId.get(entry.id);
      if (!original || original.name !== entry.name || original.isDeleted !== entry.isDeleted) throw new Error(`Không khớp ID, tên hoặc trạng thái: ${entry.name}.`);
      const keys = Object.keys(entry.set);
      if (keys.every((key) => same(original[key], entry.set[key]))) continue;
      if (keys.some((key) => !same(original[key], entry.previous[key]))) throw new Error(`Nội dung đã thay đổi so với bản xuất: ${entry.name}. Dừng để tránh ghi đè.`);
      const filter = { _id: original._id, name: original.name, isDeleted: original.isDeleted };
      for (const key of [...keys, 'updatedAt']) {
        filter[key] = owns(original, key) ? { $eq: original[key], $exists: true } : { $exists: false };
      }
      pending[collection].push({ entry, filter });
      backup.documents.push({ collection, before: original, after: entry.set });
    }
  }

  const total = pending.categories.length + pending.services.length;
  print(`Database FixNow: chuẩn bị cập nhật ${pending.categories.length}/11 danh mục và ${pending.services.length}/33 dịch vụ, gồm cả dịch vụ đã xóa mềm. Trạng thái được giữ nguyên.`);
  if (total === 0) {
    print('Toàn bộ 44 bản ghi đã có nội dung mới. Không cần cập nhật thêm.');
    return;
  }
  const backupPath = `${directory}/backup-mongosh-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(backupPath, EJSON.stringify(backup, null, 2), { flag: 'wx' });
  const session = target.getMongo().startSession({ readPreference: { mode: 'primary' } });
  try {
    await session.withTransaction(async () => {
      const transactionDb = session.getDatabase('FixNow');
      for (const collection of ['categories', 'services']) {
        const changes = pending[collection];
        if (!changes.length) continue;
        const transactionCollection = transactionDb.getCollection(collection);
        const result = await transactionCollection.bulkWrite(changes.map(({ entry, filter }) => ({
          updateOne: { filter, update: { $set: { ...entry.set, updatedAt: new Date() } }, upsert: false },
        })), { ordered: true });
        if (result.matchedCount !== changes.length) throw new Error(`Có bản ghi ${collection} thay đổi trong lúc cập nhật. Hủy giao dịch.`);
        const updated = await transactionCollection.find({ _id: { $in: changes.map(({ entry }) => ObjectId(entry.id)) } }).toArray();
        const byId = new Map(updated.map((document) => [document._id.toString(), document]));
        for (const { entry } of changes) {
          const document = byId.get(entry.id);
          if (!document || document.isDeleted !== entry.isDeleted || !Object.keys(entry.set).every((key) => same(document[key], entry.set[key]))) {
            throw new Error(`Kết quả sau ghi không khớp: ${entry.name}. Hủy giao dịch.`);
          }
        }
      }
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } finally {
    await session.endSession();
  }
  print(`Đã cập nhật và kiểm tra ${total} bản ghi thành công.`);
  print(`File sao lưu: ${backupPath}`);
})();
