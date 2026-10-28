const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(filename, overrides = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, Error, Map, Set, Object, ...globals,
    require(name) {
      if (name in overrides) return overrides[name];
      if (name.startsWith('@/')) return load(path.join(__dirname, '../src', `${name.slice(2)}.ts`), overrides);
      if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), `${name}.ts`), overrides);
      return require(name);
    },
  }, { filename });
  return exports;
}
const { prepareRebooking, canRebook } = load(path.join(__dirname, '../src/features/booking/utils/rebooking.ts'));
const address = { _id: 'dia-chi', fullAddress: '12 Đường A', detailAddress: '12 Đường A', province: 'TP. Hồ Chí Minh', ward: 'Phường A', latitude: 10, longitude: 106 };
const service = { _id: 'dich-vu', categoryId: { _id: 'danh-muc' }, isActive: true, serviceType: 'fixed_price' };
const option = { _id: 'tuy-chon', serviceId: 'dich-vu', price: 100000, isActive: true, allowsQuantity: true };
const order = { _id: 'don-cu', orderCode: 'ORD-CU', status: 'completed', serviceId: { _id: 'dich-vu' },
  addressId: address, addressSnapshot: { fullAddress: address.fullAddress, province: address.province, ward: address.ward, latitude: 10, longitude: 106 },
  selectedOptionIds: ['tuy-chon'], selectedOptionsSnapshot: [{ optionId: 'tuy-chon', price: 100000, quantity: 3 }],
  paymentMethod: 'wallet', scheduledAt: '2026-01-01T08:00:00Z', customerAttachments: ['anh-cu'], problemDescription: 'Sự cố cũ',
  providerId: { _id: 'tho-cu' }, voucherSnapshot: { code: 'MA-CU' }, pricing: { totalPaidAmount: 300000 },
};

test('Đặt lại giữ lựa chọn hợp lệ và địa chỉ snapshot, lấy mã danh mục đã populate', () => {
  const draft = prepareRebooking(order, service, [option], [address]);
  assert.equal(draft.categoryId, 'danh-muc');
  assert.equal(draft.serviceId, 'dich-vu');
  assert.deepEqual(Array.from(draft.selectedOptionIds), ['tuy-chon']);
  assert.equal(draft.selectedOptionQuantities['tuy-chon'], 3);
  assert.equal(draft.addressId, 'dia-chi');
  assert.equal(draft.paymentMethod, 'wallet');
  assert.equal(draft.rebookSource.orderCode, 'ORD-CU');
  assert.equal(draft.rebookSource.notices.length, 0);
});

test('Đặt lại yêu cầu lịch mới, không sao chép giá, tiền, mã giảm, báo giá, ảnh hoặc sự cố cũ', () => {
  const draft = prepareRebooking(order, service, [option], [address]);
  assert.equal(draft.orderType, 'scheduled');
  for (const field of ['scheduledAt', 'pricing', 'voucherSnapshot', 'currentQuotationId', 'customerAttachments', 'problemDescription', 'providerId', 'preferredProviderId']) {
    assert.equal(field in draft, false, field);
  }
  assert.equal(order.selectedOptionsSnapshot[0].quantity, 3);
});

test('Địa chỉ đã sửa, xóa hoặc đổi tọa độ phải được chọn lại', () => {
  for (const addresses of [[], [{ ...address, fullAddress: '99 Đường B' }], [{ ...address, latitude: 11 }]]) {
    const draft = prepareRebooking(order, service, [option], addresses);
    assert.equal(draft.addressId, undefined);
    assert.ok(draft.rebookSource.notices.some(text => text.includes('Địa chỉ')));
  }
});

test('Tùy chọn ngừng hoạt động bị bỏ và giá, số lượng thay đổi có thông báo', () => {
  const changed = prepareRebooking(order, service, [{ ...option, allowsQuantity: false, price: 120000 }], [address]);
  assert.equal(changed.selectedOptionQuantities['tuy-chon'], 1);
  assert.ok(changed.rebookSource.notices.some(text => text.includes('Giá')));
  for (const options of [[], [{ ...option, isActive: false }]]) {
    const draft = prepareRebooking(order, service, options, [address]);
    assert.equal(draft.selectedOptionIds.length, 0);
    assert.ok(draft.rebookSource.notices.length > 0);
  }
});

test('Nhóm đổi sang chọn một không giữ tổ hợp tùy chọn cũ không hợp lệ', () => {
  const options = [option, { ...option, _id: 'tuy-chon-2' }].map(item => ({ ...item, selectionGroup: 'Nhóm A', selectionMode: 'single' }));
  const draft = prepareRebooking({ ...order, selectedOptionIds: ['tuy-chon', 'tuy-chon-2'] }, service, options, [address]);
  assert.equal(draft.selectedOptionIds.length, 1);
  assert.equal(Object.keys(draft.selectedOptionQuantities).length, 1);
  assert.ok(draft.rebookSource.notices.some(text => text.includes('Quy tắc')));
});

test('Dịch vụ giá chung giữ số lượng từ snapshot và thông báo khi giá đổi', () => {
  const uniformOrder = { ...order, selectedOptionIds: [], selectedOptionsSnapshot: [{ optionId: null, quantity: 4, price: 100000 }] };
  const draft = prepareRebooking(uniformOrder, { ...service, categoryId: 'danh-muc', fixedPrice: 120000 }, [], [address]);
  assert.equal(draft.uniformQuantity, 4);
  assert.equal(draft.categoryId, 'danh-muc');
  assert.ok(draft.rebookSource.notices.some(text => text.includes('tính giá')));
});

test('Chỉ đơn hoàn thành hoặc hủy được đặt lại; dịch vụ sai hoặc ngừng hoạt động bị chặn', () => {
  assert.equal(canRebook('completed'), true);
  assert.equal(canRebook('cancelled'), true);
  for (const status of ['created', 'accepted', 'in_progress', undefined]) {
    assert.equal(canRebook(status), false);
    assert.throws(() => prepareRebooking({ ...order, status }, service, [option], [address]), /Chỉ có thể đặt lại/);
  }
  assert.throws(() => prepareRebooking(order, { ...service, isActive: false }, [], []), /ngừng hoạt động/);
  assert.throws(() => prepareRebooking(order, { ...service, _id: 'khac' }, [], []), /ngừng hoạt động/);
});

function buttonRuntime({ status = 'completed', existingDraft = true, pending = false, getOrder } = {}) {
  let state = existingDraft ? { serviceId: 'ban-dang-soan', customerAttachments: ['anh-dang-soan'] } : {};
  const auth = { sessionRevision: 1 };
  const calls = [];
  const slots = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect() {},
  };
  const useBookingStore = Object.assign(selector => selector(state), {
    getState: () => state,
    setState: value => { calls.push('draft'); state = { ...state, ...value }; },
  });
  const useAuthStore = Object.assign(selector => selector(auth), { getState: () => auth });
  const { RebookButton } = load(path.join(__dirname, '../src/features/booking/components/RebookButton.tsx'), {
    react,
    'react-router-dom': { useNavigate: () => destination => calls.push(destination) },
    'lucide-react': { RotateCcw: 'icon' },
    '@/components/common/Modal': { Modal: 'modal' },
    '@/features/auth/store/auth.store': { useAuthStore },
    '@/features/customer-service/api/serviceCatalog.api': { serviceCatalogApi: {
      serviceById: async () => service, options: async () => [option], categories: async () => [{ _id: 'danh-muc' }],
    } },
    '../api/booking.api': { bookingApi: {
      getOrderById: async () => { calls.push('read'); return getOrder ? getOrder() : { ...order, status, providerId: { _id: 'tho-cu', userId: { fullName: 'Nguyễn Văn An' } } }; },
      getAddresses: async () => [address],
    } },
    '../hooks/useBookingStore': { useBookingStore, resetBookingSession: () => {
      calls.push('reset'); state = { customerAttachments: [], problemDescription: undefined, scheduledAt: undefined, preferredProviderId: undefined };
    } },
    '../hooks/useBookingPreview': { invalidateBookingPreview: () => calls.push('refresh-price') },
    '../utils/rebooking': { prepareRebooking, canRebook },
    '../utils/submitQuickRebooking': { assertNoPendingRebooking: () => { if (pending) throw new Error('Cần kiểm tra lần đặt trước.'); } },
    './QuickRebookingPanel': { QuickRebookingPanel: 'quick-panel' },
  }, { sessionStorage: { getItem: () => pending ? 'dang-doi-ket-qua' : null } });
  const render = () => { cursor = 0; return RebookButton({ orderId: order._id, status }); };
  return { render, calls, auth, state: () => state };
}

function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (predicate(node)) return node;
  for (const child of [node.props?.children, node.props?.footer].flat(Infinity)) {
    const found = find(child, predicate);
    if (found) return found;
  }
}
const button = (tree, text) => find(tree, node => node.type === 'button' && [node.props.children].flat(Infinity).includes(text));
const tick = () => new Promise(setImmediate);

test('Mở bảng đặt lại nhanh chỉ đọc dữ liệu hiện tại, giữ nguyên bản đang soạn', async () => {
  const runtime = buttonRuntime();
  button(runtime.render(), 'Đặt lại').props.onClick();
  await tick();
  const tree = runtime.render();
  assert.equal(find(tree, node => node.type === 'modal').props.title, 'Đặt lại nhanh');
  assert.equal(runtime.state().serviceId, 'ban-dang-soan');
  const panel = find(tree, node => node.type === 'quick-panel');
  assert.equal(panel.props.prepared.service._id, 'dich-vu');
  assert.equal(panel.props.prepared.order.providerId.userId.fullName, 'Nguyễn Văn An');
  assert.equal(panel.props.prepared.addresses[0]._id, 'dia-chi');
  assert.deepEqual(runtime.calls, ['read']);
  panel.props.onBusyChange(true);
  find(runtime.render(), node => node.type === 'modal').props.onClose();
  assert.equal(find(runtime.render(), node => node.type === 'modal').props.open, true);
});

test('Đóng modal giữ nguyên bản nháp; phản hồi đến muộn không mở lại nội dung', async () => {
  let finish;
  const runtime = buttonRuntime({ getOrder: () => new Promise(resolve => { finish = resolve; }) });
  button(runtime.render(), 'Đặt lại').props.onClick();
  find(runtime.render(), node => node.type === 'modal').props.onClose();
  finish(order);
  await tick();
  assert.equal(find(runtime.render(), node => node.type === 'modal').props.open, false);
  assert.equal(runtime.state().serviceId, 'ban-dang-soan');
  assert.equal(runtime.calls.includes('reset'), false);
});

test('Có lần tạo đơn chưa xác định kết quả thì không thay bản nháp hoặc xóa khóa', async () => {
  const runtime = buttonRuntime({ pending: true });
  button(runtime.render(), 'Đặt lại').props.onClick();
  await tick();
  assert.ok(find(runtime.render(), node => node.props?.role === 'alert'));
  assert.equal(runtime.calls.length, 0);
  assert.equal(runtime.state().serviceId, 'ban-dang-soan');
});

test('Đổi phiên đăng nhập đóng nội dung đơn cũ và ngăn ghi bản nháp từ phản hồi cũ', async () => {
  let finish;
  const runtime = buttonRuntime({ getOrder: () => new Promise(resolve => { finish = resolve; }) });
  button(runtime.render(), 'Đặt lại').props.onClick();
  runtime.auth.sessionRevision++;
  finish(order);
  await tick();
  assert.equal(find(runtime.render(), node => node.type === 'modal').props.open, false);
  assert.equal(runtime.calls.includes('reset'), false);
});

test('Đơn hủy không đề xuất giữ thợ cũ; đơn đang xử lý không có nút đặt lại', async () => {
  for (const status of ['created', 'accepted', 'in_progress']) assert.equal(buttonRuntime({ status }).render(), null);
  const runtime = buttonRuntime({ status: 'cancelled', existingDraft: false });
  button(runtime.render(), 'Đặt lại').props.onClick();
  await tick();
  const tree = runtime.render();
  assert.equal(find(tree, node => node.type === 'quick-panel').props.prepared.order.status, 'cancelled');
  assert.deepEqual(runtime.calls, ['read']);
});

test('Sổ địa chỉ cho phép đặt lại yêu cầu chọn tay, luồng thông thường vẫn tự chọn địa chỉ mặc định', () => {
  for (const autoSelect of [false, true]) {
    const effects = [];
    const selected = [];
    const react = {
      useState: initial => [Array.isArray(initial) ? [{ id: 'mac-dinh', isDefault: true }] : initial, () => {}],
      useCallback: callback => callback,
      useEffect: callback => effects.push(callback),
    };
    const { useAddressBookManager } = load(path.join(__dirname, '../src/features/profile/hooks/useAddressBookManager.ts'), {
      react,
      '@/components/common/Toast': { useToast: () => ({ addToast() {} }), useToastFeedback: value => [value, () => {}] },
      '@/features/profile/api/addressBook.api': { getUserAddresses: async () => [] },
    });
    useAddressBookManager({ selectable: true, autoSelect, onSelectAddress: value => selected.push(value) });
    effects.forEach(callback => callback());
    assert.equal(selected.length, autoSelect ? 1 : 0);
    if (autoSelect) assert.equal(selected[0].id, 'mac-dinh');
  }
});

test('Đặt lại không tự điền lịch; muốn giữ thợ cũ phải chọn được thợ hoặc chủ động đổi lựa chọn', () => {
  const effects = [];
  const calls = [];
  const state = { serviceId: 'dich-vu', addressId: 'dia-chi', orderType: 'scheduled', customerAttachments: [],
    rebookSource: { orderId: 'don-cu' }, requestedProviderId: 'tho-cu', scheduledAt: undefined,
    setScheduledAt: (...args) => calls.push(['schedule', ...args]), setPreferredProviderId() {},
  };
  const useBookingStore = Object.assign(() => state, { getState: () => state });
  let errors;
  const react = {
    useState(initial) {
      const value = typeof initial === 'function' ? initial() : initial;
      return [value === 'idle' ? 'available' : value, next => { if (next && typeof next === 'object') errors = next; }];
    },
    useRef: current => ({ current }), useCallback: callback => callback, useMemo: callback => callback(),
    useEffect: callback => effects.push(callback),
  };
  const { useCreateBookingStep2Form } = load(path.join(__dirname, '../src/features/booking/components/useCreateBookingStep2Form.ts'), {
    react,
    'react-router-dom': { useNavigate: () => () => calls.push('navigate'), useLocation: () => ({}) },
    '@/components/common/Toast': { useToastFeedback: value => [value, () => {}] },
    '@/features/booking/api/booking.api': { bookingApi: {} },
    '../hooks/useBookingStore': { useBookingStore },
  }, {
    window: { setTimeout() {}, addEventListener() {} }, document: { addEventListener() {} },
  });
  let form = useCreateBookingStep2Form();
  effects.splice(0).forEach(callback => callback());
  assert.equal(calls.length, 0);
  form.handleContinue();
  assert.ok(errors.scheduledAt);
  assert.ok(errors.preferredProviderId);
  state.scheduledAt = '2099-01-01T10:00:00';
  form = useCreateBookingStep2Form();
  form.handleContinue();
  assert.ok(errors.preferredProviderId);
  assert.equal(calls.includes('navigate'), false);
  state.preferredProviderId = 'tho-cu';
  form = useCreateBookingStep2Form();
  form.handleContinue();
  assert.equal(calls.includes('navigate'), true);
  state.preferredProviderId = undefined;
  state.requestedProviderId = undefined;
  form = useCreateBookingStep2Form();
  form.handleContinue();
  assert.equal(Object.keys(errors).length, 0);
});
