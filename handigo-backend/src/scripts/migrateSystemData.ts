import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { collectFields, fieldValues, isCorrectType } from "./auditSystemData";

// Không khởi động server hoặc tự đồng bộ index khi nạp model.
mongoose.set("autoIndex", false);
mongoose.set("autoCreate", false);
const VERSION = "handigo-system-v8-1";
const root = path.resolve(__dirname, "../..");
const reports = path.resolve(root, "../docs/migrations");
const EJSON = mongoose.mongo.BSON.EJSON;
type Doc = Record<string, any>;
type Change = { collection: string; id: any; before: Doc | null; after: Doc; reason: string };
type Issue = { collection: string; id: string; reason: string };
type IndexChange = { collection: string; action: "create" | "drop"; spec: Doc };
const hash = (value: unknown) => createHash("sha256").update(EJSON.stringify({ value }, { relaxed: false })).digest("hex");
const arg = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const normalize = (value: string) => value.trim().toLocaleLowerCase("vi-VN").replace(/\s+/g, " ");
const identity = (d: Doc) => createHash("sha256").update(JSON.stringify([
  normalize(d.fullAddress), normalize(d.province), normalize(d.ward),
])).digest("hex");

// Chỉ backfill metadata có nguồn rõ ràng; không dùng toàn bộ default của schema.
export function buildPlan(data: Record<string, Doc[]>) {
  const changes: Change[] = [];
  const issues: Issue[] = [];
  const add = (collection: string, before: Doc, after: Doc, reason: string) => {
    if (hash(before) !== hash(after)) changes.push({ collection, id: before._id, before, after, reason });
  };
  for (const d of data.services ?? []) {
    const next = { ...d };
    for (const field of ["optionGroups", "processSteps", "galleryImages"]) {
      if (next[field] === undefined) next[field] = [];
      else if (!Array.isArray(next[field])) issues.push({ collection: "services", id: String(d._id), reason: `${field} không phải mảng; cần xác nhận.` });
    }
    if (next.coverImage === undefined && typeof d.image === "string") next.coverImage = d.image;
    add("services", d, next, "Chuẩn hóa mảng metadata thiếu và bí danh ảnh hiện có; giữ giá.");
  }
  const counts = new Map<string, number>();
  for (const d of data.addresses ?? []) {
    if ([d.fullAddress, d.province, d.ward].every(v => typeof v === "string" && v.trim()) && d.userId) {
      const key = `${d.userId}:${identity(d)}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  for (const d of data.addresses ?? []) {
    if (![d.fullAddress, d.province, d.ward].every(v => typeof v === "string" && v.trim()) || !d.userId) {
      issues.push({ collection: "addresses", id: String(d._id), reason: "Thiếu thành phần định danh địa chỉ; không tự điền." }); continue;
    }
    if (counts.get(`${d.userId}:${identity(d)}`)! > 1) {
      issues.push({ collection: "addresses", id: String(d._id), reason: "Địa chỉ trùng; cần chọn bản ghi giữ và xử lý liên kết đơn." }); continue;
    }
    const next = { ...d };
    if (next.identityKey === undefined) next.identityKey = identity(d);
    else if (next.identityKey !== identity(d)) {
      issues.push({ collection: "addresses", id: String(d._id), reason: "Khóa địa chỉ khác nội dung; cần đối soát." }); continue;
    }
    // Không suy đoán trạng thái xóa nếu đã có dấu thời gian xóa.
    if (next.isDeleted === undefined && !next.deletedAt) next.isDeleted = false;
    add("addresses", d, next, "Tính khóa từ địa chỉ đang lưu; chuẩn hóa trạng thái bản ghi chưa có dấu xóa.");
  }
  for (const d of data.promotions ?? []) {
    if (d.applicationMode === "automatic") continue;
    if (typeof d.code !== "string" || !d.code.trim()) {
      issues.push({ collection: "promotions", id: String(d._id), reason: "Không có mã hoặc chế độ tự động; cần phân loại chương trình." }); continue;
    }
    const existing = (data.vouchers ?? []).find(v => String(v._id) === String(d._id) || String(v.code).toUpperCase() === d.code.trim().toUpperCase());
    if (existing) {
      if (String(existing._id) !== String(d._id) || existing.code !== d.code.trim().toUpperCase()
        || existing.discountType !== d.discountType || existing.discountValue !== d.discountValue) {
        issues.push({ collection: "promotions", id: String(d._id), reason: "Xung đột voucher ID/mã/nội dung; dừng chuyển bản ghi." });
      }
      continue;
    }
    // Sao chép giữ ID và nguồn legacy để reward/order cũ vẫn đọc được.
    const next: Doc = { ...d, code: d.code.trim().toUpperCase() };
    if (!next.name) next.name = next.code;
    changes.push({ collection: "vouchers", id: d._id, before: null, after: next, reason: "Mã legacy được backend đọc như voucher; giữ ID và nguồn promotion." });
  }
  for (const d of data.serviceoptions ?? []) {
    if (d.selectionGroup && !d.groupId) issues.push({ collection: "serviceoptions", id: String(d._id), reason: "Cần xác nhận nhóm, selectionMode và isRequired trước khi gán groupId." });
  }
  for (const collection of ["providers", "providerapplications"]) for (const d of data[collection] ?? []) {
    if (d.serviceCategoryIds?.length) issues.push({ collection, id: String(d._id), reason: "Cần mapping năng lực dịch vụ được xác nhận; không mở rộng từ danh mục." });
  }
  return { changes, issues };
}

function encrypt(value: unknown, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const content = Buffer.concat([cipher.update(EJSON.stringify(value, { relaxed: false }), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), content]);
}
function decrypt(content: Buffer, key: Buffer) {
  const cipher = createDecipheriv("aes-256-gcm", key, content.subarray(0, 12));
  cipher.setAuthTag(content.subarray(12, 28));
  return EJSON.parse(Buffer.concat([cipher.update(content.subarray(28)), cipher.final()]).toString("utf8"), { relaxed: false });
}
function loadModels() {
  for (const file of readdirSync(path.join(root, "src/models")).filter(f => f.endsWith(".model.ts"))) require(path.join(root, "src/models", file));
  require(path.join(root, "src/ai/session/session.service.ts"));
}
const modelFor = (collection: string) => Object.values(mongoose.models).find(m => m.collection.name === collection);
async function validatePlan(plan: ReturnType<typeof buildPlan>) {
  const valid: Change[] = [];
  for (const change of plan.changes) {
    const model = modelFor(change.collection);
    if (!model) throw new Error("Collection cần cập nhật chưa có model.");
    try {
      const doc = new model(change.after);
      await doc.validate();
      // Chỉ lấy dữ liệu gốc; không ghi các default/hook phát sinh khi hydrate.
      valid.push(change);
    } catch {
      plan.issues.push({ collection: change.collection, id: String(change.id), reason: "Bản ghi không đạt validation hiện tại; cần xử lý thủ công." });
    }
  }
  plan.changes = valid;
}

function auditSnapshot(data: Record<string, Doc[]>, issues: Issue[]) {
  const summaries: Doc[] = [];
  for (const model of Object.values(mongoose.models)) {
    const collection = model.collection.name;
    for (const field of collectFields(model.schema).filter(f => !f.sensitive)) {
      let missing = 0;
      let invalid = 0;
      let orphan = 0;
      for (const doc of data[collection] ?? []) {
        const values = fieldValues(doc, field.path.split("."));
        for (const value of values) {
          if (value === undefined || value === null) {
            missing++;
            if (field.required) issues.push({ collection, id: String(doc._id), reason: `Thiếu field bắt buộc ${field.path}; cần xác nhận nguồn dữ liệu.` });
            continue;
          }
          if (!isCorrectType(value, field.type) || field.enum && !field.enum.includes(value)
            || typeof value === "number" && (field.min !== undefined && value < field.min || field.max !== undefined && value > field.max)) {
            invalid++;
            issues.push({ collection, id: String(doc._id), reason: `Field ${field.path} không đạt kiểu/ràng buộc schema.` });
          }
          if (field.ref && mongoose.models[field.ref]) {
            const target = mongoose.models[field.ref].collection.name;
            for (const id of Array.isArray(value) ? value : [value]) {
              if (!(id instanceof mongoose.Types.ObjectId)) continue;
              const exists = (data[target] ?? []).some(d => String(d._id) === String(id));
              const compatibleVoucher = field.ref === "Voucher" && (data.promotions ?? []).some(d => String(d._id) === String(id) && typeof d.code === "string" && d.code.trim());
              if (!exists && !compatibleVoucher) {
                orphan++;
                issues.push({ collection, id: String(doc._id), reason: `Liên kết ${field.path} thiếu đích ${field.ref}; không tự thay ID.` });
              }
            }
          }
        }
      }
      if (missing || invalid || orphan) summaries.push({ collection, field: field.path, missing, invalid, orphan, required: field.required });
    }
  }
  return summaries;
}

async function preparePlan(data: Record<string, Doc[]>) {
  const plan = buildPlan(data);
  await validatePlan(plan);
  const fieldAudit = auditSnapshot(data, plan.issues);
  const invalidRecords = new Set(plan.issues.filter(i => i.reason.startsWith("Liên kết") || i.reason.startsWith("Thiếu field bắt buộc") || i.reason.startsWith("Field ")).map(i => `${i.collection}:${i.id}`));
  plan.changes = plan.changes.filter(c => !invalidRecords.has(`${c.collection}:${c.id}`)
    && !(c.before === null && invalidRecords.has(`promotions:${c.id}`)));
  const voucherCodes = new Map<string, number>();
  for (const doc of [...(data.vouchers ?? []), ...plan.changes.filter(c => c.collection === "vouchers" && c.before === null).map(c => c.after)]) {
    voucherCodes.set(doc.code, (voucherCodes.get(doc.code) ?? 0) + 1);
  }
  plan.changes = plan.changes.filter(c => {
    if (c.collection === "vouchers" && voucherCodes.get(c.after.code)! > 1) {
      plan.issues.push({ collection: c.collection, id: String(c.id), reason: "Mã voucher đích trùng trong kế hoạch; cần xử lý thủ công." }); return false;
    }
    return true;
  });
  return { plan, fieldAudit };
}

async function snapshot(session: mongoose.ClientSession) {
  const db = mongoose.connection.db!;
  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name).filter(n => !n.startsWith("system."));
  const data: Record<string, Doc[]> = {};
  const indexes: Record<string, any[]> = {};
  // Backup tất cả collection, kể cả collection không được model đăng ký.
  for (const name of names) indexes[name] = await db.collection(name).indexes();
  session.startTransaction({ readConcern: { level: "snapshot" } });
  try {
    for (const name of names) {
      data[name] = await db.collection(name).find({}, { session }).toArray();
      if (data[name].length > 50000) throw new Error("Collection vượt ngưỡng migration một transaction; cần chia batch có checkpoint.");
    }
    await session.commitTransaction();
  } catch (e) { await session.abortTransaction(); throw e; }
  return { version: VERSION, database: db.databaseName, data, indexes };
}

async function planIndexes(backup: Awaited<ReturnType<typeof snapshot>>, plan: ReturnType<typeof buildPlan>) {
  const result: IndexChange[] = [];
  const projected = Object.fromEntries(Object.entries(backup.data).map(([name, docs]) => [name, [...docs]]));
  for (const c of plan.changes) {
    const docs = projected[c.collection] ??= [];
    const position = docs.findIndex(d => String(d._id) === String(c.id));
    if (position < 0) docs.push(c.after); else docs[position] = c.after;
  }
  // Chỉ chuyển các index thuộc phần 1–7; không syncIndexes hoặc xóa index khác.
  for (const name of ["addresses", "vouchers", "voucherusages", "orderstatuses"]) {
    const model = modelFor(name)!;
    const current = backup.indexes[name] ?? [];
    const desired = model.schema.indexes();
    let valid = true;
    const creates: IndexChange[] = [];
    for (const [key, options] of desired) {
      const spec: Doc = { key, name: options.name ?? Object.entries(key).map(([field, order]) => `${field}_${order}`).join("_") };
      for (const field of ["unique", "partialFilterExpression", "sparse", "expireAfterSeconds", "collation"]) {
        if ((options as Doc)[field] !== undefined) spec[field] = (options as Doc)[field];
      }
      const matches = (index: Doc) => hash(index.key) === hash(spec.key)
        && Boolean(index.unique) === Boolean(spec.unique)
        && hash(index.partialFilterExpression) === hash(spec.partialFilterExpression);
      if (current.some(matches)) continue;
      if (current.some(i => i.name === spec.name)) {
        plan.issues.push({ collection: name, id: "index", reason: `Index ${spec.name} khác cấu hình; cần chuyển riêng.` }); valid = false; continue;
      }
      if (spec.unique) {
        const seen = new Set<string>();
        for (const d of projected[name] ?? []) {
          if (spec.partialFilterExpression && !Object.entries(spec.partialFilterExpression).every(([field, filter]) => {
            const type = (filter as Doc).$type;
            return type === "string" ? typeof d[field] === "string" : type === "number" ? typeof d[field] === "number" : false;
          })) continue;
          const value = hash(Object.keys(key).map(field => d[field] ?? null));
          if (seen.has(value)) { valid = false; break; }
          seen.add(value);
        }
        if (!valid) {
          plan.issues.push({ collection: name, id: "index", reason: `Trùng khóa ${spec.name}; không chuyển index collection này.` }); continue;
        }
      }
      creates.push({ collection: name, action: "create", spec });
    }
    if (!valid) continue;
    result.push(...creates);
    if (name === "voucherusages") for (const index of current) {
      if (index.unique && hash(index.key) === hash({ voucherId: 1, userId: 1 })) {
        result.push({ collection: name, action: "drop", spec: index });
      }
    }
  }
  return result;
}
function indexOptions(spec: Doc) {
  const { key: _key, v: _v, ns: _ns, ...options } = spec;
  return options;
}

async function main() {
  if (process.argv.includes("--test")) {
    const data = { services: [{ _id: "s", image: "ảnh", fixedPrice: 180000 }], addresses: [], promotions: [] };
    const plan = buildPlan(data);
    assert.equal(plan.changes[0].after.fixedPrice, 180000);
    assert.deepEqual(plan.changes[0].after.processSteps, []);
    assert.equal(buildPlan({ ...data, services: [plan.changes[0].after] }).changes.length, 0);
    const address = { _id: "a", userId: "u", fullAddress: "1 A", province: "Hà Nội", ward: "B" };
    assert.equal(buildPlan({ addresses: [address, { ...address, _id: "b" }] }).changes.length, 0);
    const legacy = { _id: "v", code: " TEST ", discountType: "fixed", discountValue: 1 };
    const migrated = buildPlan({ promotions: [legacy] }).changes[0];
    assert.equal(migrated.after.code, "TEST");
    assert.equal(buildPlan({ promotions: [legacy], vouchers: [migrated.after] }).changes.length, 0);
    assert.equal(buildPlan({ promotions: [{ _id: "p", applicationMode: "automatic", code: "AUTO" }] }).changes.length, 0);
    assert.equal(buildPlan({ promotions: [legacy], vouchers: [{ ...migrated.after, _id: "other" }] }).issues.length, 1);
    assert.equal(buildPlan({ addresses: [{ ...address, deletedAt: new Date() }] }).changes[0].after.isDeleted, undefined);
    const key = randomBytes(32);
    const sample = { id: new mongoose.Types.ObjectId(), date: new Date(), data };
    assert.equal(hash(decrypt(encrypt(sample, key), key)), hash(sample));
    const tampered = encrypt(sample, key);
    tampered[tampered.length - 1] ^= 1;
    assert.throws(() => decrypt(tampered, key));
    console.log("Đạt kiểm thử giữ giá, chạy lại, địa chỉ trùng, voucher legacy và backup mã hóa/BSON."); return;
  }
  if (["--apply", "--rollback", "--dry-run"].filter(flag => process.argv.includes(flag)).length > 1) throw new Error("Chỉ chọn một chế độ migration.");
  if (process.argv.includes("--rollback") && !arg("--backup")) throw new Error("Rollback cần đường dẫn backup.");
  const mode = process.argv.includes("--apply") ? "apply" : process.argv.includes("--rollback") ? "rollback" : "dry-run";
  loadModels();
  require("dotenv").config({ path: path.join(root, ".env"), quiet: true });
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("Chưa có cấu hình kết nối MongoDB.");
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 15000, connectTimeoutMS: 15000, socketTimeoutMS: 120000 });
  const db = mongoose.connection.db!;
  const hello = await db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid") throw new Error("Migration yêu cầu database hỗ trợ transaction.");
  const session = await mongoose.startSession();
  try {
    if (mode === "rollback") {
      const directory = path.resolve(arg("--backup") ?? "");
      const key = readFileSync(path.join(directory, "key.bin"));
      const journal = decrypt(readFileSync(path.join(directory, "journal.enc")), key) as Doc;
      if (journal.version !== VERSION || journal.database !== db.databaseName) throw new Error("Journal không khớp database/phiên bản.");
      // Khôi phục ràng buộc cũ trước: duplicate mới sẽ làm dừng rollback an toàn.
      for (const index of journal.indexes ?? []) if (index.action === "drop") {
        await db.collection(index.collection).createIndex(index.spec.key, indexOptions(index.spec));
      }
      await session.withTransaction(async () => {
        for (const change of [...journal.changes].reverse() as Change[]) {
          const collection = db.collection(change.collection);
          const current = await collection.findOne({ _id: change.id }, { session });
          if (hash(current) === hash(change.before)) continue;
          if (hash(current) !== hash(change.after)) throw new Error("Bản ghi đã thay đổi sau migration; rollback dừng để tránh mất dữ liệu.");
          if (change.before === null) await collection.deleteOne({ _id: change.id }, { session });
          else await collection.replaceOne({ _id: change.id }, change.before as any, { session });
        }
      });
      for (const index of [...(journal.indexes ?? [])].reverse()) if (index.action === "create") {
        const existing = await db.collection(index.collection).indexes();
        const match = existing.find(i => i.name === index.spec.name);
        if (!match) continue;
        if (hash(match.key) !== hash(index.spec.key) || Boolean(match.unique) !== Boolean(index.spec.unique)
          || hash(match.partialFilterExpression) !== hash(index.spec.partialFilterExpression)) throw new Error("Index thay đổi sau migration; không tự xóa.");
        await db.collection(index.collection).dropIndex(index.spec.name);
      }
      console.log("Đã rollback dữ liệu và index theo journal."); return;
    }
    const backup = await snapshot(session);
    const { plan, fieldAudit } = await preparePlan(backup.data);
    const indexes = await planIndexes(backup, plan);
    mkdirSync(reports, { recursive: true });
    const report = {
      version: VERSION, generatedAt: new Date().toISOString(), database: db.databaseName, mode,
      collections: Object.entries(backup.data).map(([name, docs]) => ({ name, count: docs.length })),
      changes: plan.changes.map(c => ({ collection: c.collection, id: String(c.id), fields: Object.keys(c.after).filter(f => hash(c.after[f]) !== hash(c.before?.[f])), reason: c.reason })),
      issues: plan.issues,
      fieldAudit,
      indexes,
      limitations: ["Không tạo lịch sử đơn/snapshot quá khứ hoặc sửa dữ liệu tài chính.", "Không tự sửa dữ liệu thiếu bằng chứng; xem data-audit.json để rà soát toàn bộ field và liên kết."],
    };
    writeFileSync(path.join(reports, "system-migration-report.json"), JSON.stringify(report, null, 2));
    console.log(`Đã kiểm kê ${report.collections.length} collection; ${plan.changes.length} chuyển đổi hợp lệ; ${plan.issues.length} mục chờ xác nhận.`);
    if (mode === "dry-run") return;
    const directory = path.join(root, ".migration-backups", `${VERSION}-${Date.now()}`);
    mkdirSync(directory, { recursive: true });
    const key = randomBytes(32);
    writeFileSync(path.join(directory, "key.bin"), key, { flag: "wx", mode: 0o600 });
    writeFileSync(path.join(directory, "snapshot.enc"), encrypt(backup, key), { flag: "wx", mode: 0o600 });
    const restored = decrypt(readFileSync(path.join(directory, "snapshot.enc")), key);
    if (hash(restored) !== hash(backup)) throw new Error("Backup đọc lại không khớp.");
    writeFileSync(path.join(directory, "journal.enc"), encrypt({ version: VERSION, database: db.databaseName, changes: plan.changes, indexes }, key), { flag: "wx", mode: 0o600 });
    // Một transaction toàn batch: không có trạng thái apply dở dang; retry tự kiểm tra ảnh trước.
    await session.withTransaction(async () => {
      for (const change of plan.changes) {
        const collection = db.collection(change.collection);
        const current = await collection.findOne({ _id: change.id }, { session });
        if (hash(current) !== hash(change.before)) throw new Error("Dữ liệu đã thay đổi sau snapshot; phải chạy lại dry-run.");
        if (change.collection === "vouchers" && change.before === null) {
          const source = await db.collection("promotions").findOne({ _id: change.id }, { session });
          const original = backup.data.promotions.find(d => String(d._id) === String(change.id));
          if (hash(source) !== hash(original)) throw new Error("Nguồn voucher thay đổi sau backup; dừng chuyển dữ liệu.");
        }
        if (change.before === null) await collection.insertOne(change.after as any, { session });
        else await collection.replaceOne({ _id: change.id }, change.after as any, { session });
      }
    });
    // DDL không nằm trong transaction; tạo index thay thế thành công rồi mới bỏ unique cũ.
    for (const index of indexes) {
      if (index.action === "create") await db.collection(index.collection).createIndex(index.spec.key, indexOptions(index.spec));
      else await db.collection(index.collection).dropIndex(index.spec.name);
    }
    const after = await snapshot(session);
    for (const name of ["orders", "payments", "wallets", "wallettransactions", "refunds", "serviceoptions", "servicepackages"]) {
      const sort = (docs: Doc[]) => [...docs].sort((a, b) => String(a._id).localeCompare(String(b._id)));
      if (hash(sort(after.data[name] ?? [])) !== hash(sort(backup.data[name] ?? []))) {
        throw new Error("Dữ liệu bảo vệ thay đổi trong lúc migration; cần phân biệt cập nhật ứng dụng và đối soát backup.");
      }
    }
    for (const original of backup.data.services ?? []) {
      const current = (after.data.services ?? []).find(d => String(d._id) === String(original._id));
      for (const field of ["fixedPrice", "depositAmount", "serviceType"]) {
        if (hash(current?.[field]) !== hash(original[field])) throw new Error("Giá hoặc loại dịch vụ thay đổi; cần đối soát.");
      }
    }
    const { plan: repeated } = await preparePlan(after.data);
    const repeatedIndexes = await planIndexes(after, repeated);
    if (repeated.changes.length || repeatedIndexes.length) throw new Error("Cần đối soát: chạy lại vẫn phát sinh chuyển đổi.");
    writeFileSync(path.join(directory, "completed.json"), JSON.stringify({ version: VERSION, count: plan.changes.length, completedAt: new Date().toISOString() }));
    console.log(`Đã apply và kiểm tra chạy lại. Backup/journal: ${directory}`);
    console.log(`Đã chuyển ${indexes.length} index; ${plan.issues.length} mục chờ xác nhận vẫn được giữ nguyên.`);
  } finally { await session.endSession(); }
}
if (require.main === module) main().catch((error: unknown) => {
  const detail = error as { name?: string; code?: number; reason?: { servers?: Map<string, { error?: { name?: string; code?: string; cause?: { code?: string } } }> } };
  const causes = [...(detail.reason?.servers?.values() ?? [])].map(server => ({ name: server.error?.name, code: server.error?.code, cause: server.error?.cause?.code }));
  console.error("Migration chưa hoàn tất; không in nội dung dữ liệu hoặc thông tin kết nối.", { name: detail.name, code: detail.code, causes });
  process.exitCode = 1;
}).finally(async () => { await mongoose.disconnect(); });

export { encrypt, decrypt, hash, loadModels, snapshot };
