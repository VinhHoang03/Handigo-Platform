const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function detail(order, payments = []) {
  const modules = {
    react: { useState: value => [value, () => {}] },
    'react-router-dom': { useParams: () => ({ bookingId: 'order' }) },
    './useBookingDetailData': { useBookingDetailData: () => ({ order, payments, quotation: null }) },
    './useMatchingCountdown': { useMatchingCountdown: () => ({}) },
    './useBookingCancellationFlow': { useBookingCancellationFlow: () => ({}) },
    './useBookingReassignmentFlow': { useBookingReassignmentFlow: () => ({}) },
    './useBookingPaymentFlow': { useBookingPaymentFlow: () => ({}) },
    './bookingDetailTimeline': { buildOrderTimeline: () => [] },
    './bookingDetailFormatters': { getPaymentStatusDisplay: () => ({}) },
    './bookingDetailProvider': { getProviderInfo: () => null },
    '@/utils/quotationPayment': { getAppliedQuotationDeposit: () => 0 },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,
    '../src/features/booking/components/detail/useBookingDetail.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => modules[name] ?? {} });
  return exports.useBookingDetail();
}

test('Khách được đổi phương thức sau nghiệm thu đơn cố định khi vẫn chưa thanh toán', () => {
  for (const status of ['in_progress', 'completed']) {
    assert.equal(detail({ status, inspectionRequired: false, paymentStatus: 'unpaid' }).canChangePayment, true);
  }
});

test('Ẩn đổi phương thức khi ví/QR/tiền mặt đã trả hoặc đơn bị hủy', () => {
  for (const paymentMethod of ['wallet', 'bank', 'cash']) {
    assert.equal(detail({ status: 'completed', inspectionRequired: false, paymentStatus: 'paid', paymentMethod }).canChangePayment, false);
  }
  assert.equal(detail({ status: 'cancelled', paymentStatus: 'unpaid' }).canChangePayment, false);
  assert.equal(detail({ status: 'completed', paymentStatus: 'unpaid' }, [{ paymentType: 'full', status: 'paid' }]).canChangePayment, false);
});
