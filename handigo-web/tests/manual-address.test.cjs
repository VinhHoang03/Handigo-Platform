const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relative, modules = {}) {
  const filename = path.isAbsolute(relative) ? relative : path.join(__dirname, '../src', relative);
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require(name) {
    if (name in modules) return modules[name];
    if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`, modules);
    if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), `${name}.ts`), modules);
    return require(name);
  } }, { filename });
  return exports;
}
const { prepareAddressSubmission, clearGeocodedFields } = load('features/profile/utils/addressBookForm.utils.ts');

test('Form nhập tay gửi đủ thông tin người nhận và địa chỉ mà không cần GPS hoặc ghim bản đồ', () => {
  const form = { recipientName: 'Nguyễn Văn An', recipientPhone: '0900000000', addressLine: '12 Đường A',
    province: 'Thành phố Hồ Chí Minh', ward: 'Phường B', provinceCode: 79, wardCode: 1, isDefault: false };
  const result = prepareAddressSubmission(form);
  assert.equal(result.error, undefined);
  assert.ok(result.payload.fullAddress.includes('12 Đường A'));
  assert.equal(result.payload.latitude, undefined);
  assert.equal(result.payload.longitude, undefined);
  assert.equal(result.payload.recipientPhone, '0900000000');
  const edited = clearGeocodedFields({ ...form, latitude: 10, longitude: 106, placeId: 'ghim-cu' });
  assert.equal(edited.latitude, undefined);
  assert.equal(edited.placeId, undefined);
  assert.equal(prepareAddressSubmission(edited).error, undefined);
});

function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const found = find(child, predicate); if (found) return found; }
}

test('Bản đồ hiển thị trực tiếp, không có nút hiện/ẩn và không tự yêu cầu quyền vị trí', () => {
  let locations = 0;
  const { AddressBookFormFields } = load('features/profile/components/AddressBookFormFields.tsx', {
    'lucide-react': { LocateFixed: 'locate', RefreshCw: 'loading' },
    '@/components/common/LocationPickerMap': { LocationPickerMap: 'map' },
    '@/components/common/SearchableSelect': { SearchableSelect: 'select' },
    '@/components/common/FloatingField': { FloatingTextarea: 'textarea' },
  });
  const render = () => AddressBookFormFields({ addressForm: {}, provinceOptions: [], wardOptions: [], onUseCurrentLocation: () => locations++ });
  const tree = render();
  assert.ok(find(tree, node => node.type === 'map'));
  assert.equal(locations, 0);
  assert.equal(find(tree, node => node.type === 'button' && node.props['aria-expanded'] !== undefined), undefined);
  find(tree, node => node.type === 'button').props.onClick();
  assert.equal(locations, 1);
});
