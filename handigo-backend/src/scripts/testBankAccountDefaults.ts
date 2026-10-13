import assert from "node:assert/strict";
import { mock } from "node:test";
import mongoose, { Types } from "mongoose";
import { BankAccount } from "../models/bankAccount.model";
import { createMyBankAccount, updateMyBankAccount, setDefaultMyBankAccount } from "../services/bankAccount.service";

async function run() {
  const user = { id: new Types.ObjectId().toString(), role: "CUSTOMER" as const };
  const firstId = new Types.ObjectId().toString(); const secondId = new Types.ObjectId().toString();
  let rows: any[] = [{ _id: firstId, userId: user.id, isDefault: true, isDeleted: false, status: "active" },
    { _id: secondId, userId: user.id, isDefault: false, isDeleted: false, status: "active" }];
  let fail = false;
  const session = {};
  const query = <T>(value: T): any => ({ session: (valueSession: unknown) => { assert.equal(valueSession, session); return Promise.resolve(value); } });
  const matches = (row: any, filter: any) => String(row.userId) === String(filter.userId) && !row.isDeleted &&
    (!filter._id || (filter._id.$ne ? row._id !== filter._id.$ne : row._id === String(filter._id)));
  mock.method(mongoose.connection, "transaction", async (fn: any) => {
    const before = structuredClone(rows);
    try { return await fn(session); } catch (error) { rows = before; throw error; }
  });
  mock.method(BankAccount, "countDocuments", () => query(rows.length));
  mock.method(BankAccount, "findOne", (filter: any) => query(rows.find((row) => matches(row, filter)) ?? null));
  mock.method(BankAccount, "updateMany", async (filter: any, update: any, options: any) => {
    assert.equal(options.session, session); assert.equal(options.runValidators, true);
    for (const row of rows.filter((item) => matches(item, filter))) Object.assign(row, update.$set);
    return {} as never;
  });
  mock.method(BankAccount, "create", async (values: any, options: any) => {
    assert.equal(options.session, session);
    if (fail) throw Object.assign(new Error("Trùng tài khoản giả lập."), { code: 11000 });
    const row = { _id: new Types.ObjectId().toString(), isDeleted: false, ...values[0] }; rows.push(row); return [row] as never;
  });
  mock.method(BankAccount, "findOneAndUpdate", async (filter: any, update: any, options: any) => {
    assert.equal(options.session, session); assert.equal(options.runValidators, true);
    if (fail) throw Object.assign(new Error("Trùng tài khoản giả lập."), { code: 11000 });
    const row = rows.find((item) => matches(item, filter)); if (row) Object.assign(row, update); return row as never;
  });
  const defaultId = () => rows.find((row) => row.isDefault)?._id;
  try {
    fail = true;
    await assert.rejects(createMyBankAccount(user, { bankName: "Ngân hàng kiểm thử", bankCode: "THU", accountNumber: "123456", accountHolderName: "Khách thử", isDefault: true }), /đã tồn tại/);
    assert.equal(defaultId(), firstId, "Tạo thất bại phải giữ tài khoản mặc định cũ.");
    await assert.rejects(updateMyBankAccount(user, secondId, { isDefault: true, accountNumber: "123456" }), /đã tồn tại/);
    assert.equal(defaultId(), firstId, "Cập nhật thất bại cũng phải khôi phục mặc định cũ.");
    fail = false;
    await setDefaultMyBankAccount(user, secondId);
    assert.equal(defaultId(), secondId); assert.equal(rows.filter((row) => row.isDefault).length, 1);
    await assert.rejects(setDefaultMyBankAccount(user, new Types.ObjectId().toString()), /Không tìm thấy/);
    assert.equal(defaultId(), secondId);
    console.log("Đạt: mặc định ngân hàng được đổi trong transaction, rollback khi tạo/sửa lỗi và kiểm tra quyền sở hữu.");
  } finally { mock.restoreAll(); }
}
run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
