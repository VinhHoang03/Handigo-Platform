const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const sourceRoot = path.join(__dirname, '../src');

function renderDetail(data, { loading = false, error = '', byOrder = false } = {}) {
  const cache = new Map();
  let stateIndex = 0;
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const exports = {};
    cache.set(filename, exports);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    vm.runInNewContext(code, { exports, require(name) {
      if (name === '@/components/common/Modal') return { Modal: ({ title, children }) => React.createElement('div', { role: 'dialog' }, title, children) };
      if (name === '@/features/feedback/api/feedback.api') return { feedbackApi: {} };
      if (name === '../../api/adminDashboard.api') return { adminDashboardApi: {} };
      if (name === 'react' && filename.endsWith('AdminFeedbackDetailModal.tsx')) return {
        useState: () => [[data, loading, error, 0][stateIndex++], () => {}], useEffect() {},
      };
      if (!name.startsWith('.') && !name.startsWith('@/')) return require(name);
      const base = name.startsWith('@/') ? path.join(sourceRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
      return load(['.ts', '.tsx'].map(extension => base + extension).find(fs.existsSync));
    } }, { filename });
    return exports;
  }
  const { AdminFeedbackDetailModal } = load(path.join(sourceRoot, 'features/admin/components/feedback/AdminFeedbackDetailModal.tsx'));
  return renderToStaticMarkup(React.createElement(AdminFeedbackDetailModal, { ...(byOrder ? { orderId: 'order1' } : { feedbackId: 'review1' }), onClose() {} }));
}

const feedback = { _id: 'review1', customerId: null, serviceId: null, rating: 2, createdAt: '2026-10-27T01:00:00Z', images: ['https://example.com/danh-gia.jpg'], isVisible: true,
  comment: 'Cần cải thiện', providerReply: { content: 'Thợ đã tiếp nhận', images: ['https://example.com/phan-hoi.jpg'] } };
const order = { _id: 'order1', orderCode: 'DH01', customerId: { fullName: 'Khách A', phone: '0900000000' },
  providerId: { userId: { fullName: 'Thợ A', phone: '0900000001' } }, serviceId: { name: 'Vệ sinh nhà', serviceType: 'fixed_price' },
  addressId: { fullAddress: 'Địa chỉ đơn hàng' }, orderType: 'scheduled', status: 'completed', paymentMethod: 'wallet', paymentStatus: 'paid',
  pricing: { bookingAmount: 120000, totalPaidAmount: 120000 }, createdAt: '2026-10-25T01:00:00Z',
  statusHistory: [{ _id: 'event1', status: 'completed', changedByRole: 'provider', createdAt: '2026-10-26T01:00:00Z' }],
  confirmation: { providerConfirmedAt: '2026-10-26T01:00:00Z' }, completionEvidenceImages: ['https://example.com/hoan-thanh.jpg'], completionNote: 'Đã hoàn thành dịch vụ' };

test('Modal hiển thị đơn, khách, thợ, thanh toán, phản hồi và cả ba nhóm ảnh', () => {
  const html = renderDetail({ feedback, order, quotation: null });
  for (const value of ['DH01', 'Khách A', 'Thợ A', '0900000000', '0900000001', 'Đã thanh toán', 'Xác nhận hoàn thành', 'Thợ xác nhận', 'Khách hàng xác nhận', 'Cần cải thiện', 'Thợ đã tiếp nhận', 'danh-gia.jpg', 'phan-hoi.jpg', 'hoan-thanh.jpg']) {
    assert.ok(html.includes(value), `Thiếu thông tin: ${value}`);
  }
});

test('Đơn hoặc liên kết không còn tồn tại vẫn hiển thị modal và đánh giá', () => {
  assert.ok(renderDetail({ feedback, order: null, quotation: null }).includes('Đơn hàng không còn tồn tại'));
  assert.ok(renderDetail({ feedback, order: { ...order, customerId: null, providerId: null, addressId: null, serviceId: null }, quotation: null }).includes('Cần cải thiện'));
});

test('Modal có trạng thái đang tải và nút thử lại khi API lỗi', () => {
  assert.ok(renderDetail(null, { loading: true }).includes('aria-busy="true"'));
  const html = renderDetail(null, { error: 'Không thể tải dữ liệu' });
  assert.ok(html.includes('Không thể tải dữ liệu'));
  assert.ok(html.includes('Thử lại'));
});

test('Chi tiết đơn đang xử lý mở được khi chưa có đánh giá và chưa xác nhận hoàn thành', () => {
  const html = renderDetail({ feedback: null, order: { ...order, status: 'in_progress', statusHistory: [], confirmation: null }, quotation: null }, { byOrder: true });
  assert.ok(html.includes('Chi tiết đơn hàng'));
  assert.ok(html.includes('Đang thực hiện'));
  assert.ok(!html.includes('Đánh giá và phản hồi'));
  assert.ok(html.includes('Chưa ghi nhận thời điểm xác nhận hoàn thành'));
});
