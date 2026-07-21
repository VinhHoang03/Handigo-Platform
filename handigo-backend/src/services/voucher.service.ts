import mongoose, { ClientSession, Types } from "mongoose";
import { AuditLog } from "../models/auditLog.model";
import type { RequestUser } from "../middlewares/authContext";
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
} from "../validations/voucher.validator";

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

export const resolveVoucherForAmount = async (
  code: string,
  amountBeforeVoucher: number,
  session?: ClientSession,
) => {
  const normalizedCode = normalizeCode(code);
  const query = Promotion.findOne({ code: normalizedCode });
  if (session) query.session(session);
  const promotion = await query;

  if (!promotion) {
    throw new AppError("Voucher không tồn tại", 404);
  }
  if (!isPromotionActive(promotion)) {
    throw new AppError("Voucher không hoạt động hoặc đã hết hạn", 400);
  }
  if (
    promotion.usageLimit !== null &&
    promotion.usageLimit !== undefined &&
    promotion.usedCount >= promotion.usageLimit
  ) {
    throw new AppError("Voucher đã hết lượt sử dụng", 400);
  }
  if (amountBeforeVoucher < (promotion.minOrderAmount ?? 0)) {
    throw new AppError("Giá trị đơn hàng chưa đạt mức tối thiểu để áp dụng voucher", 400);
  }

  const discountAmount = calculateDiscountAmount(promotion, amountBeforeVoucher);
  return {
    promotion,
    discountAmount,
    snapshot: {
      voucherId: promotion._id as Types.ObjectId,
      name: promotion.name,
      code: normalizedCode,
      discountType: normalizeDiscountType(promotion.discountType),
      discountValue: promotion.discountValue,
      discountAmount,
    },
  };
};

export const markOrderVoucherAsUsed = async (
  order: InstanceType<typeof Order>,
  session: ClientSession,
) => {
  const voucherId = order.voucherSnapshot?.voucherId;
  if (!voucherId || order.voucherUsedAt) return false;

  const usedAt = new Date();
  const claimedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      voucherUsedAt: null,
      "voucherSnapshot.voucherId": voucherId,
    },
    { $set: { voucherUsedAt: usedAt } },
    { new: true, session },
  );
  if (!claimedOrder) return false;

  await Promotion.updateOne(
    { _id: voucherId },
    { $inc: { usedCount: 1 } },
    { session },
  );
  order.voucherUsedAt = usedAt;
  return true;
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
    throw new AppError("Không tìm thấy voucher", 404);
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

const getOrderForVoucher = async (
  orderId: string,
  user: RequestUser,
  session?: ClientSession,
) => {
  const query = Order.findById(orderId);
  if (session) query.session(session);
  const order = await query;

  if (!order || order.isDeleted) {
    throw new AppError("Không tìm thấy đơn hàng", 404);
  }

  assertCustomerCanModifyOrder(order, user);

  if (["completed", "cancelled"].includes(order.status)) {
    throw new AppError("Không thể thay đổi voucher cho đơn hàng đã hoàn tất hoặc đã hủy", 400);
  }

  return order;
};

const assertNoLockedPayment = async (
  orderId: Types.ObjectId | string,
  session?: ClientSession,
) => {
  const query = Payment.findOne({
    orderId,
    status: { $in: ["pending", "paid", "refunded"] },
  }).select("_id status");
  if (session) query.session(session);
  const payment = await query;

  if (payment) {
    throw new AppError("Không thể thay đổi voucher vì đơn hàng đã có giao dịch thanh toán", 409);
  }
};

export const applyVoucher = async (user: RequestUser, input: ApplyVoucherInput) => {
  const session = await mongoose.startSession();
  let result: ReturnType<typeof buildVoucherResponse> | null | undefined;

  try {
    result = await session.withTransaction(async () => {
      const order = await getOrderForVoucher(input.orderId, user, session);

      if (order.voucherSnapshot) {
        throw new AppError("Đơn hàng đã áp dụng một voucher", 409);
      }

      await assertNoLockedPayment(order._id as Types.ObjectId, session);

      const amountBeforeVoucher = getAmountBeforeVoucher(order);
      const { promotion, discountAmount, snapshot } =
        await resolveVoucherForAmount(input.code, amountBeforeVoucher, session);
      const finalAmount = Math.max(amountBeforeVoucher - discountAmount, 0);

      const updatedOrder = await Order.findOneAndUpdate(
        {
          _id: order._id,
          voucherSnapshot: null,
          status: { $nin: ["completed", "cancelled"] },
        },
        {
          $set: {
            voucherSnapshot: snapshot,
            "pricing.voucherDiscountAmount": discountAmount,
            "pricing.totalPaidAmount": finalAmount,
          },
        },
        { new: true, session, runValidators: true },
      );

      if (!updatedOrder) {
        throw new AppError("Đơn hàng vừa được xử lý bởi yêu cầu khác", 409);
      }

      return buildVoucherResponse(updatedOrder, promotion, discountAmount);
    });
  } finally {
    await session.endSession();
  }

  if (!result) {
    throw new AppError("Không thể áp dụng voucher", 500);
  }

  return result;
};

export const removeVoucher = async (user: RequestUser, input: RemoveVoucherInput) => {
  const session = await mongoose.startSession();
  let result: {
    originalAmount: number;
    discountAmount: number;
    finalAmount: number;
    voucher: { code: string } | null;
  } | null | undefined;

  try {
    result = await session.withTransaction(async () => {
      const order = await getOrderForVoucher(input.orderId, user, session);

      if (!order.voucherSnapshot) {
        throw new AppError("Đơn hàng chưa áp dụng voucher", 400);
      }

      await assertNoLockedPayment(order._id as Types.ObjectId, session);

      const voucherId = order.voucherSnapshot.voucherId;
      const voucherCode = order.voucherSnapshot.code || null;
      const amountBeforeVoucher = getAmountBeforeVoucher(order);
      const originalAmount = getOriginalAmount(order);
      const snapshotFilter = voucherId
        ? { "voucherSnapshot.voucherId": voucherId }
        : { "voucherSnapshot.code": voucherCode };
      const updatedOrder = await Order.findOneAndUpdate(
        {
          _id: order._id,
          status: { $nin: ["completed", "cancelled"] },
          ...snapshotFilter,
        },
        {
          $set: {
            voucherSnapshot: null,
            "pricing.voucherDiscountAmount": 0,
            "pricing.totalPaidAmount": amountBeforeVoucher,
          },
        },
        { new: true, session, runValidators: true },
      );

      if (!updatedOrder) {
        throw new AppError("Đơn hàng vừa được xử lý bởi yêu cầu khác", 409);
      }

      return {
        originalAmount,
        discountAmount: 0,
        finalAmount: amountBeforeVoucher,
        voucher: voucherCode ? { code: voucherCode } : null,
      };
    });
  } finally {
    await session.endSession();
  }

  if (!result) {
    throw new AppError("Không thể gỡ voucher", 500);
  }

  return result;
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
