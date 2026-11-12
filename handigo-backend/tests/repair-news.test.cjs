const { test } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');
const { NewsArticle } = require('../src/models/newsArticle.model');
const { newsContentToText } = require('../src/utils/newsRichContent');
const { buildRepairNews } = require('../src/scripts/repairNewsContent');
const { planNewsImport } = require('../src/scripts/importNewsArticles');
const { rankRepairArticles, searchRepairArticles } = require('../src/services/repairNews.service');

const base = { _id: 'article', slug: 'meo-sua-chua-washer-drain', title: 'Máy giặt không xả nước hoặc không vắt',
  excerpt: 'Nguyên nhân và cách xử lý an toàn', category: 'Mẹo sửa chữa', status: 'published', isDeleted: false,
  publishedAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
  content: [{ type: 'paragraph', text: 'Nội dung thuần cũ.' }] };

test('Chỉ trả bài đúng tình huống đã công bố, không dùng bài ẩn, xóa, khác mục hoặc hẹn công bố', () => {
  for (const patch of [{ status: 'draft' }, { isDeleted: true }, { category: 'Thông báo hệ thống' }, { publishedAt: new Date('2099-01-01') }]) {
    assert.equal(rankRepairArticles('Máy giặt không vắt', [{ ...base, ...patch }]).length, 0);
  }
  assert.equal(rankRepairArticles('Điều hòa chảy nước', [base]).length, 0);
  assert.equal(rankRepairArticles('may giat khong vat', [base])[0].path, '/tin-tuc/meo-sua-chua-washer-drain');
});

test('Đọc richContent đã chỉnh sửa, giữ liên kết nguồn, không dùng bản thuần cũ', () => {
  const richContent = { type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'Hướng dẫn mới: dừng máy.' },
    { type: 'text', text: 'Nguồn chính thức', marks: [{ type: 'link', attrs: { href: 'https://www.samsung.com/us/support/' } }] },
  ] }] };
  const result = rankRepairArticles('Máy giặt không vắt', [{ ...base, richContent }]);
  assert.match(result[0].content, /Hướng dẫn mới/);
  assert.match(result[0].content, /https:\/\/www.samsung.com/);
  assert.ok(!result[0].content.includes('thuần cũ'));
  assert.equal(newsContentToText(base.content, { type: 'script' }), '');
});

test('Bài mới do quản trị viên viết vẫn được tìm theo thiết bị và triệu chứng, không bắt buộc slug nhập sẵn', () => {
  const result = rankRepairArticles('Máy giặt không vắt', [{ ...base, slug: 'huong-dan-moi-cua-quan-tri' }]);
  assert.equal(result.length, 1);
  assert.equal(rankRepairArticles('Máy giặt hỏng', [{ ...base, slug: 'huong-dan-moi' }]).length, 0);
});

test('Mỗi lượt đều đọc database với bộ lọc công khai và giới hạn truy vấn', async () => {
  const previous = NewsArticle.find;
  let reads = 0;
  try {
    NewsArticle.find = filter => {
      reads++;
      assert.equal(filter.category, 'Mẹo sửa chữa'); assert.equal(filter.status, 'published');
      assert.equal(filter.isDeleted, false); assert.ok(filter.$or);
      return { select() { return this; }, sort() { return this; },
        limit(value) { assert.equal(value, 100); return this; },
        maxTimeMS(value) { assert.equal(value, 2500); return this; },
        lean: async () => [{ ...base, content: [{ type: 'paragraph', text: `Phiên bản ${reads}` }] }],
      };
    };
    assert.match((await searchRepairArticles('Máy giặt không vắt'))[0].content, /Phiên bản 1/);
    assert.match((await searchRepairArticles('Máy giặt không vắt'))[0].content, /Phiên bản 2/);
    assert.equal(reads, 2);
  } finally { NewsArticle.find = previous; }
});

test('Tạo 22 bài đúng bảy nhóm dịch vụ thật, có nguồn và qua validation của model', () => {
  const services = ['Sửa rò rỉ vòi nước nhà bếp', 'Sửa Chữa Điều Hòa', 'Sửa Máy Giặt', 'Sửa Tủ Lạnh', 'Tivi', 'Camera', 'Sửa Máy Bơm'].map(name => ({ name }));
  const rows = buildRepairNews(services, 'https://example.com/cover.webp');
  assert.equal(rows.length, 22); assert.equal(new Set(rows.map(row => row.slug)).size, 22);
  assert.ok(!rows.some(row => /heater-not-hot|drain-blocked|electrical-breaker/.test(row.slug)));
  for (const row of rows) {
    assert.equal(row.payload.category, 'Mẹo sửa chữa'); assert.equal(row.payload.status, 'published');
    assert.equal(new NewsArticle({ ...row.payload, slug: row.slug, publishedAt: row.publishedAt, createdBy: '000000000000000000000001' }).validateSync(), undefined, row.slug);
    assert.ok(row.payload.content.some(block => block.type === 'heading' && block.text === 'Nguồn tham khảo'));
    assert.match(JSON.stringify(row.payload.richContent), /"type":"link"/);
  }
  const again = planNewsImport(rows, rows.map((row, index) => ({ slug: row.slug, isDeleted: index === 0 })));
  assert.ok(again.every(row => row.action === 'keep'), 'Giữ nguyên cả bài đã chỉnh sửa hoặc đã xóa');
});
