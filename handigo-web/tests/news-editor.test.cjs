const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(relative) {
  const filename = path.join(__dirname, '../src', relative);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, URL, Date, require(name) {
    if (name.endsWith('.css')) return {};
    if (!name.startsWith('.') && !name.startsWith('@/')) return require(name);
    const target = name.startsWith('@/') ? path.join(__dirname, '../src', name.slice(2)) : path.resolve(path.dirname(filename), name);
    const file = ['.ts', '.tsx'].map(ext => target + ext).find(candidate => fs.existsSync(candidate));
    return load(path.relative(path.join(__dirname, '../src'), file));
  } });
  return exports;
}
const { newsDraftKey, readNewsDraft, writeNewsDraft, normalizeNewsContent, validateNewsForm } =
  load('features/admin/components/news/newsDraft.ts');
const makeForm = overrides => ({ title: '', excerpt: '', category: 'Thông báo hệ thống', coverImage: '',
  authorName: 'Ban biên tập Handigo', content: [{ type: 'paragraph', text: '' }], status: 'draft', isFeatured: false, ...overrides });
const store = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};

test('Khôi phục đầy đủ bản nháp chưa đủ thông tin sau khi mở lại', () => {
  const storage = store();
  const key = newsDraftKey('quan-tri-1');
  const form = makeForm({ title: 'Đang viết', content: [{ type: 'paragraph', text: 'Nội dung chưa xong\nDòng tiếp theo' }] });
  writeNewsDraft(storage, key, form);
  const draft = readNewsDraft(storage, key);
  assert.equal(JSON.stringify(draft.form), JSON.stringify(form));
  assert(Number.isFinite(Date.parse(draft.savedAt)));
});

test('Bản đang soạn tách riêng theo tài khoản, bài mới và từng bài đã lưu', () => {
  const storage = store();
  writeNewsDraft(storage, newsDraftKey('quan-tri-1', 'bai-1'), makeForm({ title: 'Bài riêng' }));
  assert.equal(readNewsDraft(storage, newsDraftKey('quan-tri-2', 'bai-1')), null);
  assert.equal(readNewsDraft(storage, newsDraftKey('quan-tri-1', 'bai-2')), null);
  assert.equal(readNewsDraft(storage, newsDraftKey('quan-tri-1')), null);
});

test('Bỏ qua dữ liệu khôi phục hỏng hoặc sai cấu trúc', () => {
  for (const raw of ['{', 'null', JSON.stringify({ savedAt: 'sai', form: makeForm() }),
    JSON.stringify({ savedAt: new Date().toISOString(), form: makeForm({ content: [{ type: 'list', items: 'sai' }] }) }),
    JSON.stringify({ savedAt: new Date().toISOString(), form: makeForm({ content: [null] }) })]) {
    assert.equal(readNewsDraft({ getItem: () => raw }, 'nhap'), null);
  }
});

test('Lỗi đầy bộ nhớ được trả về để giao diện báo thay vì báo lưu thành công', () => {
  assert.throws(() => writeNewsDraft({ setItem() { throw new Error('Đầy bộ nhớ'); } }, 'nhap', makeForm()), /Đầy bộ nhớ/);
});

test('Chuẩn hóa trước khi gửi API giữ thứ tự và loại đoạn trống', () => {
  const result = normalizeNewsContent([{ type: 'paragraph', text: '  ' }, { type: 'heading', text: ' Đề mục ' },
    { type: 'list', items: [' Một ', '', ' Hai '] }, { type: 'quote', text: ' Lưu ý ' }]);
  assert.equal(JSON.stringify(result), JSON.stringify([{ type: 'heading', text: 'Đề mục' },
    { type: 'list', items: ['Một', 'Hai'] }, { type: 'quote', text: 'Lưu ý' }]));
});

test('Xuất bản yêu cầu đủ dữ liệu và đúng giới hạn hợp đồng API', () => {
  const valid = makeForm({ title: 'Tin tức Handigo', excerpt: 'Mô tả bài viết hợp lệ', coverImage: 'https://example.com/anh.webp',
    content: [{ type: 'paragraph', text: 'Nội dung bài viết' }] });
  assert.equal(validateNewsForm(valid), '');
  assert.notEqual(validateNewsForm(makeForm()), '');
  assert.notEqual(validateNewsForm({ ...valid, coverImage: 'javascript:alert(1)' }), '');
  assert.notEqual(validateNewsForm({ ...valid, content: [{ type: 'list', items: Array(31).fill('Mục') }] }), '');
  assert.notEqual(validateNewsForm({ ...valid, content: [{ type: 'list', items: ['a'.repeat(501)] }] }), '');
  assert.notEqual(validateNewsForm({ ...valid, content: [{ type: 'paragraph', text: 'a'.repeat(5001) }] }), '');
});

test('Xem trước và trang đọc hiển thị nội dung dưới dạng chữ an toàn', () => {
  const { NewsArticleContent } = load('features/content/components/NewsArticleContent.tsx');
  const html = renderToStaticMarkup(React.createElement(NewsArticleContent, { content: [
    { type: 'paragraph', text: '<script>alert(1)</script>' },
    { type: 'list', items: ['Một', 'Một'] },
  ] }));
  assert(!html.includes('<script>'));
  assert(html.includes('&lt;script&gt;'));
  assert.equal((html.match(/<li /g) || []).length, 2);
});

test('Bản nháp lưu và khôi phục nguyên định dạng chữ', () => {
  const storage = store();
  const richContent = { type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: 'right' }, content: [
    { type: 'text', text: 'Bản nháp', marks: [{ type: 'bold' }, { type: 'textStyle', attrs: { fontSize: '24px', fontFamily: 'Arial' } }] },
  ] }] };
  writeNewsDraft(storage, 'nhap-dinh-dang', makeForm({ richContent }));
  assert.equal(JSON.stringify(readNewsDraft(storage, 'nhap-dinh-dang').form.richContent), JSON.stringify(richContent));
});

test('Trang đọc giữ căn lề, kiểu chữ và liên kết an toàn', () => {
  const { NewsArticleContent } = load('features/content/components/NewsArticleContent.tsx');
  const html = renderToStaticMarkup(React.createElement(NewsArticleContent, { content: [], richContent: {
    type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'Liên kết', marks: [
      { type: 'bold' }, { type: 'italic' }, { type: 'underline' }, { type: 'strike' },
      { type: 'textStyle', attrs: { fontFamily: 'Georgia', fontSize: '24px', color: '#ff0000', backgroundColor: '#ffff00' } },
      { type: 'link', attrs: { href: 'https://example.com' } },
    ] }] }],
  } }));
  for (const expected of ['text-align:center', 'font-family:Georgia', 'font-size:24px', '<strong>', '<em>', '<u>', '<s>', 'background-color:#ffff00', 'noopener noreferrer nofollow']) assert(html.includes(expected), expected);
});

test('Dữ liệu localStorage độc hại không sinh HTML hoặc CSS thực thi', () => {
  const { NewsArticleContent } = load('features/content/components/NewsArticleContent.tsx');
  const html = renderToStaticMarkup(React.createElement(NewsArticleContent, { content: [], richContent: {
    type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>', marks: [
      { type: 'link', attrs: { href: 'javascript:alert(1)' } }, { type: 'textStyle', attrs: { color: 'url(https://example.com)', fontFamily: 'url(evil)' } },
    ] }] }],
  } }));
  assert(!html.includes('javascript:')); assert(!html.includes('url(')); assert(!html.includes('<script>'));
});
