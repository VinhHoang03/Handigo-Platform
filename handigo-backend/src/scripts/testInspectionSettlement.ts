import assert from "node:assert/strict";
import { mock } from "node:test";
import { Types, type ClientSession } from "mongoose";
import { Wallet } from "../models/wallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import User from "../models/user.model";
import type { IOrder } from "../models/order.model";
import type { IProvider } from "../models/provider.model";
import { calculateBookingSettlement } from "../utils/bookingPolicy";

// Không khởi tạo PayOS hoặc kết nối database trong kiểm thử quyết toán.
const payosPath = require.resolve("../configs/payos.config");
require.cache[payosPath] = { exports: { payos: {} } } as NodeModule;
const { recordCompletedOrderSettlement } = require("../services/wallet.service") as typeof import("../services/wallet.service");

async function run() {
  const provider = { _id: new Types.ObjectId(), userId: new Types.ObjectId() } as IProvider;
  for (const method of ["bank", "wallet"] as const) {
    for (const total of [40000, 60000]) {
      const wallet = { _id: new Types.ObjectId(), balance: 100000, save: async () => {} };
      const entries: any[] = [];
      let duplicate = false;
      mock.method(User, "findById", () => ({ select: () => ({ session: async () => ({ status: "active" }) }) }));
      mock.method(Wallet, "findOne", () => ({ session: async () => wallet }));
      mock.method(WalletTransaction, "findOne", () => ({ session: async () => duplicate ? entries[0] : null }));
      mock.method(WalletTransaction, "create", async (documents: any[]) => {
        entries.push(...documents);
        return documents;
      });
      const order = {
        _id: new Types.ObjectId(), orderCode: "KIEM-THU", inspectionRequired: true,
        paymentMethod: method,
        pricing: { totalPaidAmount: total, ...calculateBookingSettlement(total, 0, true) },
      } as IOrder;
      const session = {} as ClientSession;
      await recordCompletedOrderSettlement(order, provider, session);
      assert.equal(wallet.balance, 100000);
      assert.equal(entries[0].amount, 0);
      assert.equal(entries[0].description, null);
      assert.equal(entries[0].balanceAfter, wallet.balance);
      assert.equal(entries[1].amount, total);
      assert.equal(entries[1].description, null);
      assert.equal(entries[1].metadata.affectsWalletBalance, false);
      assert.equal(entries[1].metadata.systemRevenueOnly, true);
      assert.equal(entries[1].balanceAfter, wallet.balance);
      duplicate = true;
      await assert.rejects(recordCompletedOrderSettlement(order, provider, session));
      assert.equal(wallet.balance, 100000);
      assert.equal(entries.length, 2);
      mock.restoreAll();
    }
  }
  console.log("Đã kiểm tra tiền cọc thuộc hệ thống, số dư ví thợ và chống quyết toán trùng.");
}

run().catch((error) => { mock.restoreAll(); console.error(error); process.exitCode = 1; });
