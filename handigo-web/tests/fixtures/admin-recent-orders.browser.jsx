import { createRoot } from 'react-dom/client';
import { DashboardRecentOrders } from '../../src/features/admin/components/dashboard/DashboardRecentOrders';

createRoot(document.getElementById('root')).render(<DashboardRecentOrders />);
const check = (value, message) => { if (!value) throw Error(message); };
async function until(check) {
  for (let i = 0; i < 150; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
  throw Error('Quá thời gian chờ danh sách đơn.');
}
(async () => {
  await until(() => document.querySelectorAll('article li').length === 5);
  check(document.body.textContent.includes('ORD-25') && document.body.textContent.includes('Xem tất cả (25)'), 'Thiếu mã đơn mới nhất hoặc tổng số đơn.');
  [...document.querySelectorAll('button')].find(button => button.textContent.includes('Xem tất cả')).click();
  await until(() => document.querySelector('[role="dialog"]')?.querySelectorAll('li').length === 20);
  [...document.querySelectorAll('[role="dialog"] button')].find(button => button.textContent === 'Sau').click();
  await until(() => document.querySelector('[role="dialog"]')?.textContent.includes('Trang 2/2'));
  check(document.querySelector('[role="dialog"]').textContent.includes('ORD-5'), 'Trang sau không tải đúng đơn.');
  document.querySelector('[role="dialog"] li button').click();
  await until(() => document.querySelectorAll('[role="dialog"]').length === 2);
  check(document.body.textContent.includes('order-5'), 'Mở sai chi tiết đơn.');
  document.documentElement.setAttribute('data-sidebar-passed', 'true');
})().catch(error => document.documentElement.setAttribute('data-sidebar-error', error.message));
