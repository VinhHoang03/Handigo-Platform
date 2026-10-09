import assert from "node:assert/strict";
import { mock } from "node:test";
import { Types, type PipelineStage } from "mongoose";
import { WalletTransaction } from "../models/walletTransaction.model";
import { Provider } from "../models/provider.model";
import User from "../models/user.model";
import { walletTransactionQuerySchema } from "../validations/wallet.validator";

// Cô lập cổng thanh toán và database; không nạp cấu hình bí mật.
require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {} } } as NodeModule;
const { getWalletTransactionHistory } = require("../services/wallet.service") as typeof import("../services/wallet.service");

async function run() {
  const userId = new Types.ObjectId();
  const earning = { _id: new Types.ObjectId(), userId, type: "provider_earning" };
  mock.method(Provider, "findOne", async () => ({ userId }));
  mock.method(User, "findById", () => ({ select: () => ({ session: async () => ({ status: "active", isDeleted: false }) }) }));
  let calls = 0;
  mock.method(WalletTransaction, "aggregate", async (pipeline: PipelineStage[]) => {
    calls++;
    const filter = (pipeline[0] as PipelineStage.Match).$match;
    // Aggregate không ép kiểu chuỗi ID như find; mô phỏng khớp đúng kiểu BSON.
    const matches = filter.userId instanceof Types.ObjectId && filter.userId.equals(userId);
    const items = matches && (!filter.type || filter.type === earning.type) ? [earning] : [];
    return [{ items, count: items.length ? [{ total: items.length }] : [] }];
  });
  const user = { id: userId.toHexString(), role: "PROVIDER" as const };
  for (const type of [undefined, "provider_earning"] as const) {
    const query = walletTransactionQuerySchema.parse({ groupSettlements: "true", type, page: 1, limit: 5 });
    const result = await getWalletTransactionHistory(user, query);
    assert.equal(result.items.length, 1, "Lịch sử gộp phải tìm thấy giao dịch của đúng chủ ví.");
    assert.equal(result.pagination.total, 1);
    assert.equal(result.pagination.totalPages, 1);
  }
  assert.equal(calls, 2);
  assert.equal(walletTransactionQuerySchema.parse({ groupSettlements: "false" }).groupSettlements, false);
  console.log("Đạt: bộ lọc tất cả/thu nhập tìm đúng giao dịch khi ID người dùng từ JWT là chuỗi.");
}

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => mock.restoreAll());
