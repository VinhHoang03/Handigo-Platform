const fs = require('node:fs');
const path = require('node:path');
require('ts-node').register({ project: path.resolve(__dirname, '../../tsconfig.json'), transpileOnly: true });
const mongoose = require('mongoose');
const { EJSON } = require('bson');
const { Category } = require('../../src/models/category.model');
const { Service } = require('../../src/models/service.model');

const apply = process.argv.includes('--apply');
const patch = JSON.parse(fs.readFileSync(path.join(__dirname, 'content-update.json'), 'utf8'));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
  const uri = process.env.HANDIGO_MONGO_URI;
  if (!uri || /username:password@/.test(uri)) {
    throw new Error('Cần cấu hình HANDIGO_MONGO_URI bằng kết nối đã xác thực.');
  }
  await mongoose.connect(uri, { dbName: 'FixNow', autoIndex: false, serverSelectionTimeoutMS: 15000 });
  if (mongoose.connection.name !== 'FixNow') throw new Error('Database đích không đúng FixNow.');
  const pending = [];
  const backup = { database: 'FixNow', createdAt: new Date(), documents: [] };
  for (const [collection, Model] of [['categories', Category], ['services', Service]]) {
    for (const item of patch[collection]) {
      if (!mongoose.isValidObjectId(item.id)) throw new Error('ID cập nhật không hợp lệ.');
      const doc = await Model.collection.findOne({ _id: new mongoose.Types.ObjectId(item.id), isDeleted: item.isDeleted });
      if (!doc || doc.name !== item.name) throw new Error(`Không khớp bản ghi: ${item.name}.`);
      const keys = Object.keys(item.set);
      if (keys.every((key) => equal(doc[key], item.set[key]))) continue;
      for (const key of keys) {
        if (!equal(doc[key], item.previous[key])) throw new Error(`Nội dung đã thay đổi so với bản xuất: ${item.name}. Dừng để tránh ghi đè.`);
      }
      if (collection === 'services' && (item.set.processSteps.length < 4 || item.set.processSteps.length > 20)) {
        throw new Error('Quy trình phải có từ 4 đến 20 bước.');
      }
      const validation = new Model({ ...doc, ...item.set }).validateSync();
      if (validation) throw new Error(`Nội dung không đạt validation: ${item.name}.`);
      pending.push({ Model, collection, item, doc });
      backup.documents.push({ collection, before: doc, after: item.set });
    }
  }
  console.log(JSON.stringify({ database: 'FixNow', che_do: apply ? 'cập nhật' : 'xem trước', danh_muc: pending.filter((x) => x.collection === 'categories').length, dich_vu: pending.filter((x) => x.collection === 'services').length, bao_gom_dich_vu_da_xoa: patch.services.filter((x) => x.isDeleted).length }));
  if (!apply || pending.length === 0) return;
  const backupPath = path.join(__dirname, `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(backupPath, EJSON.stringify(backup, null, 2), { flag: 'wx' });
  const session = await mongoose.startSession();
  try {
    // Giao dịch bảo đảm hai collection được cập nhật cùng nhau trên Atlas.
    await session.withTransaction(async () => {
      for (const { Model, item, doc } of pending) {
        const filter = { _id: doc._id, isDeleted: item.isDeleted, name: doc.name };
        for (const key of Object.keys(item.set)) {
          filter[key] = Object.hasOwn(doc, key) ? { $eq: doc[key], $exists: true } : { $exists: false };
        }
        const result = await Model.updateOne(filter, { $set: item.set }, { runValidators: true, session });
        if (result.matchedCount !== 1) throw new Error(`Bản ghi đã thay đổi trong lúc cập nhật: ${item.name}.`);
        const updated = await Model.collection.findOne({ _id: doc._id }, { session });
        if (!Object.keys(item.set).every((key) => equal(updated[key], item.set[key]))) throw new Error(`Kiểm tra sau ghi không khớp: ${item.name}.`);
      }
    });
  } finally {
    await session.endSession();
  }
  console.log(`Đã cập nhật và kiểm tra ${pending.length} bản ghi. Sao lưu: ${path.basename(backupPath)}`);
}

main().catch((error) => {
  // Không in lỗi kết nối gốc vì có thể chứa thông tin đăng nhập.
  const safe = /^(Cần cấu hình|Database đích|ID cập nhật|Không khớp bản ghi|Nội dung đã thay đổi|Quy trình phải|Nội dung không đạt|Bản ghi đã thay đổi|Kiểm tra sau ghi)/.test(error.message);
  console.error(safe ? error.message : 'Không thể hoàn tất cập nhật. Kiểm tra xác thực, kết nối mạng, quyền ghi và hỗ trợ giao dịch của MongoDB.');
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
