const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.join(__dirname, '../src');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require(name) {
    if (name === '@/components/common/Modal') return { Modal: ({ children }) => React.createElement('section', null, children) };
    if (name === './ServiceImagesEditor') return { ServiceImagesEditor: () => null };
    if (name === './ServiceProcessEditor') return { ServiceProcessEditor: () => null };
    if (!name.startsWith('.') && !name.startsWith('@/')) return require(name);
    const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name);
    return load(['.ts', '.tsx'].map(extension => base + extension).find(fs.existsSync));
  } });
  return exports;
}
const { ServiceFormModal } = load(path.join(root, 'features/admin/components/services/ServiceFormModal.tsx'));
const { emptyServiceForm } = load(path.join(root, 'features/admin/components/services/service.helpers.ts'));
const render = props => renderToStaticMarkup(React.createElement(ServiceFormModal, {
  open: true, mode: 'create', categories: [], form: { ...emptyServiceForm }, busy: false, blockClose: false,
  onChange() {}, onClose() {}, onSubmit() {}, ...props,
}));

test('Modal catalog giữ nút Lưu và quyền bật hiển thị mặc định', () => {
  const html = render({});
  const checkbox = html.match(/<input[^>]*name="service-active"[^>]*>/)[0];
  assert.ok(checkbox.includes('checked'));
  assert.ok(!checkbox.includes('disabled'));
  assert.match(html, />Lưu<\/button>/);
  assert.ok(!html.includes('Dịch vụ từ đề xuất được lưu'));
});

test('Modal đề xuất khóa hiển thị, giải thích tạm ngừng và dùng nhãn tạo/duyệt riêng', () => {
  const html = render({ allowActivation: false, submitLabel: 'Tạo dịch vụ và duyệt' });
  const checkbox = html.match(/<input[^>]*name="service-active"[^>]*>/)[0];
  assert.ok(checkbox.includes('disabled'));
  assert.ok(!checkbox.includes('checked'));
  assert.ok(html.includes('Dịch vụ từ đề xuất được lưu ở trạng thái tạm ngừng'));
  assert.match(html, />Tạo dịch vụ và duyệt<\/button>/);
});
