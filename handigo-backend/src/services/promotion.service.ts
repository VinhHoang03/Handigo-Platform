import { ClientSession, Types, QueryFilter } from "mongoose";
import { Promotion, IPromotion } from "../models/promotion.model";
import { Service } from "../models/service.model";
import { Order } from "../models/order.model";
import { AppError } from "../utils/appError";
import { createPromotionSchema, promotionFieldsSchema } from "../validations/promotion.validator";

export const promotionDiscount = (promotion: Pick<IPromotion, "discountType" | "discountValue" | "maxDiscountAmount">, amount: number) => {
  const raw = promotion.discountType === "PERCENT" || promotion.discountType === "percentage" ? amount * promotion.discountValue / 100 : promotion.discountValue;
  return Math.floor(Math.max(0, Math.min(amount, raw, promotion.maxDiscountAmount ?? raw)));
};
const activeFilter = (): QueryFilter<IPromotion> => ({ applicationMode: "automatic", isDeleted: false, isActive: true,
  status: { $in: ["ACTIVE", "active"] }, startAt: { $lte: new Date() }, endAt: { $gte: new Date() },
  $expr: { $or: [{ $eq: [{ $ifNull: ["$usageLimit", null] }, null] }, { $lt: ["$usedCount", "$usageLimit"] }] },
});
export const listActivePromotions = () => Promotion.find(activeFilter()).sort({ priority: -1, _id: 1 })
  .select("name description discountType discountValue maxDiscountAmount minOrderAmount startAt endAt serviceIds allowVoucher priority").lean();

export const resolveAutomaticPromotion = async (serviceId: Types.ObjectId, amount: number, hasVoucher: boolean) => {
  const candidates = await Promotion.find({ ...activeFilter(), ...(hasVoucher ? { allowVoucher: true } : {}),
    $or: [{ serviceIds: { $size: 0 } }, { serviceIds: serviceId }],
  }).sort({ priority: -1, _id: 1 });
  const promotion = candidates.find(item => amount >= (item.minOrderAmount ?? 0) && promotionDiscount(item, amount) > 0);
  if (!promotion) return null;
  const discountAmount = promotionDiscount(promotion, amount);
  return { promotion, discountAmount, snapshot: { promotionId: promotion._id, name: promotion.name,
    discountType: promotion.discountType === "PERCENT" || promotion.discountType === "percentage" ? "percentage" : "fixed",
    discountValue: promotion.discountValue, discountAmount } };
};

export const claimPromotion = async (promotion: IPromotion, count: number, session: ClientSession) => {
  const result = await Promotion.updateOne({ _id: promotion._id, updatedAt: promotion.updatedAt, ...activeFilter(),
    $expr: { $or: [{ $eq: [{ $ifNull: ["$usageLimit", null] }, null] }, { $lte: [{ $add: ["$usedCount", count] }, "$usageLimit"] }] },
  }, { $inc: { usedCount: count } }, { session, runValidators: true });
  if (!result.modifiedCount) throw new AppError("Chương trình ưu đãi vừa thay đổi hoặc hết lượt. Vui lòng kiểm tra lại đơn.", 409);
};

export const releaseOrderPromotion = async (orderId: Types.ObjectId, session: ClientSession) => {
  const order = await Order.findOneAndUpdate({ _id: orderId, promotionUsedAt: { $ne: null }, promotionReleasedAt: null, "promotionSnapshot.promotionId": { $ne: null } },
    { $set: { promotionReleasedAt: new Date() } }, { new: true, session, runValidators: true });
  if (order?.promotionSnapshot?.promotionId) await Promotion.updateOne({ _id: order.promotionSnapshot.promotionId, usedCount: { $gt: 0 } },
    { $inc: { usedCount: -1 } }, { session, runValidators: true });
};

export const listAdminPromotions = () => Promotion.find({ applicationMode: "automatic", isDeleted: false }).sort({ createdAt: -1 }).lean();
export const savePromotion = async (input: Record<string, unknown>, id?: string) => {
  const current = id ? await Promotion.findOne({ _id: id, applicationMode: "automatic", isDeleted: false }) : null;
  if (id && !current) throw new AppError("Không tìm thấy chương trình khuyến mãi.", 404);
  const previous = current ? Object.fromEntries(Object.keys(promotionFieldsSchema.shape).map(key => [key, current.get(key)])) : {};
  if (current) { previous.startAt = current.startAt.toISOString(); previous.endAt = current.endAt.toISOString(); previous.serviceIds = (current.serviceIds ?? []).map(String); }
  const data = createPromotionSchema.parse({ ...previous, ...input });
  if (data.serviceIds.length !== await Service.countDocuments({ _id: { $in: data.serviceIds }, isDeleted: false })) throw new AppError("Danh sách dịch vụ không hợp lệ hoặc bị trùng.", 400);
  const fields = { ...data, applicationMode: "automatic" as const, isActive: data.status === "ACTIVE" };
  if (!current) return Promotion.create(fields);
  Object.assign(current, fields); return current.save();
};
export const deletePromotion = async (id: string) => {
  const result = await Promotion.findOneAndUpdate({ _id: id, applicationMode: "automatic", isDeleted: false }, { $set: { isDeleted: true, deletedAt: new Date(), isActive: false, status: "INACTIVE" } }, { new: true, runValidators: true });
  if (!result) throw new AppError("Không tìm thấy chương trình khuyến mãi.", 404);
};
