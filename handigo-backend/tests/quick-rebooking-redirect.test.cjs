const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const exportsForTest = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,
  '../src/utils/paymentRedirect.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsForTest, URL, require: name => name === './appError'
  ? { AppError: Error } : { isAllowedOrigin: () => true } });
const { buildOrderPaymentRedirects } = exportsForTest;
const currentId = '507f1f77bcf86cd799439011';
const sourceId = '507f1f77bcf86cd799439012';
const origin = 'https://handigo.example.test';

test('Hủy và quay lại PayOS mở form trên danh sách dịch vụ, thành công vẫn dùng đơn mới', () => {
  const urls = buildOrderPaymentRedirects(currentId, origin, {
    clientCancelUrl: `${origin}/customer/services?quickRebook=${sourceId}&next=https://khac.example.test`,
  });
  const cancel = new URL(urls.cancelUrl);
  assert.equal(cancel.origin, origin);
  assert.equal(cancel.pathname, '/customer/services');
  assert.equal(cancel.searchParams.get('quickRebook'), sourceId);
  assert.equal(cancel.searchParams.get('payos'), 'cancel');
  assert.equal(cancel.searchParams.has('next'), false);
  assert.equal(new URL(urls.returnUrl).searchParams.get('orderId'), currentId);
  assert.equal(new URL(urls.returnUrl).searchParams.get('payos'), 'success');
});

test('Đường dẫn đặt lại nhanh cũ cũng được chuyển về danh sách dịch vụ', () => {
  const cancel = new URL(buildOrderPaymentRedirects(currentId, origin, {
    clientCancelUrl: `${origin}/customer/bookings/${sourceId}?quickRebook=1`,
  }).cancelUrl);
  assert.equal(cancel.pathname, '/customer/services');
  assert.equal(cancel.searchParams.get('quickRebook'), sourceId);
});

test('Luồng đặt thường giữ nguyên trang thanh toán khi hủy QR', () => {
  const urls = buildOrderPaymentRedirects(currentId, origin, {
    clientCancelUrl: `${origin}/customer/bookings/new/payment`,
  });
  assert.equal(urls.cancelUrl, `${origin}/customer/bookings/new/payment?payos=cancel`);
});

for (const requested of [
  `https://khac.example.test/customer/services?quickRebook=${sourceId}`,
  `${origin}/customer/services?quickRebook=khong-hop-le`,
  `https://khac.example.test/customer/bookings/${sourceId}?quickRebook=1`,
  `${origin}/customer/bookings/khong-hop-le?quickRebook=1`,
  `${origin}/customer/bookings/${sourceId}/tracking?quickRebook=1`,
  `${origin}/customer/bookings/${sourceId}?quickRebook=0`,
]) {
  test(`Không mở rộng quyền chuyển hướng ngoài danh sách được phép: ${requested}`, () => {
    const cancel = new URL(buildOrderPaymentRedirects(currentId, origin, { clientCancelUrl: requested }).cancelUrl);
    assert.equal(cancel.origin, origin);
    assert.equal(cancel.pathname, `/customer/bookings/${currentId}`);
    assert.equal(cancel.searchParams.has('quickRebook'), false);
  });
}
