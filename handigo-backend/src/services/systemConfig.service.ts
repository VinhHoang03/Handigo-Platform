import mongoose, { Types } from "mongoose";
import { AuditLog } from "../models/auditLog.model";
import { AppError } from "../utils/appError";
import type {
  CreateSystemConfigInput,
  SystemConfigListQuery,
  SystemConfigType,
  UpdateSystemConfigInput,
} from "../validations/systemConfig.validator";

type RequestUser = {
  id: string;
  role: string;
};

type SystemConfigDocument = {
  _id: Types.ObjectId;
  key: string;
  value: unknown;
  type: SystemConfigType;
  description?: string | null;
  isPublic: boolean;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

const collection = () => mongoose.connection.collection<SystemConfigDocument>("system_configs");

let indexesReady: Promise<string> | null = null;

const ensureIndexes = () => {
  if (!indexesReady) {
    indexesReady = collection().createIndex({ key: 1 }, { unique: true });
  }

  return indexesReady;
};

const serializeConfig = (config: SystemConfigDocument) => ({
  id: config._id,
  key: config.key,
  value: config.value,
  type: config.type,
  description: config.description ?? null,
  isPublic: Boolean(config.isPublic),
  updatedBy: config.updatedBy ?? null,
  createdAt: config.createdAt,
  updatedAt: config.updatedAt,
});

const assertAdmin = (user: RequestUser) => {
  if (user.role !== "ADMIN") {
    throw new AppError("Chỉ quản trị viên được quản lý cấu hình hệ thống", 403);
  }
};

const assertConfigValueMatchesType = (value: unknown, type: SystemConfigType) => {
  if (value === undefined || value === null) {
    throw new AppError("Giá trị cấu hình là bắt buộc", 400);
  }

  if (type === "STRING" && typeof value !== "string") {
    throw new AppError("Giá trị cấu hình phải là chuỗi", 400);
  }

  if (type === "NUMBER" && (typeof value !== "number" || !Number.isFinite(value))) {
    throw new AppError("Giá trị cấu hình phải là số hợp lệ", 400);
  }

  if (type === "BOOLEAN" && typeof value !== "boolean") {
    throw new AppError("Giá trị cấu hình phải là đúng/sai", 400);
  }

  if (type === "JSON") {
    const isJsonObject = typeof value === "object";

    if (!isJsonObject) {
      throw new AppError("Giá trị cấu hình phải là object hoặc array JSON", 400);
    }

    try {
      JSON.stringify(value);
    } catch {
      throw new AppError("Giá trị cấu hình phải có thể chuyển đổi sang JSON", 400);
    }
  }
};

const createAuditLog = async (
  admin: RequestUser,
  action: string,
  configId: Types.ObjectId,
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
) => {
  await AuditLog.create({
    actorId: new Types.ObjectId(admin.id),
    actorRole: "admin",
    action,
    targetType: "SYSTEM_CONFIG",
    targetId: configId,
    oldValue: before,
    newValue: after,
    description: `${action} ${after.key}`,
  });
};

const buildListFilter = (query: SystemConfigListQuery) => {
  const filter: Record<string, unknown> = {};

  if (query.isPublic !== undefined) {
    filter.isPublic = query.isPublic;
  }

  if (query.type) {
    filter.type = query.type;
  }

  if (query.search) {
    const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { key: new RegExp(escaped, "i") },
      { description: new RegExp(escaped, "i") },
    ];
  }

  return filter;
};

export const getPublicConfigs = async () => {
  await ensureIndexes();
  const configs = await collection()
    .find({ isPublic: true })
    .sort({ key: 1 })
    .toArray();

  return configs.map(serializeConfig);
};

export const getAllConfigs = async (admin: RequestUser, query: SystemConfigListQuery) => {
  assertAdmin(admin);
  await ensureIndexes();

  const configs = await collection()
    .find(buildListFilter(query))
    .sort({ key: 1 })
    .toArray();

  return configs.map(serializeConfig);
};

export const getConfigByKey = async (admin: RequestUser, key: string) => {
  assertAdmin(admin);
  await ensureIndexes();

  const config = await collection().findOne({ key });

  if (!config) {
    throw new AppError("Không tìm thấy cấu hình hệ thống", 404);
  }

  return serializeConfig(config);
};

export const createConfig = async (admin: RequestUser, input: CreateSystemConfigInput) => {
  assertAdmin(admin);
  assertConfigValueMatchesType(input.value, input.type);
  await ensureIndexes();

  const now = new Date();
  const config: Omit<SystemConfigDocument, "_id"> = {
    key: input.key,
    value: input.value,
    type: input.type,
    description: input.description ?? null,
    isPublic: input.isPublic,
    updatedBy: new Types.ObjectId(admin.id),
    createdAt: now,
    updatedAt: now,
  };

  try {
    const result = await collection().insertOne(config as SystemConfigDocument);
    const created = {
      _id: result.insertedId,
      ...config,
    };
    const response = serializeConfig(created);

    await createAuditLog(admin, "CREATE_SYSTEM_CONFIG", result.insertedId, null, response);

    return response;
  } catch (error: any) {
    if (error?.code === 11000) {
      throw new AppError("Key cấu hình hệ thống đã tồn tại", 409);
    }

    throw error;
  }
};

export const updateConfig = async (
  admin: RequestUser,
  key: string,
  input: UpdateSystemConfigInput,
) => {
  assertAdmin(admin);
  await ensureIndexes();

  const existing = await collection().findOne({ key });

  if (!existing) {
    throw new AppError("Không tìm thấy cấu hình hệ thống", 404);
  }

  const nextType = input.type ?? existing.type;
  assertConfigValueMatchesType(input.value, nextType);

  const now = new Date();
  const update = {
    value: input.value,
    type: nextType,
    description: input.description === undefined ? existing.description ?? null : input.description ?? null,
    isPublic: input.isPublic === undefined ? existing.isPublic : input.isPublic,
    updatedBy: new Types.ObjectId(admin.id),
    updatedAt: now,
  };

  await collection().updateOne({ key }, { $set: update });

  const updated = {
    ...existing,
    ...update,
  };
  const before = serializeConfig(existing);
  const after = serializeConfig(updated);

  await createAuditLog(admin, "UPDATE_SYSTEM_CONFIG", existing._id, before, after);

  return after;
};

export const getNumberConfigValue = async (key: string, fallbackValue: number) => {
  await ensureIndexes();

  const config = await collection().findOne({ key });
  if (!config || config.type !== "NUMBER") {
    return fallbackValue;
  }

  const value = Number(config.value);
  return Number.isFinite(value) ? value : fallbackValue;
};
