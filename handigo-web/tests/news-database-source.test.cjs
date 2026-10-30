const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.join(__dirname, '../src/features/content');
const compile = relative => ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const views = {};
vm.runInNewContext(compile('utils/newsView.ts'), { exports: views, Intl, Date });
const article = (slug = 'bao-duong-dieu-hoa-tai-nha') => ({ id: slug, slug, title: 'Bài trong database', excerpt: 'Nội dung đầy đủ',
  category: 'Mẹo sửa chữa', coverImage: 'https://example.com/a.webp', authorName: 'Handigo', content: [{ type: 'paragraph', text: 'Thân bài từ database' }],
  status: 'published', isFeatured: false, publishedAt: '2026-10-30T00:00:00.000Z' });

function hookHarness(api) {
  const slots = [], effects = [], timers = [];
  let cursor = 0;
  const useState = initial => {
    const i = cursor++;
    if (!(i in slots)) slots[i] = initial;
    return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
  };
  const exports = {};
  vm.runInNewContext(compile('hooks/useNewsArticle.ts'), {
    exports, Promise, window: { setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {} },
    require(name) {
      if (name === 'react') return { useState, useEffect: fn => { if (!slots[cursor++]) { slots[cursor - 1] = true; effects.push(fn); } } };
      if (name.endsWith('/Toast')) return { useToastFeedback: useState };
      if (name.endsWith('news.api')) return { newsApi: api };
      if (name.endsWith('newsView')) return views;
      if (name.endsWith('apiError')) return { getErrorMessage: (err, fallback) => err.message || fallback };
      throw new Error(`Module không được giả lập: ${name}`);
    },
  });
  const render = () => { cursor = 0; return exports.useNewsArticle('bao-duong-dieu-hoa-tai-nha'); };
  return { render, async load() { render(); effects.forEach(fn => fn()); timers.forEach(fn => fn()); await new Promise(resolve => setImmediate(resolve)); return render(); } };
}

test('Bài đã ẩn/xóa không xuất hiện lại bằng nội dung tĩnh cùng slug', async () => {
  const harness = hookHarness({ getPublished: async () => { throw new Error('Không tìm thấy bài viết'); }, listPublished: async () => [] });
  const result = await harness.load();
  assert.equal(result.article, null);
  assert.equal(result.related.length, 0);
  assert.match(result.error, /Không tìm thấy/);
  assert.equal(result.isLoading, false);
});

test('Lỗi tải bài liên quan vẫn giữ thân bài chính lấy từ database', async () => {
  const harness = hookHarness({ getPublished: async () => article(), listPublished: async () => { throw new Error('Mất kết nối'); } });
  const result = await harness.load();
  assert.equal(result.article.content[0].text, 'Thân bài từ database');
  assert.equal(result.related.length, 0);
  assert.equal(result.error, '');
});

test('Bài liên quan chỉ gồm dữ liệu API và loại bài đang đọc', async () => {
  const harness = hookHarness({ getPublished: async () => article(), listPublished: async () => [article(), article('bai-moi')] });
  const result = await harness.load();
  assert.equal(result.related.length, 1);
  assert.equal(result.related[0].slug, 'bai-moi');
});
