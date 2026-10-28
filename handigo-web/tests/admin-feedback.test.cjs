const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const sourceRoot = path.join(__dirname, '../src');
const cache = new Map();
function load(filename) {
  if (cache.has(filename)) return cache.get(filename);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  cache.set(filename, exports);
  vm.runInNewContext(code, { exports, require(name) {
    if (!name.startsWith('.') && !name.startsWith('@/')) return require(name);
    const base = name.startsWith('@/') ? path.join(sourceRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
    const dependency = ['.ts', '.tsx'].map(extension => base + extension).find(fs.existsSync);
    if (!dependency) throw new Error(`Không tìm thấy module: ${name}`);
    return load(dependency);
  } }, { filename });
  return exports;
}

const { AdminFeedbackList } = load(path.join(sourceRoot, 'features/admin/components/feedback/AdminFeedbackList.tsx'));
const feedback = {
  _id: 'danh-gia', rating: 1, customerId: { fullName: 'Khách A' },
  serviceId: { name: 'Vệ sinh nhà' }, orderId: { orderCode: 'DH01' },
  providerId: { userId: { fullName: 'Thợ A' } },
  createdAt: '2026-10-27T01:00:00Z', images: [], isVisible: true,
  comment: 'Dịch vụ cần cải thiện',
};
const render = (overrides = {}) => renderToStaticMarkup(
  React.createElement(AdminFeedbackList, { items: [{ ...feedback, ...overrides }], onToggle() {} }),
);

test('Đánh giá đầy đủ thông tin vẫn hiển thị tên, mã đơn và thao tác', () => {
  const html = render();
  for (const text of ['Khách A', 'Thợ A', 'DH01', 'Vệ sinh nhà', 'Ẩn đánh giá']) {
    assert.ok(html.includes(text));
  }
});

for (const [field, fallback] of [
  ['providerId', 'Chưa có thông tin'],
  ['orderId', 'Dịch vụ cần cải thiện'],
  ['customerId', 'Khách hàng'],
  ['serviceId', 'Dịch vụ'],
]) {
  test(`Không lỗi khi tham chiếu ${field} trả về null`, () => {
    assert.ok(render({ [field]: null }).includes(fallback));
  });
}

test('Vẫn hiển thị đánh giá khi tất cả tham chiếu bị thiếu', () => {
  const html = render({ providerId: null, orderId: null, customerId: null, serviceId: null });
  assert.ok(html.includes('Dịch vụ cần cải thiện'));
  assert.ok(html.includes('Ẩn đánh giá'));
});

test('Card có ngày đánh giá, ngày thực hiện thực tế, mã đơn và trạng thái', () => {
  const html = render({ orderId: { orderCode: 'DH02', performedAt: '2026-10-26T01:00:00Z' } });
  for (const text of ['Ngày đánh giá:', 'Ngày thực hiện:', 'Mã đơn:', 'DH02', 'Trạng thái:', 'Đang hiển thị']) {
    assert.ok(html.includes(text));
  }
  assert.match(html, /datetime="2026-10-26T01:00:00Z"/i);
});

test('Không dùng ngày hẹn thay cho ngày thực hiện khi chưa có lịch sử', () => {
  const html = render({ orderId: { orderCode: 'DH03', scheduledAt: '2026-10-25T01:00:00Z', performedAt: null } });
  assert.ok(html.includes('Ngày thực hiện:'));
  assert.doesNotMatch(html, /datetime="2026-10-25T01:00:00Z"/i);
  assert.ok(html.includes('Chưa có thông tin'));
});

function loadPageQuery() {
  const filename = path.join(sourceRoot, 'features/feedback/pages/AdminFeedbackPage.tsx');
  const state = [];
  let cursor = 0;
  let request;
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require(name) {
    if (name === 'react') return {
      useCallback: callback => callback,
      useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
      },
    };
    if (name === 'react/jsx-runtime') return require(name);
    if (name === '../hooks/useFeedback') return {
      useFeedbackList(mode, query, onLoaded) {
        request = { mode, query, onLoaded };
        return { result: null, loading: true, load() {} };
      },
    };
    return new Proxy({}, { get: () => () => null });
  } });
  return () => {
    cursor = 0;
    exports.default();
    return request;
  };
}

test('Mặc định tải 30 đánh giá dưới 4 sao; không có kết quả thì chuyển sang tất cả', () => {
  const renderPage = loadPageQuery();
  let request = renderPage();
  assert.equal(request.query.limit, 30);
  assert.equal(request.query.ratingBelow, 4);
  request.onLoaded({ items: [], pagination: { total: 0 } });
  request = renderPage();
  assert.equal(request.query.ratingBelow, undefined);
  assert.equal(request.query.page, 1);
  assert.equal(request.query.limit, 30);
  request.onLoaded({ items: [], pagination: { total: 0 } });
  assert.equal(renderPage().query, request.query);
});

test('Giữ bộ lọc dưới 4 sao khi tổng kết quả lớn hơn 0 kể cả trang hiện tại rỗng', () => {
  const renderPage = loadPageQuery();
  const request = renderPage();
  request.onLoaded({ items: [], pagination: { total: 31 } });
  assert.equal(renderPage().query, request.query);
});

test('Bấm card mở chi tiết; bấm ẩn đánh giá chỉ gọi thao tác kiểm duyệt', () => {
  let opened = 0;
  let toggled = 0;
  const tree = AdminFeedbackList({ items: [feedback], onOpen: () => { opened++; }, onToggle: () => { toggled++; } });
  const buttons = [];
  function visit(element) {
    if (!element || typeof element !== 'object') return;
    if (element.type === 'button') buttons.push(element);
    for (const child of [element.props?.children, element.props?.actions].flat(Infinity)) visit(child);
  }
  visit(tree);
  buttons.find(button => button.props['aria-label'] === 'Xem chi tiết đơn hàng và đánh giá').props.onClick();
  assert.equal(opened, 1);
  assert.equal(toggled, 0);
  buttons.find(button => !button.props['aria-label']).props.onClick();
  assert.equal(opened, 1);
  assert.equal(toggled, 1);
});
