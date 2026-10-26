const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
const settle = () => new Promise(setImmediate);
const order = id => ({ _id: id, status: 'accepted', orderType: 'normal',
  serviceId: { name: 'Dịch vụ', serviceType: 'fixed_price' }, pricing: {}, addressId: null });

function fixture() {
  const slots = []; const effects = []; const toasts = []; const navigation = [];
  let cursor = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) {
        slots[i] = { value: typeof initial === 'function' ? initial() : initial };
        slots[i].set = value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; };
      }
      return [slots[i].value, slots[i].set];
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!same(slots[i]?.deps, deps)) slots[i] = { fn, deps };
      return slots[i].fn;
    },
    useMemo(fn, deps) {
      const i = cursor++;
      if (!same(slots[i]?.deps, deps)) slots[i] = { value: fn(), deps };
      return slots[i].value;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!same(slots[i]?.deps, deps)) {
        const old = slots[i];
        effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
      }
    },
  };
  const requests = []; const actions = [];
  const bookingApi = {
    getOrderById(id) { const item = { id, ...deferred() }; requests.push(item); return item.promise; },
    uploadOrderAttachment: async () => 'anh-thu',
  };
  const api = {
    getPendingAssignments: async () => [],
    getQuotation: async id => ({ quotation: { _id: `bao-gia-${id}`, revision: 1 } }),
    getProviderOrders: async () => ({ items: [], pagination: { page: 1, totalPages: 0 } }),
    startOrder: async id => { actions.push(['start', id]); },
    completeOrder: async id => { actions.push(['complete', id]); },
    cancelOrder: async id => { actions.push(['cancel', id]); },
    acceptAssignment: async id => { actions.push(['accept', id]); },
    rejectAssignment: async id => { actions.push(['reject', id]); },
  };
  let params = new URLSearchParams();
  const navigate = (...args) => navigation.push(args);
  const modules = {
    react,
    'react-router-dom': { useNavigate: () => navigate, useSearchParams: () => [params] },
    '@/components/common/Toast': { useToast: () => ({ addToast: (...args) => toasts.push(args) }),
      useToastFeedback: initial => react.useState(initial) },
    '@/features/booking/api/booking.api': { bookingApi },
    '../api/providerOrder.api': { providerOrderApi: api },
  };
  function load(file) {
    const exports = {};
    const filename = path.join(__dirname, '../src', file);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(code, { exports, console, Date, Promise,
      window: { setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {}, addEventListener() {}, removeEventListener() {}, prompt: () => '' },
      document: { visibilityState: 'visible' },
      require: name => name in modules ? modules[name] : name.startsWith('.') || name.startsWith('@/') ? {} : require(name),
    }, { filename });
    return exports;
  }
  const hook = load('features/provider/hooks/useProviderOrderDetail.ts').useProviderOrderDetail;
  const render = fn => {
    cursor = 0; const value = fn();
    while (effects.length) effects.shift()();
    return value;
  };
  return { react, load, modules, requests, actions, api, bookingApi, toasts, navigation,
    setParams: value => { params = new URLSearchParams(value); }, render,
    detail: id => render(() => hook(id, navigate)),
    unmount: () => { for (const slot of slots) slot?.cleanup?.(); },
  };
}

test('KH-43: A đến sau B không ghi đè đơn và báo giá; nút bắt đầu chỉ thao tác B', async () => {
  const app = fixture();
  app.detail('A'); await settle();
  app.detail('B'); await settle();
  app.requests[1].resolve(order('B')); await settle();
  app.requests[0].resolve({ ...order('A'), inspectionRequired: true }); await settle();
  const state = app.detail('B');
  assert.equal(state.order._id, 'B'); assert.equal(state.quotation, null);
  const action = state.handleStart(); await settle();
  assert.deepEqual(app.actions, [['start', 'B']]);
  app.requests[2].resolve(order('B')); await action;
});

test('KH-43: báo giá A đến muộn không thay thế báo giá B', async () => {
  const app = fixture(); const quotation = deferred();
  app.api.getQuotation = id => id === 'A' ? quotation.promise : Promise.resolve({ quotation: { _id: 'bao-gia-B' } });
  app.detail('A'); await settle();
  app.requests[0].resolve({ ...order('A'), inspectionRequired: true }); await settle();
  app.detail('B'); await settle();
  app.requests[1].resolve({ ...order('B'), inspectionRequired: true }); await settle();
  quotation.resolve({ quotation: { _id: 'bao-gia-A' } }); await settle();
  assert.equal(app.detail('B').quotation.quotation._id, 'bao-gia-B');
});

test('KH-43: lượt tải cũ cùng đơn và lỗi cũ không ghi đè dữ liệu mới', async () => {
  const app = fixture(); app.detail('A'); await settle();
  const reload = app.detail('A').reload();
  app.requests[1].resolve({ ...order('A'), orderCode: 'MOI' }); await reload;
  app.requests[0].reject(new Error('Lỗi cũ')); await settle();
  const state = app.detail('A');
  assert.equal(state.order.orderCode, 'MOI'); assert.equal(state.error, null); assert.equal(state.loading, false);
});

test('KH-43: rời trang trong lúc tải ảnh không gửi yêu cầu hoàn tất hoặc hiện toast', async () => {
  const app = fixture(); const upload = deferred();
  app.bookingApi.uploadOrderAttachment = () => upload.promise;
  app.detail('A'); await settle(); app.requests[0].resolve(order('A')); await settle();
  const action = app.detail('A').handleComplete([{}], 'Đã hoàn tất');
  app.unmount(); upload.resolve('anh'); await action;
  assert.deepEqual(app.actions, []); assert.deepEqual(app.toasts, []);
});

test('KH-43: hủy đơn xong sau khi rời trang không chuyển trang hay tải lại dữ liệu', async () => {
  const app = fixture(); const pending = deferred();
  app.api.cancelOrder = () => pending.promise;
  app.detail('A'); await settle(); app.requests[0].resolve(order('A')); await settle();
  const action = app.detail('A').handleCancel();
  app.unmount(); pending.resolve(); await action;
  assert.deepEqual(app.navigation, []); assert.deepEqual(app.toasts, []); assert.equal(app.requests.length, 1);
});

test('KH-43: trang tạo lại trạng thái biểu mẫu và hộp thoại theo mã đơn', () => {
  const app = fixture(); let orderId = 'A';
  app.modules['react-router-dom'].useParams = () => ({ orderId });
  const Page = app.load('features/provider/pages/ProviderOrderDetailPage.tsx').default;
  const first = Page(); orderId = 'B'; const second = Page();
  assert.equal(first.type, second.type); assert.equal(first.key, 'A'); assert.equal(second.key, 'B');
});

const children = element => element == null || typeof element !== 'object' ? [] : [element, ...[element.props?.children].flat(Infinity).flatMap(children)];

for (const provider of [false, true]) {
  test(`KH-40: hồ sơ ${provider ? 'thợ' : 'khách'} A trả muộn không sửa hồ sơ hoặc thông tin tài khoản B`, async () => {
    const app = fixture(); const pending = deferred();
    let auth = { user: { id: 'A', fullName: 'Tên A' }, sessionRevision: 1 };
    const store = select => select(auth);
    store.getState = () => ({ ...auth, setUser: user => { auth.user = user; } });
    app.modules['@/features/auth/store/auth.store'] = { useAuthStore: store };
    app.modules['@/features/profile/api/userProfile.api'] = {
      getUserProfile: () => pending.promise, updateUserProfile: () => pending.promise, updateUserAvatar: () => pending.promise,
    };
    app.modules['@/features/provider-application/api/providerApplication.api'] = { providerApplicationApi: { mine: async () => null } };
    app.modules['@/features/customer/utils/providerBanner.utils'] = { getProviderBannerMode: () => null };
    app.modules['../../api/providerProfile.api'] = { providerProfileApi: { getProfile: () => pending.promise } };
    app.modules['../../utils/providerProfilePage'] = {
      emptyProfessionalForm: {}, toProfessionalForm: () => ({}), toUserProfileData: profile => profile.user,
      buildProviderProfileView: profile => profile, buildPerformanceStats: () => [], buildServiceArea: () => [],
    };
    app.modules['./useProviderProfileSave'] = app.load('features/provider/components/profile/useProviderProfileSave.ts');
    const hook = provider
      ? app.load('features/provider/components/profile/useProviderProfileData.ts').useProviderProfileData
      : app.load('features/customer/hooks/useCustomerProfileData.ts').useCustomerProfileData;
    app.render(() => hook('available'));
    auth = { user: { id: 'B', fullName: 'Tên B' }, sessionRevision: 2 };
    pending.resolve(provider ? { user: { id: 'A', fullName: 'Tên A cũ' } } : { id: 'A', fullName: 'Tên A cũ' });
    await settle();
    assert.equal(auth.user.id, 'B'); assert.equal(auth.user.fullName, 'Tên B');
    assert.equal(app.toasts.length, 0);
  });
}

test('KH-42: mở thông báo chỉ hiển thị đề nghị tương ứng, không gọi chi tiết khi còn chờ', async () => {
  const app = fixture(); app.setParams('assignmentId=de-nghi-B&orderId=B');
  app.api.getPendingAssignments = async () => [{ _id: 'de-nghi-A', orderId: order('A') }, { _id: 'de-nghi-B', orderId: order('B') }];
  const Section = () => null;
  app.modules['../components/orders/PendingAssignmentsSection'] = { PendingAssignmentsSection: Section };
  const Page = app.load('features/provider/pages/ProviderOrdersPage.tsx').default;
  app.render(Page); await settle(); const tree = app.render(Page);
  const section = children(tree).find(item => item.type === Section);
  assert.equal(section.props.visible, true);
  assert.deepEqual(Array.from(section.props.assignments, item => item._id), ['de-nghi-B']);
  assert.equal(app.requests.length, 0);
  await section.props.onAccept('de-nghi-B');
  assert.deepEqual(app.actions, [['accept', 'de-nghi-B']]);
});

for (const allowed of [true, false]) {
  test(`KH-42: đề nghị đã xử lý chỉ mở chi tiết khi API cho phép (${allowed})`, async () => {
    const app = fixture(); app.setParams('assignmentId=cu&orderId=A');
    const Page = app.load('features/provider/pages/ProviderOrdersPage.tsx').default;
    app.render(Page); await settle(); app.render(Page); await settle();
    assert.equal(app.requests.length, 1);
    if (allowed) app.requests[0].resolve(order('A'));
    else app.requests[0].reject(Object.assign(new Error('Không có quyền'), { isAxiosError: true, response: { status: 403 } }));
    await settle();
    assert.equal(JSON.stringify(app.navigation), JSON.stringify(allowed ? [['/provider/orders/A', { replace: true }]] : []));
    if (!allowed) assert.match(children(app.render(Page)).map(item => item.props?.children).join(' '), /không còn khả dụng/);
  });
}

test('KH-42: mở tiếp thông báo khác trên cùng trang tải lại đề nghị và bỏ trạng thái cũ', async () => {
  const app = fixture(); let id = 'A'; let calls = 0;
  app.setParams('assignmentId=de-nghi-A&orderId=A');
  app.api.getPendingAssignments = async () => { calls++; return [{ _id: `de-nghi-${id}`, orderId: order(id) }]; };
  const Section = () => null;
  app.modules['../components/orders/PendingAssignmentsSection'] = { PendingAssignmentsSection: Section };
  const Page = app.load('features/provider/pages/ProviderOrdersPage.tsx').default;
  app.render(Page); await settle(); app.render(Page);
  id = 'B'; app.setParams('assignmentId=de-nghi-B&orderId=B');
  app.render(Page); await settle();
  const section = children(app.render(Page)).find(item => item.type === Section);
  assert.equal(calls, 2); assert.equal(section.props.loading, false);
  assert.deepEqual(Array.from(section.props.assignments, item => item._id), ['de-nghi-B']);
  assert.equal(app.requests.length, 0);
});

test('KH-42: lỗi tải đề nghị có thông báo thử lại, không bị hiểu nhầm là hết hạn', async () => {
  const app = fixture(); app.setParams('assignmentId=de-nghi-A&orderId=A');
  app.api.getPendingAssignments = async () => { throw new Error('Mất mạng'); };
  const Page = app.load('features/provider/pages/ProviderOrdersPage.tsx').default;
  app.render(Page); await settle(); const tree = app.render(Page);
  assert.equal(app.requests.length, 0);
  assert.match(children(tree).map(item => item.props?.children).join(' '), /Không thể tải đề nghị nhận việc/);
});

test('KH-41: thẻ và popup không lỗi khi địa chỉ null và chỉ hiển thị khu vực', () => {
  for (const addressId of [null, { ward: 'Phường thử', province: 'Tỉnh thử', fullAddress: 'Địa chỉ bí mật' }]) {
    const app = fixture(); const value = { ...order('A'), addressId };
    const assignment = { _id: 'de-nghi', orderId: value, responseDeadline: new Date(Date.now() + 60000).toISOString() };
    const utils = app.load('features/provider/utils/providerOrder.utils.ts');
    app.modules['../utils/providerOrder.utils'] = utils;
    app.modules['./useProviderAssignmentGate'] = { useProviderAssignmentGate: () => ({ assignment, order: value }) };
    const Card = app.load('features/provider/components/PendingAssignmentCard.tsx').PendingAssignmentCard;
    const Modal = app.load('features/provider/components/ProviderAssignmentModal.tsx').ProviderAssignmentModal;
    for (const tree of [app.render(() => Card({ assignment })), Modal()]) {
      const text = children(tree).map(item => item.props?.children).flat(Infinity).join(' ');
      const props = children(tree).map(item => item.props?.value).filter(Boolean).join(' ');
      assert.doesNotMatch(text + props, /Địa chỉ bí mật/);
      assert.match(text + props, addressId ? /Phường thử, Tỉnh thử/ : /Chưa có thông tin khu vực/);
    }
  }
});
