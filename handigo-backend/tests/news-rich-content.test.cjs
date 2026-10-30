const { test } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');
const { isNewsRichContent } = require('../src/utils/newsRichContent');
const { createNewsArticleSchema, updateNewsArticleSchema } = require('../src/validations/newsArticle.validator');
const { NewsArticle } = require('../src/models/newsArticle.model');
const richContent = { type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: 'center' }, content: [
  { type: 'text', text: 'Nội dung', marks: [{ type: 'bold' }, { type: 'textStyle', attrs: { fontSize: '24px', fontFamily: 'Arial', color: '#ff0000', backgroundColor: '#ffff00', lineHeight: '1.5' } }] },
] }] };
const payload = { title: 'Bài tin tức', excerpt: 'Mô tả tin tức hợp lệ', category: 'Tin tức', coverImage: 'https://example.com/a.webp', authorName: 'Handigo',
  content: [{ type: 'paragraph', text: 'Nội dung' }], status: 'draft', isFeatured: false };

test('Bài cũ không có richContent vẫn hợp lệ; bài định dạng lưu được qua schema Mongoose', () => {
  assert(createNewsArticleSchema.safeParse(payload).success);
  assert(createNewsArticleSchema.safeParse({ ...payload, richContent }).success);
  const article = new NewsArticle({ ...payload, richContent, slug: 'bai-tin-tuc', createdBy: '000000000000000000000001' });
  assert.equal(article.validateSync(), undefined);
  assert.equal(JSON.stringify(article.toObject().richContent), JSON.stringify(richContent));
  assert(updateNewsArticleSchema.safeParse({ richContent }).success);
});

test('Chặn HTML, node không hỗ trợ, thuộc tính sự kiện và liên kết thực thi mã', () => {
  const bad = [
    '<p>HTML</p>', { type: 'doc', content: [{ type: 'script', text: 'alert(1)' }] },
    { type: 'doc', content: [{ type: 'paragraph', attrs: { onclick: 'alert(1)' } }] },
    { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bấm', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] },
    { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bấm', marks: [{ type: 'link', attrs: { href: 'java\nscript:alert(1)' } }] }] }] },
  ];
  for (const doc of bad) {
    assert(!isNewsRichContent(doc));
    assert(!createNewsArticleSchema.safeParse({ ...payload, richContent: doc }).success);
  }
});

test('Chặn cây quá sâu và nội dung quá lớn trước khi lưu', () => {
  let nested = { type: 'paragraph' };
  for (let i = 0; i < 15; i++) nested = { type: 'blockquote', content: [nested] };
  assert(!isNewsRichContent({ type: 'doc', content: [nested] }));
  assert(!isNewsRichContent({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a'.repeat(100001) }] }] }));
});

test('Model cũng từ chối richContent nguy hiểm khi không đi qua route', () => {
  const article = new NewsArticle({ ...payload, richContent: { type: 'script' }, slug: 'bai-tin-tuc', createdBy: '000000000000000000000001' });
  assert(article.validateSync()?.errors.richContent);
});
