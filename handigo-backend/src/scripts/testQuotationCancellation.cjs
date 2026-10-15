const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { calculateRefundPolicy, QUOTATION_DEPOSIT_POLICY_VERSION, isQuotationDeclinedReason } = require('../services/refundPolicy.service');
const { DEFAULT_REFUND_POLICY } = require('../validations/refundPolicy.validator');
let currentRefundPolicy = DEFAULT_REFUND_POLICY;

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
  assert.equal(result.refundAmount, 0);
  assert.equal(result.providerCompensation, 100000);
}
assert.equal(calculateRefundPolicy({ ...base, cancellationReason: 'Khách hàng không đồng ý báo giá: Giá vượt ngân sách' }).providerCompensation, 100000);
const mixed = calculateRefundPolicy({ ...base, paidAmount: 400000 });
assert.equal(mixed.refundAmount, 300000);
assert.equal(mixed.providerCompensation, 100000);
for (const hasRepairQuotation of [false, true]) {
  for (const cancellationReason of [undefined, '', 'Khách hàng không đồng ý báo giá',
    'Không thể sửa chữa hoặc thực hiện dịch vụ', 'Khách hàng cung cấp thông tin chưa đầy đủ',
    'Không thể liên hệ với khách hàng', 'Lịch hẹn không còn phù hợp', 'Lý do khác',
    'Lý do khác: Khách hàng không đồng ý báo giá']) {
    const result = calculateRefundPolicy({ ...base, hasRepairQuotation, cancellationReason });
    const transferDeposit = hasRepairQuotation;
    assert.equal(result.providerCompensation, transferDeposit ? 100000 : 0);
    assert.equal(result.refundAmount, transferDeposit ? 0 : 100000);
  }
}
for (const orderType of ['normal', 'urgent', 'scheduled', 'recurring']) {
  for (const hasRepairQuotation of [false, true]) {
    const accepted = calculateRefundPolicy({ ...base, role: 'customer', orderType, hasRepairQuotation,
      scheduledAt: new Date(Date.now() - 1000) });
    assert.equal(accepted.canCancel, true);
    assert.equal(accepted.providerCompensation, 100000);
    assert.equal(accepted.refundAmount, 0);
    const unassigned = calculateRefundPolicy({ ...base, role: 'customer', orderType, hasRepairQuotation: false,
      orderStatus: 'created', hasAssignedProvider: false });
    assert.equal(unassigned.refundAmount, 100000);
    assert.equal(unassigned.providerCompensation, 0);
  }
}
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
  './systemConfig.service': { getRefundPolicy: async () => currentRefundPolicy },
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
  + '\nexport const testFunctions = { getPaymentRefundAmount, compensateProviderPayments, requestPayosRefund, calculateOrderRefundPolicy, getStoredCompensationRate };';
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const context = { exports: {}, require: name => modules[name] || (name === 'crypto' ? require('crypto') : {}), Date, process: { pid: 1 } };
vm.runInNewContext(js, context);
const helpers = context.exports.testFunctions;
const order = { _id: 'order', providerId: 'provider', orderCode: 'KIEM_THU', cancellation: { refundPolicy: mixed } };
assert.equal(helpers.getStoredCompensationRate(order), 1);
assert.equal(helpers.getStoredCompensationRate({ cancellation: { refundPolicy: { policyVersion: 'HANDIGO_REFUND_V1', providerCompensationRate: 35 } } }), 0.35);
assert.equal(helpers.getStoredCompensationRate({ cancellation: { refundPolicy: { policyVersion: 'HANDIGO_REFUND_V1' } } }), 0.8);
assert.equal(helpers.getPaymentRefundAmount(order, payments[0]), 0);
assert.equal(helpers.getPaymentRefundAmount(order, payments[1]), 300000);
(async () => {
  const quotedOrder = { ...order, status: 'accepted', orderType: 'normal', inspectionRequired: true, currentQuotationId: 'quote' };
  const awaitingOrder = { ...quotedOrder, currentQuotationId: null };
  for (const reason of [base.cancellationReason, 'Lý do khác', undefined]) {
    const awaitingPolicy = await helpers.calculateOrderRefundPolicy(awaitingOrder, 'provider', 100000, new Date(), {}, reason);
    assert.equal(awaitingPolicy.providerCompensation, 0);
    assert.equal(awaitingPolicy.refundAmount, 100000);
  }
  const validPolicy = await helpers.calculateOrderRefundPolicy(quotedOrder, 'provider', 400000, new Date(), {}, base.cancellationReason);
  assert.equal(validPolicy.providerCompensation, 100000);
  assert.equal(validPolicy.refundAmount, 300000);
  assert.equal((await helpers.calculateOrderRefundPolicy({ ...quotedOrder, status: 'in_progress' }, 'provider', 100000)).canCancel, false);
  const otherReason = await helpers.calculateOrderRefundPolicy(quotedOrder, 'provider', 100000, new Date(), {}, 'Không thể liên hệ với khách hàng');
  assert.equal(otherReason.refundAmount, 0);
  assert.equal(otherReason.providerCompensation, 100000);
  await helpers.compensateProviderPayments(order, {});
  await helpers.compensateProviderPayments(order, {});
  assert.equal(wallet.balance, 150000);
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].amount, 100000);
  assert.equal(payments[0].compensatedToProviderId, 'provider');
  assert.equal(payments[1].compensatedToProviderId, null);
  // Không gọi cổng hoàn tiền khi khoản cọc được chuyển toàn bộ cho thợ.
  await helpers.requestPayosRefund(payments[0], order, 'Kiểm thử', 0);
  payments.splice(0, payments.length, { _id: 'custom', paymentType: 'full', amount: 100000, status: 'paid', compensatedToProviderId: null });
  const customOrder = { ...order, cancellation: { refundPolicy: { policyVersion: 'HANDIGO_REFUND_V1', refundRate: 60, providerCompensationRate: 35 } } };
  currentRefundPolicy = { ...DEFAULT_REFUND_POLICY, normalRefundPercent: 60, providerCompensationPercent: 35 };
  const calculated = await helpers.calculateOrderRefundPolicy({ ...customOrder, status: 'accepted', orderType: 'normal' }, 'customer', 100000);
  assert.equal(calculated.refundAmount, 60000);
  assert.equal(calculated.providerCompensation, 14000);
  currentRefundPolicy = { ...DEFAULT_REFUND_POLICY, normalRefundPercent: 10, providerCompensationPercent: 95 };
  await helpers.compensateProviderPayments(customOrder, {});
  await helpers.compensateProviderPayments(customOrder, {});
  assert.equal(wallet.balance, 164000);
  assert.equal(transactions.length, 2);
  assert.equal(transactions[1].amount, 14000);
  assert.equal(payments[0].metadata.cancellationCompensation.rate, 35);
  // Tiền cọc được xác nhận sau khi hủy vẫn dùng người nhận đã chốt theo lần hủy.
  const latePolicy = calculateRefundPolicy({ ...base, role: 'customer', paidAmount: 0, paidInspectionDeposit: 0, hasRepairQuotation: false });
  assert.equal(latePolicy.policyVersion, QUOTATION_DEPOSIT_POLICY_VERSION);
  payments.splice(0, payments.length, { _id: 'late', paymentType: 'inspection_deposit', amount: 40000, status: 'paid', compensatedToProviderId: null });
  const lateOrder = { ...order, cancellation: { refundPolicy: latePolicy } };
  assert.equal(helpers.getPaymentRefundAmount(lateOrder, payments[0]), 0);
  await helpers.compensateProviderPayments(lateOrder, {});
  await helpers.compensateProviderPayments(lateOrder, {});
  assert.equal(wallet.balance, 204000);
  assert.equal(transactions.length, 3);
  assert.equal(transactions[2].amount, 40000);
  console.log('Đạt: cọc vào ví thợ đúng một lần, hoàn khoản trả thêm, giữ chính sách cũ và không hoàn PayOS số tiền 0.');
})().catch(error => { console.error(error); process.exitCode = 1; });
