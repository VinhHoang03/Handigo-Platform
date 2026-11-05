const { test } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');
const QRCode = require('qrcode');
const { WalletTransaction } = require('../src/models/walletTransaction.model');
const { getPayosWalletDepositQr } = require('../src/services/payosQr.service');
const user = { id: '507f1f77bcf86cd799439011', role: 'CUSTOMER' };

test('QR nạp ví chỉ lấy giao dịch đang chờ của chủ ví và mã hóa nguyên dữ liệu PayOS', async t => {
  const payload = '000201-payOS-125000';
  t.mock.method(WalletTransaction, 'findOne', filter => {
    assert.deepEqual(filter, { userId: user.id, gatewayOrderCode: '12345', type: 'deposit', isDeleted: false });
    return { lean: async () => ({ status: 'pending', gatewayResponse: { paymentLink: { qrCode: payload } } }) };
  });
  t.mock.method(QRCode, 'toBuffer', async text => {
    assert.equal(text, payload);
    return Buffer.from('ảnh QR');
  });
  assert.deepEqual(await getPayosWalletDepositQr('12345', user), Buffer.from('ảnh QR'));
  assert.deepEqual(await getPayosWalletDepositQr('12345', { ...user, role: 'PROVIDER' }), Buffer.from('ảnh QR'));
});

test('Chặn sai quyền, không tìm thấy, giao dịch đã kết thúc và thiếu dữ liệu QR', async t => {
  await assert.rejects(getPayosWalletDepositQr('12345', { ...user, role: 'ADMIN' }), { statusCode: 403 });
  let transaction = null;
  t.mock.method(WalletTransaction, 'findOne', () => ({ lean: async () => transaction }));
  await assert.rejects(getPayosWalletDepositQr('12345', user), { statusCode: 404 });
  for (const status of ['success', 'cancelled', 'failed']) {
    transaction = { status };
    await assert.rejects(getPayosWalletDepositQr('12345', user), { statusCode: 409 });
  }
  transaction = { status: 'pending', gatewayResponse: {} };
  await assert.rejects(getPayosWalletDepositQr('12345', user), { statusCode: 409 });
});
