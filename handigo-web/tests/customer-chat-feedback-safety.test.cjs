const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { exports, Date, Promise, queueMicrotask, ...globals,
    require: name => name in modules ? modules[name] : name.startsWith('.') || name.startsWith('@/') ? {} : require(name) });
  return exports;
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const tick = () => new Promise(setImmediate);
function hooks() {
  const slots = [];
  let cursor = 0;
  let pending = [];
  const same = (left, right) => left && right && left.length === right.length && left.every((item, index) => item === right[index]);
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: initial, set: next => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; } };
      return [slots[index].value, slots[index].set];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useMemo(work, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) slots[index] = { deps, value: work() };
      return slots[index].value;
    },
    useCallback(work, deps) { return react.useMemo(() => work, deps); },
    useEffect(work, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) pending.push(() => {
        slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: work() };
      });
    },
  };
  return {
    react,
    render(work) { cursor = 0; pending = []; const value = work(); const effects = pending; effects.forEach(run => run()); return value; },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}
function socketFixture() {
  const handlers = new Map(); let created = 0;
  const socket = { on(name, handler) { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name).add(handler); },
    off(name, handler) { handlers.get(name)?.delete(handler); }, emit() {} };
  return { handlers, get created() { return created; }, fire(name, payload) { handlers.get(name)?.forEach(handler => handler(payload)); },
    createAuthenticatedSocket() { created++; return { socket, dispose() {} }; } };
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const result = find(child, predicate); if (result) return result; }
  return null;
}
const user = { id: 'khach', role: 'CUSTOMER' };
const auth = { useAuthStore: selector => selector({ user, isAuthenticated: true }) };

test('KH-21: socket popup chỉ nhận tin mới/sửa của hội thoại hiện tại và dọn listener', () => {
  const app = hooks(); const sockets = socketFixture(); const received = [], updated = [];
  const { useChatSocket } = load('features/chat/hooks/useChatSocket.ts', {
    react: app.react, '@/realtime/authenticatedSocket': sockets,
  });
  app.render(() => useChatSocket('A', message => received.push(message), message => updated.push(message), () => {}));
  sockets.fire('message:new', { _id: 'tin-B', conversationId: 'B' });
  sockets.fire('message:updated', { _id: 'tin-B', conversationId: 'B' });
  assert.equal(received.length, 0); assert.equal(updated.length, 0);
  sockets.fire('message:new', { _id: 'tin-A', conversationId: 'A' });
  sockets.fire('message:updated', { _id: 'tin-A', conversationId: 'A' });
  assert.equal(received.length, 1); assert.equal(updated.length, 1);
  app.unmount(); sockets.fire('message:new', { _id: 'tin-A2', conversationId: 'A' });
  assert.equal(received.length, 1);
});

test('KH-21: đổi popup tạo lại trạng thái; phản hồi lịch sử cũ không đánh dấu đã đọc', async () => {
  const app = hooks(); const oldHistory = deferred(); const seen = [];
  function Thread() {}
  const toast = { useToast: () => ({ addToast() {} }), useToastFeedback: initial => app.react.useState(initial) };
  const history = load('features/chat/hooks/useChatMessages.ts', {
    react: app.react,
    '../hooks/useChatSocket': { useChatSocket() {} },
    './useChatSocket': { useChatSocket() {} },
    '../api/chat.api': { chatApi: { messages: () => oldHistory.promise, seen: async id => { seen.push(id); } } },
    '../utils/chatHistory': load('features/chat/utils/chatHistory.ts', {}),
  }, { window: { setTimeout, clearTimeout } });
  const { ChatPopup } = load('features/chat/components/ChatPopup.tsx', {
    react: app.react, 'react-dom': { createPortal: node => node },
    '@/features/auth/store/auth.store': auth, '@/components/common/Toast': toast,
    '../hooks/useChatMessages': history,
    '../store/chatUi.store': { useChatUiStore: selector => selector({ registerOpenPopup() {}, unregisterOpenPopup() {} }) },
    './MessageThread': { MessageThread: Thread },
    '../api/chat.api': { chatApi: { messages: () => oldHistory.promise, seen: async id => { seen.push(id); } } },
  }, { document: { body: {}, addEventListener() {}, removeEventListener() {} } });
  const first = ChatPopup({ conversation: { _id: 'A' }, open: true, onClose() {} });
  const second = ChatPopup({ conversation: { _id: 'B' }, open: true, onClose() {} });
  assert.notEqual(first.key, second.key);
  app.render(() => first.type(first.props)); await tick();
  app.unmount();
  oldHistory.resolve({ items: [{ _id: 'tin-A', conversationId: 'A', createdAt: new Date().toISOString() }] });
  await tick(); assert.equal(seen.length, 0);
});

test('KH-25: danh sách rỗng vẫn nghe tin đầu tiên, kết nối lại và mở menu tải lại', async () => {
  const app = hooks(); const sockets = socketFixture(); const windowEvents = new EventTarget(), documentEvents = new EventTarget();
  documentEvents.visibilityState = 'visible';
  let rows = []; let reads = 0;
  const { MessageCenter } = load('features/chat/components/MessageCenter.tsx', {
    react: app.react, '@/features/auth/store/auth.store': auth,
    '@/components/common/Toast': { useToastFeedback: initial => app.react.useState(initial) },
    '@/realtime/authenticatedSocket': sockets,
    '../api/chat.api': { chatApi: { conversations: async () => { reads++; return { items: rows }; } } },
  }, { window: windowEvents, document: documentEvents });
  const page = MessageCenter(); const render = () => app.render(() => page.type(page.props));
  render(); await tick(); render();
  assert.equal(sockets.created, 1, 'Phải tạo listener ngay cả khi chưa có hội thoại.');
  rows = [{ _id: 'hoi-thoai-moi', customerId: 'khach', providerId: 'tho', lastMessage: { senderId: 'tho', sentAt: new Date().toISOString() } }];
  sockets.fire('message:new', { conversationId: 'hoi-thoai-moi' }); await tick();
  const tree = render();
  const button = find(tree, node => node.props?.['aria-label'] === 'Tin nhắn');
  const beforeOpen = reads; button.props.onClick(); await tick();
  assert.ok(reads > beforeOpen);
  const opened = render();
  assert.ok(find(opened, node => node.props?.conversation?._id === 'hoi-thoai-moi'));
  const beforeConnect = reads; sockets.fire('connect'); await tick(); render();
  assert.ok(reads > beforeConnect); assert.equal(sockets.created, 1, 'Tải danh sách không gây vòng lặp tạo socket.');
  const beforeFocus = reads; windowEvents.dispatchEvent(new Event('focus')); await tick();
  assert.ok(reads > beforeFocus);
  app.unmount(); const afterUnmount = reads; sockets.fire('message:new', {}); await tick(); assert.equal(reads, afterUnmount);
});

test('KH-22: đổi đơn che context cũ và chặn lưu nhầm; bỏ phản hồi tải cũ', async () => {
  const app = hooks(); const requests = []; const saves = [];
  const { useOrderFeedback } = load('features/feedback/hooks/useFeedback.ts', {
    react: app.react,
    '../services/feedback.service': { feedbackService: {
      loadOrderContext: id => { const request = { id, ...deferred() }; requests.push(request); return request.promise; },
      save: async (id, payload) => { saves.push({ id, payload }); return { _id: id }; },
    } },
  });
  const A = 'aaaaaaaaaaaaaaaaaaaaaaaa', B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
  const render = id => app.render(() => useOrderFeedback(id));
  render(A); await tick();
  requests[0].resolve({ order: { _id: A }, feedback: { _id: 'danh-gia-A' }, canReview: true }); await tick();
  const old = render(A).load(); await tick();
  const next = render(B); await tick();
  assert.equal(next.context, null); assert.equal(next.loading, true);
  await assert.rejects(next.save({ orderId: B, rating: 1 }, []), /chưa khớp/);
  requests[2].resolve({ order: { _id: B }, feedback: { _id: 'danh-gia-B' }, canReview: true }); await tick();
  requests[1].resolve({ order: { _id: A }, feedback: { _id: 'danh-gia-A' }, canReview: true }); await old;
  const current = render(B); assert.equal(current.context.order._id, B);
  await current.save({ orderId: B, rating: 5 }, []);
  assert.equal(saves.length, 1); assert.equal(saves[0].id, 'danh-gia-B');
  assert.equal(render('khong-hop-le').context, null);
});

test('KH-22: rời trang trong lúc upload ảnh không được gọi API lưu đánh giá', async () => {
  const uploading = deferred(); let current = true; let writes = 0;
  const { feedbackService } = load('features/feedback/services/feedback.service.ts', {
    '../api/feedback.api': { feedbackApi: {
      uploadImages: () => uploading.promise,
      update: async () => { writes++; }, create: async () => { writes++; },
    } },
  });
  const saving = feedbackService.save('danh-gia-A', { orderId: 'A', rating: 5 }, [{}], () => current);
  current = false; uploading.resolve(['https://example.test/anh.jpg']);
  await assert.rejects(saving); assert.equal(writes, 0);
});
