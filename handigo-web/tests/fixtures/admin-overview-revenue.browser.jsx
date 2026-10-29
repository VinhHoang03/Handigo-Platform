import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ToastProvider, ToastContainer } from '../../src/components/common/Toast';
import { DashboardShell } from '../../src/components/common/DashboardShell';
import { AdminLayoutContext } from '../../src/components/common/dashboard/adminLayout.context';
import AdminDashboardPage from '../../src/features/admin/pages/AdminDashboardPage';
import AdminRevenuePage from '../../src/features/admin/pages/AdminRevenuePage';

function ObserveLocation() {
  const location = useLocation();
  useEffect(() => { window.__currentLocation = location; }, [location]);
  return null;
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check) {
  for (let index = 0; index < 200; index++) { if (check()) return; await delay(20); }
  throw Error('Quá thời gian chờ Tổng quan và báo cáo doanh thu.');
}
const assert = (value, message) => { if (!value) throw Error(message); };
createRoot(document.getElementById('root')).render(
  <MemoryRouter initialEntries={['/admin/revenue?fromDate=2026-10-01&toDate=2026-10-31']}>
    <ToastProvider><ToastContainer /><ObserveLocation /><Routes>
      <Route path="/admin" element={<DashboardShell role="ADMIN"><AdminLayoutContext.Provider value={true}><AdminDashboardPage /></AdminLayoutContext.Provider></DashboardShell>} />
      <Route path="/admin/revenue" element={<AdminRevenuePage />} />
    </Routes></ToastProvider>
  </MemoryRouter>,
);
(async () => {
  await until(() => document.querySelector('#revenue-payments table'));
  assert(window.__currentLocation.pathname === '/admin', 'Liên kết cũ phải chuyển về Tổng quan.');
  assert(window.__currentLocation.search.includes('fromDate=2026-10-01'), 'Chuyển hướng phải giữ ngày đã chọn.');
  assert(document.querySelectorAll('h1.admin-page-title').length === 1, 'Chỉ có một tiêu đề trang.');
  assert(!document.querySelector('aside a[href="/admin/revenue"]'), 'Sidebar không còn tab doanh thu riêng.');
  assert(document.querySelector('a[href="#admin-revenue"]'), 'Thẻ phí nền tảng phải dẫn đến section trong trang.');
  assert(document.querySelectorAll('[aria-label="Khoảng thời gian thống kê"]').length === 1, 'Chỉ có một bộ lọc dùng chung.');
  for (const title of ['Nhà cung cấp theo đơn hoàn thành', 'Cơ cấu doanh thu theo tháng', 'Thu tiền, hoàn tiền và đối soát', 'Dòng tiền thu theo ngày']) {
    assert(!document.body.textContent.includes(title), `Đã bỏ phần ${title}.`);
  }
  await until(() => document.body.textContent.includes('Thợ xếp hạng kiểm thử'));
  assert(document.body.textContent.includes('Bảng xếp hạng doanh thu theo thợ'), 'Xếp hạng được đổi sang danh sách thợ.');
  assert(document.body.textContent.includes('Vệ sinh điều hòa kiểm thử'), 'Hiển thị cơ cấu doanh thu dịch vụ thật từ API.');
  assert(document.body.textContent.includes('+100%'), 'Hiển thị tăng trưởng của dịch vụ.');
  assert(document.querySelector('a[href="/admin/cases?tab=reports&reportId=000000000000000000000003"]'), 'Cảnh báo mở đúng hồ sơ báo cáo.');
  const channel = document.querySelector('#revenue-payments [aria-label="Các kênh thanh toán"] button');
  channel.click();
  await until(() => window.__paymentQueries.at(-1)?.method === 'wallet');
  assert(window.__paymentQueries.at(-1).page === 1, 'Bấm kênh ví đặt lại trang giao dịch.');
  assert(document.querySelector('#revenue-payments select').value === 'wallet', 'Bảng thanh toán nhận bộ lọc từ thẻ kênh.');
  assert(document.querySelector('#revenue-payments').textContent.includes('15 đơn · 21 giao dịch'), 'Hiển thị tổng số đơn riêng biệt trên toàn bộ kết quả lọc.');
  const initialReports = window.__revenueInsightQueries.length;
  [...document.querySelectorAll('button')].find(item => item.textContent === '7 ngày').click();
  await until(() => window.__revenueInsightQueries.length > initialReports && document.querySelector('#revenue-payments table'));
  const params = new URLSearchParams(window.__currentLocation.search);
  const fromDate = params.get('fromDate'), toDate = params.get('toDate');
  assert(Date.parse(toDate) - Date.parse(fromDate) === 6 * 86400000, 'Preset 7 ngày tính đủ 7 ngày.');
  assert(window.__overviewQueries.at(-1).fromDate === fromDate && window.__overviewQueries.at(-1).toDate === toDate, 'Tổng quan dùng khoảng mới.');
  assert(window.__revenueInsightQueries.some(query => query.fromDate === fromDate && query.toDate === toDate), 'Báo cáo doanh thu dùng cùng khoảng.');
  assert(window.__paymentQueries.at(-1).fromDate === fromDate && window.__paymentQueries.at(-1).toDate === toDate, 'Bảng thanh toán dùng cùng khoảng.');
  const calls = window.__revenueInsightQueries.length;
  [...document.querySelectorAll('button')].find(item => item.textContent.trim() === 'Làm mới').click();
  await until(() => window.__revenueInsightQueries.length >= calls + 1 && document.querySelector('#revenue-payments table'));
  window.__failNextPayment = true;
  const methodSelect = document.querySelector('#revenue-payments select');
  methodSelect.value = 'cash';
  methodSelect.dispatchEvent(new Event('change', { bubbles: true }));
  await until(() => document.querySelector('.handigo-toast[role="alert"]'));
  assert(!document.querySelector('#revenue-payments [role="alert"]'), 'Lỗi admin hiện bằng toast, không chèn banner vào danh sách.');
  assert(![...document.querySelectorAll('#revenue-payments button')].some(button => button.textContent.includes('Thử lại')), 'Không hiện nút thử lại trong danh sách.');
  methodSelect.value = 'payos';
  methodSelect.dispatchEvent(new Event('change', { bubbles: true }));
  await until(() => document.querySelector('#revenue-payments table'));
  document.body.dataset.sidebarPassed = 'true';
})().catch(error => { document.body.dataset.sidebarError = error.message; });
