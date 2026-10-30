const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, Date, ...globals, require: name => {
    assert.ok(name in modules, `Phụ thuộc chưa được cô lập: ${name}`);
    return modules[name];
  } });
  return exports;
}

function hooks() {
  const slots = [];
  let cursor = 0, effects = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => value === b[i]);
  const react = {
    useState(initial) {
      const i = cursor++;
      slots[i] ??= { value: initial, set: next => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next; } };
      return [slots[i].value, slots[i].set];
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!same(slots[i]?.deps, deps)) slots[i] = { deps, value: fn };
      return slots[i].value;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!same(slots[i]?.deps, deps)) effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
    },
  };
  return { react, render(fn) { cursor = 0; effects = []; const value = fn(); effects.forEach(run => run()); return value; },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); } };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function fixture(listFn = async () => ({ items: [] }), detailFn = async id => ({ _id: id, status: 'open' })) {
  const h = hooks();
  const auth = { sessionRevision: 0, isAuthenticated: true };
  const useAuthStore = selector => selector(auth);
  useAuthStore.getState = () => auth;
  const listeners = new Map(), intervals = new Set();
  const add = (name, fn) => { const set = listeners.get(name) ?? new Set(); set.add(fn); listeners.set(name, set); };
  const remove = (name, fn) => listeners.get(name)?.delete(fn);
  const document = { hidden: false, addEventListener: add, removeEventListener: remove };
  const window = { setTimeout, clearTimeout, addEventListener: add, removeEventListener: remove,
    setInterval(fn, ms) { assert.equal(ms, 30000); intervals.add(fn); return fn; }, clearInterval(fn) { intervals.delete(fn); } };
  const { useSupportData } = load('features/case-management/hooks/useSupportData.ts', {
    react: h.react, '@/features/auth/store/auth.store': { useAuthStore }, '@/utils/apiError': { getErrorMessage: error => error.message },
  }, { window, document });
  let fetchList = listFn;
  return { auth, document, intervals, listeners,
    render: () => h.render(() => useSupportData(fetchList, detailFn)),
    setList(fn) { fetchList = fn; },
    emit(name) { listeners.get(name)?.forEach(fn => fn()); },
    poll() { intervals.forEach(fn => fn()); }, unmount: h.unmount };
}

test('Đồng bộ danh sách và chi tiết khi focus/online/30 giây; tab ẩn không tải, không tạo request chồng', async () => {
  let calls = 0, detailCalls = 0, status = 'open', pending = null;
  const f = fixture(async () => { calls++; return pending ? pending.promise : { items: [{ status }] }; }, async id => { detailCalls++; return { _id: id, status }; });
  let state = f.render(); await tick(); state = f.render();
  assert.equal(calls, 1);
  await state.open('A'); state = f.render();
  status = 'waiting_user'; f.poll(); await tick(); state = f.render();
  assert.equal(state.data.items[0].status, status); assert.equal(state.selected.status, status);
  f.document.hidden = true; const before = calls; f.poll(); f.emit('focus'); await tick(); assert.equal(calls, before);
  f.document.hidden = false; f.emit('visibilitychange'); await tick(); assert.equal(calls, before + 1);
  pending = deferred(); f.emit('online'); f.emit('focus'); f.poll(); await tick(); assert.equal(calls, before + 2);
  pending.resolve({ items: [] }); await tick();
  assert.ok(detailCalls >= 3);
  f.unmount(); assert.equal(f.intervals.size, 0);
  assert.ok([...f.listeners.values()].every(set => set.size === 0));
});

test('Kết quả chi tiết A không được ghi đè B hoặc mở lại modal đã đóng', async () => {
  const a = deferred(), b = deferred();
  const f = fixture(undefined, id => id === 'A' ? a.promise : b.promise);
  let state = f.render(); await tick(); state = f.render();
  const first = state.open('A'); const second = state.open('B');
  b.resolve({ _id: 'B' }); await second; a.resolve({ _id: 'A' }); await first;
  state = f.render(); assert.equal(state.selected._id, 'B');
  state.close(); await state.load(); state = f.render(); assert.equal(state.selected, null);
  f.unmount();
});

test('Đổi bộ lọc và đổi tài khoản loại bỏ kết quả cũ, không lộ hồ sơ phiên trước', async () => {
  const old = deferred();
  const f = fixture(() => old.promise);
  f.render(); await tick();
  f.setList(async () => ({ items: ['mới'] })); f.render(); await tick();
  old.resolve({ items: ['cũ'] }); await tick();
  let state = f.render(); assert.equal(state.data.items[0], 'mới');
  await state.open('A'); state = f.render(); assert.equal(state.selected._id, 'A');
  f.auth.sessionRevision++;
  state = f.render(); assert.equal(state.data, null); assert.equal(state.selected, null);
  f.auth.isAuthenticated = false; state = f.render(); f.emit('focus'); await tick();
  assert.equal(state.data, null); assert.equal(state.selected, null);
  f.unmount();
});

test('Lỗi tải nền giữ dữ liệu cũ; lỗi 409 tải lại trạng thái và không tự gửi lại thao tác ghi', async () => {
  let failure = false, status = 'open', writes = 0;
  const f = fixture(async () => { if (failure) throw new Error('Mất mạng'); return { items: [status] }; }, async id => ({ _id: id, status }));
  let state = f.render(); await tick(); state = f.render(); await state.open('A');
  failure = true; await state.load(true); state = f.render();
  assert.equal(state.data.items[0], 'open'); assert.equal(state.error, ''); assert.match(state.refreshError, /Mất mạng/);
  failure = false;
  const ok = await state.runAction(async () => { writes++; status = 'resolved'; throw Object.assign(new Error('Yêu cầu đã thay đổi'), { status: 409 }); });
  await tick(); state = f.render();
  assert.equal(ok, false); assert.equal(writes, 1); assert.equal(state.selected.status, 'resolved'); assert.match(state.actionError, /đã thay đổi/);
  f.unmount();
});

test('Thao tác ghi thành công vẫn thành công khi tải lại danh sách lỗi; bỏ phản hồi nền cũ', async () => {
  let listFailure = false, server = { _id: 'A', status: 'open' }, pending = null;
  const f = fixture(async () => { if (listFailure) throw new Error('Mất mạng'); return { items: [] }; }, async () => pending ? pending.promise : server);
  let state = f.render(); await tick(); state = f.render(); await state.open('A');
  pending = deferred(); const stale = pending; f.poll(); await tick();
  listFailure = true; server = { _id: 'A', status: 'resolved' }; pending = null;
  assert.equal(await state.runAction(async () => server), true);
  stale.resolve({ _id: 'A', status: 'open' }); await tick(); state = f.render();
  assert.equal(state.selected.status, 'resolved'); assert.match(state.refreshError, /Mất mạng/);
  f.unmount();
});

const jsx = (type, props, key) => ({ type, props: props || {}, key });
const jsxRuntime = { jsx, jsxs: jsx, Fragment: 'fragment' };
function all(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => all(child, predicate));
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...all(node.props?.children, predicate)];
}

test('Bản nháp chữ/ảnh của người dùng giữ nguyên sau cập nhật nền và bị chặn gửi khi hồ sơ kết thúc', async () => {
  const h = hooks(); let sent = 0;
  const component = load('features/case-management/components/CaseDetailModal.tsx', {
    react: h.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': { ExternalLink: 'external' },
    '@/components/common/ConfirmDialog': { ConfirmDialog: 'confirm' }, '@/components/common/Modal': { Modal: 'modal' },
    '@/components/common/Skeleton': {}, './caseStatusLabels.constants': { STATUS_LABELS: {} }, './EvidenceImagePicker': { EvidenceImagePicker: 'picker' },
  }).CaseDetailModal;
  let selected = { kind: 'ticket', item: { _id: 'A', status: 'open', subject: 'Hỗ trợ thử', description: 'Nội dung', createdAt: new Date().toISOString(), responses: [], attachments: [] } };
  const props = { loading: false, busy: false, actionError: '', onClose() {}, onCancel() {}, onAddEvidence() {}, onRespond: async () => { sent++; return true; } };
  const render = () => h.render(() => component({ ...props, selected }));
  let tree = render();
  all(tree, node => node.type === 'textarea')[0].props.onChange({ target: { value: 'Nội dung đang viết' } });
  all(tree, node => node.type === 'picker')[0].props.onChange([{ name: 'anh.jpg' }]);
  selected = { ...selected, item: { ...selected.item, status: 'resolved', resolutionNote: 'Đã xử lý' } };
  tree = render();
  const input = all(tree, node => node.type === 'textarea')[0];
  assert.equal(input.props.value, 'Nội dung đang viết'); assert.equal(input.props.disabled, true);
  assert.equal(all(tree, node => node.type === 'picker')[0].props.files[0].name, 'anh.jpg');
  await all(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.equal(sent, 0);
});

test('Admin giữ bản nháp khi ticket đổi trạng thái và không gửi vào hồ sơ kết thúc', async () => {
  const h = hooks(); let sent = 0;
  const component = load('features/admin/components/support/TicketThread.tsx', {
    react: h.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': { Send: 'send' },
    './SupportAttachments': { SupportAttachments: 'attachments' }, './SupportBadges': {},
    './support.constants': { dateTime: { format: () => '' }, ticketAge: () => '' }, '@/utils/orderStatus': {}, '../payments/payment-constants': {},
  }).TicketThread;
  let ticket = { _id: 'A', status: 'in_progress', subject: 'Thử', requesterId: null, createdAt: new Date().toISOString(), responses: [], attachments: [] };
  const render = () => h.render(() => component({ ticket, busy: false, onRespond: async () => { sent++; return true; } }));
  let tree = render(); all(tree, node => node.type === 'textarea')[0].props.onChange({ target: { value: 'Hướng dẫn đang viết' } });
  ticket = { ...ticket, status: 'closed' }; tree = render();
  assert.equal(all(tree, node => node.type === 'textarea')[0].props.value, 'Hướng dẫn đang viết');
  assert.equal(all(tree, node => node.type === 'textarea')[0].props.disabled, true);
  await all(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} }); assert.equal(sent, 0);
});

test('Danh sách quản trị viên tải đủ các trang và không biến lỗi API thành danh sách rỗng', async () => {
  const pages = []; let failure = false;
  const api = load('features/admin/api/adminSupport.api.ts', {
    '@/api/client': { __esModule: true, default: { get: async (_, { params }) => {
      if (failure) throw new Error('Lỗi tải quản trị viên');
      pages.push(params.page);
      return { data: { data: { items: [{ _id: `admin-${params.page}` }], pagination: { totalPages: 2 } } } };
    } } },
  }).adminSupportApi;
  const result = await api.getActiveAdmins();
  assert.deepEqual(pages, [1, 2]); assert.equal(result.items.length, 2);
  failure = true; await assert.rejects(api.getActiveAdmins(), /Lỗi tải/);
});

test('Nút phân công chặn resolved và lựa chọn trạng thái cũ không gửi được sau cập nhật nền', async () => {
  const h = hooks(); let statusWrites = 0;
  const labels = load('features/case-management/components/supportLabels.constants.ts', {});
  const component = load('features/admin/components/support/TicketSidebar.tsx', {
    react: h.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': {},
    './support.constants': { STATUS_LABELS: labels.SUPPORT_STATUS_LABELS, STATUS_TRANSITIONS: labels.SUPPORT_STATUS_TRANSITIONS },
  }).TicketSidebar;
  let ticket = { _id: 'A', status: 'in_progress' };
  const props = { admins: [{ _id: 'admin', fullName: 'Quản trị viên' }], adminsLoading: false, adminsError: '', busy: false,
    onReloadAdmins() {}, onAssign: async () => true, onStatusChange: async () => { statusWrites++; return true; }, onCreateViolation() {} };
  const render = () => h.render(() => component({ ...props, ticket }));
  let tree = render();
  all(tree, node => node.type === 'select')[1].props.onChange({ target: { value: 'resolved' } });
  tree = render();
  const resolve = all(tree, node => node.type === 'button').find(node => node.props.children === 'Cập nhật trạng thái');
  assert.equal(resolve.props.disabled, false, 'Có thể hoàn tất hỗ trợ khi không nhập kết quả xử lý.');
  await resolve.props.onClick(); assert.equal(statusWrites, 1);
  statusWrites = 0; tree = render();
  all(tree, node => node.type === 'select')[1].props.onChange({ target: { value: 'waiting_user' } });
  ticket = { ...ticket, status: 'resolved' }; tree = render();
  const selects = all(tree, node => node.type === 'select');
  assert.equal(selects[0].props.disabled, true);
  assert.equal(selects[1].props.value, '');
  const update = all(tree, node => node.type === 'button').find(node => node.props.children === 'Cập nhật trạng thái');
  assert.equal(update.props.disabled, true); await update.props.onClick(); assert.equal(statusWrites, 0);
});

test('Thao tác ghi đang chạy chỉ gửi một lần; đổi bộ lọc trong lúc ghi vẫn tải đúng bộ lọc mới', async () => {
  const writing = deferred(); let writes = 0;
  const f = fixture(async () => ({ items: ['ban đầu'] }));
  let state = f.render(); await tick(); state = f.render(); await state.open('A');
  const first = state.runAction(async () => { writes++; return writing.promise; });
  assert.equal(await state.runAction(async () => { writes++; return { _id: 'A' }; }), false);
  f.setList(async () => ({ items: ['bộ lọc mới'] })); f.render(); await tick();
  writing.resolve({ _id: 'A' }); assert.equal(await first, true); await tick(); state = f.render();
  assert.equal(writes, 1); assert.equal(state.data.items[0], 'bộ lọc mới');
  f.unmount();
});

test('Danh sách hỗ trợ tự quay về trang hợp lệ khi tổng số trang giảm; truy vấn cũ không đổi bộ lọc mới', async () => {
  const h = hooks(); let fetchList, pending = null;
  const { useSupportTickets } = load('features/case-management/hooks/useSupportTickets.ts', {
    react: h.react, '@/components/common/Toast': { useToast: () => ({ addToast() {} }) },
    '../api/caseManagement.api': { caseManagementApi: { tickets: async () => pending ? pending.promise : { items: [], pagination: { totalPages: 1 } } } },
    './useSupportData': { useSupportData: fn => { fetchList = fn; return { selected: null }; } },
  });
  const render = () => h.render(useSupportTickets);
  let state = render(); state.setTicketQuery({ page: 3, limit: 10 }); render();
  await fetchList(); state = render(); assert.equal(state.ticketQuery.page, 1);
  state.setTicketQuery({ page: 4, limit: 10 }); render();
  pending = deferred(); const oldRequest = fetchList();
  state = render(); state.setTicketQuery({ page: 2, limit: 10, keyword: 'mới' }); render();
  pending.resolve({ items: [], pagination: { totalPages: 1 } }); await oldRequest;
  state = render(); assert.equal(state.ticketQuery.page, 2); assert.equal(state.ticketQuery.keyword, 'mới');
});

function createFormFixture(role = 'CUSTOMER', kind = 'ticket') {
  const h = hooks(); h.react.useMemo = fn => fn();
  const sent = [], loads = [];
  const orders = [{ _id: 'order-A', orderCode: 'ORD-KHONG-HIEN', status: 'completed',
    customerId: 'customer', providerId: { _id: 'provider' }, serviceId: { name: 'Sửa máy lạnh' }, createdAt: '2026-10-30T02:00:00Z' }];
  const component = load('features/case-management/components/CreateCaseModal.tsx', {
    react: h.react, 'react/jsx-runtime': jsxRuntime,
    '@/components/common/Toast': { useToast: () => ({ addToast() {} }), useToastFeedback: h.react.useState },
    '@/components/common/Modal': { Modal: 'modal' }, '../hooks/useCaseOrders': { useCaseOrders: (_, __, enabled) => {
      loads.push(enabled); return { orders, loading: false, error: '', hasMore: false, loadMore() {} };
    } },
    '@/utils/apiError': { getErrorMessage: error => error.message },
    '../api/caseManagement.api': { caseManagementApi: { createTicket: async payload => sent.push(payload), createReport: async payload => sent.push(payload) } },
    './EvidenceImagePicker': { EvidenceImagePicker: 'images' }, './ReportExtraFields': { ReportExtraFields: 'report-fields' },
    './TicketExtraFields': { TicketExtraFields: 'ticket-fields' }, './SupportOrderPicker': { SupportOrderPicker: 'orders' },
  }).CreateCaseModal;
  return { sent, loads, render: () => h.render(() => component({ open: true, role, kind, onClose() {}, onCreated() {} })) };
}

test('Dropdown người vi phạm gộp người gửi trùng khách, dùng tài khoản thợ thay vì mã hồ sơ', () => {
  const { getSupportViolationTargets } = load('features/admin/components/cases/violation-form-options.ts', {});
  const customer = { _id: 'customer', fullName: 'Khách A', email: 'khach@example.com', role: 'CUSTOMER' };
  const targets = getSupportViolationTargets({ requesterId: customer, orderId: { customerId: customer,
    providerId: { _id: 'provider-profile', userId: { _id: 'provider-user', fullName: 'Thợ B', role: 'PROVIDER' } } } });
  assert.equal(targets.length, 2);
  assert.equal(targets[0].userId, 'customer');
  assert.match(targets[0].label, /khach@example.com.*Người gửi hỗ trợ, Khách trong đơn/);
  assert.equal(targets[1].userId, 'provider-user');
  assert.equal(getSupportViolationTargets({ requesterId: null, orderId: null }).length, 0);
  assert.equal(getSupportViolationTargets({ requesterId: { _id: 'admin', role: 'ADMIN' } }).length, 0);
});

test('Form vi phạm bắt buộc chọn người liên quan, hỗ trợ loại có sẵn và nhập loại khác', async () => {
  const h = hooks(), sent = [];
  const { ViolationFormModal } = load('features/admin/components/cases/ViolationFormModal.tsx', {
    react: h.react, 'react/jsx-runtime': jsxRuntime, '@/components/common/Modal': { Modal: 'modal' },
    '@/components/common/Toast': { useToast: () => ({ addToast() {} }), useToastFeedback: h.react.useState },
    '@/utils/apiError': { getErrorMessage: error => error.message },
    '../../api/adminCases.api': { adminCasesApi: { createViolation: async payload => sent.push(payload) } },
    './case-status.constants': { PENALTY_LABELS: { WARNING: 'Cảnh cáo' } },
    '@/features/case-management/components/reportFieldOptions.constants': { REPORT_TYPES: [{ value: 'fraud', label: 'Gian lận' }, { value: 'other', label: 'Khác' }] },
  });
  const render = () => h.render(() => ViolationFormModal({ open: true, sourceType: 'SUPPORT_TICKET', sourceId: 'ticket',
    relatedUsers: [{ userId: 'customer', label: 'Khách A' }], onClose() {}, onCreated() {} }));
  let tree = render();
  await all(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.equal(sent.length, 0);
  all(tree, node => node.type === 'select')[0].props.onChange({ target: { value: 'stranger' } });
  tree = render();
  await all(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.equal(sent.length, 0);
  all(tree, node => node.type === 'select')[0].props.onChange({ target: { value: 'customer' } });
  all(tree, node => node.type === 'select')[1].props.onChange({ target: { value: 'other' } });
  tree = render();
  all(tree, node => node.type === 'input')[0].props.onChange({ target: { value: '  Lạm dụng hỗ trợ  ' } });
  tree = render();
  await all(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.equal(sent[0].userId, 'customer'); assert.equal(sent[0].violationType, 'Lạm dụng hỗ trợ');
  all(tree, node => node.type === 'select')[1].props.onChange({ target: { value: 'Gian lận' } });
  tree = render();
  assert.equal(all(tree, node => node.type === 'input').length, 0);
  await all(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.equal(sent[1].violationType, 'Gian lận');
});

test('Form hỗ trợ có tiêu đề, không chọn ưu tiên; chỉ thanh toán hiện đơn và đổi loại không gửi đơn bị ẩn', async () => {
  for (const role of ['CUSTOMER', 'PROVIDER']) {
    const f = createFormFixture(role);
    let tree = f.render();
    assert.equal(all(tree, node => node.type === 'input').length, 1);
    await all(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
    assert.equal(f.sent.length, 0, 'Không gửi yêu cầu khi tiêu đề trống.');
    all(tree, node => node.type === 'input')[0].props.onChange({ target: { value: '  Cần kiểm tra thanh toán  ' } });
    assert.equal(all(tree, node => node.type === 'orders').length, 0);
    assert.equal(f.loads.at(-1), false);
    all(tree, node => node.type === 'ticket-fields')[0].props.onCategoryChange('PAYMENT');
    tree = f.render(); assert.equal(f.loads.at(-1), true);
    all(tree, node => node.type === 'orders')[0].props.onChange('order-A');
    all(tree, node => node.type === 'textarea')[0].props.onChange({ target: { value: 'Kiểm tra thanh toán cho đơn này' } });
    tree = f.render(); await all(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
    assert.equal(f.sent[0].orderId, 'order-A'); assert.equal(f.sent[0].subject, 'Cần kiểm tra thanh toán'); assert.equal(f.sent[0].priority, undefined);
    all(tree, node => node.type === 'ticket-fields')[0].props.onCategoryChange('GUIDANCE');
    tree = f.render(); assert.equal(all(tree, node => node.type === 'orders').length, 0);
    await all(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
    assert.equal(f.sent[1].orderId, undefined); assert.equal(f.sent[1].category, 'GUIDANCE');
  }
  const report = createFormFixture('CUSTOMER', 'report').render();
  assert.equal(all(report, node => node.type === 'input').length, 1, 'Báo cáo vẫn giữ trường tiêu đề riêng.');
});

test('Loại hỗ trợ chỉ có năm lựa chọn; không có điều khiển mức ưu tiên', () => {
  const options = load('features/case-management/components/ticketFieldOptions.constants.ts', {
    './supportLabels.constants': load('features/case-management/components/supportLabels.constants.ts', {}),
  });
  const component = load('features/case-management/components/TicketExtraFields.tsx', {
    'react/jsx-runtime': jsxRuntime, '@/components/common/FormSelect': { FormSelect: 'select' },
    './ticketFieldOptions.constants': options,
  }).TicketExtraFields;
  const tree = component({ category: 'ACCOUNT', disabled: false, onCategoryChange() {} });
  assert.equal(tree.props.label, 'Loại hỗ trợ');
  assert.deepEqual(Array.from(options.CATEGORY_OPTIONS, option => option.value), ['PAYMENT', 'ACCOUNT', 'TECHNICAL', 'APPEAL', 'GUIDANCE']);
  assert.equal(all(tree, node => node.type === 'option').length, 5);
});

test('Dropdown đơn hiển thị tên dịch vụ/ngày, không hiện mã đơn; chọn đơn và Escape hoạt động', () => {
  const h = hooks(); h.react.useId = () => 'order-picker';
  const chosen = [];
  const component = load('features/case-management/components/SupportOrderPicker.tsx', {
    react: h.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': {},
  }, { document: { addEventListener() {}, removeEventListener() {} } }).SupportOrderPicker;
  const order = { _id: 'A', orderCode: 'ORD-KHONG-HIEN', serviceId: { name: 'Sửa máy lạnh' }, scheduledAt: '2026-10-30T02:00:00Z', createdAt: '2026-10-29T00:00:00Z' };
  const props = { orders: [order], value: '', disabled: false, loading: false, error: '', hasMore: false, onChange: id => chosen.push(id), onLoadMore() {} };
  const render = () => h.render(() => component(props));
  let tree = render(); all(tree, node => node.type === 'button')[0].props.onClick(); tree = render();
  const option = all(tree, node => node.props.role === 'option')[1];
  const text = JSON.stringify(option);
  assert.match(text, /Sửa máy lạnh/); assert.match(text, /30\/10\/2026/); assert.doesNotMatch(text, /ORD-KHONG-HIEN/);
  option.props.onClick(); assert.deepEqual(chosen, ['A']);
  tree = render(); assert.equal(all(tree, node => node.props.role === 'listbox').length, 0);
  all(tree, node => node.type === 'button')[0].props.onClick(); tree = render();
  tree.props.onKeyDown({ key: 'Escape', preventDefault() {}, stopPropagation() {} });
  tree = render(); assert.equal(all(tree, node => node.props.role === 'listbox').length, 0);
  h.unmount();
});

test('Không tải danh sách đơn khi loại hỗ trợ không cần chọn đơn', async () => {
  const h = hooks(); let calls = 0, enabled = false;
  const { useCaseOrders } = load('features/case-management/hooks/useCaseOrders.ts', {
    react: h.react, '@/features/booking/api/booking.api': { bookingApi: { getMyOrders: async () => { calls++; return { items: [], pagination: { totalPages: 1 } }; } } },
    '@/features/provider/api/providerOrder.api': {}, '@/utils/apiError': {},
  }, { window: { setTimeout, clearTimeout } });
  const render = () => h.render(() => useCaseOrders('CUSTOMER', undefined, enabled));
  render(); await tick(); assert.equal(calls, 0);
  enabled = true; render(); await tick(); assert.equal(calls, 1);
  enabled = false; render(); await tick(); assert.equal(calls, 1);
  h.unmount();
});
