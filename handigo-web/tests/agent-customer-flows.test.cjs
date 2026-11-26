const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { MemoryRouter } = require('react-router-dom');
const root = path.resolve(__dirname, '../src');
function load(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, Date, require: name => name.startsWith('@/')
    ? load(name.slice(2) + '.ts') : require(name) });
  return exports;
}
const { AgentConfirmationCard } = load('features/chatbot/components/AgentConfirmationCard.tsx');
const render = (tool, preview, extra = {}) => renderToStaticMarkup(React.createElement(MemoryRouter, null,
  React.createElement(AgentConfirmationCard, { action: { id: 'action', tool, preview, expiresAt: '2035-01-01T00:00:00Z' },
    disabled: false, onDecision: () => {}, ...extra })));

test('Xác nhận rút tiền hiện đủ ngân hàng, số che, chủ tài khoản, số tiền và hệ quả trước khi xác nhận', () => {
  const html = render('create_withdrawal', { title: 'Tạo yêu cầu rút tiền', bankName: 'Ngân hàng thử nghiệm',
    maskedAccountNumber: '••••6789', accountHolderName: 'NGUYEN VAN AN', amount: 100000,
    bankAccountId: 'internal-bank-id', bankFingerprint: 'internal-version', note: 'Chờ quản trị viên duyệt; chưa chuyển về ngân hàng.' });
  for (const expected of ['Ngân hàng nhận', 'Ngân hàng thử nghiệm', 'Số tài khoản', '••••6789', 'Chủ tài khoản', 'NGUYEN VAN AN', '100.000', 'chưa chuyển', 'Xác nhận', 'Từ chối']) assert.ok(html.includes(expected), expected);
  assert.doesNotMatch(html, /internal-bank-id|internal-version|123456789/);
});

test('Xác nhận báo cáo hiện loại vi phạm, đối tượng, nội dung và ảnh đã chọn', () => {
  const html = render('create_report', { title: 'Gửi báo cáo vi phạm', subject: 'Thợ làm phiền', description: 'Mô tả sự việc',
    reportType: 'harassment', targetType: 'chat_conversation', orderCode: 'ORD-TEST',
    customerAttachments: ['https://owned/evidence.png'], note: 'Chưa có kết luận vi phạm.' });
  for (const expected of ['Quấy rối', 'Cuộc trò chuyện', 'Thợ làm phiền', 'Mô tả sự việc', 'ORD-TEST', 'https://owned/evidence.png', 'Chưa có kết luận']) assert.ok(html.includes(expected), expected);
});

test('Xác nhận xóa địa chỉ hiện đúng mục và hệ quả; bản hết hạn yêu cầu kiểm tra lại', () => {
  const html = render('delete_saved_address', { title: 'Xóa địa chỉ đã lưu', address: '12 Lê Lợi, Đà Nẵng', note: 'Không thay đổi đơn đã tạo.' },
    { action: { tool: 'delete_saved_address', expiresAt: '2000-01-01T00:00:00Z', preview: { title: 'Xóa địa chỉ đã lưu', address: '12 Lê Lợi, Đà Nẵng', note: 'Không thay đổi đơn đã tạo.' } } });
  assert.ok(html.includes('12 Lê Lợi, Đà Nẵng')); assert.ok(html.includes('Không thay đổi đơn đã tạo.'));
  assert.ok(html.includes('Kiểm tra lại thông tin')); assert.ok(html.includes('đã hết hạn'));
});

test('Giao diện phân loại luồng mới theo công cụ xác nhận và lời khách, không hiển thị nhầm luồng đặt đơn', () => {
  const { getAgentConversationFlow } = load('features/chatbot/utils/agentConversationFlow.ts');
  for (const tool of ['create_report', 'get_report', 'cancel_report', 'add_report_evidence']) assert.equal(getAgentConversationFlow({ pendingConfirmation: { tool } }), 'complaint');
  for (const tool of ['create_withdrawal', 'get_my_withdrawals', 'get_withdrawal_accounts']) assert.equal(getAgentConversationFlow({ pendingConfirmation: { tool } }), 'payment');
  for (const tool of ['delete_saved_address', 'set_default_address', 'discard_unpaid_order', 'get_feedback_moderation']) assert.equal(getAgentConversationFlow({ pendingConfirmation: { tool } }), 'general');
  assert.equal(getAgentConversationFlow({ messages: [{ sender: 'user', content: 'Tôi muốn báo cáo thợ quấy rối' }] }), 'complaint');
  assert.equal(getAgentConversationFlow({ messages: [{ sender: 'user', content: 'Rút tiền từ ví của tôi' }] }), 'payment');
});

test('Thanh toán báo giá hiện mã, tổng, cọc và số còn trả; xóa đơn chưa trả tiền là xác nhận riêng', () => {
  const html = render('create_payment', { title: 'Thanh toán phần còn lại', quotationCode: 'Q-TEST', quotationAmount: 1000000,
    paidAmount: 100000, amount: 900000, paymentLabel: 'Phần còn lại của báo giá', paymentMethod: 'wallet', quotationId: 'internal-quotation-id', quotationRevision: 2 });
  for (const expected of ['Q-TEST', '1.000.000', '100.000', '900.000', 'Ví Handigo', 'Phần còn lại']) assert.ok(html.includes(expected), expected);
  assert.doesNotMatch(html, /internal-quotation-id|quotationRevision/);
  const deleting = render('discard_unpaid_order', { title: 'Xóa đơn chưa thanh toán', orderCode: 'ORD-TEST', note: 'Kiểm tra và đóng QR trước khi xóa.' });
  for (const expected of ['ORD-TEST', 'Xóa đơn chưa thanh toán', 'đóng QR', 'Xác nhận', 'Từ chối']) assert.ok(deleting.includes(expected), expected);
});
