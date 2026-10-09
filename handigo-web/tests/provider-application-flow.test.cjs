const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules = {}, globals = {}) {
  const filename = path.join(__dirname, '../src/features/provider-application', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Error, ...globals, require(name) {
    if (!(name in modules)) throw new Error(`Module chưa được giả lập: ${name}`);
    return modules[name];
  } }, { filename });
  return exports;
}

function hook(service, applicationId) {
  const state = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [state[index], (value) => {
        state[index] = typeof value === 'function' ? value(state[index]) : value;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = { current: initial };
      return state[index];
    },
    useCallback: (callback) => callback,
    useEffect() {},
  };
  const { useProviderApplication } = load('hooks/useProviderApplication.ts', {
    react, '../services/providerApplication.service': { providerApplicationService: service },
  });
  return () => { cursor = 0; return useProviderApplication(applicationId); };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('Thử lại tải cả danh mục và hồ sơ, không mở form trống khi API hồ sơ lỗi', async () => {
  let fail = true;
  let loads = 0;
  const application = { _id: 'ho-so', status: 'draft' };
  const render = hook({
    loadCategories: async () => [],
    loadMine: async () => { loads++; if (fail) throw new Error('Lỗi mạng'); return application; },
  });
  await render().loadData();
  assert.ok(render().loadError);
  fail = false;
  await render().loadData();
  assert.equal(loads, 2);
  assert.equal(render().application, application);
  assert.equal(render().loadedApplication, application);
  assert.equal(render().loadError, '');
});

test('Lưu nháp được tuần tự hóa và không thay dữ liệu dùng để khởi tạo form', async () => {
  const first = deferred();
  const second = deferred();
  const calls = [];
  const render = hook({
    saveDraft: async (payload) => {
      calls.push(payload.description);
      return calls.length === 1 ? first.promise : second.promise;
    },
  });
  const oldSave = render().saveDraft({ description: 'Bản cũ' });
  const newSave = render().saveDraft({ description: 'Bản mới' });
  await Promise.resolve();
  assert.deepEqual(calls, ['Bản cũ']);
  first.resolve({ _id: 'ho-so', status: 'draft', description: 'Bản cũ' });
  await oldSave;
  await Promise.resolve();
  assert.deepEqual(calls, ['Bản cũ', 'Bản mới']);
  second.resolve({ _id: 'ho-so', status: 'draft', description: 'Bản mới' });
  await newSave;
  assert.equal(render().application.description, 'Bản mới');
  assert.equal(render().loadedApplication, null);
});

test('Gửi hồ sơ chờ lần lưu đang chạy, chặn gửi trùng và khóa lưu sau thành công', async () => {
  const draft = deferred();
  const response = deferred();
  let sends = 0;
  let saves = 0;
  const render = hook({
    saveDraft: async () => { saves++; return draft.promise; },
    submit: async () => { sends++; return response.promise; },
  });
  const saving = render().saveDraft({});
  await Promise.resolve();
  const sending = render().submit({});
  await assert.rejects(render().submit({}), /đang được gửi/);
  assert.equal(sends, 0);
  draft.resolve({ _id: 'ho-so', status: 'draft' });
  await saving;
  await Promise.resolve();
  assert.equal(sends, 1);
  response.resolve({ _id: 'ho-so', status: 'pending' });
  await sending;
  assert.equal(render().application.status, 'pending');
  await assert.rejects(render().submit({}), /chờ xét duyệt/);
  await render().saveDraft({});
  assert.equal(saves, 1);
});

test('Mã bản nháp trong URL không bị gửi nhầm sang API resubmit', async () => {
  let creates = 0;
  const render = hook({
    loadCategories: async () => [],
    loadDetail: async () => ({ _id: 'nhap', status: 'draft' }),
    submit: async () => { creates++; return { _id: 'nhap', status: 'pending' }; },
    resubmit: async () => { throw new Error('Không được gửi lại bản nháp'); },
  }, 'nhap');
  await render().loadData();
  await render().submit({});
  assert.equal(creates, 1);
});

test('Gửi lại đúng hồ sơ bị từ chối và có thể thử lại sau lỗi gửi', async () => {
  let fail = true;
  const ids = [];
  const render = hook({
    loadCategories: async () => [],
    loadMine: async () => ({ _id: 'bi-tu-choi', status: 'rejected' }),
    resubmit: async (id) => {
      ids.push(id);
      if (fail) throw new Error('Lỗi mạng');
      return { _id: id, status: 'resubmitted' };
    },
  });
  await render().loadData();
  await assert.rejects(render().submit({}), /Lỗi mạng/);
  fail = false;
  await render().submit({});
  assert.deepEqual(ids, ['bi-tu-choi', 'bi-tu-choi']);
  assert.equal(render().application.status, 'resubmitted');
});

test('Khôi phục bản chỉnh sửa theo tài khoản và lần xét duyệt, xóa khi hoàn tất', () => {
  const values = new Map();
  const storage = load('utils/providerApplicationDraftStorage.ts', {}, {
    sessionStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  });
  const key = storage.providerApplicationDraftKey('nguoi-dung-1', 'ho-so');
  const form = {
    description: 'Nội dung đã sửa', experienceYears: 2, serviceIds: ['dich-vu'], workingAreas: [],
    identityDocument: { type: 'cccd', documentNumber: '', fullName: '' }, certificates: [], onboardingStep: 2,
  };
  assert.equal(storage.writeProviderApplicationDraft(key, { form, sourceVersion: 'lan-1' }), true);
  assert.equal(storage.readProviderApplicationDraft(key, 'lan-1').description, form.description);
  assert.equal(storage.readProviderApplicationDraft(key, 'lan-2'), null);
  assert.equal(storage.readProviderApplicationDraft(storage.providerApplicationDraftKey('nguoi-dung-2', 'ho-so'), 'lan-1'), null);
  storage.clearProviderApplicationDraft(key);
  assert.equal(storage.readProviderApplicationDraft(key, 'lan-1'), null);
  values.set(key, '{');
  assert.equal(storage.readProviderApplicationDraft(key, 'lan-1'), null);
});

test('Hướng dẫn chỉ rõ thông tin thiếu và chứng chỉ chưa đầy đủ, CCCD không yêu cầu mặt sau', () => {
  const { getProviderApplicationSubmissionErrors } = load('utils/providerApplicationValidation.ts');
  const form = {
    description: '', experienceYears: 2, serviceIds: [], workingAreas: [],
    identityDocument: { type: 'cccd', documentNumber: '', fullName: '' }, certificates: [],
  };
  assert.equal(getProviderApplicationSubmissionErrors(form).length, 6);
  Object.assign(form, { description: 'Có kinh nghiệm', serviceIds: ['dich-vu'], workingAreas: ['khu-vuc'] });
  Object.assign(form.identityDocument, { documentNumber: '123', fullName: 'Nguyễn An', frontImageUrl: 'anh' });
  assert.equal(getProviderApplicationSubmissionErrors(form).length, 0);
  form.certificates.push({ title: 'Chứng chỉ', imageUrls: [] });
  assert.match(getProviderApplicationSubmissionErrors(form)[0], /Tải tệp chứng chỉ 1/);
});

test('Thông báo duyệt ban đầu giải thích và kết thúc phiên, bổ sung dịch vụ giữ phiên', () => {
  let receive;
  let logouts = 0;
  const toasts = [];
  const react = {
    useState: (value) => [value, () => {}],
    useRef: (value) => ({ current: value }),
    useEffect() {}, useCallback: (callback) => callback,
  };
  const { useNotificationFeed } = load('../../components/common/notification-bell/useNotificationFeed.ts', {
    react,
    '@/features/notification/api/notification.api': { notificationApi: {} },
    './notificationBell.utils': { getNotificationPath: () => '#', getErrorMessage: () => '' },
    './useNotificationReadActions': { useNotificationReadActions: () => ({}) },
    './useNotificationSocket': { useNotificationSocket: (_enabled, callback) => { receive = callback; } },
    '../Toast': { useToast: () => ({ addToast: (...args) => toasts.push(args) }) },
    '@/features/auth/store/auth.store': { useAuthStore: { getState: () => ({ logout: () => { logouts++; } }) } },
    '@/features/auth/api/auth.api': { getMeApi: async () => ({ id: 'nguoi-dung' }) },
  });
  useNotificationFeed('PROVIDER', { onReassignmentRequired() {} });
  receive({ type: 'SYSTEM', content: 'Đã duyệt dịch vụ.', data: {
    providerApplicationId: 'bo-sung', status: 'approved', applicationType: 'service_addition',
  } });
  assert.equal(logouts, 0);
  receive({ type: 'SYSTEM', content: 'Vui lòng đăng nhập lại.', data: {
    providerApplicationId: 'ban-dau', status: 'approved', applicationType: 'initial',
  } });
  assert.equal(logouts, 1);
  assert.equal(toasts[1][0], 'Vui lòng đăng nhập lại.');
  assert.equal(toasts[1][2], 0);
});

function formSync(provider, storage = new Map()) {
  const states = [];
  const effects = [];
  const timers = new Map();
  let cursor = 0;
  let timerId = 0;
  let form = {
    description: '', experienceYears: 2, serviceIds: [], workingAreas: [],
    identityDocument: { type: 'cccd', documentNumber: '', fullName: '' }, certificates: [],
  };
  let step = 1;
  const globals = { sessionStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key),
  } };
  const draftStorage = load('utils/providerApplicationDraftStorage.ts', {}, globals);
  const helpers = load('components/registerProviderPageHelpers.ts');
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => { states[index] = value; }];
    },
    useEffect(callback, deps) {
      const index = cursor++;
      const previous = states[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        effects.push(() => {
          previous?.cleanup?.();
          states[index] = { deps, cleanup: callback() };
        });
      }
    },
  };
  const { useRegisterProviderFormSync } = load('components/useRegisterProviderFormSync.ts', {
    react, './registerProviderPageHelpers': helpers,
    '../utils/providerApplicationDraftStorage': draftStorage,
  }, { ...globals, window: {
    setTimeout(callback, delay) { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  } });
  const setForm = (value) => { form = value; };
  const setStep = (value) => { step = value; };
  const navigate = () => {};
  const user = { id: 'khach-hang', role: 'CUSTOMER' };
  return {
    storage,
    get form() { return form; },
    change(value) { form = { ...form, ...value }; },
    render() {
      cursor = 0;
      const result = useRegisterProviderFormSync({ user, navigate, providerApplication: provider, step, form, setForm, setStep });
      effects.splice(0).forEach((effect) => effect());
      return result;
    },
    tick(delay) {
      [...timers].filter(([, timer]) => timer.delay === delay).forEach(([id, timer]) => {
        timers.delete(id); timer.callback();
      });
    },
  };
}

test('CUSTOMER lưu từ bước 1 và phản hồi lưu nháp không ghi đè nội dung đang nhập', () => {
  const saves = [];
  const provider = { loadedApplication: null, application: null, loading: false, loadError: '',
    saveDraft: async (payload) => { saves.push(payload); } };
  const scenario = formSync(provider);
  scenario.render(); scenario.tick(0); scenario.render();
  scenario.change({ serviceIds: ['dich-vu'], description: 'Bản đang nhập' });
  scenario.render(); scenario.tick(700);
  assert.equal(saves[0].serviceIds[0], 'dich-vu');
  provider.application = { _id: 'nhap', status: 'draft', description: 'Bản cũ trên máy chủ' };
  scenario.render(); scenario.tick(0);
  assert.equal(scenario.form.description, 'Bản đang nhập');
});

test('Sửa hồ sơ bị từ chối được khôi phục khi tải lại, không sửa hồ sơ máy chủ trước khi gửi', () => {
  let saves = 0;
  const application = { _id: 'tu-choi', status: 'rejected', updatedAt: 'lan-1',
    serviceIds: [], workingAreas: [], certificates: [], description: 'Bản gốc' };
  const provider = { loadedApplication: application, application, loading: false, loadError: '',
    saveDraft: async () => { saves++; } };
  const first = formSync(provider);
  first.render(); first.tick(0); first.render();
  first.change({ description: 'Bản chỉnh sửa' }); first.render(); first.tick(700);
  const reloaded = formSync(provider, first.storage);
  reloaded.render(); reloaded.tick(0); reloaded.render();
  assert.equal(reloaded.form.description, 'Bản chỉnh sửa');
  assert.equal(saves, 0);
});

test('Tải hồ sơ lỗi không lưu nháp rỗng hoặc thay bản chỉnh sửa đã có', () => {
  let saves = 0;
  const scenario = formSync({ loadedApplication: null, application: null,
    loading: false, loadError: 'Lỗi mạng', saveDraft: async () => { saves++; } });
  assert.equal(scenario.render().formReady, false);
  scenario.tick(0); scenario.render(); scenario.tick(700);
  assert.equal(saves, 0);
  assert.equal(scenario.storage.size, 0);
});
