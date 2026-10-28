import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../src/components/common/Toast';
import AdminRevenuePage from '../../src/features/admin/pages/AdminRevenuePage';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check) {
  for (let index = 0; index < 150; index++) { if (check()) return; await delay(20); }
  throw Error('Quá thời gian chờ báo cáo doanh thu.');
}
const assert = (value, message) => { if (!value) throw Error(message); };
const button = text => [...document.querySelectorAll('button')].find(item => item.textContent === text);
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/admin/revenue?fromDate=2026-10-01&toDate=2026-10-31']}><ToastProvider><AdminRevenuePage /></ToastProvider></MemoryRouter>);
(async () => {
  await until(() => document.querySelector('#revenue-payments table'));
  assert(window.__reportQueries.some(query => query.fromDate === '2026-09-01' && query.toDate === '2026-09-30'), 'Phải tải tháng trước theo lịch.');
  assert(document.body.textContent.includes('Tăng 50.000') && document.body.textContent.includes('(50%)'), 'Phải hiện cả số tiền và phần trăm.');
  const back = [...document.querySelectorAll('a')].find(item => item.textContent === 'Về tổng quan');
  assert(back.getAttribute('href').includes('fromDate=2026-10-01&toDate=2026-10-31'), 'Quay lại phải giữ bộ lọc.');
  const table = () => document.querySelector('#revenue-payments table');
  assert(table().textContent.includes('200.000'), 'Tiền thu là toàn bộ khoản thanh toán.');
  assert(table().textContent.includes('ORD-KIEM-THU'), 'Hiện mã đơn thật, không dùng ID rút gọn.');
  button('Sau').click();
  await until(() => window.__paymentQueries.at(-1)?.page === 2 && table());
  button('Tiền đã hoàn').click();
  await until(() => table()?.textContent.includes('25.000'));
  assert(window.__paymentQueries.at(-1).dateField === 'refundedAt' && window.__paymentQueries.at(-1).page === 1, 'Đổi loại giao dịch phải lọc ngày hoàn và về trang đầu.');
  assert(!table().textContent.includes('200.000'), 'Hoàn một phần phải hiện đúng khoản đã hoàn.');
  table().querySelector('button').click();
  await until(() => document.querySelector('[role="dialog"]'));
  assert(document.querySelector('[role="dialog"]').textContent.includes('000000000000000000000002'), 'Mở đúng đơn của giao dịch.');
  button('Đóng').click();
  document.body.dataset.sidebarPassed = 'true';
})().catch(error => { document.body.dataset.sidebarError = error.message; });
