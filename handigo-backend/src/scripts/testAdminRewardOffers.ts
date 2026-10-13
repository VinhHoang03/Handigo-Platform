import assert from "node:assert/strict";
import { mock } from "node:test";
import mongoose, { Types } from "mongoose";
import { AuditLog } from "../models/auditLog.model";
import { Promotion } from "../models/promotion.model";
import { Order } from "../models/order.model";
import { RewardAccount, RewardTransaction } from "../models/reward.model";
import { getRewardOffers, updateConfig } from "../services/systemConfig.service";
import { getAdminRewardOffers, saveAdminRewardOffer, getRewardOverview, redeemReward } from "../services/reward.service";
import { getAdminVouchers, updateAdminVoucher, disableAdminVoucher, enableAdminVoucher, deleteAdminVoucher } from "../services/voucher.service";
import { rewardOfferSchema } from "../validations/reward.validator";
import { adminVoucherQuerySchema } from "../validations/voucher.validator";

// Cô lập database; kiểm tra cấu hình thật, cấp mã, phân quyền và quản lý mã cá nhân.
async function run() {
  const admin = { id: new Types.ObjectId().toString(), role: "ADMIN" as const };
  const customer = { id: new Types.ObjectId().toString(), role: "CUSTOMER" as const };
  const configs = new Map<string, any>();
  const transactions = new Map<string, any>();
  const promotions = new Map<string, InstanceType<typeof Promotion>>();
  const audits: any[] = [];
  let balance = 2000;
  let lastFilter: any;
  let reserved = false;
  const session = {};
  const query = <T>(value: T): any => Object.assign(Promise.resolve(value), {
    session: () => query(value), lean: () => query(value), sort: () => query(value),
    skip: () => query(value), limit: () => query(value),
  });
  const collection = {
    createIndex: async () => "key_1",
    findOne: async ({ key }: any) => configs.get(key) ?? null,
    find: () => ({ toArray: async () => [...configs.values()] }),
    insertOne: async (value: any) => {
      const row = { ...value, _id: new Types.ObjectId() }; configs.set(value.key, row);
      return { insertedId: row._id };
    },
    updateOne: async ({ key }: any, { $set }: any) => { Object.assign(configs.get(key), $set); return { matchedCount: 1 }; },
  };
  mock.method(mongoose.connection, "collection", () => collection as never);
  mock.method(mongoose.connection, "transaction", async (fn: any) => fn(session));
  mock.method(AuditLog, "create", async (rows: any) => { audits.push(rows); return rows; });
  mock.method(RewardAccount, "findById", () => query({ balance }));
  mock.method(RewardAccount, "findOneAndUpdate", (_filter: any, update: any) => {
    balance += update.$inc.balance; return query({ balance });
  });
  mock.method(RewardTransaction, "findById", (id: string) => query(transactions.get(id)));
  mock.method(RewardTransaction, "create", async (rows: any) => { transactions.set(rows[0]._id, rows[0]); return rows; });
  mock.method(Promotion, "create", async (rows: any) => {
    const voucher = new Promotion(rows[0]); promotions.set(voucher.id, voucher); return [voucher] as never;
  });
  mock.method(Promotion, "findById", (id: any) => query(promotions.get(String(id))));
  mock.method(Promotion, "findOne", ({ _id }: any) => query(promotions.get(String(_id))));
  mock.method(Promotion.prototype, "save", async function (this: InstanceType<typeof Promotion>) { return this; });
  mock.method(Promotion, "find", (filter: any) => { lastFilter = filter; return query([...promotions.values()]); });
  mock.method(Promotion, "countDocuments", () => query(promotions.size));
  mock.method(Order, "exists", () => query(reserved ? { _id: new Types.ObjectId() } : null));
  try {
    await assert.rejects(getAdminRewardOffers(customer), /quản trị viên/);
    const defaults = await getAdminRewardOffers(admin);
    assert.equal(defaults.length, 5);
    const offer = defaults.find((item) => item.id === "DEPOSIT100")!;
    assert.equal(offer.maxDiscountAmount, 30000);
    assert.equal(rewardOfferSchema.safeParse({ ...offer, discountValue: 101 }).success, false);
    assert.equal(rewardOfferSchema.safeParse({ ...offer, points: 0 }).success, false);
    assert.equal(rewardOfferSchema.safeParse({ ...offer, maxDiscountAmount: undefined }).success, false);
    assert.equal(rewardOfferSchema.safeParse({ ...offer, maxDiscountAmount: 30001 }).success, false);
    await assert.rejects(saveAdminRewardOffer(customer, offer), /quản trị viên/);
    await saveAdminRewardOffer(admin, { ...offer, points: 450 });
    assert.equal((await getRewardOffers()).find((item) => item.id === offer.id)!.points, 450);
    const voucher = (await redeemReward(customer.id, offer.id, "lan-doi-1"))!;
    assert.equal(balance, 1550);
    assert.equal(String(voucher.ownerId), customer.id);
    assert.equal(voucher.discountValue, 100);
    assert.equal(voucher.maxDiscountAmount, 30000);
    assert.equal(voucher.applicableOrderType, "variable_price");
    assert.equal(voucher.endAt.getTime() - voucher.startAt.getTime(), 30 * 86400000);
    await saveAdminRewardOffer(admin, { ...offer, points: 500, maxDiscountAmount: 20000, isActive: false });
    assert.equal(voucher.maxDiscountAmount, 30000, "Chỉnh sửa gói không đổi quyền lợi mã đã cấp.");
    assert.equal((await getRewardOverview(customer.id)).policy.offers.some((item) => item.id === offer.id), false);
    await assert.rejects(redeemReward(customer.id, offer.id, "lan-doi-2"), /ngừng áp dụng/);
    assert.equal((await redeemReward(customer.id, offer.id, "lan-doi-1"))!.id, voucher.id);
    assert.equal(balance, 1550, "Thử lại yêu cầu cũ không bị trừ điểm lần nữa dù gói đã tạm dừng.");
    const added = { ...defaults[0], id: "GOI-MOI", name: "Gói mới", points: 350 };
    await saveAdminRewardOffer(admin, added);
    assert.ok((await getRewardOverview(customer.id)).policy.offers.some((item) => item.id === added.id));
    await assert.rejects(updateConfig(admin, `REWARD_OFFER_${offer.id}`, { value: { ...offer, discountValue: 150 }, type: "JSON", isPublic: false }), /không|hợp lệ/);
    assert.ok(audits.length >= 3);
    const list = await getAdminVouchers(admin, adminVoucherQuerySchema.parse({ source: "reward", status: "ACTIVE" }));
    assert.deepEqual(lastFilter.ownerId, { $ne: null });
    assert.equal(lastFilter.$or, undefined, "Lọc trạng thái không tạo điều kiện OR rỗng.");
    assert.equal(String(list.items[0].ownerId), customer.id);
    assert.equal(list.items[0].applicableOrderType, "variable_price");
    await getAdminVouchers(admin, adminVoucherQuerySchema.parse({ source: "all" }));
    assert.equal(lastFilter.ownerId, undefined);
    await getAdminVouchers(admin, adminVoucherQuerySchema.parse({}));
    assert.equal(lastFilter.ownerId, null);
    await assert.rejects(getAdminVouchers(customer, adminVoucherQuerySchema.parse({})), /quản trị viên/);
    await assert.rejects(updateAdminVoucher(admin, voucher.id, { discountValue: 50 }), /giữ nguyên điều kiện/);
    await assert.rejects(disableAdminVoucher(customer, voucher.id), /quản trị viên/);
    await disableAdminVoucher(admin, voucher.id); assert.equal(voucher.isActive, false);
    await enableAdminVoucher(admin, voucher.id); assert.equal(voucher.isActive, true);
    voucher.reservedOrderId = new Types.ObjectId(); reserved = true;
    await assert.rejects(disableAdminVoucher(admin, voucher.id), /đang được giữ/);
    await assert.rejects(deleteAdminVoucher(admin, voucher.id), /đang được giữ/);
    reserved = false; voucher.usedCount = 1;
    await assert.rejects(deleteAdminVoucher(admin, voucher.id), /đã sử dụng/);
    voucher.usedCount = 0;
    await deleteAdminVoucher(admin, voucher.id); assert.equal(voucher.isDeleted, true);
    console.log("Đạt: quản lý gói đổi điểm, lưu cấu hình, cấp mã theo cấu hình, giữ quyền lợi cũ, lọc mã cá nhân, phân quyền và bảo vệ mã đang dùng.");
  } finally { mock.restoreAll(); }
}
run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
