import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ApplicationSummary } from '../../src/features/admin/components/applications/ApplicationSummary';
import { ApplicationFilters } from '../../src/features/admin/components/applications/ApplicationFilters';
import { useAdminApplicationsController } from '../../src/features/admin/components/applications/useAdminApplicationsController';
import { ToastProvider, ToastContainer } from '../../src/components/common/Toast';

function Fixture() {
  const [query, setQuery] = useState({ page: 3, keyword: 'An', categoryId: 'cat', fromDate: '2026-10-01', toDate: '2026-10-29' });
  window.__applicationQuery = query;
  return <>
    <ApplicationSummary query={query} counts={[173, 15, 4, 142, 12]} loading={false} onChange={setQuery} />
    <ApplicationFilters query={query} categories={[{ _id: 'cat', name: 'Điện lạnh' }]} onChange={setQuery} />
  </>;
}
function ControllerFixture() {
  const applications = useAdminApplicationsController();
  window.__applications = applications;
  return <>
    <ApplicationSummary query={applications.query} {...applications.summary} onChange={applications.setQuery} />
    <ToastContainer />
  </>;
}
const root = createRoot(document.getElementById('root'));
root.render(<Fixture />);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const check = (value, message) => { if (!value) throw new Error(message); };
async function run() {
  await wait(100);
  const buttons = [...document.querySelectorAll('section button')];
  for (const [index, status, type] of [[1, 'pending', ''], [2, 'pending', 'service_addition'], [3, 'approved', ''], [4, 'rejected', ''], [0, '', '']]) {
    buttons[index].click();
    await wait(20);
    const query = window.__applicationQuery;
    check(query.status === status && query.applicationType === type && query.page === 1, 'Thẻ không điền đúng bộ lọc/trang.');
    check(query.keyword === 'An' && query.categoryId === 'cat' && query.fromDate === '2026-10-01', 'Mất bộ lọc tìm kiếm, lĩnh vực hoặc ngày.');
    check(document.querySelector('#admin-application-status').value === status && document.querySelector('#admin-application-type').value === type, 'Select không đồng bộ với thẻ.');
    check(buttons[index].getAttribute('aria-pressed') === 'true', 'Thẻ đang chọn không được đánh dấu.');
  }
  const select = document.querySelector('#admin-application-status');
  select.value = 'resubmitted';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await wait(20);
  check(window.__applicationQuery.status === 'resubmitted', 'Không lọc được hồ sơ gửi lại.');
  check(buttons.every(button => button.getAttribute('aria-pressed') === 'false'), 'Thẻ không đồng bộ khi lọc thủ công.');
  check(buttons[0].textContent.includes('173'), 'Thiếu số lượng hồ sơ.');
  root.render(<ToastProvider><ControllerFixture /></ToastProvider>);
  await wait(500);
  check(window.__applications.summary.counts?.[0] === 173 && window.__applications.summary.counts?.[1] === 15, 'Hook không tải được số lượng ban đầu.');
  check(window.__applications.summary.counts?.[2] === 0, 'Thẻ bổ sung vẫn đếm hồ sơ đã duyệt.');
  window.__failApplicationSummary = true;
  await window.__applications.load();
  await wait(500);
  check(document.body.textContent.includes('Vui lòng nhấn “Làm mới” để tải lại.'), 'Thiếu toast nhắc làm mới khi tải thất bại.');
  check(![...document.querySelectorAll('button')].some(button => button.textContent === 'Thử lại'), 'Còn nút Thử lại trong trang.');
  check(window.__applications.summary.counts === null && !window.__applications.summary.loading, 'Lỗi bị hiển thị thành số 0 hoặc vẫn tải.');
  window.__failApplicationSummary = false;
  await window.__applications.load();
  await wait(500);
  check(window.__applications.summary.counts?.[0] === 173, 'Làm mới không khôi phục số lượng.');
  document.body.setAttribute('data-sidebar-passed', 'true');
}
run().catch(error => document.body.setAttribute('data-sidebar-error', error.message));
