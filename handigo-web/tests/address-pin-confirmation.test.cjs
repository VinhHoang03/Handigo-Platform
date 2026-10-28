const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relative, modules = {}, globals = {}) {
  const filename = path.isAbsolute(relative) ? relative : path.join(__dirname, '../src', relative);
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, Error, ...globals, require(name) {
    if (name in modules) return modules[name];
    if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`, modules, globals);
    if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), `${name}.ts`), modules, globals);
    return require(name);
  } }, { filename });
  return exports;
}
const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
const tick = () => new Promise(setImmediate);
const event = { preventDefault() {} };

function setup({ lookup, save } = {}) {
  const slots = [];
  let cursor = 0;
  const requests = [];
  const writes = [];
  const gps = [];
  let closed = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { value: typeof initial === 'function' ? initial() : initial,
        set(next) { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; } };
      return [slots[index].value, slots[index].set];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(callback) { const index = cursor++; if (!(index in slots)) slots[index] = { cleanup: callback() }; },
  };
  const { useAddressBookForm } = load('features/profile/hooks/useAddressBookForm.ts', {
    react,
    '@/components/common/Toast': { useToastFeedback: react.useState },
    './useAddressAdministrativeUnits': { useAddressAdministrativeUnits: () => ({ provinceOptions: [], wardOptions: [], setWards() {} }) },
    '@/features/booking/api/booking.api': { bookingApi: { geocodeAddress: input => {
      requests.push(input); return lookup ? lookup(input) : Promise.resolve({ latitude: 10, longitude: 106, fullAddress: 'Địa chỉ do bản đồ trả về khác nội dung nhập' });
    } } },
  }, { navigator: { geolocation: { getCurrentPosition: (success, failure) => gps.push({ success, failure }) } } });
  const render = () => {
    cursor = 0;
    return useAddressBookForm({ open: true, address: null, addressCount: 0,
      defaultRecipient: { name: 'Nguyễn Văn An', phone: '0900000000' },
      onSubmit: async payload => { writes.push(payload); if (save) await save(payload); }, onClose: () => closed++ });
  };
  const fill = () => {
    const form = render();
    form.handleAddressInputChange('addressLine', '12 Đường A, Tòa nhà B');
    form.handleProvinceChange({ value: 79, label: 'Thành phố Hồ Chí Minh' });
    form.handleWardChange({ value: 1, label: 'Phường B' });
    return render();
  };
  return { render, fill, requests, writes, gps, closed: () => closed };
}

test('Nhập địa chỉ trước, tự tìm ghim, chỉ ghi dữ liệu sau lần xác nhận vị trí', async () => {
  const runtime = setup();
  assert.equal(runtime.fill().step, 'details');
  await runtime.render().handleSubmit(event);
  assert.equal(runtime.render().step, 'location');
  assert.equal(runtime.writes.length, 0);
  await tick();
  const form = runtime.render();
  assert.equal(form.addressForm.addressLine, '12 Đường A, Tòa nhà B');
  assert.equal(form.addressForm.province, 'Thành phố Hồ Chí Minh');
  assert.equal(form.addressForm.ward, 'Phường B');
  assert.equal(form.addressForm.latitude, 10);
  assert.equal(runtime.requests.length, 1);
  assert.match(runtime.requests[0].fullAddress, /12 Đường A, Tòa nhà B/);
  assert.equal(runtime.gps.length, 0);
  await form.handleSubmit(event);
  assert.equal(runtime.writes.length, 1);
  assert.equal(runtime.writes[0].latitude, 10);
  assert.match(runtime.writes[0].fullAddress, /12 Đường A, Tòa nhà B/);
  assert.equal(runtime.closed(), 1);
});

test('Kéo ghim chỉ cập nhật tọa độ; kết quả tìm vị trí đến muộn không ghi đè ghim hoặc địa chỉ nhập', async () => {
  const pending = deferred();
  const runtime = setup({ lookup: () => pending.promise });
  await runtime.fill().handleSubmit(event);
  runtime.render().updateAddressFromCoordinate(11, 107);
  pending.resolve({ latitude: 20, longitude: 105, fullAddress: 'Địa chỉ khác', province: 'Tỉnh khác' });
  await tick();
  const form = runtime.render();
  assert.equal(form.addressForm.latitude, 11);
  assert.equal(form.addressForm.longitude, 107);
  assert.equal(form.addressForm.addressLine, '12 Đường A, Tòa nhà B');
  assert.equal(form.addressForm.province, 'Thành phố Hồ Chí Minh');
  await form.handleSubmit(event);
  assert.equal(runtime.writes[0].latitude, 11);
});

test('Không tìm được vị trí vẫn giữ thông tin, cho chọn ghim thủ công và không bắt bật GPS', async () => {
  const runtime = setup({ lookup: async () => { throw new Error('Dịch vụ bản đồ tạm lỗi'); } });
  await runtime.fill().handleSubmit(event); await tick();
  let form = runtime.render();
  assert.equal(form.step, 'location');
  assert.match(form.locationError, /Địa chỉ đã nhập được giữ nguyên/);
  await form.handleSubmit(event);
  assert.equal(runtime.writes.length, 0);
  assert.match(runtime.render().addressFormError, /chọn vị trí ghim/);
  runtime.render().updateAddressFromCoordinate(10.5, 106.5);
  form = runtime.render();
  await form.handleSubmit(event);
  assert.equal(runtime.writes.length, 1);
  assert.equal(runtime.gps.length, 0);
});

test('Quay lại sửa địa chỉ hủy truy vấn cũ và xóa ghim, phải xác nhận lại vị trí mới', async () => {
  const pending = deferred();
  const runtime = setup({ lookup: () => pending.promise });
  await runtime.fill().handleSubmit(event);
  runtime.render().backToDetails();
  runtime.render().handleAddressInputChange('addressLine', '99 Đường C');
  pending.resolve({ latitude: 10, longitude: 106 }); await tick();
  const form = runtime.render();
  assert.equal(form.step, 'details');
  assert.equal(form.addressForm.addressLine, '99 Đường C');
  assert.equal(form.addressForm.latitude, undefined);
  assert.equal(runtime.writes.length, 0);
});

test('GPS được chọn chủ động chỉ đổi tọa độ, không thay nội dung địa chỉ hoặc ghi đè ghim mới hơn', async () => {
  const runtime = setup();
  await runtime.fill().handleSubmit(event); await tick();
  runtime.render().handleUseCurrentLocation();
  assert.equal(runtime.gps.length, 1);
  runtime.gps[0].success({ coords: { latitude: 12, longitude: 108 } });
  assert.equal(runtime.render().addressForm.latitude, 12);
  assert.equal(runtime.render().addressForm.addressLine, '12 Đường A, Tòa nhà B');
  runtime.render().handleUseCurrentLocation();
  runtime.render().updateAddressFromCoordinate(13, 109);
  runtime.gps[1].success({ coords: { latitude: 14, longitude: 110 } });
  assert.equal(runtime.render().addressForm.latitude, 13);
});

test('Bấm lưu liên tiếp chỉ gửi một lần; lỗi lưu giữ nguyên địa chỉ và ghim để thử lại', async () => {
  const pending = deferred();
  const runtime = setup({ save: () => pending.promise });
  await runtime.fill().handleSubmit(event); await tick();
  const form = runtime.render();
  const saving = form.handleSubmit(event);
  await form.handleSubmit(event);
  assert.equal(runtime.writes.length, 1);
  assert.equal(runtime.render().isSubmitting, true);
  pending.reject(new Error('Không lưu được địa chỉ'));
  await saving;
  const failed = runtime.render();
  assert.equal(failed.step, 'location');
  assert.equal(failed.addressForm.latitude, 10);
  assert.equal(failed.addressForm.addressLine, '12 Đường A, Tòa nhà B');
  assert.match(failed.addressFormError, /Không lưu được địa chỉ/);
  assert.equal(runtime.closed(), 0);
});

test('Bước xác nhận tự hiển thị ghim, không còn hai nút tìm địa chỉ và dùng vị trí hiện tại', () => {
  const { AddressBookModal } = load('features/profile/components/AddressBookModal.tsx', {
    '@/components/common/Modal': { Modal: 'modal' },
    '@/components/common/LocationPickerMap': { LocationPickerMap: 'map' },
    './AddressBookFormFields': { AddressBookFormFields: 'fields' },
    '@/features/profile/hooks/useAddressBookForm': { useAddressBookForm: () => ({
      step: 'location', addressForm: { latitude: 10.78, longitude: 106.7 },
    }) },
  });
  const nodes = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    nodes.push(node);
    for (const child of [node.props?.children].flat(Infinity)) visit(child);
  }
  visit(AddressBookModal({ open: true }));
  const buttons = nodes.filter(node => node.type === 'button');
  assert.equal(buttons.length, 2);
  assert.equal(buttons[0].props.children, 'Quay lại chỉnh sửa');
  assert.equal(buttons[1].props.children, 'Xác nhận vị trí và lưu');
  const map = nodes.find(node => node.type === 'map');
  assert.equal(map.props.latitude, 10.78);
  assert.equal(map.props.longitude, 106.7);
});
