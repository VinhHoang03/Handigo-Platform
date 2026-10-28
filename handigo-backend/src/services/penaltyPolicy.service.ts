import mongoose, { ClientSession, Types } from "mongoose";
import User, { IUser } from "../models/user.model";
import { Violation, PenaltyType } from "../models/violation.model";
import { AppError } from "../utils/appError";
import { createLogger } from "../utils/logger";

export const restrictedFeatures = ["chat", "voucher", "order_receiving", "booking"] as const;
export type RestrictedFeature = typeof restrictedFeatures[number];

export const normalizeRestrictedFeature = (value: string) => {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d").toLowerCase().trim().replace(/[\s-]+/g, "_");
  const aliases: Record<string, RestrictedFeature> = {
    chat: "chat", tro_chuyen: "chat", voucher: "voucher", ma_giam_gia: "voucher",
    order_receiving: "order_receiving", nhan_don: "order_receiving",
    booking: "booking", dat_don: "booking", dat_dich_vu: "booking",
  };
  return aliases[normalized];
};

const effectivePenaltyFilter = (now = new Date()) => ({
  status: "active" as const, isDeleted: false,
  $and: [
    { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
    { $or: [{ endAt: null }, { endAt: { $gt: now } }] },
  ],
});

const suspensionTypes: PenaltyType[] = ["TEMPORARY_SUSPEND", "PERMANENT_BAN", "account_locked", "provider_suspended"];
const featurePenaltyType: Record<RestrictedFeature, PenaltyType> = {
  chat: "RESTRICT_CHAT", voucher: "RESTRICT_VOUCHER",
  order_receiving: "RESTRICT_ORDER_RECEIVING", booking: "RESTRICT_FEATURE",
};

export const getRestrictedUserIds = async (feature: RestrictedFeature, session?: ClientSession) => {
  const penalties = await Violation.find({ ...effectivePenaltyFilter(),
    penaltyType: { $in: [...suspensionTypes, featurePenaltyType[feature], "RESTRICT_FEATURE"] },
  }).select("userId penaltyType penalty.feature").session(session ?? null).lean();
  return penalties.filter((penalty) => suspensionTypes.includes(penalty.penaltyType)
    || (penalty.penaltyType !== "RESTRICT_FEATURE" && penalty.penaltyType === featurePenaltyType[feature])
    || normalizeRestrictedFeature(penalty.penalty?.feature ?? "") === feature)
    .map((penalty) => penalty.userId);
};

export const assertFeatureAllowed = async (
  userId: string | Types.ObjectId, feature: RestrictedFeature, session?: ClientSession,
) => {
  const penalties = await Violation.find({ userId, ...effectivePenaltyFilter(),
    penaltyType: { $in: [...suspensionTypes, featurePenaltyType[feature], "RESTRICT_FEATURE"] },
  }).select("penaltyType penalty.feature").session(session ?? null).lean();
  if (penalties.some((penalty) => suspensionTypes.includes(penalty.penaltyType)
    || (penalty.penaltyType !== "RESTRICT_FEATURE" && penalty.penaltyType === featurePenaltyType[feature])
    || normalizeRestrictedFeature(penalty.penalty?.feature ?? "") === feature)) {
    throw new AppError("Tài khoản đang bị hạn chế sử dụng chức năng này theo quyết định xử lý vi phạm.", 403);
  }
};

// Khóa theo tài khoản; thao tác khóa thủ công luôn xóa dấu nguồn khóa tạm thời.
export const refreshTemporaryLock = async (userId: string | Types.ObjectId) => {
  return mongoose.connection.transaction(async (session) => {
    const user = await User.findOne({ _id: userId, isDeleted: false })
      .select("+temporaryLockId").session(session);
    if (!user?.temporaryLockId || user.status !== "locked") return user;
    const source = await Violation.findOne({ _id: user.temporaryLockId, userId,
      penaltyType: "TEMPORARY_SUSPEND", isDeleted: false }).session(session);
    if (!source || source.status !== "active" || !source.endAt || source.endAt > new Date()) return user;
    // Ghi cùng tài khoản với áp dụng hình phạt để các quyết định đồng thời không bị bỏ qua.
    const locked = await User.findOneAndUpdate({ _id: userId, status: "locked", temporaryLockId: user.temporaryLockId },
      { $inc: { __v: 1 } }, { new: true, runValidators: true, session });
    if (!locked) return user;
    if (await Violation.exists({ userId, ...effectivePenaltyFilter(),
      penaltyType: { $in: suspensionTypes } }).session(session)) return user;
    await User.updateOne({ _id: userId, temporaryLockId: user.temporaryLockId },
      { $set: { status: "active" }, $unset: { temporaryLockId: 1 } }, { session, runValidators: true });
    await Violation.updateMany({ userId, status: "active", isDeleted: false,
      penaltyType: "TEMPORARY_SUSPEND", endAt: { $lte: new Date() } },
      { $set: { status: "resolved" } }, { session, runValidators: true });
    user.status = "active";
    return user;
  });
};

export const refreshAccountLock = async (user: IUser) => {
  if (user.status !== "locked") return;
  const current = await refreshTemporaryLock(user._id as Types.ObjectId);
  if (current) user.status = current.status;
};

let lockMonitor: ReturnType<typeof setInterval> | undefined;
export const startTemporaryLockMonitor = () => {
  if (lockMonitor) return;
  let running = false;
  const scan = async () => {
    if (running) return;
    running = true;
    try {
      const expired = await Violation.find({ penaltyType: "TEMPORARY_SUSPEND", status: "active",
        isDeleted: false, endAt: { $lte: new Date() } }).select("userId").lean();
      for (const userId of new Set(expired.map((penalty) => String(penalty.userId)))) {
        await refreshTemporaryLock(userId);
      }
    } catch (error) {
      createLogger("PenaltyPolicy").error("Không thể kiểm tra thời hạn khóa tài khoản.", error);
    } finally { running = false; }
  };
  lockMonitor = setInterval(() => { void scan(); }, 60_000);
  lockMonitor.unref();
  void scan();
};

export const stopTemporaryLockMonitor = () => {
  if (lockMonitor) clearInterval(lockMonitor);
  lockMonitor = undefined;
};
