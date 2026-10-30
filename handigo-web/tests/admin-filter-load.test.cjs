const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const root = path.join(__dirname, '../src');
const compile = file => ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
  fileName: file,
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const settle = () => new Promise(resolve => setImmediate(resolve));

function harness(dashboard = false) {
  let cursor = 0, time = 0, sequence = 0, session = 1, writes = 0;
  let key = 'A', enabled = true, search = 'fromDate=2026-10-01&toDate=2026-10-31';
  const slots = [], effects = [], timers = new Map(), requests = [];
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const hooks = { ...React,
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === 'function' ? initial() : initial, set(next) { writes++; this.value = typeof next === 'function' ? next(this.value) : next; } };
      slots[index].setter ??= slots[index].set.bind(slots[index]);
      return [slots[index].value, slots[index].setter];
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useMemo(fn, deps) { const i = cursor++; if (!slots[i] || !equal(slots[i].deps, deps)) slots[i] = { deps, value: fn() }; return slots[i].value; },
    useCallback(fn, deps) { return this.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || !equal(slots[i].deps, deps)) {
        const previous = slots[i]; slots[i] = { deps, cleanup: previous?.cleanup };
        effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = fn(); });
      }
    },
  };
  // Các hook được gọi như hàm độc lập trong mã đã biên dịch.
  hooks.useCallback = (fn, deps) => hooks.useMemo(() => fn, deps);
  const clock = {
    setTimeout(fn, delay = 0) { const id = ++sequence; timers.set(id, { fn, at: time + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  const request = (signal, filter = key) => {
    const pending = { ...deferred(), signal, filter }; requests.push(pending); return pending.promise;
  };
  const readModule = {};
  vm.runInNewContext(compile('features/admin/hooks/useAdminRead.ts'), {
    exports: readModule, AbortController, window: clock,
    require(name) {
      if (name === 'react') return hooks;
      if (name.endsWith('auth.store')) return { useAuthStore: select => select({ sessionRevision: session }) };
      if (name.endsWith('apiError')) return { getErrorMessage: (cause, fallback) => cause?.message || fallback };
      throw Error(name);
    },
  });
  let Component;
  if (dashboard) {
    const exports = {};
    vm.runInNewContext(compile('features/admin/pages/AdminDashboardPage.tsx'), { exports, URLSearchParams, Date,
      require(name) {
        if (name === 'react') return hooks;
        if (name === 'react/jsx-runtime') return require(name);
        if (name === 'react-router-dom') return { useSearchParams: () => [new URLSearchParams(search), () => {}] };
        if (name.endsWith('useAdminRead')) return readModule;
        if (name.endsWith('adminOperations.api')) return { adminOperationsApi: {
          orderAnalytics: (query, signal) => request(signal, query.toDate), providerAnalytics: (query, signal) => request(signal, query.toDate),
        } };
        if (name.endsWith('revenue-period')) return { revenueRangeFromSearch: value => Object.fromEntries(new URLSearchParams(value)) };
        return new Proxy({}, { get: () => () => null });
      },
    });
    Component = exports.default;
  }
  const render = () => {
    cursor = 0;
    const currentKey = key;
    const value = dashboard ? Component() : readModule.useAdminRead(key, signal => request(signal, currentKey), { enabled });
    effects.splice(0).forEach(fn => fn());
    return value;
  };
  return { requests, render,
    change(value) { key = value; search = `fromDate=2026-10-01&toDate=2026-10-${String(value).padStart(2, '0')}`; return render(); },
    setSession(value) { session = value; return render(); },
    disable() { enabled = false; return render(); },
    advance(ms) {
      const target = time + ms;
      while (true) {
        const next = [...timers].filter(([, task]) => task.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        timers.delete(next[0]); time = next[1].at; next[1].fn();
      }
      time = target;
    },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
    writes: () => writes,
  };
}

test('25 lần đổi bộ lọc nhanh chỉ gửi hai request analytics của kỳ cuối', () => {
  const page = harness(true);
  page.render();
  for (let i = 1; i <= 25; i++) { page.change(i); page.advance(10); }
  assert.equal(page.requests.length, 0);
  page.advance(250);
  assert.equal(page.requests.length, 2);
  assert(page.requests.every(item => item.filter === '2026-10-25'));
  page.unmount();
});

test('Hủy request cũ và phản hồi ngược thứ tự không ghi đè kết quả mới', async () => {
  const view = harness(); view.render(); view.advance(250);
  const old = view.requests[0]; view.change('B'); assert(old.signal.aborted); view.advance(250);
  view.requests[1].resolve('Kỳ B'); await settle(); assert.equal(view.render().data, 'Kỳ B');
  old.resolve('Kỳ A'); await settle(); assert.equal(view.render().data, 'Kỳ B'); view.unmount();
});

test('Lỗi từ request cũ không hiện toast lỗi hoặc kết thúc trạng thái tải mới', async () => {
  const view = harness(); view.render(); view.advance(250); view.change('B'); view.advance(250);
  view.requests[0].reject(Error('Lỗi cũ')); await settle();
  const state = view.render(); assert.equal(state.error, ''); assert(state.loading);
  view.requests[1].resolve('B'); await settle(); assert.equal(view.render().loading, false); view.unmount();
});

test('Giữ dữ liệu kỳ trước trong khi tải và khi kỳ mới lỗi, không gắn nhãn thành kỳ mới', async () => {
  const view = harness(); view.render(); view.advance(250); view.requests[0].resolve('A'); await settle(); view.render();
  const pending = view.change('B'); assert.equal(pending.data, 'A'); assert.equal(pending.dataKey, 'A'); assert(pending.loading);
  view.advance(250); view.requests[1].reject(Error('Không tải được B')); await settle();
  const failed = view.render(); assert.equal(failed.dataKey, 'A'); assert.equal(failed.loading, false); assert.match(failed.error, /Không tải/); view.unmount();
});

test('Request treo có deadline, kết quả đến muộn bị bỏ và vẫn có thể thử lại', async () => {
  const view = harness(); view.render(); view.advance(30250);
  let state = view.render(); assert.equal(state.loading, false); assert.match(state.error, /quá nhiều thời gian/); assert(view.requests[0].signal.aborted);
  view.requests[0].resolve('Muộn'); await settle(); assert.equal(view.render().data, null);
  state.reload(); view.render(); view.advance(250); view.requests[1].resolve('Đã phục hồi'); await settle();
  state = view.render(); assert.equal(state.data, 'Đã phục hồi'); assert.equal(state.error, ''); view.unmount();
});

test('Đổi tài khoản không hiển thị dữ liệu phiên trước', async () => {
  const view = harness(); view.render(); view.advance(250); view.requests[0].resolve('Phiên cũ'); await settle(); view.render();
  assert.equal(view.setSession(2).data, null); view.advance(250); view.requests[1].resolve('Phiên mới'); await settle();
  assert.equal(view.render().data, 'Phiên mới'); view.unmount();
});

test('Rời trang hủy transport và phản hồi sau unmount không cập nhật state', async () => {
  const view = harness(); view.render(); view.advance(250); view.unmount(); const before = view.writes();
  assert(view.requests[0].signal.aborted); view.requests[0].resolve('Muộn'); await settle(); assert.equal(view.writes(), before);
});

test('Callback mới cùng khóa không gửi lại; tắt đọc khi đã có dữ liệu chia sẻ', () => {
  const view = harness(); view.render(); view.advance(250);
  for (let i = 0; i < 10; i++) { view.render(); view.advance(10); }
  assert.equal(view.requests.length, 1);
  assert.equal(view.disable().loading, false); assert(view.requests[0].signal.aborted); view.advance(1000);
  assert.equal(view.requests.length, 1); view.unmount();
});

test('API truyền signal hủy xuống Axios, không thêm signal vào tham số HTTP', async () => {
  const calls = [];
  const signal = new AbortController().signal;
  const loadApi = (file, name) => {
    const exports = {};
    vm.runInNewContext(compile(file), { exports, require(module) {
      if (module === '@/api/client') return { __esModule: true, default: { get: async (url, config) => { calls.push({ url, config }); return { data: { success: true, data: {} } }; } } };
      if (module === '@/api/response') return { unwrap: response => response.data.data };
      throw Error(module);
    } });
    return exports[name];
  };
  const operations = loadApi('features/admin/api/adminOperations.api.ts', 'adminOperationsApi');
  const dashboard = loadApi('features/admin/api/adminDashboard.api.ts', 'adminDashboardApi');
  const revenue = loadApi('features/admin/api/adminRevenue.api.ts', 'adminRevenueApi');
  const query = { fromDate: '2026-10-01', toDate: '2026-10-31' };
  await Promise.all([operations.orderAnalytics(query, signal), operations.providerAnalytics(query, signal), operations.payments(query, signal),
    dashboard.insights(query, signal), dashboard.monthlyTrend(query, signal), revenue.getInsights(query, signal)]);
  assert.equal(calls.length, 6);
  for (const call of calls) { assert.equal(call.config.signal, signal); assert.equal(call.config.params, query); assert.equal('signal' in call.config.params, false); }
});

test('Bảng xếp hạng dùng dữ liệu trang cha thì không tải lại provider analytics', () => {
  const exports = {};
  let canRead;
  vm.runInNewContext(compile('features/admin/components/revenue/RevenueProviderRanking.tsx'), { exports, require(name) {
    if (name === 'react/jsx-runtime') return require(name);
    if (name.endsWith('useAdminRead')) return { useAdminRead: (_, __, options) => { canRead = options.enabled; return { data: null, loading: false, error: '', reload() {} }; } };
    if (name.endsWith('adminOperations.api')) return { adminOperationsApi: { providerAnalytics() { throw Error('Không được gọi thêm API'); } } };
    return new Proxy({}, { get: () => () => null });
  } });
  exports.RevenueProviderRanking({ range: { fromDate: '2026-10-01', toDate: '2026-10-31' }, providers: { topProvidersByRevenue: [] } });
  assert.equal(canRead, false);
});

test('Giảm animation riêng cho dashboard và vẫn tôn trọng cài đặt hệ điều hành', () => {
  for (const [dashboard, system, expected] of [[true, false, true], [false, true, true], [false, false, false]]) {
    const exports = {};
    vm.runInNewContext(compile('components/common/chart/use-prefers-reduced-motion.ts'), { exports,
      window: { matchMedia: () => ({ matches: system }) }, require: () => ({ createContext: value => value, useContext: () => dashboard,
        useState: fn => [fn(), () => {}], useEffect() {} }),
    });
    assert.equal(exports.usePrefersReducedMotion(), expected);
  }
});
