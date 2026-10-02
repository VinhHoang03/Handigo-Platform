const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { calculateRefundPolicy, QUOTATION_DEPOSIT_POLICY_VERSION, isQuotationDeclinedReason } = require('../services/refundPolicy.service');

// Kiểm tra chính sách và ghi ví bằng dữ liệu cô lập, không kết nối cổng tiền hoặc database.
const base = { role: 'provider', orderType: 'normal', orderStatus: 'accepted', hasAssignedProvider: true,
  inspectionRequired: true, hasRepairQuotation: true, paidAmount: 100000, paidInspectionDeposit: 100000,
  cancellationReason: 'Khách hàng không đồng ý báo giá' };
const policy = calculateRefundPolicy(base);
assert.equal(policy.refundAmount, 0);
assert.equal(policy.providerCompensation, 100000);
assert.equal(policy.platformRetainedAmount, 0);
for (const cancellationReason of [undefined, '', 'Không thể sửa chữa hoặc thực hiện dịch vụ', 'Không thể liên hệ với khách hàng', 'Lý do khác: Khách hàng không đồng ý báo giá']) {
  const result = calculateRefundPolicy({ ...base, cancellationReason });
  assert.equal(result.refundAmount, 100000);
  assert.equal(result.providerCompensation, 0);
}
assert.equal(calculateRefundPolicy({ ...base, cancellationReason: 'Khách hàng không đồng ý báo giá: Giá vượt ngân sách' }).providerCompensation, 100000);
const mixed = calculateRefundPolicy({ ...base, paidAmount: 400000 });
assert.equal(mixed.refundAmount, 300000);
assert.equal(mixed.providerCompensation, 100000);
assert.equal(calculateRefundPolicy({ ...base, hasRepairQuotation: false }).providerCompensation, 100000);
assert.equal(calculateRefundPolicy({ ...base, hasRepairQuotation: false, cancellationReason: 'Lý do khác' }).providerCompensation, 100000);
assert.equal(calculateRefundPolicy({ ...base, inspectionRequired: false }).refundAmount, 100000);
assert.equal(calculateRefundPolicy({ ...base, role: 'admin' }).refundAmount, 100000);
assert.equal(calculateRefundPolicy({ ...base, paidInspectionDeposit: 0, paidAmount: 0 }).providerCompensation, 0);
assert.equal(calculateRefundPolicy({ ...base, orderStatus: 'in_progress' }).canCancel, false);

const payments = [
  { _id: 'deposit', paymentType: 'inspection_deposit', amount: 100000, status: 'paid', compensatedToProviderId: null },
  { _id: 'remaining', paymentType: 'remaining', amount: 300000, status: 'paid', compensatedToProviderId: null },
];
const wallet = { _id: 'wallet', balance: 50000, save: async () => {} };
const transactions = [];
const sessionResult = (data) => ({ session: async () => data });
const modules = {
  '../utils/appError': { AppError: class extends Error {} },
  '../configs/payos.config': {},
  '../services/refundPolicy.service': { calculateRefundPolicy, QUOTATION_DEPOSIT_POLICY_VERSION },
  './refundPolicy.service': { calculateRefundPolicy, QUOTATION_DEPOSIT_POLICY_VERSION, isQuotationDeclinedReason },
  '../models/provider.model': { Provider: { findOne: () => ({ select: () => sessionResult({ _id: 'provider', userId: 'worker' }) }) } },
  '../models/payment.model': { Payment: {
    find: (query) => sessionResult(payments.filter(p => !p.compensatedToProviderId
      && (!query.paymentType || query.paymentType === p.paymentType))),
    findOneAndUpdate: async (query, update) => {
      const payment = payments.find(p => p._id === query._id && p.compensatedToProviderId === null);
      if (!payment) return null;
      Object.assign(payment, update.$set);
      return payment;
    },
  } },
  '../models/wallet.model': { Wallet: { findOne: () => sessionResult(wallet) } },
  '../models/walletTransaction.model': { WalletTransaction: { create: async (rows) => transactions.push(...rows) } },
  '../utils/transaction': { buildTransactionCode: () => 'KIEM_THU' },
  '../utils/logger': { createLogger: () => ({}) },
};
const source = fs.readFileSync(require.resolve('../services/orderCancellation.service'), 'utf8')
  + '\nexport const testFunctions = { getPaymentRefundAmount, compensateProviderPayments, requestPayosRefund, calculateOrderRefundPolicy };';
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const context = { exports: {}, require: name => modules[name] || (name === 'crypto' ? require('crypto') : {}), Date, process: { pid: 1 } };
vm.runInNewContext(js, context);
const helpers = context.exports.testFunctions;
const order = { _id: 'order', providerId: 'provider', orderCode: 'KIEM_THU', cancellation: { refundPolicy: mixed } };
assert.equal(helpers.getPaymentRefundAmount(order, payments[0]), 0);
assert.equal(helpers.getPaymentRefundAmount(order, payments[1]), 300000);
(async () => {
  const quotedOrder = { ...order, status: 'accepted', orderType: 'normal', inspectionRequired: true, currentQuotationId: 'quote' };
  const awaitingOrder = { ...quotedOrder, currentQuotationId: null };
  for (const reason of [base.cancellationReason, 'Lý do khác', undefined]) {
    const awaitingPolicy = await helpers.calculateOrderRefundPolicy(awaitingOrder, 'provider', 100000, new Date(), {}, reason);
    assert.equal(awaitingPolicy.providerCompensation, 100000);
    assert.equal(awaitingPolicy.refundAmount, 0);
  }
  const validPolicy = await helpers.calculateOrderRefundPolicy(quotedOrder, 'provider', 400000, new Date(), {}, base.cancellationReason);
  assert.equal(validPolicy.providerCompensation, 100000);
  assert.equal(validPolicy.refundAmount, 300000);
  await assert.rejects(helpers.calculateOrderRefundPolicy({ ...quotedOrder, status: 'in_progress' }, 'provider', 100000, new Date(), {}, base.cancellationReason));
  await assert.rejects(helpers.calculateOrderRefundPolicy({ ...awaitingOrder, inspectionRequired: false }, 'provider', 100000, new Date(), {}, base.cancellationReason));
  const otherReason = await helpers.calculateOrderRefundPolicy(quotedOrder, 'provider', 100000, new Date(), {}, 'Không thể liên hệ với khách hàng');
  assert.equal(otherReason.refundAmount, 100000);
  assert.equal(otherReason.providerCompensation, 0);
  await helpers.compensateProviderPayments(order, {});
  await helpers.compensateProviderPayments(order, {});
  assert.equal(wallet.balance, 150000);
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].amount, 100000);
  assert.equal(payments[0].compensatedToProviderId, 'provider');
  assert.equal(payments[1].compensatedToProviderId, null);
  // Không gọi cổng hoàn tiền khi khoản cọc được chuyển toàn bộ cho thợ.
  await helpers.requestPayosRefund(payments[0], order, 'Kiểm thử', 0);
  console.log('Đạt: cọc vào ví thợ đúng một lần, hoàn khoản trả thêm, giữ chính sách cũ và không hoàn PayOS số tiền 0.');
})().catch(error => { console.error(error); process.exitCode = 1; });
