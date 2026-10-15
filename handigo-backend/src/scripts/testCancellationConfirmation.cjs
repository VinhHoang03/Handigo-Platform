const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { Types } = require('mongoose');
const { calculateRefundPolicy } = require('../services/refundPolicy.service');
const { ActionPreconditionError } = require('../utils/actionPreconditionError');
const { cancelOrderSchema, cancelRecurringSeriesSchema } = require('../validations/order.validator');

// Chạy nguyên hàm giao dịch hủy với database và dịch vụ tiền được cô lập.
const source = fs.readFileSync(require.resolve('../services/orderCancellation.service'), 'utf8');
const ast = ts.createSourceFile('cancellation.ts', source, ts.ScriptTarget.Latest, true);
const declarations = [];
for (const node of ast.statements) {
  if (ts.isVariableStatement(node) && node.declarationList.declarations.some(item =>
    ['cancelOrdersWithSettlement', 'cancelOrderWithSettlement'].includes(item.name.getText(ast)))) {
    declarations.push(node.getText(ast));
  }
}
assert.equal(declarations.length, 2);
let orders = [];
let ledger = [];
let settled = [];
let notified = [];
let active = false;
const actorId = String(new Types.ObjectId());
const session = {
  withTransaction: async callback => {
    const snapshots = orders.map(order => ({ ...order }));
    const previousLedger = [...ledger];
    active = true;
    try { return await callback(); }
    catch (error) { orders.forEach((order, index) => { for (const key of Object.keys(order)) delete order[key]; Object.assign(order, snapshots[index]); }); ledger = previousLedger; throw error; }
    finally { active = false; }
  },
  endSession: async () => {},
};
const context = {
  exports: {}, Types, Date, AppError: require('../utils/appError').AppError, ActionPreconditionError,
  mongoose: { startSession: async () => session }, CANCELLABLE_STATUSES: ['created', 'accepted'],
  assertObjectId: value => assert.equal(Types.ObjectId.isValid(value), true),
  assertCancellationAccess: async order => assert.equal(String(order.customerId), actorId),
  getPaidOrderAmount: async () => 40000,
  calculateOrderRefundPolicy: async (order, role, paidAmount) => calculateRefundPolicy({
    role, orderType: order.orderType, orderStatus: order.status, hasAssignedProvider: Boolean(order.providerId),
    paidAmount, paidInspectionDeposit: paidAmount, inspectionRequired: true, hasRepairQuotation: false,
  }),
  Order: {
    findById: id => {
      const order = orders.find(item => String(item._id) === id);
      return { session: async () => order, then: (resolve, reject) => Promise.resolve(order).then(resolve, reject) };
    },
    findOneAndUpdate: async (query, update, options) => {
      assert.equal(active, true); assert.equal(options.session, session);
      const order = orders.find(item => String(item._id) === String(query._id) && item.status === query.status);
      return order ? Object.assign(order, update.$set) : null;
    },
  },
  OrderAssignment: { updateMany: async () => {} }, Payment: { updateMany: async () => {} },
  Provider: { updateOne: async () => {} }, releaseVoucherReservation: async () => {}, releaseOrderPromotion: async () => {},
  refundWalletPayments: async order => { ledger.push({ orderId: String(order._id), refund: order.cancellation.refundPolicy.refundAmount }); return []; },
  compensateProviderPayments: async order => { ledger.push({ orderId: String(order._id), compensation: order.cancellation.refundPolicy.providerCompensation }); },
  refreshCancelledOrderPaymentStatus: async () => {},
  settleCancelledOrderPayments: async id => { assert.equal(active, false); settled.push(id); },
  notifyCancellation: async order => { assert.equal(active, false); notified.push(String(order._id)); },
  emitToUser: () => { assert.equal(active, false); },
  cancellationLogger: { error() {} },
};
vm.runInNewContext(ts.transpileModule(declarations.join('\n'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const { cancelOrdersWithSettlement, cancelOrderWithSettlement } = context.exports;
const makeOrder = assigned => ({ _id: new Types.ObjectId(), customerId: actorId, status: assigned ? 'accepted' : 'created',
  providerId: assigned ? new Types.ObjectId() : null, orderType: 'normal', inspectionRequired: true });
const fullRefund = { paidAmount: 40000, refundAmount: 40000, cancellationFee: 0, providerCompensation: 0 };
const providerCredit = { paidAmount: 40000, refundAmount: 0, cancellationFee: 40000, providerCompensation: 40000 };
const input = (order, confirmedExpectation) => ({ orderId: String(order._id), actorId, role: 'customer', reason: 'Thay đổi lịch', confirmedExpectation });

(async () => {
  assert.equal(cancelOrderSchema.parse({ reason: 'Thay đổi lịch', confirmedExpectation: fullRefund }).confirmedExpectation.refundAmount, 40000);
  assert.equal(cancelOrderSchema.safeParse({ reason: 'Thay đổi lịch', confirmedExpectation: { ...fullRefund, refundAmount: -1 } }).success, false);
  assert.equal(cancelRecurringSeriesSchema.safeParse({ reason: 'Thay đổi lịch', confirmedExpectations: [{ orderId: String(new Types.ObjectId()), ...fullRefund }] }).success, true);
  orders = [makeOrder(true)];
  await assert.rejects(cancelOrderWithSettlement(input(orders[0], fullRefund)), error => error instanceof ActionPreconditionError);
  assert.equal(orders[0].status, 'accepted');
  assert.equal(ledger.length, 0); assert.equal(settled.length, 0); assert.equal(notified.length, 0);
  await cancelOrderWithSettlement(input(orders[0], providerCredit));
  assert.equal(orders[0].status, 'cancelled');
  assert.equal(ledger.find(item => item.compensation !== undefined).compensation, 40000);
  assert.equal(settled.length, 1);

  orders = [makeOrder(false), makeOrder(true)]; ledger = []; settled = []; notified = [];
  await assert.rejects(cancelOrdersWithSettlement(orders.map(order => input(order, fullRefund))), error => error instanceof ActionPreconditionError);
  assert.equal(orders[0].status, 'created', 'Hoàn tác cả buổi đã xử lý khi buổi sau đổi tiền hoàn');
  assert.equal(orders[1].status, 'accepted');
  assert.equal(ledger.length, 0); assert.equal(settled.length, 0); assert.equal(notified.length, 0);
  const result = await cancelOrdersWithSettlement([input(orders[0], fullRefund), input(orders[1], providerCredit)]);
  assert.equal(result.length, 2); assert.equal(result.every(order => order.status === 'cancelled'), true);
  assert.equal(settled.length, 2); assert.equal(notified.length, 2);
  orders = [makeOrder(false)]; ledger = []; settled = []; notified = [];
  orders[0].reassignment = { automatic: true, status: 'matching' };
  const timeoutInput = { orderId: String(orders[0]._id), role: 'admin', system: true,
    systemCancellationType: 'provider_unavailable', reason: 'Không tìm thấy thợ phù hợp trong bán kính 10 km sau thời gian tìm kiếm.' };
  await cancelOrderWithSettlement(timeoutInput);
  assert.equal(orders[0].status, 'cancelled');
  assert.equal(ledger.find(item => item.refund !== undefined).refund, 40000);
  assert.equal(ledger.find(item => item.compensation !== undefined).compensation, 0);
  orders = [makeOrder(true)]; ledger = [];
  await cancelOrderWithSettlement({ ...timeoutInput, orderId: String(orders[0]._id) });
  assert.equal(orders[0].status, 'accepted', 'Thợ mới đã nhận thì không hủy bởi tác vụ hết hạn tìm kiếm.');
  assert.equal(ledger.length, 0);
  console.log('Đã kiểm tra xác nhận tiền hoàn, chặn dữ liệu cũ, xác nhận lại và hoàn tác cả chuỗi lịch.');
})().catch(error => { console.error(error); process.exitCode = 1; });
