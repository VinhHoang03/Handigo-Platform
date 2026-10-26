const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const sourceRoot = path.join(__dirname, '../src');
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const notification = (userId, extra = {}) => ({
  id: `tb-${userId}`, userId, type: 'ORDER', title: 'Thông báo', content: 'Nội dung', isRead: false,
  createdAt: '2026-10-15T00:00:00Z', updatedAt: '2026-10-15T00:00:00Z', ...extra,
});
const listResult = items => ({ items, pagination: { page: 1, totalPages: 1 } });

test('KH-42: thông báo đề nghị nhận việc mở luồng phản hồi thay vì chi tiết chưa có quyền xem', () => {
  const runtime = setup();
  const utils = runtime.load('components/common/notification-bell/notificationBell.utils.ts');
  const item = notification('A', { data: { assignmentId: 'de-nghi', orderId: 'don', actionUrl: '/provider/orders/don' } });
  assert.equal(utils.getNotificationTarget(item, 'PROVIDER'), '/provider/orders?assignmentId=de-nghi&orderId=don');
  assert.equal(utils.getNotificationTarget({ ...item, data: { ...item.data, orderUnavailable: true } }, 'PROVIDER'), null);
  assert.equal(utils.getNotificationTarget(notification('A', { data: { orderId: 'don' } }), 'PROVIDER'), '/provider/orders/don');
});

function setup() {
  const slots = [];
  const effects = [];
  const timers = new Map();
  const sockets = [];
  const toasts = [];
  const calls = [];
  let cursor = 0;
  let timerId = 0;
  let auth = { user: { id: 'A' }, isAuthenticated: true };
  const authStore = select => select(auth);
  authStore.getState = () => ({ ...auth, logout() { calls.push('logout'); auth = { user: null, isAuthenticated: false }; }, setUser() {} });
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) {
        slots[index] = { value: typeof initial === 'function' ? initial() : initial };
        slots[index].set = value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; };
      }
      return [slots[index].value, slots[index].set];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(fn, deps) {
      const index = cursor++;
      if (!sameDeps(slots[index]?.deps, deps)) slots[index] = { fn, deps };
      return slots[index].fn;
    },
    useMemo(fn, deps) { return react.useCallback(fn, deps)(); },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!sameDeps(slots[index]?.deps, deps)) {
        const previous = slots[index];
        effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; });
      }
    },
  };
  const api = {
    list: async () => listResult([notification(auth.user.id)]),
    unreadCount: async () => ({ count: 1 }),
    markAsRead: async id => { calls.push(['read', id]); return { ...notification(auth.user.id), id, isRead: true }; },
    markAllAsRead: async () => { calls.push('readAll'); return { modifiedCount: 1 }; },
  };
  const toastModule = {
    useToast: () => ({ addToast: (...args) => toasts.push(args) }),
    useToastFeedback(initial, type) {
      const [value, setValue] = react.useState(initial);
      const report = react.useCallback(next => { setValue(next); if (next) toasts.push([next, type]); }, [setValue, type]);
      return [value, report];
    },
  };
  const modules = {
    react,
    '@/features/auth/store/auth.store': { useAuthStore: authStore },
    '@/features/notification/api/notification.api': { notificationApi: api },
    '../api/notification.api': { notificationApi: api },
    '@/features/auth/api/auth.api': { getMeApi: async () => auth.user },
    '@/realtime/authenticatedSocket': { createAuthenticatedSocket() {
      const entry = { disposed: false, handlers: {}, socket: {
        on(event, handler) { entry.handlers[event] = handler; },
        off(event) { delete entry.handlers[event]; },
      }, dispose() { entry.disposed = true; } };
      sockets.push(entry);
      return entry;
    } },
    '@/components/common/Toast': toastModule,
    'lucide-react': {},
  };
  const cache = new Map();
  function load(file) {
    const filename = path.resolve(sourceRoot, file);
    if (cache.has(filename)) return cache.get(filename);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const exports = {};
    cache.set(filename, exports);
    vm.runInNewContext(code, { exports, Error, window: {
      setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; },
      clearTimeout(id) { timers.delete(id); }, setInterval() { return ++timerId; }, clearInterval() {},
    }, require(name) {
      if (name in modules) return modules[name];
      if (name === '../Toast') return modules['@/components/common/Toast'];
      const base = name.startsWith('@/') ? path.join(sourceRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
      for (const suffix of ['.ts', '.tsx']) if (fs.existsSync(base + suffix)) return load(base + suffix);
      return require(name);
    } }, { filename });
    return exports;
  }
  const options = { onReassignmentRequired: id => calls.push(['reassign', id]) };
  const { useNotificationFeed } = load('components/common/notification-bell/useNotificationFeed.ts');
  const renderHook = callback => {
    cursor = 0;
    const result = callback();
    while (effects.length) effects.shift()();
    return result;
  };
  const render = () => renderHook(() => useNotificationFeed('CUSTOMER', options));
  return { api, calls, sockets, toasts, modules, load, render, renderHook,
    loadWrapper(file) {
      const filename = path.join(sourceRoot, file);
      const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
      }).outputText;
      const exports = {};
      vm.runInNewContext(code, { exports, document: { addEventListener() {}, removeEventListener() {} }, require(name) {
        if (name === 'react/jsx-runtime') return require(name);
        return modules[name] || {};
      } });
      return exports;
    },
    setUser(id) { auth = { user: id ? { id } : null, isAuthenticated: Boolean(id) }; },
    flushTimers() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

test('Chuông bỏ qua thông báo đơn, ví và SYSTEM riêng của tài khoản khác', () => {
  const runtime = setup();
  runtime.render();
  const receive = runtime.sockets[0].handlers['notification:new'];
  for (const type of ['ORDER', 'PAYMENT', 'SYSTEM']) {
    receive(notification('B', { type, data: { providerApplicationId: 'ho-so', status: 'approved', applicationType: 'initial', action: 'order_reassignment_required', orderId: 'don-B' } }));
  }
  const feed = runtime.render();
  assert.equal(feed.items.length, 0);
  assert.equal(feed.unreadCount, 0);
  assert.equal(runtime.toasts.length, 0);
  assert.equal(runtime.calls.length, 0);
});

test('Thông báo cá nhân và bản thông báo chung gửi đúng tài khoản vẫn hiển thị', () => {
  const runtime = setup();
  runtime.render();
  const receive = runtime.sockets[0].handlers['notification:new'];
  receive(notification('A'));
  receive(notification({ _id: 'A' }, { id: 'chung-A', type: 'SYSTEM' }));
  const feed = runtime.render();
  assert.deepEqual(Array.from(feed.items, item => item.id), ['chung-A', 'tb-A']);
  assert.equal(feed.unreadCount, 2);
});

test('Phản hồi tải chậm của A không cập nhật chuông sau khi đăng nhập B', async () => {
  const runtime = setup();
  const pending = deferred();
  runtime.api.list = () => pending.promise;
  runtime.render();
  runtime.flushTimers();
  runtime.setUser('B');
  pending.resolve(listResult([notification('A')]));
  await new Promise(setImmediate);
  const feed = runtime.render();
  assert.equal(feed.items.length, 0);
  assert.equal(feed.unreadCount, 0);
});

test('Sự kiện còn chờ của socket A không gây toast, đăng xuất hoặc mở đơn trên B', () => {
  const runtime = setup();
  runtime.render();
  const staleHandler = runtime.sockets[0].handlers['notification:new'];
  runtime.setUser('B');
  staleHandler(notification('A', { type: 'SYSTEM', data: { providerApplicationId: 'ho-so', status: 'approved', applicationType: 'initial' } }));
  assert.equal(runtime.toasts.length, 0);
  assert.equal(runtime.calls.length, 0);
});

test('Đánh dấu đã đọc không được gửi cho thông báo của tài khoản khác', async () => {
  const runtime = setup();
  await runtime.render().markAsRead(notification('B'));
  assert.equal(runtime.calls.length, 0);
});

test('Chuông lọc người nhận cả khi tải API và thêm trang', async () => {
  const runtime = setup();
  runtime.api.list = async () => ({ ...listResult([notification('A'), notification('B', { type: 'SYSTEM' })]), pagination: { totalPages: 2 } });
  runtime.render();
  runtime.flushTimers();
  await new Promise(setImmediate);
  assert.deepEqual(Array.from(runtime.render().items, item => item.userId), ['A']);
  runtime.render().loadMore();
  await new Promise(setImmediate);
  assert.ok(runtime.render().items.every(item => item.userId === 'A'));
});

test('Đổi account cùng vai trò tạo mới cây giao diện và đăng xuất ẩn thông báo', () => {
  for (const [file, name] of [
    ['components/common/NotificationBell.tsx', 'NotificationBell'],
    ['features/notification/pages/NotificationsPage.tsx', 'default'],
  ]) {
    const runtime = setup();
    const Component = runtime.loadWrapper(file)[name];
    const previous = Component({ role: 'CUSTOMER' });
    runtime.setUser('B');
    const next = Component({ role: 'CUSTOMER' });
    assert.notEqual(previous.key, next.key);
    runtime.setUser(null);
    assert.equal(Component({ role: 'CUSTOMER' }), null);
  }
});

test('Rời cây giao diện cũ đóng socket và bỏ qua sự kiện còn chờ, kể cả đăng nhập lại A', () => {
  const runtime = setup();
  runtime.render();
  const oldSocket = runtime.sockets[0];
  const receive = oldSocket.handlers['notification:new'];
  runtime.unmount();
  assert.equal(oldSocket.disposed, true);
  assert.equal(oldSocket.handlers['notification:new'], undefined);
  runtime.setUser('A');
  receive(notification('A', { type: 'SYSTEM', data: { providerApplicationId: 'ho-so', status: 'approved', applicationType: 'initial' } }));
  assert.equal(runtime.calls.length, 0);
  assert.equal(runtime.toasts.length, 0);
});

test('Đọc xong thông báo A sau khi chuyển B không cập nhật bộ đếm hoặc tải dữ liệu B', async () => {
  const runtime = setup();
  const pending = deferred();
  runtime.api.markAsRead = () => pending.promise;
  runtime.render();
  runtime.sockets[0].handlers['notification:new'](notification('A'));
  const reading = runtime.render().markAsRead(notification('A'));
  runtime.setUser('B');
  pending.resolve();
  await reading;
  assert.equal(runtime.render().unreadCount, 1, 'Phản hồi cũ không được sửa trạng thái');
});

test('Trang thông báo cá nhân lọc sai người nhận và bỏ phản hồi tải chậm sau khi đổi account', async () => {
  const runtime = setup();
  const { useNotificationsPageController } = runtime.load('features/notification/components/use-notifications-page.ts');
  const renderPage = () => runtime.renderHook(() => useNotificationsPageController('CUSTOMER'));
  runtime.api.list = async () => listResult([notification('A'), notification('B')]);
  await renderPage().refresh();
  assert.deepEqual(Array.from(renderPage().items, item => item.userId), ['A']);
  const pending = deferred();
  runtime.api.list = () => pending.promise;
  const loading = renderPage().refresh();
  runtime.setUser('B');
  pending.resolve(listResult([notification('B')]));
  await loading;
  assert.deepEqual(Array.from(renderPage().items, item => item.userId), ['A'], 'Phản hồi của cây cũ phải bị bỏ qua');
});

test('Phản hồi đánh dấu đã đọc từ trang A không hiện toast ở account B', async () => {
  const runtime = setup();
  const { useNotificationsPageController } = runtime.load('features/notification/components/use-notifications-page.ts');
  const pending = deferred();
  runtime.api.markAsRead = () => pending.promise;
  const controller = runtime.renderHook(() => useNotificationsPageController('CUSTOMER'));
  const reading = controller.markOne(notification('A'));
  runtime.setUser('B');
  pending.resolve();
  await reading;
  assert.equal(runtime.toasts.length, 0);
});

test('Trang admin dùng hộp thư của chính admin, không tải hộp thư mọi tài khoản', async () => {
  const runtime = setup();
  let adminListCalls = 0;
  runtime.api.adminList = async () => { adminListCalls++; return listResult([notification('B')]); };
  runtime.api.list = async () => listResult([notification('A'), notification('B'), notification('A', { id: 'chung-A', type: 'SYSTEM' })]);
  const { useNotificationsPageController } = runtime.load('features/notification/components/use-notifications-page.ts');
  const renderPage = () => runtime.renderHook(() => useNotificationsPageController('ADMIN'));
  await renderPage().refresh();
  assert.equal(adminListCalls, 0);
  assert.deepEqual(Array.from(renderPage().items, item => item.id), ['tb-A', 'chung-A']);
  assert.equal(renderPage().unreadCount, 1);
});

test('Thông báo đã đọc được kiểm tra lại và cập nhật nhãn hết hiệu lực khi bấm', async () => {
  const runtime = setup();
  const old = notification('A', { isRead: true });
  const latest = { ...old, data: { orderId: 'don-cu', orderUnavailable: true } };
  let requests = 0;
  runtime.api.list = async () => listResult([old]);
  runtime.api.markAsRead = async () => { requests++; return latest; };
  runtime.render();
  runtime.flushTimers();
  await new Promise(setImmediate);
  const result = await runtime.render().markAsRead(old);
  assert.equal(requests, 1);
  assert.equal(result.data.orderUnavailable, true);
  assert.equal(runtime.render().items[0].data.orderUnavailable, true);
  assert.equal(runtime.render().unreadCount, 1, 'Không trừ số chưa đọc khi bấm thông báo đã đọc');
});

test('Sự kiện đổi thợ tải lại trạng thái lịch sử trên chuông', async () => {
  const runtime = setup();
  runtime.render();
  runtime.api.list = async () => listResult([notification('A', { data: { orderUnavailable: true } })]);
  runtime.sockets[0].handlers['order:updated']();
  await new Promise(setImmediate);
  assert.equal(runtime.render().items[0].data.orderUnavailable, true);
});

function textContent(element) {
  if (element == null || typeof element === 'boolean') return '';
  if (typeof element !== 'object') return String(element);
  return [element.props?.children].flat(Infinity).map(textContent).join(' ');
}

test('Thông báo hết hiệu lực có nhãn ngay trong chuông và lịch sử; không sinh liên kết chi tiết', () => {
  const runtime = setup();
  const item = notification('A', { data: { orderId: 'don-cu', orderUnavailable: true } });
  const utils = runtime.load('components/common/notification-bell/notificationBell.utils.ts');
  const { NotificationItem } = runtime.load('components/common/notification-bell/NotificationItem.tsx');
  const { NotificationList } = runtime.load('features/notification/components/NotificationList.tsx');
  const list = NotificationList({ items: [item], onOpen() {}, onMarkRead() {} });
  const row = list.props.children[0];
  for (const element of [NotificationItem({ item, onOpen() {} }), row.type(row.props)]) {
    const text = textContent(element);
    assert.match(text, /Không còn hiệu lực/);
    assert.match(text, /Bạn không còn phụ trách đơn hàng này/);
  }
  assert.equal(utils.getNotificationTarget(item, 'PROVIDER'), null);
  assert.equal(utils.getNotificationTarget(notification('A', { type: 'PAYMENT', data: { orderId: 'don-cu', walletId: 'vi' } }), 'PROVIDER'), '/provider/wallet');
});

test('Bấm chuông hiện toast cho đơn hết hiệu lực, chỉ điều hướng nếu còn được phân công', async () => {
  for (const unavailable of [true, false]) {
    const runtime = setup();
    const navigation = [];
    const old = notification('A', { isRead: true, data: { orderId: 'don' } });
    const latest = { ...old, data: { ...old.data, orderUnavailable: unavailable } };
    runtime.modules['react-router-dom'] = { useNavigate: () => target => navigation.push(target) };
    runtime.modules['@/features/notification/hooks/useNotificationAccount'] = runtime.load('features/notification/hooks/useNotificationAccount.ts');
    runtime.modules['./notification-bell/notificationBell.utils'] = runtime.load('components/common/notification-bell/notificationBell.utils.ts');
    runtime.modules['./Toast'] = runtime.modules['@/components/common/Toast'];
    runtime.modules['./notification-bell/useReassignmentPrompt'] = { useReassignmentPrompt: () => ({ action: null }) };
    runtime.modules['./notification-bell/useNotificationFeed'] = { useNotificationFeed: () => ({
      open: true, canUseUserNotifications: true, unreadCount: 0, query: { page: 1 }, totalPages: 1,
      setOpen() {}, markAsRead: async () => latest,
    }) };
    runtime.modules['./notification-bell/NotificationBellPanel'] = { NotificationBellPanel: 'panel' };
    const { NotificationBell } = runtime.loadWrapper('components/common/NotificationBell.tsx');
    const wrapper = NotificationBell({ role: 'PROVIDER' });
    const element = runtime.renderHook(() => wrapper.type(wrapper.props));
    const panel = element.props.children.find(child => child?.type === 'panel');
    panel.props.onOpen(old);
    await new Promise(setImmediate);
    assert.deepEqual(navigation, unavailable ? [] : ['/provider/orders/don']);
    assert.equal(runtime.toasts.length, unavailable ? 1 : 0);
    if (unavailable) assert.match(runtime.toasts[0][0], /không còn phụ trách/);
  }
});
