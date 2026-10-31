const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const axios = require('axios');

const sourceRoot = path.join(__dirname, '../src');
const user = { _id: 'nguoi-dung-thu', fullName: 'Người dùng thử', email: 'test@example.com', role: 'ADMIN' };
const token = (offset = 3600) => `test.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + offset })).toString('base64url')}.test`;
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

for (const status of [200, 401]) {
  test(`KH-40: phản hồi ${status} của A không được áp dụng hoặc gửi lại bằng phiên B`, async () => {
    const entered = deferred(); const pending = deferred();
    const runtime = setup({ transport: async (config, { response, fail }) => {
      if (config.url === '/users/profile') {
        entered.resolve(); await pending.promise;
        if (status === 401) fail(config, status);
        return response(config, { fullName: 'Hồ sơ A' });
      }
    } });
    runtime.store.getState().setAuth({ ...user, id: 'A' }, token());
    const api = runtime.load('api/client.ts').default;
    const result = assert.rejects(api.put('/users/profile', { fullName: 'Hồ sơ A' }), axios.isCancel);
    await entered.promise;
    runtime.store.getState().logout();
    const nextToken = token(7200);
    runtime.store.getState().setAuth({ ...user, id: 'B' }, nextToken);
    pending.resolve(); await result;
    assert.deepEqual(runtime.calls.map(call => call.url), ['/users/profile']);
    assert.equal(runtime.store.getState().user.id, 'B');
    assert.equal(runtime.store.getState().token, nextToken);
  });
}

for (const status of [200, 403]) {
  test(`KH-40: refresh A trả ${status} sau khi đăng nhập B không đổi token hoặc đăng xuất B`, async () => {
    const entered = deferred(); const pending = deferred();
    const runtime = setup({ transport: async (config, { fail }) => {
      if (config.url === '/auth/refresh-token') {
        entered.resolve(); await pending.promise;
        if (status === 403) fail(config, status);
      }
    } });
    runtime.store.getState().setAuth({ ...user, id: 'A' }, token());
    const result = assert.rejects(runtime.load('api/client.ts').refreshAccessToken(), axios.isCancel);
    await entered.promise;
    const nextToken = token(7200);
    runtime.store.getState().setAuth({ ...user, id: 'B' }, nextToken);
    pending.resolve(); await result;
    assert.equal(runtime.store.getState().user.id, 'B');
    assert.equal(runtime.store.getState().token, nextToken);
  });
}

test('KH-40: đăng nhập lại cùng tài khoản cũng vô hiệu hóa request của phiên cũ', async () => {
  const entered = deferred(); const pending = deferred();
  const runtime = setup({ transport: async config => { entered.resolve(); await pending.promise; } });
  runtime.store.getState().setAuth(user, token());
  const result = assert.rejects(runtime.load('api/client.ts').default.get('/users/profile'), axios.isCancel);
  await entered.promise;
  runtime.store.getState().setAuth(user, token(7200));
  pending.resolve(); await result;
});

test('KH-40: phiên mới refresh độc lập, phiên cũ kết thúc không xóa lượt refresh đang chạy', async () => {
  const entered = deferred(); const first = deferred(); const second = deferred();
  let count = 0;
  const runtime = setup({ transport: async config => {
    if (config.url === '/auth/refresh-token') {
      count++;
      if (count === 1) { entered.resolve(); await first.promise; }
      else await second.promise;
    }
  } });
  runtime.store.getState().setAuth({ ...user, id: 'A' }, token());
  const client = runtime.load('api/client.ts');
  const old = assert.rejects(client.refreshAccessToken(), axios.isCancel);
  await entered.promise;
  runtime.store.getState().setAuth({ ...user, id: 'B' }, token(7200));
  const current = client.refreshAccessToken();
  await new Promise(setImmediate);
  first.resolve(); await old;
  const concurrent = client.refreshAccessToken();
  second.resolve(); await Promise.all([current, concurrent]);
  assert.equal(count, 2);
  assert.equal(runtime.store.getState().user.id, 'B');
});

test('KH-40: khôi phục phiên chậm không ghi đè tài khoản vừa đăng nhập', async () => {
  const entered = deferred(); const pending = deferred();
  const runtime = setup({ initialToken: token(), transport: async config => {
    if (config.url === '/auth/me') { entered.resolve(); await pending.promise; }
  } });
  const restore = runtime.auth.restoreSession();
  await entered.promise;
  runtime.store.getState().setAuth({ ...user, id: 'B' }, token(7200));
  pending.resolve();
  assert.equal(await restore, null);
  assert.equal(runtime.store.getState().user.id, 'B');
});

test('KH-40: đăng xuất vô hiệu hóa phiên ngay và phản hồi muộn không đăng xuất tài khoản mới', async () => {
  const entered = deferred(); const pending = deferred();
  const runtime = setup({ transport: async config => {
    if (config.url === '/auth/logout') { entered.resolve(); await pending.promise; }
  } });
  runtime.store.getState().setAuth(user, token());
  const logout = runtime.auth.logout();
  assert.equal(runtime.store.getState().user, null);
  await entered.promise;
  runtime.store.getState().setAuth({ ...user, id: 'B' }, token(7200));
  pending.resolve(); await logout;
  assert.equal(runtime.store.getState().user.id, 'B');
});

function setup({ initialToken, rememberedUser, remember = true, transport, env = { DEV: true } } = {}) {
  const memoryStorage = entries => {
    const values = new Map(entries);
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
  };
  const localStorage = memoryStorage([
    ['handigo:remember-login', String(remember)],
    ...(rememberedUser && remember ? [['handigo:user', JSON.stringify(rememberedUser)]] : []),
  ]);
  const sessionStorage = memoryStorage([
    ...(initialToken ? [['handigo:external-redirect-token', initialToken]] : []),
    ...(rememberedUser && !remember ? [['handigo:user', JSON.stringify(rememberedUser)]] : []),
  ]);
  const calls = [];
  const rendered = [];
  const freshToken = token();
  const response = (config, data, status = 200) => ({ config, data, status, statusText: String(status), headers: {} });
  const fail = (config, status) => { throw new axios.AxiosError('Lỗi thử nghiệm', undefined, config, {}, response(config, {}, status)); };
  const adapter = async config => {
    calls.push({ url: config.url, baseURL: config.baseURL, withCredentials: config.withCredentials, authorization: config.headers.get('Authorization') });
    if (transport) {
      const result = await transport(config, { response, fail, freshToken });
      if (result !== undefined) return result;
    }
    return response(config, config.url === '/auth/refresh-token' ? { token: freshToken } : { user });
  };
  const overrides = {
    axios: { __esModule: true, default: { ...axios, create: config => axios.create({ ...config, adapter }) } },
    'react-dom/client': { createRoot: () => ({ render: () => rendered.push(true) }) },
    '@react-oauth/google': { GoogleOAuthProvider: () => null },
  };
  const cache = new Map();
  function load(file) {
    const filename = path.resolve(sourceRoot, file);
    if (cache.has(filename)) return cache.get(filename);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8').replace(/import\.meta\.env/g, `(${JSON.stringify(env)})`), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const exports = {};
    cache.set(filename, exports);
    vm.runInNewContext(code, {
      exports, console, localStorage, sessionStorage, navigator: {}, window: { atob },
      document: { getElementById: () => ({}) },
      require(name) {
        if (name in overrides) return overrides[name];
        if (/\.(css)$/.test(name) || name.startsWith('@fontsource')) return {};
        if (name === './App.tsx') return { __esModule: true, default: () => null };
        if (name.startsWith('@/') || name.startsWith('.')) {
          const base = name.startsWith('@/') ? path.join(sourceRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
          for (const suffix of ['', '.ts', '.tsx']) if (fs.existsSync(base + suffix) && fs.statSync(base + suffix).isFile()) return load(base + suffix);
          throw new Error(`Không tìm thấy module thử nghiệm: ${name}`);
        }
        return require(name);
      },
    }, { filename });
    return exports;
  }
  const store = load('features/auth/store/auth.store.ts').useAuthStore;
  const auth = load('features/auth/services/auth.service.ts').authService;
  const guard = props => {
    overrides['@/features/auth/store/auth.store'] = { useAuthStore: select => select(store.getState()) };
    overrides['react-router-dom'] = {
      Navigate: () => null,
      useLocation: () => ({ pathname: '/admin', search: '', hash: '' }),
    };
    return load('components/common/RouteGuard.tsx').RouteGuard({ children: 'Nội dung được bảo vệ', ...props });
  };
  return { auth, store, load, calls, rendered, localStorage, sessionStorage, freshToken, guard };
}

test('Khởi động bằng cookie: một refresh và một /me, chuẩn hóa id và kết thúc khởi tạo', async () => {
  const runtime = setup();
  const result = await runtime.auth.restoreSession();
  assert.deepEqual(runtime.calls.map(call => call.url), ['/auth/refresh-token', '/auth/me']);
  assert.equal(result.id, user._id);
  assert.equal(runtime.store.getState().token, runtime.freshToken);
  assert.equal(runtime.store.getState().isInitializing, false);
  assert.equal(runtime.store.getState().isAuthenticated, true);
});

test('Production qua proxy: F5 khôi phục bằng cookie cùng website, API nghiệp vụ vẫn gọi Render', async () => {
  const runtime = setup({
    rememberedUser: user,
    env: { DEV: false, VITE_API_BASE_URL: 'https://handigo-platform.onrender.com', VITE_AUTH_API_BASE_URL: '/api' },
  });
  assert.equal(runtime.store.getState().token, null);
  assert.equal(runtime.store.getState().isAuthenticated, false);
  await runtime.auth.restoreSession();
  assert.deepEqual(runtime.calls.map(({ url, baseURL, withCredentials }) => ({ url, baseURL, withCredentials })), [
    { url: '/auth/refresh-token', baseURL: '/api', withCredentials: true },
    { url: '/auth/me', baseURL: '/api', withCredentials: true },
  ]);
  assert.equal(runtime.guard({ roles: ['ADMIN'] }), 'Nội dung được bảo vệ');
  await runtime.load('api/client.ts').default.get('/users/profile');
  assert.equal(runtime.calls.at(-1).baseURL, 'https://handigo-platform.onrender.com');
  assert.equal(runtime.calls.at(-1).authorization, `Bearer ${runtime.freshToken}`);
});

test('Production qua proxy: đăng nhập, đăng xuất và các API xác thực đều dùng cùng nơi lưu cookie', async () => {
  const runtime = setup({ env: { DEV: false, VITE_API_BASE_URL: 'https://handigo-platform.onrender.com', VITE_AUTH_API_BASE_URL: '/api' } });
  const api = runtime.load('api/client.ts').default;
  for (const endpoint of ['login', 'google-login', 'facebook-login', 'verify-register-otp', 'logout']) {
    await api.post(`/auth/${endpoint}`);
  }
  assert.ok(runtime.calls.every(call => call.baseURL === '/api' && call.withCredentials === true));
});

test('Không cấu hình proxy: giữ tương thích với backend trực tiếp', async () => {
  const runtime = setup({ env: { DEV: false, VITE_API_BASE_URL: 'https://api.handigo.test' } });
  await runtime.auth.restoreSession();
  assert.ok(runtime.calls.every(call => call.baseURL === 'https://api.handigo.test'));
  assert.equal(runtime.store.getState().isAuthenticated, true);
});

test('Các lời gọi khôi phục đồng thời chỉ tạo một cặp request', async () => {
  const pending = deferred();
  const runtime = setup({ transport: async config => { if (config.url === '/auth/refresh-token') await pending.promise; } });
  const first = runtime.auth.restoreSession();
  const second = runtime.auth.restoreSession();
  assert.equal(first, second);
  pending.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(runtime.calls.map(call => call.url), ['/auth/refresh-token', '/auth/me']);
});

test('Token chuyển hướng còn hạn được kiểm tra bằng /me, không refresh thừa', async () => {
  const runtime = setup({ initialToken: token() });
  await runtime.auth.restoreSession();
  assert.deepEqual(runtime.calls.map(call => call.url), ['/auth/me']);
  assert.equal(runtime.store.getState().isInitializing, false);
});

test('Token hết hạn được interceptor refresh trước khi lấy user', async () => {
  const runtime = setup({ initialToken: token(-100) });
  await runtime.auth.restoreSession();
  assert.deepEqual(runtime.calls.map(call => call.url), ['/auth/refresh-token', '/auth/me']);
  assert.equal(runtime.calls[1].authorization, `Bearer ${runtime.freshToken}`);
});

test('Request /me bị 401 vẫn được refresh và thử lại đúng một lần', async () => {
  let attempts = 0;
  const runtime = setup({ initialToken: token(), transport: async (config, { fail }) => {
    if (config.url === '/auth/me' && attempts++ === 0) fail(config, 401);
  } });
  await runtime.auth.restoreSession();
  assert.deepEqual(runtime.calls.map(call => call.url), ['/auth/me', '/auth/refresh-token', '/auth/me']);
  assert.equal(runtime.store.getState().isAuthenticated, true);
});

test('Cookie không hợp lệ: xóa user cũ, kết thúc khởi tạo và không gọi /me', async () => {
  const runtime = setup({ rememberedUser: user, transport: async (config, { fail }) => fail(config, 401) });
  assert.equal(await runtime.auth.restoreSession(), null);
  assert.deepEqual(runtime.calls.map(call => call.url), ['/auth/refresh-token']);
  assert.equal(runtime.store.getState().user, null);
  assert.equal(runtime.store.getState().token, null);
  assert.equal(runtime.store.getState().isInitializing, false);
});

test('Tài khoản bị từ chối hoặc /me tiếp tục 401 thì đăng xuất, không lặp vô hạn', async () => {
  for (const status of [401, 403]) {
    const runtime = setup({ initialToken: token(), rememberedUser: user, transport: async (config, { fail }) => {
      if (config.url === '/auth/me') fail(config, status);
    } });
    assert.equal(await runtime.auth.restoreSession(), null);
    assert.equal(runtime.store.getState().isAuthenticated, false);
    assert.equal(runtime.store.getState().user, null);
    assert.ok(runtime.calls.length <= 3);
  }
});

test('Mất mạng, 429 hoặc 5xx không xóa phiên còn dùng được và luôn kết thúc khởi tạo', async () => {
  for (const status of [undefined, 429, 500, 503]) {
    const runtime = setup({ initialToken: token(), rememberedUser: user, transport: async (config, { fail }) => {
      if (status) fail(config, status);
      throw new axios.AxiosError('Mất kết nối', 'ERR_NETWORK', config);
    } });
    await runtime.auth.restoreSession();
    assert.equal(runtime.store.getState().user._id, user._id);
    assert.equal(runtime.store.getState().isAuthenticated, true);
    assert.equal(runtime.store.getState().isInitializing, false);
  }
});

test('Không có token và không thể refresh: không tạo trạng thái đã đăng nhập từ user lưu cũ', async () => {
  const runtime = setup({ rememberedUser: user, transport: async config => { throw new axios.AxiosError('Mất kết nối', 'ERR_NETWORK', config); } });
  await runtime.auth.restoreSession();
  assert.equal(runtime.store.getState().token, null);
  assert.equal(runtime.store.getState().isAuthenticated, false);
  assert.equal(runtime.store.getState().isInitializing, false);
});

test('Khôi phục giữ đúng nơi lưu user theo lựa chọn ghi nhớ, không lưu access token', async () => {
  for (const remember of [true, false]) {
    const runtime = setup({ remember });
    await runtime.auth.restoreSession();
    const selected = remember ? runtime.localStorage : runtime.sessionStorage;
    const other = remember ? runtime.sessionStorage : runtime.localStorage;
    assert.equal(JSON.parse(selected.getItem('handigo:user')).id, user._id);
    assert.equal(other.getItem('handigo:user'), null);
    assert.equal(runtime.localStorage.getItem('handigo:remember-login'), String(remember));
    for (const storage of [selected, other]) {
      assert.equal(storage.getItem('token'), null);
      assert.equal(storage.getItem('handigo_token'), null);
    }
  }
});

test('Lần khôi phục thất bại không khóa các lần khôi phục tiếp theo', async () => {
  let offline = true;
  const runtime = setup({ transport: async config => { if (offline) throw new axios.AxiosError('Mất kết nối', 'ERR_NETWORK', config); } });
  await runtime.auth.restoreSession();
  offline = false;
  const result = await runtime.auth.restoreSession();
  assert.equal(result.id, user._id);
  assert.equal(runtime.store.getState().isAuthenticated, true);
});

test('Điểm vào app chỉ render một lần sau khi phiên được xử lý, kể cả không đăng nhập', async () => {
  for (const signedIn of [true, false]) {
    const pending = deferred();
    const runtime = setup({ transport: async (config, { fail }) => {
      await pending.promise;
      if (!signedIn) fail(config, 401);
    } });
    runtime.load('main.tsx');
    assert.equal(runtime.rendered.length, 0);
    pending.resolve();
    await runtime.auth.restoreSession();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(runtime.rendered.length, 1);
    assert.equal(runtime.store.getState().isInitializing, false);
    assert.equal(runtime.calls.filter(call => call.url === '/auth/me').length, signedIn ? 1 : 0);
  }
});

test('Sau khôi phục, RouteGuard chỉ mở đúng vai trò và chuyển khách chưa đăng nhập về login', async () => {
  const admin = setup();
  await admin.auth.restoreSession();
  assert.equal(admin.guard({ roles: ['ADMIN'] }), 'Nội dung được bảo vệ');
  assert.equal(admin.guard({ roles: ['CUSTOMER'] }).props.to, '/admin');
  const guest = setup({ transport: async (config, { fail }) => fail(config, 401) });
  await guest.auth.restoreSession();
  assert.equal(guest.guard({ roles: ['ADMIN'] }).props.to, '/login');
});

test('Provider chưa được duyệt vẫn bị chặn sau khôi phục phiên', async () => {
  const runtime = setup({ transport: async (config, { response }) => {
    if (config.url === '/auth/me') return response(config, { user: { ...user, role: 'PROVIDER', providerOnboardingStatus: 'PENDING_REVIEW' } });
  } });
  await runtime.auth.restoreSession();
  assert.equal(runtime.guard({ roles: ['PROVIDER'] }).props.to, '/register-provider');
  assert.equal(runtime.guard({ roles: ['PROVIDER'], allowUnapprovedProvider: true }), 'Nội dung được bảo vệ');
});

test('Đăng nhập và đăng xuất sau khởi tạo thất bại vẫn cập nhật đúng phiên và lựa chọn ghi nhớ', async () => {
  const runtime = setup({ transport: async (config, { response, fail, freshToken }) => {
    if (config.url === '/auth/refresh-token') fail(config, 401);
    if (config.url === '/auth/login') return response(config, { user: { ...user, id: user._id }, token: freshToken });
    if (config.url === '/auth/logout') return response(config, { message: 'Đã đăng xuất' });
  } });
  await runtime.auth.restoreSession();
  await runtime.auth.login({ email: user.email, password: 'mat-khau-thu-nghiem' }, false);
  assert.equal(runtime.store.getState().isAuthenticated, true);
  assert.equal(runtime.store.getState().isInitializing, false);
  assert.equal(runtime.localStorage.getItem('handigo:user'), null);
  assert.equal(JSON.parse(runtime.sessionStorage.getItem('handigo:user')).id, user._id);
  await runtime.auth.logout();
  assert.equal(runtime.store.getState().user, null);
  assert.equal(runtime.store.getState().token, null);
  assert.equal(runtime.store.getState().isAuthenticated, false);
  assert.equal(runtime.sessionStorage.getItem('handigo:user'), null);
});
