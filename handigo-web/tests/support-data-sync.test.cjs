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
