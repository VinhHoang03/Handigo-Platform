const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules = {}, globals = {}) {
  const filename = path.join(__dirname, '../src', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, Error, URL: { createObjectURL: (file) => `blob:${file.name}`, revokeObjectURL() {} },
    ...globals,
    require: (name) => name in modules ? modules[name] : require(name),
  }, { filename });
  return exports;
}

function hooks() {
  const state = [];
  let cursor = 0;
  return {
    reset: () => { cursor = 0; },
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
        return [state[index], (value) => {
          state[index] = typeof value === 'function' ? value(state[index]) : value;
        }];
      },
      useMemo: (callback) => callback(), useEffect() {}, useId: () => 'anh-danh-gia',
    },
  };
}

function find(element, predicate) {
  if (!element || typeof element !== 'object') return undefined;
  if (predicate(element)) return element;
  for (const child of [element.props?.children].flat(Infinity)) {
    const result = find(child, predicate);
    if (result) return result;
  }
}

function textContent(element) {
  if (element == null || typeof element === 'boolean') return '';
  if (typeof element !== 'object') return String(element);
  return [element.props?.children].flat(Infinity).map(textContent).join(' ');
}

test('Hủy đơn phải xác nhận lại tiền hoàn mới khi thợ nhận đơn trong lúc modal đang mở', async () => {
  const runtime = hooks();
  const oldPreview = { scope: 'single', canCancel: true, paidAmount: 40000, refundAmount: 40000,
    cancellationFee: 0, providerCompensation: 0, items: [{ orderId: 'don' }] };
  const newPreview = { ...oldPreview, refundAmount: 0, cancellationFee: 40000, providerCompensation: 40000 };
  let preview = oldPreview;
  let busy = false;
  let failRefresh = false;
  let loaded = 0;
  const calls = [];
  const { useBookingCancellationFlow } = load('features/booking/components/detail/useBookingCancellationFlow.ts', {
    react: runtime.react,
    axios: { isAxiosError: (error) => Boolean(error.isAxiosError) },
    '@/components/common/Toast': { useToast: () => ({ addToast() {} }) },
    '@/utils/apiError': { getErrorMessage: () => 'Thông tin đã thay đổi.' },
    '@/features/booking/api/booking.api': { bookingApi: {
      getCancellationPreview: async () => { if (failRefresh) throw new Error('Mất kết nối'); return preview; },
      cancelOrder: async (id, reason, expectation) => {
        calls.push({ id, reason, expectation });
        if (calls.length === 1) { preview = newPreview; throw { isAxiosError: true, response: { status: 409 } }; }
      },
    } },
  });
  const render = () => {
    runtime.reset();
    return useBookingCancellationFlow({ _id: 'don', status: 'created' }, null, busy,
      (value) => { busy = value; }, async () => { loaded++; });
  };
  await render().handleCancelOrder();
  render().updateActionReason('Thay đổi lịch');
  await render().executePendingAction();
  assert.equal(calls.length, 1, 'Không tự hủy lại sau khi nhận tiền hoàn mới');
  assert.equal(calls[0].expectation.refundAmount, 40000);
  assert.equal(render().cancellationPreview.refundAmount, 0);
  assert.ok(render().pendingAction.error.includes('xác nhận lại'));
  assert.equal(loaded, 1);
  await render().executePendingAction();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].expectation.refundAmount, 0);
  assert.equal(calls[1].expectation.providerCompensation, 40000);
  assert.equal(render().pendingAction, null);

  await render().handleCancelOrder();
  render().updateActionReason('Thay đổi lịch');
  failRefresh = true;
  // Giữ modal lỗi tải xem trước thì không được gửi yêu cầu hủy.
  await render().handleCancelOrder();
  await render().executePendingAction();
  assert.equal(calls.length, 2);
});

test('Hủy chuỗi lịch gửi số tiền đã xem của từng buổi và không tự gửi lại khi có xung đột', async () => {
  const runtime = hooks();
  const items = [{ orderId: 'buoi-1', paidAmount: 40000, refundAmount: 40000, cancellationFee: 0, providerCompensation: 0 },
    { orderId: 'buoi-2', paidAmount: 40000, refundAmount: 0, cancellationFee: 40000, providerCompensation: 40000 }];
  const preview = { scope: 'series', canCancel: true, items };
  const calls = [];
  let requests = 0;
  const { useBookingCancellationFlow } = load('features/booking/components/detail/useBookingCancellationFlow.ts', {
    react: runtime.react,
    axios: { isAxiosError: () => true },
    '@/components/common/Toast': { useToast: () => ({ addToast() {} }) },
    '@/utils/apiError': { getErrorMessage: () => 'Chuỗi lịch đã thay đổi.' },
    '@/features/booking/api/booking.api': { bookingApi: {
      getCancellationPreview: async (_, scope) => { assert.equal(scope, 'series'); requests++; return preview; },
      cancelRecurringSeries: async (id, reason, expectations) => {
        calls.push({ id, reason, expectations });
        throw { response: { status: 409 } };
      },
    } },
  });
  const render = () => {
    runtime.reset();
    return useBookingCancellationFlow({ _id: 'chuoi', orderType: 'recurring', status: 'accepted',
      customerCancellationDeadline: new Date(Date.now() + 300000).toISOString() }, null, false, () => {}, async () => {});
  };
  await render().handleCancelSeries();
  render().updateActionReason('Thay đổi lịch');
  await render().executePendingAction();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].expectations, items);
  assert.equal(requests, 2);
  assert.equal(render().pendingAction.type, 'cancelSeries');
});

test('API hủy giữ nguyên thông tin số tiền xác nhận cho đơn và chuỗi lịch', async () => {
  const calls = [];
  const { bookingApi } = load('features/booking/api/booking.api.ts', {
    '@/api/client': { patch: async (url, body) => { calls.push({ url, body }); return { data: { data: {} } }; } },
  });
  const expectation = { paidAmount: 40000, refundAmount: 40000, cancellationFee: 0, providerCompensation: 0 };
  const items = [{ orderId: 'buoi-1', ...expectation }];
  await bookingApi.cancelOrder('don', 'Thay đổi lịch', expectation);
  await bookingApi.cancelRecurringSeries('chuoi', 'Thay đổi lịch', items);
  assert.equal(calls[0].body.confirmedExpectation, expectation);
  assert.equal(calls[1].body.confirmedExpectations, items);
});

const customerPolicies = {
  paymentHoldMinutes: 20,
  matching: { initialRadiusKm: 7, expandedRadiusKm: 15, expandAfterMinutes: 2,
    expandedDurationMinutes: 4, providerResponseSeconds: 45 },
  fixedPriceRefund: { normalRefundPercent: 60, missingScheduleRefundPercent: 40,
    earlyHours: 48, middleHours: 12, lateHours: 3, earlyRefundPercent: 95,
    middleRefundPercent: 75, lateRefundPercent: 45, lastMinuteRefundPercent: 10 },
};

test('Modal có đủ chính sách hai loại dịch vụ, lịch hẹn và dùng số liệu cấu hình đang có', () => {
  const { BookingPolicyContent } = load('features/booking/components/BookingPolicyContent.tsx');
  const text = textContent(BookingPolicyContent({ policies: customerPolicies, depositAmount: 40000, payableDeposit: 20000 }));
  for (const phrase of ['giá cố định', 'khảo sát và báo giá', 'đặt ngay', 'hẹn giờ', 'định kỳ',
    'giữ nguyên cọc', 'Khách hủy khi chưa có thợ nhận', 'Khách hủy khi thợ đã nhận đơn',
    'Thợ hủy sau khi đã báo giá', 'đã bắt đầu thực hiện', 'sau ưu đãi']) assert.ok(text.includes(phrase), phrase);
  assert.match(text, /5 phút/);
  assert.match(text, /100% khoản đã thanh toán về ví Handigo/);
  assert.doesNotMatch(text, /60%|95%|48 giờ/);
  assert.match(text, /7.*km/);
  assert.match(text, /15.*km/);
  assert.match(text, /40\.000đ/);
  assert.match(text, /20\.000đ/);
});

test('Bấm liên kết xanh chỉ mở modal; khách phải chủ động đồng ý, có thể bỏ tích', () => {
  const runtime = hooks();
  let accepted = false;
  const { BookingPolicyConsent } = load('features/booking/components/BookingPolicyConsent.tsx', {
    react: runtime.react, '@/components/common/Modal': { Modal: 'modal' },
    './BookingPolicyContent': { BookingPolicyContent: 'policy-content' },
  });
  const render = (extra = {}) => {
    runtime.reset();
    return BookingPolicyConsent({ policies: customerPolicies, loading: false, error: '', accepted,
      disabled: false, onChange: (value) => { accepted = value; }, ...extra });
  };
  const link = find(render(), (node) => node.type === 'button' && textContent(node) === 'chính sách Handigo');
  assert.match(link.props.className, /text-blue-600/);
  assert.equal(find(render(), (node) => node.type === 'input').props.checked, false);
  link.props.onClick();
  assert.equal(accepted, false);
  let modal = find(render(), (node) => node.type === 'modal');
  assert.equal(modal.props.open, true);
  find(modal.props.footer, (node) => node.type === 'button' && textContent(node) === 'Đồng ý với chính sách').props.onClick();
  assert.equal(accepted, true);
  assert.equal(find(render(), (node) => node.type === 'modal').props.open, false);
  find(render(), (node) => node.type === 'input').props.onChange({ target: { checked: false } });
  assert.equal(accepted, false);
  assert.equal(find(render({ loading: true }), (node) => node.type === 'input').props.disabled, true);
  modal = find(render({ error: 'Không tải được chính sách' }), (node) => node.type === 'modal');
  assert.equal(find(modal.props.footer, (node) => textContent(node) === 'Đồng ý với chính sách').props.disabled, true);
});

test('Xác nhận đặt đơn chặn mọi phương thức thanh toán nếu chưa đồng ý chính sách', async () => {
  const calls = [];
  const errors = [];
  const saved = new Map();
  const { runConfirmPaymentSubmit } = load('features/booking/components/confirmPaymentSubmit.ts', {
    '@/features/booking/api/booking.api': { bookingApi: {
      createOrder: async () => { calls.push('create'); return { _id: 'don-moi' }; },
      createPayment: async (payload) => { calls.push(payload.method); return { payment: { status: 'pending' }, checkoutUrl: 'https://thanh-toan.test' }; },
      getOrderById: async () => ({ _id: 'don-moi' }),
    } },
    '@/api/tokenStorage': { tokenStorage: { prepareExternalRedirect() {} } },
    '@/utils/airConditionerCleaning': { isAirConditionerCleaning: () => false },
    './step2Helpers': { getEarliestScheduledAt: () => new Date(0) },
    './confirmPaymentSubmitTypes': { getConfirmPaymentErrorMessage: () => 'Lỗi kiểm thử' },
    './pendingBookingRecovery': { PENDING_ORDER_ID_KEY: 'order', PENDING_ORDER_FINGERPRINT_KEY: 'fingerprint',
      PENDING_ORDER_VOUCHER_KEY: 'voucher', clearPendingBooking() {} },
  }, { sessionStorage: { setItem: (key, value) => saved.set(key, value) }, window: { location: {} } });
  const params = { serviceId: 'dich-vu', addressId: 'dia-chi', orderType: 'normal',
    service: { serviceType: 'fixed_price' }, selectedOptionIds: [], customerAttachments: [],
    voucherCode: '', pendingOrderId: '', bookingFingerprint: 'don', isOptionSelectionMissing: false,
    setPaymentError: (message) => errors.push(message), setVoucherError() {}, setIsSubmitting() {},
    setPendingOrderId() {}, reset() {}, navigate() {} };
  for (const effectivePaymentMethod of ['cash', 'wallet', 'bank']) {
    await runConfirmPaymentSubmit({ ...params, policyAccepted: false, effectivePaymentMethod });
  }
  assert.deepEqual(calls, []);
  assert.equal(errors.length, 3);
  assert.ok(errors.every((message) => message.includes('đồng ý với chính sách Handigo')));
  for (const effectivePaymentMethod of ['cash', 'wallet', 'bank']) {
    await runConfirmPaymentSubmit({ ...params, policyAccepted: true, effectivePaymentMethod });
  }
  assert.deepEqual(calls, ['create', 'CASH', 'create', 'WALLET', 'create', 'PAYOS']);
});

test('Khung hoàn tiền ẩn với tiền mặt; đơn đang thực hiện không còn nút hoặc form hủy', () => {
  const { BookingRefundPanel } = load('features/booking/components/detail/BookingRefundPanel.tsx', {
    '@/components/common/Modal': { Modal: 'modal' },
    './bookingDetailConstants': { getActionDialogConfig: () => ({ title: 'Hủy', message: 'Xác nhận', tone: 'danger' }) },
    './BookingCancellationPreviewCard': { BookingCancellationPreviewCard: 'refund-policy' },
    './BookingCancellationReasonForm': { BookingCancellationReasonForm: 'reason-form' },
    './bookingDetailFormatters': { formatCurrency: (amount) => `${amount}đ` },
  });
  const render = (inspectionRequired, accepted, overrides = {}) => BookingRefundPanel({
    order: { inspectionRequired, status: accepted ? 'accepted' : 'created', providerId: accepted ? 'tho' : null,
      paymentMethod: 'bank', ...overrides },
    busy: false, pendingAction: { type: 'cancelOrder', reason: '' },
    cancellationPreview: { canCancel: true, providerCompensation: 0, refundAmount: 40000 },
  });
  const awaiting = render(true, false);
  assert.ok(find(awaiting, (node) => node.type === 'refund-policy'));
  assert.match(textContent(awaiting), /hoàn lại cho bạn \(100%\)/);
  const accepted = render(true, true);
  assert.ok(find(accepted, (node) => node.type === 'refund-policy'));
  assert.doesNotMatch(textContent(accepted), /Khi chưa có thợ nhận|chuyển vào ví thợ/);
  assert.ok(find(render(false, true), (node) => node.type === 'refund-policy'));
  assert.equal(find(render(false, true, { paymentMethod: 'cash' }), (node) => node.type === 'refund-policy'), undefined);
  const started = render(false, true, { status: 'in_progress' });
  assert.equal(find(started, (node) => node.type === 'modal'), undefined);
  assert.doesNotMatch(textContent(started), /Hủy yêu cầu/);
});

test('Form hủy của thợ chỉ xác nhận hủy nhận đơn và lý do hủy', () => {
  const { CancellationDialog, CancelConfirmationDialog } = load('features/provider/components/orders/CancelOrderDialogs.tsx', {
    '@/components/common/Modal': { Modal: 'modal' },
  });
  for (const reason of ['Khách hàng không đồng ý báo giá', 'Không thể sửa chữa hoặc thực hiện dịch vụ', 'Lý do khác']) {
    const props = { reason, busy: false, canDeclineQuotation: true, explanation: '', error: '' };
    const confirmation = CancelConfirmationDialog(props);
    assert.equal(confirmation.props.title, 'Xác nhận hủy đơn?');
    assert.match(textContent(confirmation), /Bạn xác nhận hủy nhận đơn dịch vụ này/);
    assert.match(textContent(confirmation), new RegExp(reason));
    assert.ok(find(confirmation, (node) => node.type === 'button' && textContent(node).trim() === 'Hủy đơn'));
    assert.doesNotMatch(textContent(CancellationDialog(props)) + textContent(confirmation), /tìm thợ thay thế|chuyển vào ví|gán.*thợ khác/);
  }
});

function feedbackForm(images = []) {
  const runtime = hooks();
  const calls = [];
  const toasts = [];
  const { FeedbackForm } = load('features/feedback/components/FeedbackForm.tsx', {
    react: runtime.react,
    '@/components/common/Toast': { useToast: () => ({ addToast: (message) => toasts.push(message) }) },
    '@/components/common/FloatingField': { FloatingTextarea: 'textarea' },
    '@/components/common/RatingStars': { RatingStars: 'stars' },
  });
  const render = () => {
    runtime.reset();
    return FeedbackForm({ orderId: 'don-hang', feedback: { rating: 5, images },
      save: async (payload, files) => calls.push({ payload, files }) });
  };
  return {
    render, calls, toasts,
    select: (files) => find(render(), (node) => node.type === 'input').props.onChange({ target: { files } }),
    submit: () => render().props.onSubmit({ preventDefault() {} }),
  };
}

const image = (name) => ({ name, type: 'image/png', size: 1024, lastModified: 1 });

test('Cấu hình hoàn tiền và tích điểm dùng trường nhập có nhãn, giữ các giá trị khác khi sửa', () => {
  const policies = load('features/admin/components/system-configs/business-policies.ts');
  const { BusinessPolicyFields } = load('features/admin/components/system-configs/BusinessPolicyFields.tsx', {
    './business-policies': policies,
  });
  for (const [configKey, defaults, field, nextValue] of [
    ['REFUND_POLICY', policies.defaultRefundPolicy, 'Phần phí hủy được bồi thường cho thợ (%)', 35],
    ['REWARD_POLICY', policies.defaultRewardPolicy, 'Hạn dùng mã đổi điểm kể từ khi đổi (ngày)', 7],
  ]) {
    let value = JSON.stringify(defaults);
    const tree = BusinessPolicyFields({ configKey, value, onChange: (next) => { value = next; } });
    const label = find(tree, (node) => node.type === 'label' && node.props.children[0].props.children === field);
    const input = find(label, (node) => node.type === 'input');
    assert.equal(input.props.required, true);
    input.props.onChange({ target: { value: String(nextValue) } });
    const expected = configKey === 'REFUND_POLICY'
      ? { ...defaults, providerCompensationPercent: 35 } : { ...defaults, validityDays: 7 };
    assert.deepEqual(JSON.parse(value), expected);
  }
});

test('Nhóm chính sách hiển thị giá trị mặc định và ưu tiên cấu hình đã lưu', () => {
  const policies = load('features/admin/components/system-configs/business-policies.ts');
  const { defaultBookingPolicy } = load('features/admin/components/system-configs/booking-policy.ts');
  const catalog = load('features/admin/components/system-configs/config-catalog.ts', {
    './business-policies': policies, './booking-policy': { defaultBookingPolicy },
  });
  const { mergeConfigItems } = load('features/admin/components/system-configs/system-config-format.ts', {
    './config-definitions': catalog,
    './booking-policy': load('features/admin/components/system-configs/booking-policy.ts'),
    './business-policies': policies,
  });
  assert.ok(catalog.groupOptions.some((group) => group.key === 'policy'));
  const saved = { key: 'REFUND_POLICY', value: { ...policies.defaultRefundPolicy, normalRefundPercent: 60 } };
  const items = mergeConfigItems([saved]).filter((item) => item.group === 'policy');
  assert.equal(items.length, 3);
  assert.equal(items.find((item) => item.key === 'REFUND_POLICY').currentValue.normalRefundPercent, 60);
  assert.equal(items.find((item) => item.key === 'REWARD_POLICY').currentValue.amountPerPoint, 10000);
  assert.ok(items.every((item) => item.isEffective && !item.isPublic));
});

test('Chọn ảnh nhiều lần giữ ảnh đã lưu và toàn bộ ảnh vừa chọn', async () => {
  const form = feedbackForm(['https://anh-cu.vn/1.png']);
  const first = image('moi-1.png');
  const second = image('moi-2.png');
  form.select([first]);
  form.select([second]);
  await form.submit();
  assert.deepEqual(Array.from(form.calls[0].payload.images), ['https://anh-cu.vn/1.png']);
  assert.deepEqual(Array.from(form.calls[0].files), [first, second]);
});

test('Giới hạn năm ảnh tính cả ảnh cũ và các lần chọn trước, bỏ qua tệp sai định dạng', async () => {
  const form = feedbackForm(['https://anh-cu.vn/1.png', 'https://anh-cu.vn/2.png']);
  const first = image('moi-1.png');
  const second = image('moi-2.png');
  const third = image('moi-3.png');
  form.select([first, second]);
  form.select([{ ...image('sai.pdf'), type: 'application/pdf' }]);
  form.select([third, image('vuot-gioi-han.png')]);
  await form.submit();
  assert.deepEqual(Array.from(form.calls[0].files), [first, second, third]);
  assert.ok(form.toasts.some((message) => message.includes('tối đa 1 ảnh')));
});

test('Chỉ xóa ảnh cũ khi người dùng chủ động bấm xóa', async () => {
  const form = feedbackForm(['https://anh-cu.vn/1.png', 'https://anh-cu.vn/2.png']);
  find(form.render(), (node) => node.props?.['aria-label'] === 'Xóa ảnh đánh giá').props.onClick();
  form.select([image('moi.png')]);
  await form.submit();
  assert.deepEqual(Array.from(form.calls[0].payload.images), ['https://anh-cu.vn/2.png']);
});

test('Lưu đánh giá gửi cả URL ảnh cũ và URL ảnh vừa upload tới API', async () => {
  let submitted;
  const { feedbackService } = load('features/feedback/services/feedback.service.ts', {
    '../api/feedback.api': { feedbackApi: {
      uploadImages: async () => ['https://anh-moi.vn/1.png'],
      update: async (id, payload) => { submitted = { id, payload }; },
    } },
  });
  await feedbackService.save('danh-gia', { orderId: 'don-hang', images: ['https://anh-cu.vn/1.png'] }, [image('moi.png')]);
  assert.equal(submitted.id, 'danh-gia');
  assert.deepEqual(Array.from(submitted.payload.images), ['https://anh-cu.vn/1.png', 'https://anh-moi.vn/1.png']);
});

const { getNotificationTarget } = load('components/common/notification-bell/notificationBell.utils.ts');

test('Thông báo rút tiền cũ và mới chuyển đúng trang ví theo vai trò', () => {
  for (const data of [null, { withdrawalId: 'rut-tien' }]) {
    assert.equal(getNotificationTarget({ type: 'WITHDRAWAL', data }, 'CUSTOMER'), '/customer/wallet');
    assert.equal(getNotificationTarget({ type: 'WITHDRAWAL', data }, 'PROVIDER'), '/provider/wallet');
    assert.equal(getNotificationTarget({ type: 'WITHDRAWAL', data }, 'ADMIN'), '/admin/withdrawals');
  }
});

test('Thông báo giao dịch ví và thanh toán đơn hàng có đích phù hợp, ưu tiên actionUrl nội bộ', () => {
  assert.equal(getNotificationTarget({ type: 'PAYMENT', data: { transactionId: 'giao-dich', orderId: 'don' } }, 'PROVIDER'), '/provider/wallet');
  assert.equal(getNotificationTarget({ type: 'PAYMENT', data: null }, 'CUSTOMER'), '/customer/wallet');
  assert.equal(getNotificationTarget({ type: 'PAYMENT', data: { orderId: 'don' } }, 'CUSTOMER'), '/customer/bookings/don');
  assert.equal(getNotificationTarget({ type: 'WITHDRAWAL', data: { actionUrl: '/customer/wallet?tab=withdrawals' } }, 'CUSTOMER'), '/customer/wallet?tab=withdrawals');
  assert.equal(getNotificationTarget({ type: 'WITHDRAWAL', data: { actionUrl: '//trang-khac.vn' } }, 'CUSTOMER'), '/customer/wallet');
  assert.equal(getNotificationTarget({ type: 'WITHDRAWAL' }), null);
});

test('Thông báo ví đã lưu chỉ có orderId/paymentId vẫn mở ví của người nhận', () => {
  for (const content of [
    'Tiền đã được hoàn về ví Handigo của bạn.',
    'PayOS không cung cấp tài khoản nguồn. Tiền đã được hoàn vào ví Handigo của bạn.',
    'Đơn hàng đã được thanh toán bằng ví Handigo.',
    'Tiền cọc của đơn khảo sát đã được chuyển vào ví của bạn.',
  ]) {
    for (const role of ['CUSTOMER', 'PROVIDER']) {
      const item = { type: 'PAYMENT', content, data: { orderId: 'don-cu', paymentId: 'thanh-toan' } };
      assert.equal(getNotificationTarget(item, role), `/${role.toLowerCase()}/wallet`);
    }
  }
});

test('Đích ví được ưu tiên trước orderId và actionUrl chi tiết đơn cũ', () => {
  assert.equal(getNotificationTarget({ type: 'PAYMENT', data: {
    orderId: 'don', refundChannel: 'handigo_wallet', actionUrl: '/customer/bookings/don',
  } }, 'CUSTOMER'), '/customer/wallet');
  assert.equal(getNotificationTarget({ type: 'PAYMENT', data: {
    orderId: 'don', destination: 'handigo_wallet', actionUrl: '/customer/wallet',
  } }, 'PROVIDER'), '/provider/wallet');
  assert.equal(getNotificationTarget({ type: 'ORDER', content:
    'Đơn HD001 đã được hủy. Tiền cọc khảo sát đã thanh toán được cộng vào ví của bạn.',
  data: { orderId: 'don' } }, 'PROVIDER'), '/provider/wallet');
  assert.equal(getNotificationTarget({ type: 'PAYMENT', content: 'Hoàn tiền về Ví.',
    data: { orderId: 'don' } }, 'CUSTOMER'), '/customer/wallet');
});

test('Thông báo thanh toán ngoài ví và trạng thái đơn vẫn mở chi tiết đơn', () => {
  for (const item of [
    { type: 'PAYMENT', content: 'Tiền của đơn hàng đã hủy đã được hoàn về tài khoản thanh toán.' },
    { type: 'PAYMENT', content: 'Giao dịch PayOS của bạn đã được xác nhận.' },
    { type: 'ORDER', content: 'Đơn đã tự động hủy vì quá hạn thanh toán.' },
  ]) {
    assert.equal(getNotificationTarget({ ...item, data: { orderId: 'don' } }, 'CUSTOMER'), '/customer/bookings/don');
  }
});

const { buildOrderTimeline } = load('features/booking/components/detail/bookingDetailTimeline.ts');
const cancelledOrder = {
  status: 'cancelled', orderCode: 'HD001', customerId: { fullName: 'Nguyễn An' },
  providerId: { userId: { fullName: 'Trần Bình' } },
  cancellation: { cancelledByRole: 'customer', cancelledBy: 'khach-hang', reason: 'Thay đổi lịch: bận đột xuất', cancelledAt: '2026-10-15T01:00:00Z' },
};

test('Đơn hủy hiển thị người hủy và lý do đầy đủ dù có hoặc thiếu lịch sử', () => {
  for (const statusHistory of [undefined, [{ status: 'created' }], [{ status: 'created' }, { status: 'cancelled', note: 'Lý do cũ' }]]) {
    const step = buildOrderTimeline({ ...cancelledOrder, statusHistory }).at(-1);
    assert.equal(step.state, 'cancelled');
    assert.match(step.description, /Người hủy: Khách hàng \(Nguyễn An\)/);
    assert.match(step.description, /Lý do hủy: Thay đổi lịch: bận đột xuất/);
  }
});

test('Phân biệt chuyên gia, quản trị viên, hệ thống và dữ liệu hủy cũ thiếu thông tin', () => {
  for (const [role, actorId, expected] of [
    ['provider', 'tho', 'Chuyên gia (Trần Bình)'], ['admin', 'quan-tri', 'Quản trị viên'], ['admin', undefined, 'Hệ thống'],
  ]) {
    const step = buildOrderTimeline({ ...cancelledOrder, cancellation: { ...cancelledOrder.cancellation, cancelledByRole: role, cancelledBy: actorId } })[0];
    assert.ok(step.description.includes(`Người hủy: ${expected}`));
  }
  const legacy = buildOrderTimeline({ ...cancelledOrder, cancellation: null, statusHistory: [{ status: 'cancelled', changedByRole: 'provider', note: 'Thợ bận' }] })[0];
  assert.match(legacy.description, /Chuyên gia \(Trần Bình\).*Lý do hủy: Thợ bận/);
  assert.match(buildOrderTimeline({ status: 'cancelled' })[0].description, /Chưa có thông tin/);
});

test('Hủy tự động vì không tìm được thợ chỉ hiển thị lý do ở mọi dạng lịch sử', () => {
  for (const reason of [
    'Không tìm thấy thợ phù hợp trong bán kính 10 km sau thời gian tìm kiếm.',
    'Không tìm thấy thợ nhận đơn trong bán kính 10 km sau thời gian tìm kiếm.',
    'Không có provider nhận đơn trong vòng 5 phút.',
    'Không có provider nhận đơn sau 3 lượt matching.',
  ]) {
    const description = `Lý do hủy: ${reason.replace('Không tìm thấy thợ nhận đơn', 'Không tìm thấy thợ phù hợp')}`;
    for (const statusHistory of [undefined, [{ status: 'created' }], [{ status: 'cancelled', changedByRole: 'system' }]]) {
      const order = { ...cancelledOrder, statusHistory, cancellation: {
        ...cancelledOrder.cancellation, cancelledByRole: 'admin', cancelledBy: undefined, reason,
      } };
      assert.equal(buildOrderTimeline(order).at(-1).description, description);
    }
    const legacy = { ...cancelledOrder, cancellation: null,
      statusHistory: [{ status: 'cancelled', changedByRole: 'system', note: reason }] };
    assert.equal(buildOrderTimeline(legacy)[0].description, description);
  }
});

test('Các trường hợp hủy khác vẫn giữ thông tin người hủy', () => {
  const reason = 'Không tìm thấy thợ nhận đơn trong bán kính 10 km sau thời gian tìm kiếm.';
  const manual = { ...cancelledOrder, cancellation: {
    ...cancelledOrder.cancellation, cancelledByRole: 'admin', cancelledBy: 'quan-tri', reason,
  } };
  assert.match(buildOrderTimeline(manual)[0].description, /Người hủy: Quản trị viên/);
  const timeout = { ...manual, cancellation: { ...manual.cancellation, cancelledBy: undefined,
    reason: 'Đơn hàng quá hạn thanh toán.' } };
  assert.match(buildOrderTimeline(timeout)[0].description, /Người hủy: Hệ thống/);
});

test('Lỗi API lưu hồ sơ không lặp lại thông báo trong form và giữ nội dung để sửa', async () => {
  const runtime = hooks();
  const { useUserProfileForm } = load('features/profile/hooks/useUserProfileForm.ts', {
    react: runtime.react,
    '@/utils/phoneValidation': { normalizeVietnamesePhone: (value) => value, isValidVietnamesePhone: () => true },
    '@/features/profile/utils/userProfileForm.utils': { toProfileForm: (value) => ({ ...value }), getTodayDate: () => '2026-10-15' },
  });
  const render = () => {
    runtime.reset();
    return useUserProfileForm({ user: { fullName: 'Nguyễn An' }, showAvatar: false,
      onSaveProfile: async () => { throw new Error('Số điện thoại đã được sử dụng.'); } });
  };
  render().startEditing();
  render().updateField('fullName', 'Nguyễn Bình');
  await render().handleProfileSubmit({ preventDefault() {} });
  assert.equal(render().isEditing, true);
  assert.equal(render().profileForm.fullName, 'Nguyễn Bình');
  assert.equal(Object.keys(render().fieldErrors).length, 0);
});

test('Lỗi lưu hồ sơ provider không thay toàn bộ trang bằng khung báo lỗi', () => {
  const data = { profile: { provider: { certificates: [] } }, profileView: {}, error: 'Không thể cập nhật hồ sơ.' };
  const modules = {
    react: { useRef: () => ({ current: null }), useState: (value) => [value, () => {}] },
    '@/components/common/DashboardShell': { DashboardShell: 'dashboard' },
    '@/features/auth/store/auth.store': { useAuthStore: (select) => select({ user: { providerOnboardingStatus: 'APPROVED' } }) },
    '../store/providerAvailability.store': { useProviderAvailabilityStore: (select) => select({ availabilityStatus: 'online' }) },
    '../utils/providerProfilePage': { buildVerificationItems: () => [], toUserProfileData: () => ({}) },
    '../components/profile/useProviderProfileData': { useProviderProfileData: () => data },
    '../components/profile/ProviderProfileMainGrid': { ProviderProfileMainGrid: 'profile-grid' },
    '../components/profile/ProviderProfileDialogsGroup': { ProviderProfileDialogsGroup: 'profile-dialogs' },
    '../components/profile/ProviderProfilePageSkeleton': { ProviderProfilePageSkeleton: 'skeleton' },
  };
  for (const name of ['useProviderIdentityFlow', 'useProviderCertificateFlow', 'useProviderServiceAreaFlow', 'useProviderPasswordFlow', 'useProviderProfileUiState']) {
    modules[`../components/profile/${name}`] = { [name]: () => ({}) };
  }
  const { default: ProviderProfilePage } = load('features/provider/pages/ProviderProfilePage.tsx', modules);
  const render = () => ProviderProfilePage().type();
  assert.ok(find(render(), (node) => node.type === 'profile-grid'));
  data.profile = null;
  data.profileView = null;
  assert.equal(find(render(), (node) => node.type === 'p').props.children, data.error);
});

test('Trang provider dùng tiến độ hủy với cùng thông tin người hủy và lý do như khách hàng', () => {
  const { OrderProgressCard } = load('features/provider/components/orders/OrderProgressCard.tsx', {
    '@/features/booking/components/detail/BookingStatusTimeline': { BookingStatusTimeline: 'timeline' },
    '@/features/booking/components/detail/bookingDetailTimeline': { buildOrderTimeline },
    '../../utils/providerOrder.utils': { formatDateTime: () => '' },
    './CardTitle': { CardTitle: 'title' },
  });
  const timeline = find(OrderProgressCard({ order: cancelledOrder }), (node) => node.type === 'timeline');
  assert.equal(timeline.props.status, 'cancelled');
  assert.match(timeline.props.timeline[0].description, /Người hủy: Khách hàng.*Thay đổi lịch/);
});
