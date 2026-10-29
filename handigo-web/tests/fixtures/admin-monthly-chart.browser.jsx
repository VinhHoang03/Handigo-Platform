import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MonthlyOperationsChart } from '../../src/features/admin/components/dashboard/DashboardMonthlyTrend';
import { CategoryChartView } from '../../src/components/common/chart/ChartViews';

const points = Array.from({ length: 6 }, (_, index) => ({ month: `2026-${String(index + 5).padStart(2, '0')}`, orders: index * 3, completedRevenue: index * 1000000, platformRevenue: index * 150000 }));
function App() {
  const [type, setType] = useState('composed');
  return <div style={{ width: 900 }}>
    <button id="two-bars" onClick={() => setType('bar')}>Hai cột</button>
    <MonthlyOperationsChart points={points} type={type} />
    <CategoryChartView data={[{ label: 'Đơn', value: 12 }]} type="horizontal" title="Kiểm tra trạng thái" showDetails={false} />
  </div>;
}
createRoot(document.getElementById('root')).render(<App />);
async function until(check) {
  for (let index = 0; index < 150; index++) {
    if (check()) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw Error('Biểu đồ không hiển thị đúng sau khi tải.');
}
(async () => {
  await until(() => document.querySelector('.recharts-line-curve'));
  if (!document.querySelector('.recharts-area-area') || document.querySelectorAll('.recharts-line-curve').length !== 2) throw Error('Thiếu vùng doanh thu hoặc đường thu nhập/đơn hoàn thành.');
  const text = document.body.textContent;
  if (!text.includes('Tháng 5/2026') || !text.includes('Tháng 10/2026')) throw Error('Thiếu tháng lịch sử trên trục thời gian.');
  if (document.querySelectorAll('.recharts-yAxis').length < 2) throw Error('Thiếu trục tiền hoặc số đơn.');
  if (document.querySelector('details')) throw Error('Biểu đồ danh mục vẫn còn dropdown số liệu.');
  document.getElementById('two-bars').click();
  await until(() => document.querySelectorAll('.recharts-bar').length >= 3 && !document.querySelector('.recharts-line-curve'));
  document.documentElement.setAttribute('data-sidebar-passed', 'true');
})().catch(error => document.documentElement.setAttribute('data-sidebar-error', error.message));
