const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('Form mở sau kiểm tra thời gian, bắt buộc hai loại ảnh và gửi riêng đúng nhóm', async () => {
  const filename = path.join(__dirname, '../src/features/provider/components/orders/OrderArrivalPanel.tsx');
  const exports = {}, state = [], calls = [];
  let cursor = 0;
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, URL: { createObjectURL: file => `blob:${file.name}`, revokeObjectURL() {} }, require(name) {
    if (name === 'react') return { useMemo: fn => fn(), useEffect() {}, useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    } };
    if (name === '@/components/common/Modal') return { Modal: 'modal' };
    if (name === '@/components/common/ReliableImage') return { ReliableImage: 'img' };
    if (name === 'lucide-react') return { Plus: 'plus-icon', X: 'close-icon' };
    return require(name);
  } }, { filename });
  const props = { order: { status: 'accepted', orderType: 'normal', arrival: { providerId: 'tho' }, providerId: { _id: 'tho' } },
    busy: false, checkNoShow: async () => true, onNoShow: async (...args) => { calls.push(args); return true; } };
  const render = () => { cursor = 0; return exports.OrderArrivalPanel(props); };
  function all(node, match) {
    if (Array.isArray(node)) return node.flatMap(child => all(child, match));
    if (!node || typeof node !== 'object' || !node.props) return [];
    return [...(match(node) ? [node] : []), ...all(node.props.children, match)];
  }
  let tree = render();
  all(tree, node => node.type === 'button' && node.props.children === 'Không liên hệ được khách')[0].props.onClick();
  await new Promise(setImmediate);
  tree = render();
  assert.equal(all(tree, node => node.type === 'modal')[0].props.open, true);
  all(tree, node => node.type === 'textarea')[0].props.onChange({ target: { value: 'Đã liên hệ nhưng khách chưa trả lời.' } });
  all(tree, node => node.type === 'input' && node.props.type === 'checkbox')[0].props.onChange({ target: { checked: true } });
  const arrival = { name: 'dia-chi.jpg', type: 'image/jpeg', size: 1000 };
  const contact = { name: 'lien-he.jpg', type: 'image/jpeg', size: 1000 };
  all(tree, node => node.type === 'input' && node.props.type === 'file')[0].props.onChange({ target: { files: [arrival] } });
  tree = render();
  assert.equal(all(tree, node => node.type === 'img').length, 1);
  all(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 0);
  all(tree, node => node.type === 'input' && node.props.type === 'file')[1].props.onChange({ target: { files: [contact] } });
  tree = render();
  assert.equal(all(tree, node => node.type === 'img').length, 2);
  all(tree, node => node.type === 'button' && node.props['aria-label'] === 'Xóa ảnh liên hệ khách 1')[0].props.onClick();
  tree = render();
  assert.equal(all(tree, node => node.type === 'img').length, 1);
  all(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 0);
  all(tree, node => node.type === 'input' && node.props.type === 'file')[1].props.onChange({ target: { files: [contact] } });
  tree = render();
  all(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  await new Promise(setImmediate);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1][0].name, 'dia-chi.jpg');
  assert.equal(calls[0][2][0].name, 'lien-he.jpg');
});

test('Ảnh bằng chứng được gửi multipart dù API client mặc định dùng JSON', async () => {
  const axios = require('axios');
  const { File } = require('node:buffer');
  let received;
  const client = axios.create({ headers: { 'Content-Type': 'application/json' }, adapter: async config => {
    received = config;
    return { data: { success: true, data: { id: 'bien-nhan', url: 'https://example.com/anh.jpg', kind: 'arrival' } }, status: 201, statusText: 'Created', headers: {}, config };
  } });
  const filename = path.join(__dirname, '../src/features/provider/api/providerOrder.api.ts');
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, FormData, require: () => ({ __esModule: true, default: client }) }, { filename });
  const result = await exports.providerOrderApi.uploadNoShowEvidence('don', new File(['anh'], 'dia-chi.jpg', { type: 'image/jpeg' }), 'arrival');
  assert.ok(received.data instanceof FormData);
  assert.equal(received.data.get('kind'), 'arrival');
  assert.equal(received.data.get('image').name, 'dia-chi.jpg');
  assert.equal(result.id, 'bien-nhan');
  assert.equal(received.timeout, 110000);
});

function loadEvidenceApi() {
  const filename = path.join(__dirname, '../src/features/provider/api/providerOrder.api.ts');
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, require: () => ({}) }, { filename });
  return exports.providerOrderApi;
}

test('Ảnh bằng chứng chỉ tải tối đa hai ảnh đồng thời và giữ đúng thứ tự/nhóm khi hoàn tất lệch thứ tự', async () => {
  const api = loadEvidenceApi();
  let active = 0, peak = 0;
  const pending = [];
  api.uploadNoShowEvidence = (_orderId, file, kind) => {
    active++; peak = Math.max(peak, active);
    return new Promise(resolve => pending.push(() => {
      active--; resolve({ id: file.name, url: `https://example.com/${file.name}`, kind });
    }));
  };
  const resultPromise = api.uploadNoShowEvidenceBatch('don', [{ name: 'dia-chi' }], [{ name: 'goi-1' }, { name: 'goi-2' }]);
  assert.equal(pending.length, 2);
  pending[1](); await new Promise(setImmediate);
  assert.equal(pending.length, 3);
  pending[2](); pending[0]();
  const result = await resultPromise;
  assert.equal(peak, 2);
  assert.equal(result.arrival.map(item => item.id).join(','), 'dia-chi');
  assert.equal(result.contact.map(item => item.id).join(','), 'goi-1,goi-2');
});

test('Dừng lấy thêm ảnh trong hàng đợi nếu tải một ảnh thất bại', async () => {
  const api = loadEvidenceApi();
  let calls = 0;
  let finishOther;
  api.uploadNoShowEvidence = async () => {
    calls++;
    if (calls === 1) throw new Error('Tải ảnh thất bại');
    return new Promise(resolve => { finishOther = resolve; });
  };
  await assert.rejects(api.uploadNoShowEvidenceBatch('don', [{ name: 'dia-chi' }],
    [{ name: 'goi-1' }, { name: 'goi-2' }, { name: 'goi-3' }]), /Tải ảnh thất bại/);
  finishOther({ id: 'goi-1', url: 'https://example.com/anh.jpg', kind: 'contact' });
  await new Promise(setImmediate);
  assert.equal(calls, 2);
});
