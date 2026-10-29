import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { rolldown } from 'rolldown';

// Kiểm thử Chrome với route, layout và sidebar thật; giả lập tài khoản và nội dung trang.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const datePicker = process.argv.includes('--date-picker');
const monthlyChart = process.argv.includes('--monthly-chart');
const revenue = process.argv.includes('--revenue');
const overviewRevenue = process.argv.includes('--overview-revenue');
const applications = process.argv.includes('--applications');
const recentOrders = process.argv.includes('--recent-orders');
const suggestions = process.argv.includes('--suggestions');
const folder = await mkdtemp(path.join(tmpdir(), 'handigo-sidebar-'));
let server;
try {
  const bundle = await rolldown({ input: path.join(root, suggestions ? 'tests/fixtures/admin-suggestions.browser.jsx' : recentOrders ? 'tests/fixtures/admin-recent-orders.browser.jsx' : applications ? 'tests/fixtures/admin-applications.browser.jsx' : overviewRevenue ? 'tests/fixtures/admin-overview-revenue.browser.jsx' : revenue ? 'tests/fixtures/admin-revenue.browser.jsx' : monthlyChart ? 'tests/fixtures/admin-monthly-chart.browser.jsx' : datePicker ? 'tests/fixtures/admin-date-picker.browser.jsx' : 'tests/fixtures/admin-sidebar.browser.jsx'), cwd: root,
    transform: { jsx: 'react-jsx' }, plugins: [{ name: 'du-lieu-kiem-thu', resolveId(id) {
      if (id.endsWith('.css')) return '\0style';
      if (suggestions && (id.includes('serviceSuggestion.api') || id.includes('categoryService.api'))) return path.join(root, 'tests/fixtures/admin-suggestions.mock.js');
      if (suggestions && id === '@/components/common/DashboardShell') return '\0revenue-shell';
      if (recentOrders && id.includes('adminDashboard.api')) return '\0recent-orders-api';
      if (recentOrders && id.includes('AdminFeedbackDetailModal')) return '\0revenue-detail';
      if (applications && id === '@/api/client') return '\0application-client';
      if ((revenue || overviewRevenue) && (id.includes('adminRevenue.api') || id.includes('adminOperations.api') || id.includes('adminDashboard.api'))) return path.join(root, 'tests/fixtures/admin-revenue.mock.js');
      if ((revenue || overviewRevenue) && id.includes('AdminFeedbackDetailModal')) return '\0revenue-detail';
      if (revenue && id === '@/components/common/DashboardShell') return '\0revenue-shell';
      if (id.includes('admin-lazy-pages')) return '\0pages';
      if (monthlyChart && id.includes('adminDashboard.api')) return '\0monthly-api';
      if (id.includes('auth.store')) return '\0auth';
      if (id.includes('useProviderAvailability')) return '\0availability';
      if (id.includes('useAdminPendingCounts')) return '\0pending-counts';
      if (id === '@/components/common/Navbar' || id.endsWith('/ProviderTopbar') || id.includes('AnimatedBackground')) return '\0header';
      if (id.startsWith('@/')) {
        const base = path.join(root, 'src', id.slice(2));
        return ['.ts', '.tsx', '/index.ts', '/index.tsx'].map(suffix => base + suffix).find(existsSync);
      }
    }, load(id) {
      if (id === '\0style') return '';
      if (id === '\0recent-orders-api') return `export const adminDashboardApi = { recentOrders: async ({page,limit}) => ({
        items:Array.from({length:Math.min(limit,25-(page-1)*limit)},(_,index)=> {const n=25-(page-1)*limit-index;return {_id:'order-'+n,orderCode:'ORD-'+n,serviceId:{name:'Vệ sinh máy lạnh'},customerId:{fullName:'Nguyễn An'},pricing:{totalPaidAmount:350000},status:n%2?'created':'completed',createdAt:'2026-10-29T07:30:00Z'};}),
        pagination:{page,limit,total:25,totalPages:Math.ceil(25/limit)}
      })};`;
      if (id === '\0application-client') return `export default {get: async (url,{params}={}) => {
        if(url === '/categories/active') return {data:{data:[]}};
        if(params?.limit === 1 && window.__failApplicationSummary) throw Error('Lỗi tải số lượng giả lập');
        if(params?.status === '' || params?.applicationType === '' || params?.categoryId === '') throw Error('Bộ lọc rỗng không hợp lệ');
        return {data:{data:{items:[],pagination:{page:1,total:params?.applicationType === 'service_addition' ? (params.status === 'pending' ? 0 : 4) : params?.status === 'pending' ? 15 : 173,totalPages:1}}}};
      }};`;
      if (id === '\0revenue-shell') return 'export const DashboardShell = ({children}) => children;';
      if (id === '\0revenue-detail') return `import {createElement} from 'react'; export const AdminFeedbackDetailModal = ({orderId,onClose}) => createElement('div',{role:'dialog'},orderId,createElement('button',{onClick:onClose},'Đóng'));`;
      if (id === '\0monthly-api') return 'export const adminDashboardApi = {};';
      if (id === '\0auth') return `export const useAuthStore = selector => selector({token:'kiem-thu',user:{id:'admin-test',role:'ADMIN'},isInitializing:false});`;
      if (id === '\0availability') return 'export const useProviderAvailability = () => ({isOnline:false,toggleAvailability(){}});';
      if (id === '\0pending-counts') return 'export const useAdminPendingCounts = () => ({counts:null,stale:false});';
      if (id === '\0header') return 'export const Navbar = () => null; export const ProviderTopbar = () => null; export const AnimatedBackground = () => null;';
      if (id === '\0pages') {
        const names = ['AdminUsersPage','AdminProviderApplicationsPage','AdminCategoriesPage','AdminPromotionsPage','AdminWithdrawalsPage','AdminSupportPage','AdminRevenuePage','AdminCasesPage','AdminDashboardPage','AdminPaymentsPage','AdminWalletsPage','AdminSystemConfigsPage','AdminNewsPage','AdminServiceSuggestionsPage','AdminFeedbackPage','NotificationsPage'];
        return `import {lazy,createElement} from 'react'; import {DashboardShell} from '@/components/common/DashboardShell';` + names.map(name => {
          const title = name === 'AdminDashboardPage' ? 'Tổng quan' : name === 'AdminNewsPage' ? 'Tin tức' : name === 'AdminFeedbackPage' ? 'Đánh giá' : name;
          return `export const ${name} = lazy(() => new Promise(resolve => setTimeout(() => resolve({default: () => createElement(DashboardShell,{role:'ADMIN'},createElement('h2',{'data-page':${JSON.stringify(title)}},${JSON.stringify(title)}))}), ${name === 'AdminNewsPage' ? 300 : 10})));`;
        }).join('');
      }
    } }],
  });
  await bundle.write({ file: path.join(folder, 'app.js'), format: 'es' });
  await bundle.close();
  const script = await readFile(path.join(folder, 'app.js'));
  server = createServer((req, res) => {
    if (req.url === '/app.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(script); return; }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!doctype html><html lang="vi"><meta charset="utf-8"><style>aside{display:flex;flex-direction:column;height:600px;width:288px}aside nav{height:350px;overflow-y:auto;flex-shrink:0}aside nav a{display:flex;min-height:48px}aside>div{min-height:70px}</style><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const chrome = process.env.QR_TEST_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const output = await new Promise((resolve, reject) => {
    const browser = spawn(chrome, ['--headless', '--disable-gpu', '--no-first-run', '--disable-background-networking',
      `--user-data-dir=${path.join(folder, 'profile')}`, '--dump-dom', '--virtual-time-budget=8000', `http://127.0.0.1:${server.address().port}/admin`], { windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => { browser.kill(); reject(Error('Quá thời gian chạy Chrome.')); }, 30000);
    browser.stdout.on('data', chunk => { stdout += chunk; });
    browser.stderr.on('data', chunk => { stderr += chunk; });
    browser.on('error', error => { clearTimeout(timer); reject(error); });
    browser.on('close', code => { clearTimeout(timer); code === 0 ? resolve(stdout) : reject(Error(stderr.slice(-1500))); });
  });
  const failure = /data-sidebar-error="([^"]*)"/.exec(output)?.[1];
  assert.equal(failure, undefined, failure);
  assert.match(output, /data-sidebar-passed="true"/, output.slice(-2000));
  if (applications) console.log('Đạt: thẻ hồ sơ điền đúng bộ lọc, giữ tìm kiếm/lĩnh vực/ngày, đặt lại trang và đồng bộ khi chọn thủ công.');
  console.log(suggestions ? 'Đạt: form dịch vụ dùng chung điền sẵn, hủy giữ ghi chú, khóa hiển thị, giữ dữ liệu khi lỗi, tạo/duyệt một request và khôi phục sau 409.' : overviewRevenue ? 'Đạt: doanh thu đã gộp vào Tổng quan, liên kết cũ chuyển đúng và bộ lọc dùng chung cho báo cáo/giao dịch.' : revenue ? 'Đạt: trang doanh thu giữ khoảng ngày, so sánh tiền và %, bảng thu/hoàn, phân trang và mở đơn.' : monthlyChart ? 'Đạt: biểu đồ lịch sử hiển thị sáu tháng, hai trục số đơn/doanh thu, đổi hai cột và ẩn dropdown số liệu.' : datePicker ? 'Đạt: xoay ngày/giờ, năm nhuận, áp dụng/hủy/xóa, giới hạn ngày, xác thực bắt buộc và Escape trong modal lồng nhau.' : 'Đạt: sidebar giữ DOM, vị trí cuộn và trạng thái thu gọn khi chuyển mục, chờ tải trang và quay lại.');
} finally {
  server?.closeAllConnections();
  await new Promise(resolve => server ? server.close(resolve) : resolve());
  const relative = path.relative(tmpdir(), folder);
  if (!relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(folder).startsWith('handigo-sidebar-')) {
    await rm(folder, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
  }
}
