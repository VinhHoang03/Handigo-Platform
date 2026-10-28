import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Modal } from '../../src/components/common/Modal';
import { AdminDatePicker } from '../../src/features/admin/components/shared/AdminDatePicker';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check) {
  for (let index = 0; index < 100; index++) { if (check()) return; await delay(20); }
  throw Error('Quá thời gian chờ bộ chọn ngày.');
}
const assert = (value, message) => { if (!value) throw Error(message); };
const dialogs = () => [...document.querySelectorAll('[role="dialog"]')];
const picker = () => dialogs().find(item => item.querySelector('h2')?.textContent.startsWith('Chọn '));
const button = (root, text) => [...root.querySelectorAll('button')].find(item => item.textContent === text);
const wheel = label => [...picker().querySelectorAll('[role="listbox"]')].find(item => document.getElementById(item.getAttribute('aria-labelledby'))?.textContent === label);
const key = (element, value) => element.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true }));
let changes = 0;
let submitted = 0;
function App() {
  const [date, setDate] = useState('2024-01-31');
  const [time, setTime] = useState('');
  const [open, setOpen] = useState(false);
  return <>
    <AdminDatePicker id="wheel-date" label="Ngày lọc" value={date} min="2024-01-01" max="2024-12-31" onChange={value => { changes++; setDate(value); }} />
    <output id="date-value">{date}</output>
    <button onClick={() => setOpen(true)}>Mở biểu mẫu</button>
    <Modal open={open} title="Biểu mẫu kiểm thử" onClose={() => setOpen(false)}>
      <form id="test-form" onSubmit={event => { event.preventDefault(); submitted++; }}>
        <AdminDatePicker id="wheel-time" label="Bắt đầu" required includeTime value={time} min="2026-10-28T09:00" max="2026-10-28T10:00" onChange={setTime} />
        <output id="time-value">{time}</output>
        <button type="button" onClick={() => setTime('2026-10-28T09:05')}>Đặt giờ kiểm thử</button>
        <button type="submit">Lưu</button>
      </form>
    </Modal>
  </>;
}
createRoot(document.getElementById('root')).render(<App />);
(async () => {
  await until(() => document.getElementById('wheel-date'));
  document.getElementById('wheel-date').click();
  await until(picker);
  key(wheel('Tháng'), 'ArrowDown');
  await until(() => picker().textContent.includes('29/02/2024'));
  assert(changes === 0, 'Không được áp dụng bộ lọc khi đang xoay.');
  button(picker(), 'Áp dụng').click();
  await until(() => document.getElementById('date-value').textContent === '2024-02-29');
  document.getElementById('wheel-date').click();
  await until(picker);
  wheel('Ngày').dispatchEvent(new WheelEvent('wheel', { deltaY: -60, cancelable: true }));
  await until(() => picker().textContent.includes('28/02/2024'));
  button(picker(), 'Hủy').click();
  await until(() => !picker());
  assert(changes === 1, 'Hủy phải giữ nguyên giá trị đã chọn.');
  button(document, 'Mở biểu mẫu').click();
  await until(() => document.getElementById('test-form'));
  document.getElementById('test-form').requestSubmit();
  await until(picker);
  assert(submitted === 0, 'Không được lưu biểu mẫu thiếu ngày bắt buộc.');
  key(document, 'Escape');
  await until(() => !picker());
  assert(dialogs().length === 1 && document.body.style.overflow === 'hidden', 'Escape chỉ được đóng bộ chọn ngày, giữ biểu mẫu và khóa cuộn.');
  button(document, 'Đặt giờ kiểm thử').click();
  await until(() => document.getElementById('time-value').textContent.includes('09:05'));
  document.getElementById('wheel-time').click();
  await until(picker);
  key(wheel('Giờ'), 'ArrowDown');
  await until(() => picker().textContent.includes('28/10/2026 10:00'));
  button(picker(), 'Áp dụng').click();
  await until(() => document.getElementById('time-value').textContent === '2026-10-28T10:00');
  document.getElementById('test-form').requestSubmit();
  assert(submitted === 1, 'Biểu mẫu hợp lệ phải lưu được.');
  key(document, 'Escape');
  await until(() => dialogs().length === 0);
  assert(document.body.style.overflow === '', 'Đóng toàn bộ modal phải khôi phục cuộn.');
  document.getElementById('wheel-date').click();
  await until(picker);
  button(picker(), 'Xóa').click();
  await until(() => document.getElementById('date-value').textContent === '');
  document.documentElement.setAttribute('data-sidebar-passed', 'true');
})().catch(error => document.documentElement.setAttribute('data-sidebar-error', error.message));
