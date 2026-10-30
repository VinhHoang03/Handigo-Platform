const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const base = path.join(__dirname, '../src/features/admin/components/news');
const compile = name => ts.transpileModule(fs.readFileSync(path.join(base, name), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const draftExports = {};
const richExports = {};
const richSource = ts.transpileModule(fs.readFileSync(path.join(base, '../../../content/utils/newsRichContent.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
vm.runInNewContext(richSource, { exports: richExports, URL });
vm.runInNewContext(compile('newsDraft.ts'), { exports: draftExports, URL, Date, require: () => richExports });
const empty = { title: '', excerpt: '', category: 'Thông báo hệ thống', coverImage: '', authorName: 'Handigo',
  content: [{ type: 'paragraph', text: '' }], status: 'draft', isFeatured: false };
const valid = { ...empty, title: 'Bài viết hợp lệ', excerpt: 'Mô tả ngắn hợp lệ', coverImage: 'https://example.com/a.webp',
  content: [{ type: 'paragraph', text: 'Nội dung đang soạn' }] };

// Bộ điều khiển hook cô lập để kiểm tra lưu/khôi phục, không gọi API hoặc database thật.
function editorHarness({ articleId, api = {}, storage } = {}) {
  const data = new Map();
  storage ??= { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const slots = [], dependencies = [], cleanups = [];
  let cursor = 0, effects = [];
  const navigation = [], calls = [];
  const newsApi = {
    listAdmin: async () => [],
    create: async payload => { calls.push(payload); return { ...payload, id: 'bai-moi', updatedAt: new Date().toISOString() }; },
    update: async (id, payload) => { calls.push(payload); return { ...payload, id, updatedAt: new Date().toISOString() }; },
    ...api,
  };
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!dependencies[index] || deps.some((value, i) => !Object.is(value, dependencies[index][i]))) {
        dependencies[index] = deps;
        effects.push(() => { cleanups[index]?.(); cleanups[index] = effect(); });
      }
    },
  };
  const exports = {};
  vm.runInNewContext(compile('useNewsEditor.ts'), {
    exports, localStorage: storage, structuredClone,
    window: { addEventListener() {}, removeEventListener() {} },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react-router-dom') return { useNavigate: () => (...args) => navigation.push(args) };
      if (name.endsWith('news.api')) return { newsApi };
      if (name.endsWith('apiError')) return { getErrorMessage: (err, fallback) => err.message || fallback };
      if (name === './news.constants') return { emptyNewsForm: empty, toNewsForm: article => structuredClone(article) };
      if (name === './newsDraft') return draftExports;
      if (name.endsWith('newsRichContent')) return richExports;
      throw new Error(`Module chưa được giả lập: ${name}`);
    },
  });
  const render = () => {
    cursor = 0; effects = [];
    const value = exports.useNewsEditor('quan-tri-thu', articleId);
    effects.forEach(effect => effect());
    return value;
  };
  return { render, storage, calls, navigation, unmount: () => cleanups.forEach(cleanup => cleanup?.()) };
}

test('Lưu nháp thiếu thông tin chỉ lưu cục bộ và báo rõ, không gọi API', async () => {
  const harness = editorHarness();
  harness.render().change({ ...empty, title: 'Dở' });
  await harness.render().save('draft');
  assert.equal(harness.calls.length, 0);
  assert.match(harness.render().notice, /trình duyệt/);
  assert.equal(draftExports.readNewsDraft(harness.storage, draftExports.newsDraftKey('quan-tri-thu')).form.title, 'Dở');
});

test('Lưu nháp hợp lệ gửi trạng thái draft, xóa bản khôi phục và chuyển sang ID thật', async () => {
  const harness = editorHarness();
  harness.render().change(valid);
  await harness.render().save('draft');
  assert.equal(harness.calls[0].status, 'draft');
  assert.equal(harness.storage.getItem(draftExports.newsDraftKey('quan-tri-thu')), null);
  assert.equal(harness.navigation[0][0], '/admin/news/bai-moi/edit');
  assert.equal(harness.navigation[0][1].replace, true);
});

test('API lỗi vẫn giữ nguyên bản đang soạn và khôi phục khi mở lại', async () => {
  const harness = editorHarness({ api: { create: async () => { throw new Error('Không kết nối được'); } } });
  harness.render().change(valid);
  await harness.render().save('published');
  assert.match(harness.render().error, /Không kết nối/);
  const reopened = editorHarness({ storage: harness.storage });
  assert.equal(reopened.render().form.title, valid.title);
  assert.equal(reopened.render().form.content[0].text, valid.content[0].text);
  assert.equal(harness.navigation.length, 0);
});

test('Lưu bản đang sửa của bài công khai không tự gỡ xuất bản', async () => {
  const harness = editorHarness({ articleId: 'bai-cu', api: {
    listAdmin: async () => [{ ...valid, id: 'bai-cu', status: 'published' }],
  } });
  harness.render(); await new Promise(resolve => setImmediate(resolve));
  harness.render().change({ ...valid, title: 'Sửa bài đang công khai' });
  await harness.render().save('draft');
  assert.equal(harness.calls.length, 0);
  assert.equal(harness.render().article.status, 'published');
  assert.match(harness.render().notice, /Cập nhật bài viết/);
});

test('Bỏ bản cục bộ phục hồi dữ liệu máy chủ, không xóa bài trên hệ thống', async () => {
  const harness = editorHarness({ articleId: 'bai-cu', api: { listAdmin: async () => [{ ...valid, id: 'bai-cu' }] } });
  harness.render(); await new Promise(resolve => setImmediate(resolve));
  harness.render().change({ ...valid, title: 'Thay đổi chưa lưu' });
  harness.render().discard();
  assert.equal(harness.render().form.title, valid.title);
  assert.equal(harness.storage.getItem(draftExports.newsDraftKey('quan-tri-thu', 'bai-cu')), null);
  assert.equal(harness.calls.length, 0);
});

test('Lưu xong sau khi rời trang không kéo người dùng quay lại trang sửa', async () => {
  let complete;
  const harness = editorHarness({ api: { create: payload => new Promise(resolve => { complete = () => resolve({ ...payload, id: 'bai-moi' }); }) } });
  harness.render().change(valid);
  const saving = harness.render().save('draft');
  harness.unmount(); complete(); await saving;
  assert.equal(harness.navigation.length, 0);
});

test('Trình duyệt không lưu được phải báo lỗi lưu trữ', () => {
  const harness = editorHarness({ storage: { getItem: () => null, setItem() { throw new Error('Đầy bộ nhớ'); } } });
  harness.render().change(valid);
  assert.equal(harness.render().storageFailed, true);
  assert.equal(harness.render().savedAt, '');
});

test('Lưu lên hệ thống gửi cả định dạng và bản chữ thuần đồng bộ', async () => {
  const harness = editorHarness();
  const richContent = { type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'Nội dung mới có định dạng', marks: [{ type: 'bold' }] },
  ] }] };
  harness.render().change({ ...valid, richContent });
  await harness.render().save('draft');
  assert.equal(JSON.stringify(harness.calls[0].richContent), JSON.stringify(richContent));
  assert.equal(harness.calls[0].content[0].text, 'Nội dung mới có định dạng');
});
