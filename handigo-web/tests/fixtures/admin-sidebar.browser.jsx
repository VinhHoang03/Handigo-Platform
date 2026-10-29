import { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes } from 'react-router-dom';
import { AdminRoutes } from '../../src/routes/admin-routes';

const wait = (delay) => new Promise(resolve => setTimeout(resolve, delay));
async function until(check) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (check()) return;
    await wait(20);
  }
  throw Error('Quá thời gian chờ trang kiểm thử.');
}
function assert(condition, message) { if (!condition) throw Error(message); }

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Suspense fallback={<p data-outer-loading>Đang tải toàn trang</p>}>
      <Routes>{AdminRoutes()}</Routes>
    </Suspense>
  </BrowserRouter>,
);

(async () => {
  await until(() => document.querySelector('[data-page="Tổng quan"]'));
  const sidebar = document.querySelector('aside');
  const navigation = document.getElementById('admin-sidebar-navigation');
  navigation.scrollTop = 300;
  const initialScroll = navigation.scrollTop;
  assert(initialScroll > 0, 'Sidebar phải có thể cuộn để tái hiện lỗi.');
  const collapse = sidebar.querySelector('button[aria-controls]');
  const news = navigation.querySelector('a[href="/admin/news"]');
  news.click();
  await wait(50);
  assert(document.querySelector('aside') === sidebar, 'Sidebar bị thay trong lúc trang mới đang tải.');
  assert(navigation.scrollTop === initialScroll, 'Sidebar cuộn lên khi tải trang mới.');
  assert(!document.querySelector('[data-outer-loading]'), 'Chuyển mục không được thay toàn bộ layout bằng màn hình tải.');
  await until(() => document.querySelector('[data-page="Tin tức"]'));
  assert(document.querySelector('aside') === sidebar, 'Sidebar bị dựng lại sau chuyển mục.');
  assert(document.getElementById('admin-sidebar-navigation') === navigation, 'Vùng cuộn sidebar bị thay.');
  assert(navigation.scrollTop === initialScroll, 'Sidebar mất vị trí cuộn.');
  assert(collapse.getAttribute('aria-expanded') === 'true', 'Sidebar tự đổi trạng thái mở rộng.');
  assert(news.getAttribute('aria-current') === 'page', 'Mục đang chọn không cập nhật.');
  assert(document.querySelectorAll('aside').length === 1, 'Trang con dựng thêm sidebar.');
  collapse.click();
  await until(() => collapse.getAttribute('aria-expanded') === 'false');
  navigation.querySelector('a[href="/admin/feedbacks"]').click();
  await until(() => document.querySelector('[data-page="Đánh giá"]'));
  assert(document.querySelector('aside') === sidebar && navigation.scrollTop === initialScroll, 'Sidebar bị thay hoặc cuộn lên khi chuyển tiếp sang đánh giá.');
  assert(collapse.getAttribute('aria-expanded') === 'false', 'Sidebar mất trạng thái thu gọn.');
  window.history.back();
  await until(() => document.querySelector('[data-page="Tin tức"]'));
  assert(document.querySelector('aside') === sidebar && navigation.scrollTop === initialScroll, 'Sidebar mất trạng thái khi quay lại.');
  document.documentElement.setAttribute('data-sidebar-passed', 'true');
})().catch(error => document.documentElement.setAttribute('data-sidebar-error', `${error.message} (${location.pathname}; ${document.body.innerText.slice(-300)})`));
