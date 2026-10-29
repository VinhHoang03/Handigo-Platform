import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider, ToastContainer } from '../../src/components/common/Toast';
import AdminServiceSuggestionsPage from '../../src/features/service-suggestion/pages/AdminServiceSuggestionsPage';

const root = createRoot(document.getElementById('root'));
const mount = key => root.render(<MemoryRouter key={key}><ToastProvider><AdminServiceSuggestionsPage /><ToastContainer /></ToastProvider></MemoryRouter>);
const check = (value, message) => { if (!value) throw Error(message); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check) {
  for (let i = 0; i < 200; i++) { if (check()) return; await wait(20); }
  throw Error('Quá thời gian chờ giao diện đề xuất.');
}
const dialog = () => document.querySelector('[role="dialog"]');
const button = text => [...document.querySelectorAll('button')].find(node => node.textContent.trim() === text);
function fill(selector, value) {
  const node = document.querySelector(selector);
  const proto = node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(node, value);
  node.dispatchEvent(new Event(node instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}
async function openForm() {
  await until(() => button('Xử lý'));
  button('Xử lý').click();
  await until(() => dialog()?.textContent.includes('Xử lý đề xuất'));
  fill('[role="dialog"] textarea', 'Ghi chú cần giữ lại');
  await wait(20);
  button('Tạo dịch vụ và duyệt').click();
  await until(() => document.querySelector('[name="service-name"]'));
}
mount(1);
(async () => {
  await until(() => button('Xử lý'));
  check(!document.querySelector('table').textContent.includes('Mô tả đề xuất đầy đủ'), 'Danh sách còn mô tả.');
  check(!document.querySelector('table').textContent.includes('Nhà cung cấp'), 'Danh sách còn cột nhà cung cấp.');
  await openForm();
  check(document.querySelectorAll('[role="dialog"]').length === 1, 'Hai modal đang chồng nhau.');
  check(document.querySelector('[name="service-name"]').value === 'Bảo dưỡng thiết bị', 'Tên không điền sẵn.');
  check(document.querySelector('[name="service-description"]').value === 'Mô tả đề xuất đầy đủ', 'Mô tả không điền sẵn.');
  check(document.querySelector('[name="service-category"]').value === '507f1f77bcf86cd799439012', 'Danh mục không điền sẵn.');
  check(document.querySelector('[name="service-active"]').disabled && !document.querySelector('[name="service-active"]').checked, 'Chưa khóa hiển thị dịch vụ.');
  button('Hủy').click();
  await until(() => dialog()?.textContent.includes('Xử lý đề xuất'));
  check(dialog().querySelector('textarea').value === 'Ghi chú cần giữ lại', 'Hủy form làm mất ghi chú.');
  check(window.__suggestionRequests.length === 0, 'Hủy form vẫn gửi request.');
  button('Tạo dịch vụ và duyệt').click();
  await until(() => document.querySelector('[name="service-name"]'));
  fill('[name="service-name"]', 'Tên dịch vụ đã sửa');
  fill('[name="service-price-type"]', 'variable_price');
  await until(() => document.querySelector('[name="service-deposit-amount"]'));
  fill('[name="service-deposit-amount"]', '30000');
  await wait(20);
  window.__suggestionError = 400;
  document.querySelector('button[type="submit"]').click();
  document.querySelector('button[type="submit"]').click();
  await until(() => window.__suggestionRequests.length === 1 && document.body.textContent.includes('Không thể duyệt đề xuất thử nghiệm.'));
  check(document.querySelector('[name="service-name"]').value === 'Tên dịch vụ đã sửa', 'Lỗi làm mất dữ liệu form.');
  window.__suggestionError = 0;
  document.querySelector('button[type="submit"]').click();
  await until(() => window.__suggestionRequests.length === 2 && !dialog());
  const payload = window.__suggestionRequests[1].payload;
  check(payload.status === 'approved' && payload.serviceDraft.name === 'Tên dịch vụ đã sửa' && payload.serviceDraft.depositAmount === 30000, 'Sai payload tạo và duyệt.');
  check(payload.serviceDraft.isActive === false && payload.adminNote === 'Ghi chú cần giữ lại', 'Sai trạng thái hiển thị hoặc ghi chú.');
  window.__resetSuggestions();
  mount(2);
  await openForm();
  window.__suggestionError = 409;
  document.querySelector('button[type="submit"]').click();
  await until(() => dialog()?.textContent.includes('Dịch vụ đã tạo: Dịch vụ đã tạo'));
  check(!button('Tạo dịch vụ và duyệt'), 'Đề xuất đã xử lý vẫn cho tạo lại.');
  check(dialog().querySelector('a[href="/admin/categories"]'), 'Thiếu liên kết quản lý dịch vụ.');
  check(document.querySelectorAll('[role="dialog"]').length === 1, 'Khôi phục sau 409 bị chồng modal.');
  document.body.setAttribute('data-sidebar-passed', 'true');
})().catch(error => document.body.setAttribute('data-sidebar-error', error.message));
