const { test } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');
const { readNewsImport, planNewsImport } = require('../src/scripts/importNewsArticles');
const { NewsArticle } = require('../src/models/newsArticle.model');
const { isNewsRichContent } = require('../src/utils/newsRichContent');

test('Bộ nhập có bốn bài cũ giữ slug và bốn bài mới với nội dung đầy đủ', () => {
  const rows = readNewsImport();
  assert.equal(rows.length, 8);
  assert.equal(rows.filter(row => row.origin === 'legacy').length, 4);
  assert.equal(rows.filter(row => row.origin === 'new').length, 4);
  assert.equal(new Set(rows.map(row => row.slug)).size, rows.length);
  for (const slug of ['bao-duong-dieu-hoa-tai-nha', 'kiem-tra-he-thong-dien-mua-mua', 'nang-cap-bao-mat-tai-khoan', 'bo-dung-cu-gia-dinh']) assert(rows.some(row => row.slug === slug));
  for (const row of rows) {
    const words = row.payload.content.map(block => block.type === 'list' ? block.items.join(' ') : block.text).join(' ').split(/\s+/).filter(Boolean);
    assert(words.length >= 350, row.slug);
    assert(row.payload.content.length >= 8, row.slug);
    assert(isNewsRichContent(row.payload.richContent));
    const model = new NewsArticle({ ...row.payload, slug: row.slug, publishedAt: row.publishedAt, createdBy: '000000000000000000000001' });
    assert.equal(model.validateSync(), undefined, row.slug);
  }
});

test('Ngày bài cũ được giữ, bài mới dùng ngày biên tập hiện tại', () => {
  const rows = readNewsImport();
  assert.equal(rows.find(row => row.slug === 'bao-duong-dieu-hoa-tai-nha').publishedAt.toISOString(), '2026-07-14T17:00:00.000Z');
  assert(rows.filter(row => row.origin === 'new').every(row => row.publishedAt.toISOString() === '2026-10-29T17:00:00.000Z'));
});

test('Chạy lại không ghi đè bài đã chỉnh sửa hoặc tự khôi phục bài đã xóa', () => {
  const rows = readNewsImport();
  const existing = rows.map((row, index) => ({ slug: row.slug, isDeleted: index === 0 }));
  const before = JSON.stringify(existing);
  assert(planNewsImport(rows, existing).every(row => row.action === 'keep'));
  assert.equal(JSON.stringify(existing), before);
  assert(planNewsImport(rows, []).every(row => row.action === 'insert'));
});

test('Bài kỹ thuật có nguồn tham khảo mở được từ nội dung định dạng', () => {
  const rows = readNewsImport();
  for (const slug of ['bao-duong-dieu-hoa-tai-nha', 'kiem-tra-he-thong-dien-mua-mua', 'cham-soc-may-giat-va-khi-nao-can-tho']) {
    const row = rows.find(row => row.slug === slug);
    assert(JSON.stringify(row.payload.richContent).includes('"type":"link"'));
    assert(row.payload.content.some(block => block.type === 'heading' && block.text === 'Nguồn tham khảo'));
  }
});
