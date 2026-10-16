const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Chạy trực tiếp hai hàm thanh toán với database và cổng tiền được cô lập.
const source = fs.readFileSync(require.resolve('../services/payment.service.ts'), 'utf8');
const ast = ts.createSourceFile('payment.ts', source, ts.ScriptTarget.Latest, true);
const functions = [];
function visit(node) {
  if (ts.isVariableDeclaration(node) && ['createWalletPayment', 'syncPaidPayosPaymentToOrder'].includes(node.name.getText(ast))) {
    functions.push(`const ${node.getText(ast)};`);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.equal(functions.length, 2);
const js = ts.transpileModule(functions.join('\n') + '\nexports.wallet = createWalletPayment; exports.payos = syncPaidPayosPaymentToOrder;', {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
async function check(method, orderType, paymentType = 'full', status = 'created', paid = 100000, paymentStatus = 'unpaid') {
  const order = { _id: 'order', customerId: 'customer', orderType, status, inspectionRequired: paymentType === 'inspection_deposit',
    pricing: { totalPaidAmount: 100000, baseAmount: 100000 }, paymentStatus, readyForMatching: false, save: async () => {} };
  let dispatchCount = 0;
  const session = { withTransaction: fn => fn(), endSession: async () => {} };
  const context = {
    exports: {}, mongoose: { startSession: async () => session },
    Order: { findById: () => ({ session: async () => order }) },
    Payment: { findOne: () => ({ session: async () => null }), create: async rows => [{ ...rows[0], _id: 'payment' }], aggregate: () => ({ session: async () => [{ total: paid }] }) },
    Wallet: { findOneAndUpdate: async () => ({ _id: 'wallet', balance: 200000 }) },
    WalletTransaction: { create: async () => {} },
    assertAppointmentPaymentReady() {}, getPaymentAmount: async () => 100000, assertConfirmedPayment() {},
    buildTransactionCode: () => 'KIEM_THU', markOrderVoucherAsUsed: async () => {},
    triggerDispatch: () => { dispatchCount++; }, createNotificationRecord: async () => {},
    AppError: Error, rethrowDuplicatePaymentError: error => { throw error; },
  };
  vm.runInNewContext(js, context);
  let dispatch;
  if (method === 'wallet') {
    await context.exports.wallet(order, paymentType, 100000);
    dispatch = dispatchCount === 1;
  } else {
    dispatch = await context.exports.payos({ orderId: order._id, paymentType, amount: paid }, session);
  }
  const expected = status === 'created' && paymentType !== 'remaining' && (paymentType === 'inspection_deposit' || paid >= 100000);
  assert.equal(dispatch, expected, `${method}/${orderType}/${paymentType}/${status}/${paid}`);
  assert.equal(order.readyForMatching, expected);
  if (expected && orderType !== 'normal') assert.equal(order.bookingStatus, 'awaiting_provider');
  return order;
}
(async () => {
  for (const method of ['wallet', 'payos']) {
    for (const type of ['normal', 'scheduled', 'recurring']) {
      await check(method, type);
      await check(method, type, 'inspection_deposit');
      await check(method, type, 'remaining', 'accepted');
      await check(method, type, 'full', 'accepted');
    }
  }
  await check('payos', 'scheduled', 'full', 'created', 50000);
  const confirmedQuotationOrder = await check('payos', 'normal', 'inspection_deposit', 'in_progress', 40000, 'paid');
  assert.equal(confirmedQuotationOrder.paymentStatus, 'paid', 'Webhook cọc lặp không hạ trạng thái đơn báo giá đã thanh toán.');
  const depositOnlyOrder = await check('payos', 'normal', 'inspection_deposit', 'in_progress', 40000);
  assert.equal(depositOnlyOrder.paymentStatus, 'partially_paid', 'Đơn mới chỉ thanh toán cọc vẫn được ghi nhận thanh toán một phần.');
  console.log('Đạt: điều phối sau thanh toán ví/PayOS cho giá cố định, lịch hẹn và định kỳ; chặn trả thiếu và thanh toán bổ sung.');
})().catch(error => { console.error(error); process.exitCode = 1; });
