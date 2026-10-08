import { ClientSession, QueryFilter, UpdateQuery, Types } from "mongoose";
import { Voucher, IVoucher } from "../models/voucher.model";
import { IPromotion, Promotion } from "../models/promotion.model";

// Mã cũ còn trong promotions được đọc tại chỗ, không tự chuyển collection.
export const findStoredVoucher = async (filter: QueryFilter<IPromotion>, session?: ClientSession) => {
  const current = await Voucher.findOne(filter as QueryFilter<IVoucher>).session(session ?? null);
  if (current) return current;
  return Promotion.findOne({ $and: [filter, { code: { $type: "string", $ne: "" } }] }).session(session ?? null);
};

export const updateStoredVoucher = async (id: Types.ObjectId, filter: QueryFilter<IPromotion>, update: UpdateQuery<IPromotion>, session?: ClientSession) => {
  const voucher = await findStoredVoucher({ _id: id }, session);
  if (!voucher) return null;
  return voucher.updateOne({ ...update }, { session, runValidators: true }).where(filter);
};

export const listStoredVouchers = async (filter: QueryFilter<IPromotion>) => {
  const [current, legacy] = await Promise.all([
    Voucher.find(filter as QueryFilter<IVoucher>), Promotion.find({ $and: [filter, { code: { $type: "string", $ne: "" } }] }),
  ]);
  const ids = new Set(current.map(item => item._id.toString()));
  return [...current, ...legacy.filter(item => !ids.has(item._id.toString()))]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b._id.toString().localeCompare(a._id.toString()));
};
