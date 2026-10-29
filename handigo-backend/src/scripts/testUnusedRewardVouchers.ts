import assert from "node:assert/strict";
import { mock } from "node:test";
import { Types } from "mongoose";
import { Voucher } from "../models/voucher.model";
import { Promotion } from "../models/promotion.model";
import { Order } from "../models/order.model";
import { getMyRewardVouchers } from "../services/reward.service";

const run = async () => {
  const ownerId = new Types.ObjectId();
  const reservedOrderId = new Types.ObjectId();
  const rows = Array.from({ length: 28 }, (_, index) => ({
    _id: new Types.ObjectId(), ownerId, isDeleted: false, code: `MA${index}`,
    createdAt: new Date(1700000000000 + index), usedCount: index % 2,
    reservedOrderId: index === 0 ? reservedOrderId : null,
  }));
  const legacy = { ...rows[0]!, _id: new Types.ObjectId(), code: "MACU", usedCount: undefined };
  const otherOwner = { ...rows[0]!, _id: new Types.ObjectId(), ownerId: new Types.ObjectId() };
  const deleted = { ...rows[0]!, _id: new Types.ObjectId(), isDeleted: true };
  const matching = (items: typeof rows, filter: any) => {
    const condition = filter.$and?.[0] ?? filter;
    assert.deepEqual(condition.usedCount, { $not: { $gt: 0 } });
    return items.filter((row) => String(row.ownerId) === String(condition.ownerId)
      && row.isDeleted === false && !(Number(row.usedCount ?? 0) > 0));
  };
  mock.method(Voucher, "find", (filter: any) => Promise.resolve(matching([...rows, otherOwner, deleted], filter)) as never);
  mock.method(Promotion, "find", (filter: any) => Promise.resolve(matching([legacy] as never, filter)) as never);
  mock.method(Order, "find", () => ({ select: () => ({ lean: async () => [
    { _id: reservedOrderId, voucherSnapshot: { voucherId: rows[0]!._id } },
  ] }) }) as never);
  try {
    const first = await getMyRewardVouchers(String(ownerId), 1);
    const second = await getMyRewardVouchers(String(ownerId), 2);
    assert.equal(first.total, 15);
    assert.equal(first.totalPages, 2);
    assert.equal(first.items.length, 12);
    assert.equal(second.items.length, 3);
    const items = [...first.items, ...second.items];
    assert.ok(items.every((item) => !item.usedCount));
    assert.equal(new Set(items.map((item) => String(item._id))).size, 15);
    assert.ok(items.some((item) => item.code === legacy.code), "Mã cũ thiếu bộ đếm vẫn hiển thị.");
    assert.equal(String(items.find((item) => item.code === rows[0]!.code)?.reservedOrderId), String(reservedOrderId),
      "Mã đang giữ cho đơn vẫn hiển thị nếu chưa sử dụng.");
    console.log("Đạt: ẩn mã đã sử dụng, phân trang đúng, giữ mã cũ và mã đang giữ cho đơn, bảo vệ ownership.");
  } finally { mock.restoreAll(); }
};
run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
