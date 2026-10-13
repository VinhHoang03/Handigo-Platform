import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { collectFields, fieldValues } from "./auditSystemData";
import { decrypt, encrypt, hash, loadModels, snapshot } from "./migrateSystemData";

const VERSION = "handigo-orphan-users-v1";
const backendRoot = path.resolve(__dirname, "../..");
const reportRoot = path.resolve(backendRoot, "../docs/migrations");
type Doc = Record<string, any>;
type Reference = { collection: string; field: string; target: string };
type Entry = { collection: string; document: Doc; reason: string };
const option = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const ids = (document: Doc, field: string) => fieldValues(document, field.split("."))
  .flatMap(value => Array.isArray(value) ? value : [value])
  .filter(value => value instanceof mongoose.Types.ObjectId || typeof value === "string" && /^[a-f\d]{24}$/i.test(value))
  .map(value => String(value));

// Chỉ đi theo chiều bản ghi tham chiếu tới đối tượng đã xóa, không xóa tài nguyên mà bản ghi đó sử dụng.
export function cleanupPlan(data: Record<string, Doc[]>, refs: Reference[], missingUsers: string[]) {
  const deleted = new Map<string, Set<string>>([["users", new Set(missingUsers)]]);
  const entries: Entry[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const ref of refs) {
      const targets = deleted.get(ref.target);
      if (!targets?.size) continue;
      for (const doc of data[ref.collection] ?? []) {
        if (ref.collection === "users" || deleted.get(ref.collection)?.has(String(doc._id))) continue;
        if (!ids(doc, ref.field).some(id => targets.has(id))) continue;
        const selected = deleted.get(ref.collection) ?? new Set<string>();
        selected.add(String(doc._id));
        deleted.set(ref.collection, selected);
        entries.push({ collection: ref.collection, document: doc, reason: `${ref.field} tham chiếu ${ref.target} không tồn tại hoặc nằm trong danh sách xóa.` });
        changed = true;
      }
    }
  }
  return entries;
}

function references(data: Record<string, Doc[]>) {
  const refs: Reference[] = [];
  const known = new Set<string>();
  for (const model of Object.values(mongoose.models)) {
    known.add(model.collection.name);
    for (const field of collectFields(model.schema)) {
      if (field.ref && mongoose.models[field.ref]) refs.push({ collection: model.collection.name, field: field.path, target: mongoose.models[field.ref].collection.name });
    }
  }
  // Các collection ngoài model: chỉ nhận trường liên kết tài khoản có tên rõ ràng.
  for (const collection of Object.keys(data).filter(name => !known.has(name))) {
    for (const field of ["userId", "customerId", "providerId"]) refs.push({ collection, field, target: "users" });
    for (const field of ["orderId", "relatedOrderId"]) refs.push({ collection, field, target: "orders" });
  }
  return refs;
}

async function main() {
  if (process.argv.includes("--test")) {
    const missing = "000000000000000000000001";
    const provider = "000000000000000000000002";
    const order = "000000000000000000000003";
    const valid = "000000000000000000000004";
    const refs = [
      { collection: "providers", field: "userId", target: "users" },
      { collection: "orders", field: "providerId", target: "providers" },
      { collection: "payments", field: "orderId", target: "orders" },
    ];
    const data = {
      users: [{ _id: valid }], providers: [{ _id: provider, userId: missing }],
      orders: [{ _id: order, providerId: provider }, { _id: "valid-order", customerId: valid }],
      payments: [{ _id: "payment", orderId: order }],
    };
    assert.equal(cleanupPlan(data, refs, [missing]).length, 3);
    assert.equal(cleanupPlan(data, refs, []).length, 0);
    assert.equal(cleanupPlan({ ...data, providers: [], orders: [], payments: [] }, refs, [missing]).length, 0);
    console.log("Đạt kiểm thử xóa tham chiếu dây chuyền, giữ user/tài nguyên hợp lệ và chạy lại an toàn."); return;
  }
  if (["--dry-run", "--apply", "--rollback"].filter(flag => process.argv.includes(flag)).length > 1) throw new Error("Chỉ chọn một chế độ.");
  if (process.argv.includes("--rollback") && !option("--backup")) throw new Error("Rollback cần thư mục backup.");
  loadModels();
  require("dotenv").config({ path: path.join(backendRoot, ".env"), quiet: true });
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("Chưa có cấu hình MongoDB.");
  await mongoose.connect(uri, { autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 15000, socketTimeoutMS: 120000 });
  const db = mongoose.connection.db!;
  const session = await mongoose.startSession();
  try {
    if (process.argv.includes("--rollback")) {
      const directory = path.resolve(option("--backup")!);
      const key = readFileSync(path.join(directory, "key.bin"));
      const journal = decrypt(readFileSync(path.join(directory, "journal.enc")), key) as Doc;
      if (journal.version !== VERSION || journal.database !== db.databaseName) throw new Error("Journal không khớp phiên bản/database.");
      await session.withTransaction(async () => {
        for (const entry of journal.entries as Entry[]) {
          const collection = db.collection(entry.collection);
          const existing = await collection.findOne({ _id: entry.document._id }, { session });
          if (existing && hash(existing) !== hash(entry.document)) throw new Error("ID đã có nội dung khác; không ghi đè khi rollback.");
          if (!existing) await collection.insertOne(entry.document as any, { session });
        }
      });
      console.log("Đã khôi phục các bản ghi từ journal, không tạo user giả."); return;
    }
    const backup = await snapshot(session);
    const audit = JSON.parse(readFileSync(path.join(reportRoot, "system-migration-report.json"), "utf8")) as { issues: { collection: string; id: string; reason: string }[] };
    const missing = new Set<string>();
    // Giới hạn user gốc theo đúng 15 mục đã được người dùng yêu cầu xử lý.
    for (const issue of audit.issues.filter(item => /Liên kết (userId|customerId) thiếu đích User/.test(item.reason))) {
      const doc = backup.data[issue.collection]?.find(d => String(d._id) === issue.id);
      if (!doc) continue;
      const field = issue.reason.includes("customerId") ? "customerId" : "userId";
      for (const id of ids(doc, field)) if (!(backup.data.users ?? []).some(user => String(user._id) === id)) missing.add(id);
    }
    const refs = references(backup.data);
    const entries = cleanupPlan(backup.data, refs, [...missing]);
    const counts: Record<string, number> = {};
    for (const entry of entries) counts[entry.collection] = (counts[entry.collection] ?? 0) + 1;
    mkdirSync(reportRoot, { recursive: true });
    const report = { version: VERSION, database: db.databaseName, generatedAt: new Date().toISOString(), mode: process.argv.includes("--apply") ? "apply" : "dry-run", missingUserIds: [...missing], counts,
      entries: entries.map(entry => ({ collection: entry.collection, id: String(entry.document._id), reason: entry.reason })) };
    writeFileSync(path.join(reportRoot, "orphan-user-cleanup-report.json"), JSON.stringify(report, null, 2));
    console.log(`Có ${missing.size} ID user không tồn tại; dự kiến xóa ${entries.length} bản ghi.`, counts);
    if (!process.argv.includes("--apply") || !entries.length) return;
    const directory = path.join(backendRoot, ".migration-backups", `${VERSION}-${Date.now()}`);
    mkdirSync(directory, { recursive: true });
    const key = randomBytes(32);
    writeFileSync(path.join(directory, "key.bin"), key, { flag: "wx", mode: 0o600 });
    writeFileSync(path.join(directory, "snapshot.enc"), encrypt(backup, key), { flag: "wx", mode: 0o600 });
    if (hash(decrypt(readFileSync(path.join(directory, "snapshot.enc")), key)) !== hash(backup)) throw new Error("Backup không khớp khi đọc lại.");
    writeFileSync(path.join(directory, "journal.enc"), encrypt({ version: VERSION, database: db.databaseName, entries }, key), { flag: "wx", mode: 0o600 });
    await session.withTransaction(async () => {
      const restoredUsers = await db.collection("users").find({ _id: { $in: [...missing].map(id => new mongoose.Types.ObjectId(id)) } }, { session }).toArray();
      if (restoredUsers.length) throw new Error("User đã được khôi phục; dừng xóa.");
      for (const entry of [...entries].reverse()) {
        const collection = db.collection(entry.collection);
        const current = await collection.findOne({ _id: entry.document._id }, { session });
        if (hash(current) !== hash(entry.document)) throw new Error("Bản ghi thay đổi sau backup; dừng xóa toàn bộ batch.");
        const removed = await collection.deleteOne({ _id: entry.document._id }, { session });
        if (removed.deletedCount !== 1) throw new Error("Không xóa được bản ghi đã kiểm tra.");
      }
    });
    const after = await snapshot(session);
    const remaining = cleanupPlan(after.data, references(after.data), [...missing]);
    if (remaining.length) throw new Error("Còn tham chiếu liên quan; cần đối soát, không tự mở rộng đợt xóa.");
    if (hash(after.data.users) !== hash(backup.data.users)) throw new Error("Danh sách user thực tế thay đổi; cần đối soát.");
    writeFileSync(path.join(directory, "completed.json"), JSON.stringify({ count: entries.length, completedAt: new Date().toISOString() }));
    console.log(`Đã xóa ${entries.length} bản ghi; kiểm tra lại không còn tham chiếu trong phạm vi. Backup: ${directory}`);
  } finally { await session.endSession(); }
}
if (require.main === module) main().catch((error: unknown) => {
  const info = error as { name?: string; code?: number };
  console.error("Dọn tham chiếu user chưa hoàn tất; không in dữ liệu nhạy cảm.", { name: info.name, code: info.code });
  process.exitCode = 1;
}).finally(async () => { await mongoose.disconnect(); });
