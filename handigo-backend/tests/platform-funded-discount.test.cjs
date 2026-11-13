const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(relative, modules = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, "../src", relative), "utf8");
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, require: (name) => modules[name] ?? {}, Date, URL, process,
  });
  return exports;
}

const bookingPolicy = load("utils/bookingPolicy.ts");
const settlement = load("utils/orderSettlement.ts", { "./bookingPolicy": bookingPolicy });

function pricing(discount = 12000) {
  return {
    bookingAmount: 120000, baseAmount: 120000, totalPaidAmount: 120000 - discount,
    voucherDiscountAmount: discount, promotionDiscountAmount: 0,
    platformCommissionRate: .15,
    platformCommissionAmount: Math.round((120000 - discount) * .15),
    providerEarningAmount: Math.round((120000 - discount) * .85),
  };
}

test("Voucher nền tảng không làm giảm thu nhập thợ hoặc cơ sở tính phí", () => {
  for (const discount of [0, 12000, 50000, 120000]) {
    const result = settlement.getOrderSettlement(pricing(discount));
    assert.equal(result.platformCommissionAmount, 18000);
    assert.equal(result.providerEarningAmount, 102000);
    assert.equal(result.customerPaidAmount, 120000 - discount);
    assert.equal(result.platformDiscountAmount, discount);
  }
});

test("Đơn báo giá tiếp tục ghi cọc thực thu cho nền tảng", () => {
  const result = settlement.getOrderSettlement(pricing(), true);
  assert.equal(result.platformCommissionAmount, 108000);
  assert.equal(result.providerEarningAmount, 0);
  assert.equal(result.platformDiscountAmount, 0);
});

test("Đơn cũ chưa quyết toán được tính lại; lịch sử đã quyết toán giữ số đã ghi", () => {
  const pending = { status: "accepted", inspectionRequired: false, pricing: pricing() };
  assert.equal(settlement.withPendingOrderSettlement(pending).pricing.providerEarningAmount, 102000);
  assert.equal(pending.pricing.providerEarningAmount, 91800);
  const completed = { ...pending, status: "completed", paymentStatus: "paid" };
  assert.equal(settlement.withPendingOrderSettlement(completed), completed);
  const unpaidCash = { ...pending, status: "completed", paymentStatus: "unpaid" };
  assert.equal(settlement.withPendingOrderSettlement(unpaidCash).pricing.providerEarningAmount, 102000);
});

test("Áp dụng và gỡ voucher tại service giữ phí và thu nhập theo giá gốc", async () => {
  const order = {
    _id: "order", customerId: "customer", status: "created",
    inspectionRequired: false, pricing: pricing(0), voucherSnapshot: null,
  };
  const voucher = {
    _id: "voucher", name: "Ưu đãi nền tảng", code: "GIAM10",
    discountType: "PERCENT", discountValue: 10, usedCount: 0, reservedCount: 0,
    isActive: true, status: "ACTIVE", isDeleted: false,
    startAt: new Date("2020-01-01"), endAt: new Date("2100-01-01"),
  };
  const query = (value) => ({
    session() { return this; }, select() { return this; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  });
  const modules = {
    mongoose: { __esModule: true, default: { startSession: async () => ({
      withTransaction: async (fn) => fn(), async endSession() {},
    }) } },
    "../utils/orderSettlement": settlement,
    "../utils/appError": { AppError: Error },
    "./penaltyPolicy.service": { assertFeatureAllowed: async () => {} },
    "./voucherStore.service": {
      findStoredVoucher: async () => voucher,
      updateStoredVoucher: async () => ({ modifiedCount: 1 }),
    },
    "../models/payment.model": { Payment: { findOne: () => query(null) } },
    "../models/voucherUsage.model": { VoucherUsage: {
      exists: () => query(true), findOneAndUpdate: () => query(null),
    } },
    "../models/order.model": { Order: {
      findById: () => query(order),
      findOneAndUpdate: async (_, update, options) => {
        assert.equal(options.runValidators, true);
        for (const [field, value] of Object.entries(update.$set)) {
          if (field.startsWith("pricing.")) order.pricing[field.slice(8)] = value;
          else order[field] = value;
        }
        return order;
      },
    } },
  };
  const service = load("services/voucher.service.ts", modules);
  const user = { id: "customer", role: "CUSTOMER" };
  const applied = await service.applyVoucher(user, { orderId: "order", code: "GIAM10" });
  assert.equal(applied.finalAmount, 108000);
  assert.equal(order.pricing.platformCommissionAmount, 18000);
  assert.equal(order.pricing.providerEarningAmount, 102000);
  await service.removeVoucher(user, { orderId: "order" });
  assert.equal(order.pricing.totalPaidAmount, 120000);
  assert.equal(order.pricing.providerEarningAmount, 102000);
});

function walletFixture(method, discount, initialBalance = 100000) {
  const ledger = [];
  const query = (value) => ({
    session() { return Promise.resolve(value); },
    select() { return this; },
  });
  const wallet = { _id: "wallet", balance: initialBalance, async save() {} };
  class AppError extends Error {
    constructor(message, statusCode) { super(message); this.statusCode = statusCode; }
  }
  const modules = {
    "../utils/appError": { AppError },
    "../utils/orderSettlement": settlement,
    "../models/user.model": { default: { findById: () => query({ status: "active", isDeleted: false }) } },
    "../models/wallet.model": { Wallet: { findOne: () => query(wallet) } },
    "../models/walletTransaction.model": { WalletTransaction: {
      findOne: () => query(ledger.find((item) => ["provider_earning", "platform_fee"].includes(item.type)) ?? null),
      async create(items) { ledger.push(...items); return items; },
    } },
    "../utils/transaction": { buildTransactionCode: (prefix) => prefix },
  };
  const service = load("services/wallet.service.ts", modules);
  const order = {
    _id: "order", orderCode: "HD-001", pricing: pricing(discount),
    inspectionRequired: false, paymentMethod: method,
  };
  const provider = { _id: "provider", userId: "user" };
  return { wallet, ledger, order, settle: () => service.recordCompletedOrderSettlement(order, provider, {}) };
}

for (const method of ["wallet", "bank", "cash"]) {
  for (const discount of [0, 12000, 50000, 120000]) {
    test(`Quyết toán ${method}, ưu đãi ${discount}đ giữ đủ 102.000đ cho thợ`, async () => {
      const fixture = walletFixture(method, discount);
      await fixture.settle();
      const walletChange = fixture.wallet.balance - 100000;
      const cashReceived = method === "cash" ? 120000 - discount : 0;
      assert.equal(walletChange + cashReceived, 102000);
      assert.equal(fixture.order.pricing.platformCommissionAmount, 18000);
      assert.equal(fixture.order.pricing.providerEarningAmount, 102000);
      const income = fixture.ledger
        .filter((item) => item.type === "provider_earning" || item.type === "platform_fee")
        .reduce((sum, item) => sum + (item.direction === "in" ? item.amount : -item.amount), 0);
      assert.equal(income, 102000);
      const cashMovements = fixture.ledger
        .filter((item) => item.metadata.affectsWalletBalance)
        .reduce((sum, item) => sum + (item.direction === "in" ? item.amount : -item.amount), 0);
      assert.equal(cashMovements, walletChange);
      await assert.rejects(fixture.settle(), /đã được ghi nhận/);
    });
  }
}

test("Tiền mặt được dùng khoản tài trợ để trả phí, chặn số dư không đủ", async () => {
  const subsidized = walletFixture("cash", 50000, 0);
  await subsidized.settle();
  assert.equal(subsidized.wallet.balance, 32000);
  const insufficient = walletFixture("cash", 12000, 0);
  await assert.rejects(insufficient.settle(), /Số dư ví không đủ/);
  assert.equal(insufficient.ledger.length, 0);
  assert.equal(insufficient.wallet.balance, 0);
});
