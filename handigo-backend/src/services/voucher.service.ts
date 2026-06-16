import { Types } from "mongoose";
import { AuditLog } from "../models/auditLog.model";
import { Order } from "../models/order.model";
import { Payment } from "../models/payment.model";
import { IPromotion, Promotion } from "../models/promotion.model";
import { AppError } from "../utils/appError";
import type {
  AdminVoucherQuery,
  ApplyVoucherInput,
  AvailableVoucherQuery,
  CreateAdminVoucherInput,
  RemoveVoucherInput,
  UpdateAdminVoucherInput,
} from "../validations/voucher.validation";

type RequestUser = {
  id: string;
  role: string;
};

type NormalizedDiscountType = "fixed" | "percentage";

const normalizeCode = (code: string) => code.trim().toUpperCase();

const normalizeDiscountType = (discountType: IPromotion["discountType"]): NormalizedDiscountType => {
  if (discountType === "PERCENT" || discountType === "percentage") {
    return "percentage";
  }

  return "fixed";
};

const toResponseDiscountType = (discountType: IPromotion["discountType"]) =>
  normalizeDiscountType(discountType) === "percentage" ? "PERCENT" : "AMOUNT";

const isPromotionActive = (promotion: IPromotion, now = new Date()) => {
  const status = promotion.status?.toUpperCase();
  return (
    !promotion.isDeleted &&
    promotion.isActive &&
    status !== "INACTIVE" &&
    status !== "EXPIRED" &&
    promotion.startAt <= now &&
    promotion.endAt >= now
  );
};

const getOriginalAmount = (order: any) => Math.max(order.pricing?.bookingAmount || 0, 0);

const getAmountBeforeVoucher = (order: any) => {
  const originalAmount = getOriginalAmount(order);
  const promotionDiscountAmount = Math.max(order.pricing?.promotionDiscountAmount || 0, 0);

  return Math.max(originalAmount - promotionDiscountAmount, 0);
};

const calculateDiscountAmount = (promotion: IPromotion, amountBeforeVoucher: number) => {
  const discountType = normalizeDiscountType(promotion.discountType);
  const rawDiscount =
    discountType === "percentage"
      ? (amountBeforeVoucher * promotion.discountValue) / 100
      : promotion.discountValue;
  const maxDiscountAmount = promotion.maxDiscountAmount ?? rawDiscount;
  const limitedDiscount = Math.min(rawDiscount, maxDiscountAmount);

  return Math.min(Math.max(Math.floor(limitedDiscount), 0), amountBeforeVoucher);
};

const buildVoucherInfo = (promotion: IPromotion, discountAmount?: number) => ({
  id: promotion._id,
  code: promotion.code,
  name: promotion.name,
  description: promotion.description,
  discountType: toResponseDiscountType(promotion.discountType),
  discountValue: promotion.discountValue,
  discountAmount,
  maxDiscountAmount: promotion.maxDiscountAmount,
  minOrderAmount: promotion.minOrderAmount,
  startAt: promotion.startAt,
  endAt: promotion.endAt,
});

const toAdminVoucherResponse = (promotion: IPromotion) => ({
  id: promotion._id,
  code: promotion.code,
  name: promotion.name,
  description: promotion.description,
  discountType: toResponseDiscountType(promotion.discountType),
  discountValue: promotion.discountValue,
  maxDiscountAmount: promotion.maxDiscountAmount,
  minOrderAmount: promotion.minOrderAmount,
  usageLimit: promotion.usageLimit,
  usedCount: promotion.usedCount,
  startAt: promotion.startAt,
  endAt: promotion.endAt,
  status: promotion.status?.toUpperCase() || (promotion.isActive ? "ACTIVE" : "INACTIVE"),
  isActive: promotion.isActive,
  isDeleted: promotion.isDeleted,
  createdAt: promotion.createdAt,
  updatedAt: promotion.updatedAt,
});

const ensureAdmin = (user: RequestUser) => {
  if (user.role !== "ADMIN") {
    throw new AppError("Chi admin moi co quyen quan ly voucher", 403);
  }
};

const serializePromotion = (promotion: IPromotion) => {
  const plain = promotion.toObject() as Record<string, unknown>;
  plain.id = promotion._id;
  delete plain.__v;
  return plain;
};

const createVoucherAuditLog = async (
  user: RequestUser,
  action: string,
  targetId: Types.ObjectId,
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null,
  description: string,
) => {
  await AuditLog.create({
    actorId: new Types.ObjectId(user.id),
    actorRole: "admin",
    action,
    targetType: "Voucher",
    targetId,
    oldValue,
    newValue,
    description,
  });
};

const getVoucherOrFail = async (id: string) => {
  const voucher = await Promotion.findOne({ _id: id, isDeleted: false });

  if (!voucher) {
    throw new AppError("Khong tim thay voucher", 404);
  }

  return voucher;
};

const mapDuplicateKeyError = (error: any) => {
  if (error?.code === 11000) {
    throw new AppError("Ma voucher da ton tai", 409);
  }

  throw error;
};

const assertUniqueVoucherCode = async (code: string, excludeId?: string) => {
  const query: Record<string, unknown> = {
    code: normalizeCode(code),
    isDeleted: false,
  };

  if (excludeId) {
    query._id = { $ne: new Types.ObjectId(excludeId) };
  }

  const existing = await Promotion.exists(query);

  if (existing) {
    throw new AppError("Ma voucher da ton tai", 409);
  }
};

const assertVoucherDateRange = (startAt: Date, endAt: Date) => {
  if (startAt >= endAt) {
    throw new AppError("startAt phai truoc endAt", 400);
  }
};

const assertDiscountRule = (discountType: IPromotion["discountType"], discountValue: number) => {
  if (toResponseDiscountType(discountType) === "PERCENT" && (discountValue < 1 || discountValue > 100)) {
    throw new AppError("Gia tri phan tram phai tu 1 den 100", 400);
  }
};

const buildVoucherResponse = (order: any, promotion: IPromotion, discountAmount: number) => {
  const originalAmount = getOriginalAmount(order);
  const amountBeforeVoucher = getAmountBeforeVoucher(order);
  const finalAmount = Math.max(amountBeforeVoucher - discountAmount, 0);

  return {
    originalAmount,
    discountAmount,
    finalAmount,
    voucher: buildVoucherInfo(promotion, discountAmount),
  };
};

const assertCustomerCanModifyOrder = (order: any, user: RequestUser) => {
  if (user.role === "ADMIN") {
    return;
  }

  if (order.customerId?.toString() !== user.id) {
    throw new AppError("Bạn không có quyền thao tác với đơn hàng này", 403);
  }
};

const getOrderForVoucher = async (orderId: string, user: RequestUser) => {
  const order = await Order.findById(orderId);

  if (!order || order.isDeleted) {
    throw new AppError("Không tìm thấy đơn hàng", 404);
  }

  assertCustomerCanModifyOrder(order, user);

  if (["completed", "cancelled"].includes(order.status)) {
    throw new AppError("Không thể thay đổi voucher cho đơn hàng đã hoàn tất hoặc đã hủy", 400);
  }

  return order;
};

const assertNoLockedPayment = async (orderId: Types.ObjectId | string) => {
  const payment = await Payment.findOne({
    orderId,
    status: { $in: ["pending", "paid", "refunded"] },
  }).select("_id status");

  if (payment) {
    throw new AppError("Không thể thay đổi voucher vì đơn hàng đã có giao dịch thanh toán", 409);
  }
};

export const applyVoucher = async (user: RequestUser, input: ApplyVoucherInput) => {
  const order = await getOrderForVoucher(input.orderId, user);

  if (order.voucherSnapshot) {
    throw new AppError("Đơn hàng đã áp dụng một voucher", 409);
  }

  await assertNoLockedPayment(order._id as Types.ObjectId);

  const code = normalizeCode(input.code);
  const promotion = await Promotion.findOne({ code });

  if (!promotion) {
    throw new AppError("Voucher không tồn tại", 404);
  }

  if (!isPromotionActive(promotion)) {
    throw new AppError("Voucher không hoạt động hoặc đã hết hạn", 400);
  }

  const originalAmount = getOriginalAmount(order);
  const minOrderAmount = promotion.minOrderAmount ?? 0;

  if (originalAmount < minOrderAmount) {
    throw new AppError("Giá trị đơn hàng chưa đạt mức tối thiểu để áp dụng voucher", 400);
  }

  if (promotion.usageLimit !== null && promotion.usageLimit !== undefined && promotion.usedCount >= promotion.usageLimit) {
    throw new AppError("Voucher đã hết lượt sử dụng", 400);
  }

  const amountBeforeVoucher = getAmountBeforeVoucher(order);
  const discountAmount = calculateDiscountAmount(promotion, amountBeforeVoucher);
  const finalAmount = Math.max(amountBeforeVoucher - discountAmount, 0);

  const usageFilter: Record<string, unknown> = { _id: promotion._id };
  if (promotion.usageLimit !== null && promotion.usageLimit !== undefined) {
    usageFilter.$expr = { $lt: ["$usedCount", "$usageLimit"] };
  }

  const updatedPromotion = await Promotion.findOneAndUpdate(
    usageFilter,
    { $inc: { usedCount: 1 } },
    { new: true },
  );

  if (!updatedPromotion) {
    throw new AppError("Voucher đã hết lượt sử dụng", 400);
  }

  order.voucherSnapshot = {
    voucherId: promotion._id as Types.ObjectId,
    name: promotion.name,
    code,
    discountType: normalizeDiscountType(promotion.discountType),
    discountValue: promotion.discountValue,
    discountAmount,
  };
  order.pricing.voucherDiscountAmount = discountAmount;
  order.pricing.totalPaidAmount = finalAmount;

  try {
    await order.save();
  } catch (error) {
    await Promotion.updateOne(
      { _id: promotion._id, usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } },
    );
    throw error;
  }

  return buildVoucherResponse(order, promotion, discountAmount);
};

export const removeVoucher = async (user: RequestUser, input: RemoveVoucherInput) => {
  const order = await getOrderForVoucher(input.orderId, user);

  if (!order.voucherSnapshot) {
    throw new AppError("Đơn hàng chưa áp dụng voucher", 400);
  }

  await assertNoLockedPayment(order._id as Types.ObjectId);

  const voucherId = order.voucherSnapshot.voucherId;
  const voucherCode = order.voucherSnapshot.code || null;
  const amountBeforeVoucher = getAmountBeforeVoucher(order);
  const originalAmount = getOriginalAmount(order);

  order.voucherSnapshot = null;
  order.pricing.voucherDiscountAmount = 0;
  order.pricing.totalPaidAmount = amountBeforeVoucher;

  await order.save();

  if (voucherId) {
    await Promotion.updateOne(
      { _id: voucherId, usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } },
    );
  }

  return {
    originalAmount,
    discountAmount: 0,
    finalAmount: amountBeforeVoucher,
    voucher: voucherCode ? { code: voucherCode } : null,
  };
};

export const getAvailableVouchers = async (user: RequestUser, query: AvailableVoucherQuery) => {
  const now = new Date();
  let order: any = null;
  let originalAmount: number | undefined;
  let amountBeforeVoucher: number | undefined;

  if (query.orderId) {
    order = await getOrderForVoucher(query.orderId, user);
    originalAmount = getOriginalAmount(order);
    amountBeforeVoucher = getAmountBeforeVoucher(order);
  }

  const promotions = await Promotion.find({
    isDeleted: false,
    isActive: true,
    startAt: { $lte: now },
    endAt: { $gte: now },
    $or: [{ status: "ACTIVE" }, { status: "active" }, { status: { $exists: false } }],
  }).sort({ createdAt: -1 });

  const available = promotions.filter((promotion) => {
    if (!promotion.code || !isPromotionActive(promotion, now)) {
      return false;
    }

    if (promotion.usageLimit !== null && promotion.usageLimit !== undefined && promotion.usedCount >= promotion.usageLimit) {
      return false;
    }

    if (originalAmount !== undefined && originalAmount < (promotion.minOrderAmount ?? 0)) {
      return false;
    }

    return true;
  });

  return available.map((promotion) => {
    const discountAmount =
      amountBeforeVoucher === undefined ? undefined : calculateDiscountAmount(promotion, amountBeforeVoucher);
    return {
      ...buildVoucherInfo(promotion, discountAmount),
      finalAmount:
        amountBeforeVoucher === undefined || discountAmount === undefined
          ? undefined
          : Math.max(amountBeforeVoucher - discountAmount, 0),
    };
  });
};

export const createAdminVoucher = async (user: RequestUser, input: CreateAdminVoucherInput) => {
  ensureAdmin(user);

  const code = normalizeCode(input.code);
  await assertUniqueVoucherCode(code);

  try {
    const voucher = await Promotion.create({
      name: input.name || code,
      code,
      description: input.description ?? null,
      discountType: input.discountType,
      discountValue: input.discountValue,
      maxDiscountAmount: input.maxDiscountAmount ?? null,
      minOrderAmount: input.minOrderAmount ?? null,
      usageLimit: input.usageLimit ?? null,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      status: input.status || "ACTIVE",
      isActive: (input.status || "ACTIVE") === "ACTIVE",
    });

    await createVoucherAuditLog(
      user,
      "CREATE_VOUCHER",
      voucher._id as Types.ObjectId,
      null,
      serializePromotion(voucher),
      `Admin created voucher ${code}`,
    );

    return toAdminVoucherResponse(voucher);
  } catch (error: any) {
    mapDuplicateKeyError(error);
  }
};

export const getAdminVouchers = async (user: RequestUser, query: AdminVoucherQuery) => {
  ensureAdmin(user);

  const filter: Record<string, unknown> = { isDeleted: false };

  if (query.search) {
    const regex = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ code: regex }, { name: regex }, { description: regex }];
  }

  if (query.status) {
    const status = query.status.toUpperCase();
    filter.$or = [
      ...((filter.$or as Record<string, unknown>[] | undefined) || []),
    ];

    filter.status = { $in: [status, status.toLowerCase()] };
  }

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    Promotion.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    Promotion.countDocuments(filter),
  ]);

  return {
    items: items.map(toAdminVoucherResponse),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const getAdminVoucherById = async (user: RequestUser, id: string) => {
  ensureAdmin(user);
  const voucher = await getVoucherOrFail(id);

  return toAdminVoucherResponse(voucher);
};

export const updateAdminVoucher = async (
  user: RequestUser,
  id: string,
  input: UpdateAdminVoucherInput,
) => {
  ensureAdmin(user);

  const voucher = await getVoucherOrFail(id);
  const oldValue = serializePromotion(voucher);

  if (input.code) {
    const code = normalizeCode(input.code);
    await assertUniqueVoucherCode(code, id);
    voucher.code = code;
    voucher.name = input.name === undefined ? voucher.name : input.name || code;
  } else if (input.name !== undefined) {
    voucher.name = input.name || voucher.code || voucher.name;
  }

  if (input.description !== undefined) voucher.description = input.description;
  if (input.discountType !== undefined) voucher.discountType = input.discountType;
  if (input.discountValue !== undefined) voucher.discountValue = input.discountValue;
  if (input.maxDiscountAmount !== undefined) voucher.maxDiscountAmount = input.maxDiscountAmount;
  if (input.minOrderAmount !== undefined) voucher.minOrderAmount = input.minOrderAmount;
  if (input.usageLimit !== undefined) voucher.usageLimit = input.usageLimit;
  if (input.startAt !== undefined) voucher.startAt = new Date(input.startAt);
  if (input.endAt !== undefined) voucher.endAt = new Date(input.endAt);
  if (input.status !== undefined) {
    voucher.status = input.status;
    voucher.isActive = input.status === "ACTIVE";
  }

  assertDiscountRule(voucher.discountType, voucher.discountValue);
  assertVoucherDateRange(voucher.startAt, voucher.endAt);

  try {
    await voucher.save();
  } catch (error: any) {
    mapDuplicateKeyError(error);
  }

  await createVoucherAuditLog(
    user,
    "UPDATE_VOUCHER",
    voucher._id as Types.ObjectId,
    oldValue,
    serializePromotion(voucher),
    `Admin updated voucher ${voucher.code}`,
  );

  return toAdminVoucherResponse(voucher);
};

export const disableAdminVoucher = async (user: RequestUser, id: string) => {
  ensureAdmin(user);
  const voucher = await getVoucherOrFail(id);
  const oldValue = serializePromotion(voucher);

  voucher.status = "INACTIVE";
  voucher.isActive = false;
  await voucher.save();

  await createVoucherAuditLog(
    user,
    "DISABLE_VOUCHER",
    voucher._id as Types.ObjectId,
    oldValue,
    serializePromotion(voucher),
    `Admin disabled voucher ${voucher.code}`,
  );

  return toAdminVoucherResponse(voucher);
};

export const enableAdminVoucher = async (user: RequestUser, id: string) => {
  ensureAdmin(user);
  const voucher = await getVoucherOrFail(id);
  const oldValue = serializePromotion(voucher);

  voucher.status = "ACTIVE";
  voucher.isActive = true;
  await voucher.save();

  await createVoucherAuditLog(
    user,
    "ENABLE_VOUCHER",
    voucher._id as Types.ObjectId,
    oldValue,
    serializePromotion(voucher),
    `Admin enabled voucher ${voucher.code}`,
  );

  return toAdminVoucherResponse(voucher);
};

export const deleteAdminVoucher = async (user: RequestUser, id: string) => {
  ensureAdmin(user);
  const voucher = await getVoucherOrFail(id);
  const oldValue = serializePromotion(voucher);

  voucher.isDeleted = true;
  voucher.deletedAt = new Date();
  voucher.status = "INACTIVE";
  voucher.isActive = false;
  await voucher.save();

  await createVoucherAuditLog(
    user,
    "DELETE_VOUCHER",
    voucher._id as Types.ObjectId,
    oldValue,
    serializePromotion(voucher),
    `Admin deleted voucher ${voucher.code}`,
  );

  return toAdminVoucherResponse(voucher);
};
