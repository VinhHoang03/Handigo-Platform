const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Date, Map, Set, window: { setTimeout, clearTimeout },
    require: name => { if (!(name in modules)) throw new Error(name); return modules[name]; } });
  return exports;
}
function hooks() {
  const slots = [];
  let cursor = 0, effects = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((item, i) => item === b[i]);
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
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const message = n => ({ _id: String(n).padStart(4, '0'), conversationId: 'A',
  createdAt: new Date(1700000000000 + n * 1000).toISOString(), content: `Nội dung ${n}` });

test('Gộp theo đúng cặp khách và thợ, không gộp nhầm người khi thiếu định danh', () => {
  const { groupConversations } = load('features/chat/utils/conversationGroups.ts');
  const items = [
    { _id: '1', customerId: 'c1', providerId: { _id: 'p1' } },
    { _id: '2', customerId: { _id: 'c1' }, providerId: 'p1' },
    { _id: '3', customerId: 'c2', providerId: 'p1' },
    { _id: '4', customerId: 'c1', providerId: 'p2' },
    { _id: '5', customerId: 'c1' },
    { _id: '6', customerId: 'c1' },
  ];
  const groups = groupConversations(items);
  assert.equal(groups.length, 5);
  assert.equal(groups[0].map(item => item._id).join(','), '1,2');
});

test('Tin đơn cũ nằm trọn phía trên đơn mới dù có phản hồi muộn', () => {
  const { orderConversationMessages, conversationOrderStatus } = load('features/chat/utils/conversationGroups.ts');
  const oldOrder = { _id: 'A', orderId: { _id: '0001', status: 'completed' } };
  const newOrder = { _id: 'B', orderId: { _id: '0002', status: 'accepted' } };
  const messages = [message(1), { ...message(2), conversationId: 'B' }, message(3)];
  const ordered = orderConversationMessages(messages, [newOrder, oldOrder]);
  assert.equal(ordered.map(item => item._id).join(','), '0001,0003,0002');
  assert.equal(messages.map(item => item._id).join(','), '0001,0002,0003');
  assert.equal(conversationOrderStatus(oldOrder), 'Đã hoàn thành');
});

test('Tự nối đơn đang xử lý mới nhất và ngừng gửi khi mọi đơn đã kết thúc', () => {
  const { activeOrderConversation } = load('features/chat/utils/conversationGroups.ts');
  const items = [
    { _id: 'C', orderId: { _id: '0003', status: 'cancelled' } },
    { _id: 'A', orderId: { _id: '0001', status: 'completed' } },
    { _id: 'B', orderId: { _id: '0002', status: 'in_progress' } },
  ];
  assert.equal(activeOrderConversation(items)._id, 'B');
  const next = { _id: 'D', orderId: { _id: '0004', status: 'accepted' } };
  assert.equal(activeOrderConversation([next, ...items])._id, 'D');
  items[2].orderId.status = 'completed';
  assert.equal(activeOrderConversation(items), undefined);
});

test('Danh sách hội thoại tải mọi trang trước khi gộp cùng thợ', async () => {
  const calls = [];
  const { chatApi } = load('features/chat/api/chat.api.ts', {
    '@/api/client': { __esModule: true, default: { get: async (_url, { params }) => {
      calls.push(params.page);
      return { data: { data: { items: [{ _id: String(params.page), customerId: 'c1', providerId: 'p1' }],
        pagination: { totalPages: 2 } } } };
    } } },
  });
  const items = await chatApi.allConversations();
  assert.equal(calls.join(','), '1,2');
  assert.equal(items.length, 2);
  const { groupConversations } = load('features/chat/utils/conversationGroups.ts');
  assert.equal(groupConversations(items).length, 1);
});

test('Socket tham gia mọi đơn trong nhóm và chỉ nhận tin thuộc nhóm', () => {
  const handlers = new Map();
  const joined = [], received = [], updated = [];
  let cleanup, disposed = false, reconnected = false;
  const { useChatSocket } = load('features/chat/hooks/useChatSocket.ts', {
    react: { useEffect: fn => { cleanup = fn(); } },
    '@/realtime/authenticatedSocket': { createAuthenticatedSocket: () => ({
      socket: {
        on: (event, handler) => handlers.set(event, handler),
        off: event => handlers.delete(event),
        emit: (_event, payload) => joined.push(payload.conversationId),
      },
      dispose: () => { disposed = true; },
    }) },
  });
  useChatSocket('A,B', item => received.push(item._id), item => updated.push(item._id), () => {},
    () => { reconnected = true; });
  handlers.get('connect')();
  handlers.get('message:new')({ _id: '1', conversationId: 'A' });
  handlers.get('message:new')({ _id: '2', conversationId: 'B' });
  handlers.get('message:new')({ _id: '3', conversationId: 'C' });
  handlers.get('message:updated')({ _id: '2', conversationId: 'B' });
  assert.equal(joined.join(','), 'A,B');
  assert.equal(received.join(','), '1,2');
  assert.equal(updated.join(','), '2');
  assert.equal(reconnected, true);
  cleanup();
  assert.equal(disposed, true);
  assert.equal(handlers.size, 0);
});

test('Lịch sử nhiều đơn tải liên tục theo thời gian, nhận realtime từ mọi đơn và đọc hết các trang', async () => {
  const app = hooks();
  const rows = [
    ...Array.from({ length: 120 }, (_, i) => message(i + 1)),
    { ...message(10), _id: 'B10', conversationId: 'B' },
    { ...message(90), _id: 'B90', conversationId: 'B' },
  ];
  let receive;
  const seen = [];
  const { useChatMessages } = load('features/chat/hooks/useChatMessages.ts', {
    react: app.react,
    '../api/chat.api': { chatApi: {
      messages: async (id, page) => {
        const items = rows.filter(item => item.conversationId === id);
        return { items: items.slice().reverse().slice((page - 1) * 50, page * 50).reverse(),
          pagination: { totalPages: Math.ceil(items.length / 50) } };
      },
      seen: async id => { seen.push(id); },
    } },
    '../utils/chatHistory': load('features/chat/utils/chatHistory.ts'),
    './useChatSocket': { useChatSocket(_ids, onMessage) { receive = onMessage; } },
  });
  const render = () => app.render(() => useChatMessages('A,B'));
  render(); await tick();
  let current = render();
  assert.equal(current.messages[0]._id, '0071');
  assert.equal(current.messages.some(item => item._id === 'B10'), false);
  assert.equal(current.messages.some(item => item._id === 'B90'), true);
  await current.loadOlder();
  current = render();
  assert.equal(current.messages[0]._id, '0021');
  await current.loadOlder();
  current = render();
  assert.equal(current.messages.length, 122);
  assert.equal(current.hasMore, false);
  receive({ ...message(121), _id: 'B121', conversationId: 'B' });
  receive({ ...message(122), _id: 'C122', conversationId: 'C' });
  current = render();
  assert.equal(current.messages.at(-1)._id, 'B121');
  assert.equal(new Set(current.messages.map(item => item._id)).size, 123);
  assert.ok(seen.includes('A') && seen.includes('B'));
  app.unmount();
});

function chatFixture() {
  const app = hooks();
  let rows = Array.from({ length: 101 }, (_, i) => message(i + 1));
  let reconnect, receive, remove;
  const calls = [], seen = [];
  const api = { messages: async (_id, page) => {
    calls.push(page);
    return { items: rows.slice().reverse().slice((page - 1) * 50, page * 50).reverse(),
      pagination: { page, limit: 50, total: rows.length, totalPages: Math.ceil(rows.length / 50) } };
  }, seen: async id => { seen.push(id); } };
  const { useChatMessages } = load('features/chat/hooks/useChatMessages.ts', {
    react: app.react, '../api/chat.api': { chatApi: api },
    '../utils/chatHistory': load('features/chat/utils/chatHistory.ts'),
    './useChatSocket': { useChatSocket(_id, onMessage, _onUpdate, onDelete, onReconnect) {
      reconnect = onReconnect; receive = onMessage; remove = onDelete;
    } },
  });
  return { app, api, calls, seen, render: () => app.render(() => useChatMessages('A')),
    reconnect: () => reconnect(), receive: value => receive(value), remove: id => remove(id),
    changeRows: fn => { rows = fn(rows); } };
}

test('Chat tải đủ 51/101 tin qua các trang và không trùng ID', async () => {
  const context = chatFixture();
  context.render(); await tick();
  let current = context.render();
  assert.equal(current.messages.length, 50);
  assert.equal(current.hasMore, true);
  await current.loadOlder(); current = context.render();
  assert.equal(current.messages.length, 100);
  await current.loadOlder(); current = context.render();
  assert.equal(current.messages.length, 101);
  assert.equal(current.messages[0]._id, '0001');
  assert.equal(current.hasMore, false);
  assert.equal(new Set(current.messages.map(item => item._id)).size, 101);
  context.app.unmount();
});

test('Kết nối lại tải bù hơn 50 tin, cập nhật tin sửa và loại tin đã xóa trong lúc mất mạng', async () => {
  const context = chatFixture();
  context.render(); await tick();
  await context.render().loadOlder();
  context.changeRows(rows => [...rows.filter(item => item._id !== '0050')
    .map(item => item._id === '0060' ? { ...item, content: 'Đã sửa' } : item),
    ...Array.from({ length: 75 }, (_, i) => message(102 + i))]);
  context.reconnect(); await tick();
  const current = context.render();
  assert.ok(current.messages.some(item => item._id === '0002'));
  assert.equal(current.messages.at(-1)._id, '0176');
  assert.equal(current.messages.find(item => item._id === '0060').content, 'Đã sửa');
  assert.equal(current.messages.some(item => item._id === '0050'), false);
  assert.ok(context.calls.includes(4));
  context.app.unmount();
});

test('Tin realtime trong lúc tải không bị ảnh chụp lịch sử cũ ghi đè hoặc khôi phục tin đã xóa', async () => {
  const context = chatFixture(); const request = deferred();
  context.api.messages = () => request.promise;
  context.render(); await tick();
  context.receive(message(2)); context.remove('0001');
  request.resolve({ items: [message(1)], pagination: { page: 1, totalPages: 1 } }); await tick();
  const current = context.render();
  assert.deepEqual(Array.from(current.messages, item => item._id), ['0002']);
  context.app.unmount();
});

test('Phản hồi lịch sử sau khi đóng chat không được đánh dấu đã đọc', async () => {
  const context = chatFixture(); const request = deferred();
  context.api.messages = () => request.promise;
  context.render(); await tick(); context.app.unmount();
  request.resolve({ items: [message(1)], pagination: { page: 1, totalPages: 1 } }); await tick();
  assert.equal(context.seen.length, 0);
});

test('Tin có cùng thời điểm vẫn được tải bù theo ID tới mốc lịch sử cũ', async () => {
  const context = chatFixture();
  const timestamp = message(1).createdAt;
  context.changeRows(rows => rows.map(item => ({ ...item, createdAt: timestamp })));
  context.render(); await tick();
  const firstId = context.render().messages[0]._id;
  context.changeRows(rows => [...rows, ...Array.from({ length: 75 }, (_, i) => ({ ...message(102 + i), createdAt: timestamp }))]);
  context.reconnect(); await tick();
  assert.ok(context.render().messages.some(item => item._id === firstId));
  context.app.unmount();
});

for (const role of ['CUSTOMER', 'PROVIDER']) test(`Bộ chọn đơn ${role} tải trang 2 và đơn từ liên kết ngoài trang đầu`, async () => {
  const app = hooks(); const requests = [];
  const list = async page => { requests.push(page); return { items: [{ _id: `trang-${page}` }], pagination: { totalPages: 2 } }; };
  const { useCaseOrders } = load('features/case-management/hooks/useCaseOrders.ts', {
    react: app.react, '@/features/booking/api/booking.api': { bookingApi: { getMyOrders: list,
      getOrderById: async id => ({ _id: id }) } },
    '@/features/provider/api/providerOrder.api': { providerOrderApi: { getProviderOrders: list } },
    '@/utils/apiError': { getErrorMessage: () => 'Không tải được đơn.' },
  });
  const render = () => app.render(() => useCaseOrders(role, 'don-cu'));
  render(); await tick();
  assert.ok(render().orders.some(item => item._id === 'don-cu'));
  assert.equal(render().hasMore, true);
  await render().loadMore();
  assert.deepEqual(Array.from(render().orders, item => item._id), ['don-cu', 'trang-1', 'trang-2']);
  assert.equal(render().hasMore, false);
  assert.deepEqual(requests, [1, 2]);
  app.unmount();
});
