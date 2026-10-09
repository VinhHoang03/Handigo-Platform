import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import mongoose, { Model, Schema, SchemaType } from "mongoose";

// Script chỉ đọc: không khởi động server, chạy hook lưu, tạo collection hoặc index.
mongoose.set("autoIndex", false);
mongoose.set("autoCreate", false);

type RawDocument = Record<string, any>;
type FieldInfo = {
  path: string;
  type: string;
  required: boolean;
  defaultKind: string;
  defaultValue?: unknown;
  ref?: string;
  enum?: unknown[];
  min?: number;
  max?: number;
  sensitive: boolean;
  insideArray: boolean;
};
type FieldStats = {
  eligible: number;
  parentAbsentDocuments: number;
  missing: number;
  null: number;
  empty: number;
  invalidType: number;
  invalidConstraint: number;
  referenceValues: number;
  missingReferences: number;
  deletedReferences: number;
  runtimeMissingReferences?: number;
};
type FieldSpec = FieldInfo & { schemaType: SchemaType };

const backendRoot = path.resolve(__dirname, "../..");
const repoRoot = path.resolve(backendRoot, "..");
const sensitivePattern = /password|token|otp|secret|credential|googleId|facebookId/i;
const reportDirectory = path.join(repoRoot, "docs/migrations");

const option = (name: string) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};

const collectFields = (schema: Schema, prefix = "", insideArray = false): FieldSpec[] => {
  const result: FieldSpec[] = [];
  schema.eachPath((name, schemaType) => {
    if (name === "__v") return;
    const fieldPath = prefix + name;
    const options = schemaType.options as Record<string, any>;
    const defaultValue = options.default;
    const arrayType = schemaType as SchemaType & {
      schema?: Schema;
      embeddedSchemaType?: SchemaType;
    };
    const ref = options.ref ?? arrayType.embeddedSchemaType?.options.ref;
    const field: FieldSpec = {
      path: fieldPath,
      type: schemaType.instance,
      required: options.required === true,
      defaultKind: defaultValue === undefined ? "không có" : typeof defaultValue === "function" ? "hàm" : "hằng số",
      ...(defaultValue !== undefined && typeof defaultValue !== "function" ? { defaultValue } : {}),
      ...(typeof ref === "string" ? { ref } : {}),
      ...(Array.isArray(options.enum) ? { enum: options.enum } : {}),
      ...(typeof options.min === "number" ? { min: options.min } : {}),
      ...(typeof options.max === "number" ? { max: options.max } : {}),
      sensitive: sensitivePattern.test(fieldPath),
      insideArray,
      schemaType,
    };
    result.push(field);
    if (arrayType.schema) {
      result.push(...collectFields(arrayType.schema, fieldPath + ".", insideArray || schemaType.instance === "Array"));
    }
  });
  return result;
};

const fieldValues = (document: unknown, parts: string[]): unknown[] => {
  if (!parts.length) return [document];
  if (Array.isArray(document)) return document.flatMap((item) => fieldValues(item, parts));
  if (document === null || typeof document !== "object") return [];
  const object = document as RawDocument;
  const [name, ...rest] = parts;
  if (!Object.prototype.hasOwnProperty.call(object, name)) {
    return rest.length ? [] : [undefined];
  }
  return fieldValues(object[name], rest);
};

const isCorrectType = (value: unknown, type: string) => {
  switch (type) {
    case "String": return typeof value === "string";
    case "Number": return typeof value === "number" && Number.isFinite(value);
    case "Boolean": return typeof value === "boolean";
    case "Date": return value instanceof Date && Number.isFinite(value.getTime());
    case "ObjectId": return value instanceof mongoose.Types.ObjectId;
    case "Array": return Array.isArray(value);
    case "Embedded": return typeof value === "object" && value !== null && !Array.isArray(value);
    default: return true;
  }
};

const blankStats = (): FieldStats => ({
  eligible: 0, parentAbsentDocuments: 0, missing: 0, null: 0, empty: 0,
  invalidType: 0, invalidConstraint: 0, referenceValues: 0,
  missingReferences: 0, deletedReferences: 0,
});

const metadata = (field: FieldSpec): FieldInfo => {
  const { schemaType: _schemaType, ...info } = field;
  return info;
};

const loadModels = () => {
  const directory = path.join(backendRoot, "src/models");
  for (const file of readdirSync(directory).filter((name) => name.endsWith(".model.ts"))) {
    require(path.join(directory, file));
  }
  // Model này nằm ngoài thư mục models nhưng cũng lưu dữ liệu MongoDB.
  require(path.join(backendRoot, "src/ai/session/session.service.ts"));
  return Object.values(mongoose.models) as Model<any>[];
};

const sourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => entry.isDirectory()
    ? sourceFiles(path.join(directory, entry.name))
    : entry.name.endsWith(".ts") ? [path.join(directory, entry.name)] : []);

const modelUsage = (modelName: string) => {
  const identifier = new RegExp(`\\b${modelName === "AiAgentSession" ? "SessionModel" : modelName}\\s*\\.\\s*(\\w+)`, "g");
  return sourceFiles(path.join(backendRoot, "src"))
    .filter((file) => !file.includes(path.sep + "models" + path.sep)
      && !file.includes(path.sep + "scripts" + path.sep))
    .flatMap((file) => {
      const methods = [...readFileSync(file, "utf8").matchAll(identifier)].map((match) => match[1]);
      return methods.length ? [{ file: path.relative(repoRoot, file).replace(/\\/g, "/"), methods: [...new Set(methods)] }] : [];
    });
};

const publicIndexes = (model: Model<any>) => (model.schema as Schema).indexes().map(([key, options]) => ({
  key, unique: options.unique === true, name: options.name,
  partialFilterExpression: options.partialFilterExpression,
  expireAfterSeconds: options.expireAfterSeconds,
  collation: options.collation,
}));

// Giữ riêng liên kết khai báo và liên kết thực tế; audit không sửa hoặc gộp dữ liệu legacy.
const runtimeReference = (modelName: string, field: FieldInfo) =>
  modelName === "Order" && field.path === "voucherSnapshot.voucherId" ? "Promotion" : field.ref;

const checkReferences = async (
  model: Model<any>, fields: FieldSpec[], documents: RawDocument[], stats: Record<string, FieldStats>,
) => {
  for (const field of fields.filter((item) => item.ref && !item.sensitive)) {
    const ids = documents.flatMap((document) => fieldValues(document, field.path.split(".")))
      .flatMap((value) => Array.isArray(value) ? value : [value])
      .filter((value): value is mongoose.Types.ObjectId => value instanceof mongoose.Types.ObjectId);
    if (!ids.length) continue;
    const uniqueIds = [...new Map(ids.map((id) => [id.toHexString(), id])).values()];
    const declaredTarget = mongoose.models[field.ref!];
    if (!declaredTarget) continue;
    const related = await declaredTarget.collection.find({ _id: { $in: uniqueIds } }, {
      projection: { _id: 1, isDeleted: 1 }, maxTimeMS: 15000,
    }).toArray();
    const existing = new Map(related.map((document) => [String(document._id), document.isDeleted]));
    for (const id of ids) {
      stats[field.path].referenceValues += 1;
      if (!existing.has(String(id))) stats[field.path].missingReferences += 1;
      else if (existing.get(String(id)) === true) stats[field.path].deletedReferences += 1;
    }
    const actualRef = runtimeReference(model.modelName, field);
    if (actualRef !== field.ref && actualRef && mongoose.models[actualRef]) {
      const runtimeRelated = await mongoose.models[actualRef].collection.find({ _id: { $in: uniqueIds } }, {
        projection: { _id: 1 }, maxTimeMS: 15000,
      }).toArray();
      const runtimeIds = new Set(runtimeRelated.map((document) => String(document._id)));
      stats[field.path].runtimeMissingReferences = (stats[field.path].runtimeMissingReferences ?? 0)
        + ids.filter((id) => !runtimeIds.has(String(id))).length;
    }
  }
};

const auditCollection = async (model: Model<any>, batchSize: number, present: boolean) => {
  const fields = collectFields(model.schema);
  const stats = Object.fromEntries(fields.map((field) => [field.path, blankStats()]));
  if (!present) return { present: false, count: 0, scanned: 0, fields: stats, actualIndexes: [] };
  const count = await model.collection.countDocuments({}, { maxTimeMS: 15000 });
  const projection = Object.fromEntries(fields.filter((field) => field.sensitive && !field.path.includes(".")).map((field) => [field.path, 0]));
  const cursor = model.collection.find({}, { projection, batchSize, maxTimeMS: 120000 }).sort({ _id: 1 });
  let scanned = 0;
  let batch: RawDocument[] = [];
  const processBatch = async () => {
    for (const document of batch) {
      for (const field of fields.filter((item) => !item.sensitive)) {
        const values = fieldValues(document, field.path.split("."));
        const current = stats[field.path];
        if (!values.length) current.parentAbsentDocuments += 1;
        for (const value of values) {
          current.eligible += 1;
          if (value === undefined) { current.missing += 1; continue; }
          if (value === null) { current.null += 1; continue; }
          if (value === "" || (Array.isArray(value) && !value.length)) current.empty += 1;
          if (!isCorrectType(value, field.type)) { current.invalidType += 1; continue; }
          const options = field.schemaType.options as Record<string, any>;
          const invalid = (field.enum && !field.enum.includes(value))
            || (typeof value === "number" && ((field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max)))
            || (typeof value === "string" && ((options.match instanceof RegExp && !options.match.test(value))
              || (typeof options.maxlength === "number" && value.length > options.maxlength)));
          if (invalid) current.invalidConstraint += 1;
        }
      }
    }
    await checkReferences(model, fields, batch, stats);
    batch = [];
  };
  try {
    for await (const document of cursor) {
      batch.push(document);
      scanned += 1;
      if (batch.length >= batchSize) await processBatch();
    }
    if (batch.length) await processBatch();
  } finally {
    await cursor.close();
  }
  // Field chứa credential chỉ lấy số đếm phía server, không tải giá trị về script.
  for (const field of fields.filter((item) => item.sensitive && !item.path.includes("."))) {
    const [result] = await model.collection.aggregate([
      { $group: {
        _id: null,
        missing: { $sum: { $cond: [{ $eq: [{ $type: "$" + field.path }, "missing"] }, 1, 0] } },
        null: { $sum: { $cond: [{ $eq: [{ $type: "$" + field.path }, "null"] }, 1, 0] } },
      } },
      { $project: { _id: 0, missing: 1, null: 1 } },
    ], { maxTimeMS: 15000 }).toArray();
    stats[field.path].eligible = count;
    stats[field.path].missing = result?.missing ?? 0;
    stats[field.path].null = result?.null ?? 0;
  }
  const duplicates = [];
  for (const index of publicIndexes(model).filter((item) => item.unique)) {
    const [result] = await model.collection.aggregate([
      ...(index.partialFilterExpression ? [{ $match: index.partialFilterExpression }] : []),
      { $group: { _id: Object.fromEntries(Object.keys(index.key).map((key, position) => ["key" + position, "$" + key])), count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $group: { _id: null, groups: { $sum: 1 }, documents: { $sum: "$count" } } },
      { $project: { _id: 0, groups: 1, documents: 1 } },
    ], { maxTimeMS: 15000, ...(index.collation ? { collation: index.collation } : {}) }).toArray();
    duplicates.push({ key: index.key, groups: result?.groups ?? 0, documents: result?.documents ?? 0 });
  }
  return { present: true, count, scanned, fields: stats,
    actualIndexes: await model.collection.indexes(), duplicateUniqueKeys: duplicates };
};

const main = async () => {
  const models = loadModels();
  const inventory = models.map((model) => ({
    model: model.modelName, collection: model.collection.name,
    fields: collectFields(model.schema).map(metadata), indexes: publicIndexes(model),
    usage: modelUsage(model.modelName),
  }));
  const fingerprint = createHash("sha256").update(JSON.stringify(inventory)).digest("hex");
  mkdirSync(reportDirectory, { recursive: true });
  writeFileSync(path.join(reportDirectory, "schema-inventory.json"), JSON.stringify({
    generatedAt: new Date().toISOString(), fingerprint, models: inventory,
    nonModelCollections: ["system_configs"],
    limitations: ["Mixed và liên kết đa hình cần kiểm tra theo nghiệp vụ.", "Usage là tham chiếu tên model trong code, không phải số lần dùng thực tế."],
  }, null, 2) + "\n");
  if (process.argv.includes("--schema-only")) {
    console.log(`Đã thống kê ${models.length} model; chưa kết nối database.`);
    return;
  }
  if (!process.argv.includes("--read-only")) throw new Error("Cần chọn --schema-only hoặc --read-only.");
  // Chỉ nạp cấu hình vào bộ nhớ khi người vận hành chủ động chọn kiểm tra database.
  require("dotenv").config({ path: path.join(backendRoot, ".env"), quiet: true });
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("Chưa có cấu hình kết nối MongoDB.");
  const batchSize = Number(option("--batch-size") ?? 250);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) throw new Error("Batch phải từ 1 đến 1000.");
  await mongoose.connect(uri, {
    autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000, socketTimeoutMS: 120000,
    maxPoolSize: 2, appName: "handigo-data-audit-read-only",
  });
  const db = mongoose.connection.db!;
  const collectionNames = (await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name);
  const modelCollections = new Set(models.map((model) => model.collection.name));
  const report: RawDocument = {
    generatedAt: new Date().toISOString(), database: db.databaseName, mode: "chỉ đọc", fingerprint,
    snapshotConsistent: false, batchSize, collections: {}, unmanagedCollections: [], errors: [],
    limitations: [
      "Đếm và quét không nằm trong một snapshot; dữ liệu có thể thay đổi trong lúc kiểm tra.",
      "Kiểm tra kiểu BSON, enum, min/max và liên kết; chưa chạy mọi custom validator, hook hoặc API.",
      "Thiếu field tùy chọn hoặc thiếu phần tử trong object chưa tồn tại không tự động là lỗi.",
    ],
  };
  for (const model of models) {
    try {
      const result = await auditCollection(model, batchSize, collectionNames.includes(model.collection.name));
      report.collections[model.collection.name] = result;
      console.log(`${model.collection.name}: ${result.count} document; đã quét ${result.scanned}.`);
    } catch (error) {
      const details = error as { name?: string; code?: number };
      report.errors.push({ collection: model.collection.name, name: details.name, code: details.code });
      console.log(`${model.collection.name}: kiểm tra chưa hoàn tất; xem báo cáo.`);
    }
    writeFileSync(path.join(reportDirectory, "data-audit.json"), JSON.stringify(report, null, 2) + "\n");
  }
  for (const name of collectionNames.filter((item) => !modelCollections.has(item) && !item.startsWith("system."))) {
    const collection = db.collection(name);
    const count = await collection.countDocuments({}, { maxTimeMS: 15000 });
    const fields = await collection.aggregate([
      { $project: { keys: { $map: { input: { $objectToArray: "$$ROOT" }, as: "item", in: "$$item.k" } } } },
      { $unwind: "$keys" }, { $group: { _id: "$keys", present: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ], { maxTimeMS: 15000 }).toArray();
    report.unmanagedCollections.push({ collection: name, count, fields, indexes: await collection.indexes() });
    console.log(`${name}: ${count} document; collection không có model đăng ký.`);
  }
  report.finishedAt = new Date().toISOString();
  writeFileSync(path.join(reportDirectory, "data-audit.json"), JSON.stringify(report, null, 2) + "\n");
  if (report.errors.length) process.exitCode = 1;
};

if (require.main === module) {
  main().catch((error: unknown) => {
    // Không in message/stack vì lỗi kết nối có thể chứa credential hoặc giá trị document.
    const details = error as { name?: string; code?: number };
    console.error("Kiểm tra dữ liệu chưa hoàn tất.", { name: details.name, code: details.code });
    process.exitCode = 1;
  }).finally(async () => { await mongoose.disconnect(); });
}

export { collectFields, fieldValues, isCorrectType };
