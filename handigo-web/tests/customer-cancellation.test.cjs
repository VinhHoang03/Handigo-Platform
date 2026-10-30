const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function setup(order) {
  let now = 0;
  let cursor = 0;
  let tick;
  let cleanup;
  const states = [], calls = [], messages = [], effects = [];
  const filename = path.join(__dirname, '../src/features/booking/components/detail/useBookingCancellationFlow.ts');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const modules = {
    axios: { isAxiosError: () => false },
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
        return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
      },
      useEffect(fn) { effects.push(fn); },
    },
    '@/components/common/Toast': { useToast: () => ({ addToast: message => messages.push(message) }) },
    '@/features/booking/api/booking.api': { bookingApi: {
      async getCancellationPreview() {
        calls.push('preview'); return { canCancel: true, items: [], paidAmount: 120000, refundAmount: 120000, cancellationFee: 0 };
      },
      async cancelOrder() { calls.push('cancel'); },
    } },
    '@/utils/apiError': { getErrorMessage: (_, fallback) => fallback },
    './bookingDetailConstants': { getCustomerCancellationReasons: () => ['Không còn nhu cầu sử dụng dịch vụ', 'Lý do khác'] },
  };
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    Date: class extends Date { static now() { return now; } },
    window: { setInterval(fn) { tick = fn; return 1; }, clearInterval() { tick = null; } },
    require(name) {
      if (!(name in modules)) throw new Error(`Module chưa được giả lập: ${name}`);
      return modules[name];
    },
  }, { filename });
  function render() {
    cursor = 0;
    const result = exports.useBookingCancellationFlow(order, null, false, () => {}, async () => {});
    cleanup?.();
    cleanup = effects.pop()?.();
    return result;
  }
  return { render, calls, messages, advance(value) { now = value; tick?.(); } };
}

for (const status of ['accepted']) {
  test(`${status}: khóa hủy sau 5 phút mà không cần tải lại trang`, async () => {
    const context = setup({ _id: 'don-kiem-thu', status, customerCancellationDeadline: new Date(300000).toISOString() });
    assert.equal(context.render().cancellationLocked, false);
    context.advance(300000);
    assert.equal(context.render().cancellationLocked, false);
    context.advance(300001);
    const expired = context.render();
    assert.equal(expired.cancellationLocked, true);
    await expired.handleCancelOrder();
    assert.deepEqual(context.calls, []);
  });
}

test('Hạn hủy 8 phút từ backend được giữ đúng đến biên, không tự khóa theo 5 phút cũ', () => {
  const context = setup({ _id: 'don-cau-hinh', status: 'accepted', customerCancellationDeadline: new Date(480000).toISOString() });
  context.render();
  context.advance(300001);
  assert.equal(context.render().cancellationLocked, false);
  context.advance(480000);
  assert.equal(context.render().cancellationLocked, false);
  context.advance(480001);
  assert.equal(context.render().cancellationLocked, true);
});

test('Thợ đã bắt đầu: khóa hủy ngay dù còn trong thời hạn 5 phút', async () => {
  const order = { _id: 'don-kiem-thu', status: 'accepted', customerCancellationDeadline: new Date(300000).toISOString() };
  const context = setup(order);
  await context.render().handleCancelOrder();
  context.render().updateActionReason('Thay đổi kế hoạch');
  order.status = 'in_progress';
  assert.equal(context.render().cancellationLocked, true);
  await context.render().executePendingAction();
  await context.render().handleCancelOrder();
  assert.deepEqual(context.calls, ['preview']);
  assert.match(context.messages[0], /Thợ đã bắt đầu làm việc/);
});

test('Hộp thoại đã mở cũng không gửi yêu cầu hủy khi quá hạn', async () => {
  const context = setup({ _id: 'don-kiem-thu', status: 'accepted', customerCancellationDeadline: new Date(300000).toISOString() });
  await context.render().handleCancelOrder();
  context.render().updateActionReason('Thay đổi kế hoạch');
  context.advance(300001);
  await context.render().executePendingAction();
  assert.deepEqual(context.calls, ['preview']);
  assert.match(context.messages[0], /hết thời hạn hủy/);
});

test('Đơn chưa có thợ vẫn được hủy, đơn đã nhận thiếu mốc xác minh bị khóa', () => {
  assert.equal(setup({ status: 'created' }).render().cancellationLocked, false);
  assert.equal(setup({ status: 'accepted' }).render().cancellationLocked, true);
});

test('Khóa hủy ngay khi đúng thợ xác nhận đến nơi, kể cả hộp thoại đã mở trong 5 phút', async () => {
  const order = { _id: 'don-thu', status: 'accepted', providerId: { _id: 'tho-A' }, customerCancellationDeadline: new Date(300000).toISOString() };
  const app = setup(order);
  await app.render().handleCancelOrder();
  app.render().updateActionReason('Không còn nhu cầu sử dụng dịch vụ');
  order.arrival = { providerId: 'tho-A', arrivedAt: new Date().toISOString() };
  assert.equal(app.render().cancellationLocked, true);
  await app.render().executePendingAction();
  assert.deepEqual(app.calls, ['preview']);
  assert.match(app.messages[0], /đã xác nhận đến nơi/);
  order.arrival.providerId = 'tho-cu';
  assert.equal(app.render().cancellationLocked, false);
});
