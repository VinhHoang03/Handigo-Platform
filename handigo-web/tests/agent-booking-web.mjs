import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { rolldown } from 'rolldown';
import { existsSync } from 'node:fs';

// Dùng Chrome và component thật; thay API bằng fixture, không gọi LLM, PayOS hoặc dữ liệu tài khoản thật.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viewport = process.argv.includes('--narrow') ? '430,932' : '1100,900';
const visual = process.argv.find((arg) => arg.startsWith('--visual='))?.split('=')[1];
const business = process.argv.includes('--business');
const scroll = process.argv.includes('--scroll');
const historyActions = process.argv.includes('--history-actions');
const paymentCancellation = process.argv.includes('--payment-cancellation');
const flowExtensions = process.argv.includes('--flow-extensions');
const modelRecovery = process.argv.includes('--model-recovery');
const newSession = process.argv.includes('--new-session');
const voucherForm = process.argv.includes('--voucher-form');
const screenshot = visual ? path.join(tmpdir(), `handigo-agent-${visual}-${viewport.replace(',', 'x')}.png`) : null;
const folder = await mkdtemp(path.join(tmpdir(), 'handigo-agent-booking-'));
const mocks = ['booking.api', 'feedback.api', 'customerService.api', 'wallet.api', 'agent.api', 'chatbot.api', 'authenticatedSocket', 'tokenStorage', 'auth.store'];
let server;
let browser;
let connection;
try {
  const bundle = await rolldown({ input: path.join(root, 'tests/fixtures/agent-booking.browser.jsx'), cwd: root,
    transform: { jsx: 'react-jsx' },
    plugins: [{ name: 'api-gia-lap', resolveId(id) {
      if (id.endsWith('.css')) return '\0agent-style.js';
      if (id === '@/api/client') return '\0api-client';
      if (mocks.some((name) => id.includes(name)) || id === '@/components/common/Toast') return '\0' + id;
      if (id.startsWith('@/')) {
        const base = path.join(root, 'src', id.slice(2));
        return ['.ts', '.tsx', '/index.ts', '/index.tsx', ''].map((suffix) => base + suffix).find((file) => existsSync(file));
      }
    }, load(id) {
      if (!id.startsWith('\0')) return;
      if (id === '\0agent-style.js') return '';
      if (id === '\0api-client') return `export default {get: async (url) => {
        const f = window.__agentFixture;
        if (url.includes('/chat/orders/')) { f.chatOrderId = url.split('/')[3]; return {data:{data:{_id:'cuoc-tro-chuyen',providerId:{userId:{fullName:'Thợ thực tế'}},customerId:{fullName:'Khách kiểm thử'}}}}; }
        if (url.includes('/messages')) return {data:{data:{items:[],pagination:{page:1,total:0,totalPages:0}}}};
        throw Error('API chưa được khai báo trong fixture.');
      }, post: async () => ({data:{data:{}}})};`;
      if (id.includes('booking.api')) return `export const bookingApi = {
        getOrderById: async (id) => { const f = window.__agentFixture; f.mapOrderId = id; if (++f.mapReads === 1) throw Error('Lỗi tải vị trí giả lập'); return f.orderDetail; },
        getPaymentById: async () => window.__agentFixture.paymentRecord,
        getPaymentQr: async () => new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="white"/><rect x="10" y="10" width="80" height="80" fill="black"/></svg>'], {type:'image/svg+xml'}),
        reconcilePayosPayment: async () => ({payment:window.__agentFixture.paymentRecord}),
        getBookingPolicies: async () => { const f = window.__agentFixture; if (++f.policiesRead === 1) throw Error('Lỗi chính sách giả lập'); return f.policies; },
        getAddresses: async () => { const f = window.__agentFixture; if (++f.addressReads === 1) throw Error('Lỗi địa chỉ giả lập'); return f.addresses; }
      };`;
      if (id.includes('feedback.api')) return `export const feedbackApi = { getOrderContext: async () => {
        const f = window.__agentFixture; if (f.feedbackError) { f.feedbackError = false; throw Error('Lỗi kiểm tra đánh giá giả lập'); }
        return f.feedbackContext;
      }};`;
      if (id.includes('customerService.api')) return `export const customerServiceApi = {
        nearbyProviders: async () => { const f = window.__agentFixture; if (f.session.bookingDraft?.hasDraftAddress) throw Error('Không được tra địa chỉ tạm qua API sổ địa chỉ'); return f.providers; },
        publicProviderProfile: async () => window.__agentFixture.profile,
        options: async () => []
      };`;
      if (id.includes('wallet.api')) return `export const walletApi = { getMine: async () => ({balance: location.pathname === '/customer/wallet' ? 1000000 : 1000}), createDeposit: async (input) => window.__agentFixture.deposit(input) };`;
      if (id.includes('agent.api')) return `export const agentApi = { uploadAttachment: (id, file) => window.__agentFixture.upload(id, file), reset: (id) => window.__agentFixture.reset(id), list: async () => window.__agentFixture.history, get: (id) => window.__agentFixture.get(id), latest: () => window.__agentFixture.get(window.__agentFixture.ids.session), send: (input) => window.__agentFixture.send(input) };`;
      if (id.includes('chatbot.api')) return `export const chatbotApi = {history: async () => ({items:[]})};`;
      if (id.includes('authenticatedSocket')) return `export const createAuthenticatedSocket = () => { const f = window.__agentFixture; f.socketHandlers ??= {}; return {socket:{on(event, handler){f.socketHandlers[event] = handler;},off(event){delete f.socketHandlers[event];}},dispose(){}}; };`;
      if (id.includes('tokenStorage')) return `export const tokenStorage = {prepareExternalRedirect(){window.__agentFixture.redirectCaptured = true; throw Error('Đã ghi nhận chuyển hướng ngoài trong kiểm thử.');}};`;
      if (id.includes('auth.store')) return `export const useAuthStore = (selector) => selector({user:{id:'111111111111111111111111',role:'CUSTOMER'}});`;
      if (id.includes('/Toast')) return `import {useState} from 'react'; export const useToastFeedback = (value) => useState(value); export const useToast = () => ({addToast(){}});`;
    } }],
  });
  await bundle.write({ file: path.join(folder, 'app.js'), format: 'es' });
  await bundle.close();
  const assets = await readdir(path.join(root, 'dist/assets'));
  const cssName = assets.find((name) => /^index-.*\.css$/.test(name));
  const css = Buffer.concat([cssName ? await readFile(path.join(root, 'dist/assets', cssName)) : Buffer.from(''),
    await readFile(path.join(root, 'node_modules/leaflet/dist/leaflet.css'))]);
  const script = await readFile(path.join(folder, 'app.js'));
  server = createServer(async (req, res) => {
    if (req.url === '/app.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(script); }
    else if (req.url === '/app.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); }
    else if (req.url.startsWith('/assets/') && assets.includes(req.url.slice(8))) {
      const assetName = req.url.slice(8);
      res.setHeader('Content-Type', assetName.endsWith('.woff2') ? 'font/woff2' : 'font/woff');
      res.end(await readFile(path.join(root, 'dist/assets', assetName)));
    }
    else if (req.url.startsWith('/agent-check') || req.url.startsWith('/customer/wallet')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');
    } else { res.statusCode = 404; res.end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const chrome = process.env.QR_TEST_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  // Đặt viewport bằng DevTools để tránh giới hạn chiều rộng tối thiểu của cửa sổ Chrome trên Windows.
  const endpoint = await new Promise((resolve, reject) => {
    browser = spawn(chrome, ['--headless', '--disable-gpu', '--no-first-run', '--disable-background-networking',
      '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
      `--user-data-dir=${path.join(folder, 'profile')}`, '--window-size=1100,1000', 'about:blank'], { windowsHide: true });
    let errors = '';
    const timer = setTimeout(() => reject(Error('Chưa mở được trình duyệt kiểm thử.')), 15000);
    browser.stderr.on('data', (chunk) => {
      errors += chunk;
      const url = /DevTools listening on (ws:\/\/[^\s]+)/.exec(errors)?.[1];
      if (url) { clearTimeout(timer); resolve(url); }
    });
    browser.on('error', (error) => { clearTimeout(timer); reject(error); });
    browser.on('close', (status) => { clearTimeout(timer); reject(Error(`Trình duyệt đóng sớm (${status}): ${errors.slice(-1000)}`)); });
  });
  const endpointUrl = new URL(endpoint);
  const pages = await fetch(`http://${endpointUrl.host}/json/list`).then((response) => response.json());
  connection = new WebSocket(pages.find((page) => page.type === 'page').webSocketDebuggerUrl);
  const pending = new Map();
  let sequence = 0;
  connection.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(Error(message.error.message));
    else request.resolve(message.result);
  });
  await new Promise((resolve, reject) => {
    connection.addEventListener('open', resolve, { once: true });
    connection.addEventListener('error', reject, { once: true });
  });
  const invoke = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(Error(`DevTools quá thời gian: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    connection.send(JSON.stringify({ id, method, params }));
  });
  const [width, height] = viewport.split(',').map(Number);
  await invoke('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await invoke('Page.navigate', { url: `http://127.0.0.1:${port}/agent-check${voucherForm ? '?voucher-form=true' : newSession ? '?new-session=true' : modelRecovery ? '?model-recovery=true' : visual ? `?visual=${encodeURIComponent(visual)}` : flowExtensions ? '?flow-extensions=true' : paymentCancellation ? '?payment-cancellation=true' : historyActions ? '?history-actions=true' : scroll ? '?scroll=true' : business ? '?business=true' : ''}` });
  let output = '';
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const result = await invoke('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
    output = result.result.value || '';
    if (/data-agent-booking-(passed|error)=/.test(output)) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const failure = /data-agent-booking-error="([\s\S]*?)"/.exec(output)?.[1];
  if (failure) {
    const diagnostic = await invoke('Runtime.evaluate', { expression: 'JSON.stringify({state:window.__agentFixture?.session?.state,pending:window.__agentFixture?.session?.pendingConfirmation?.tool,request:window.__agentFixture?.calls.filter(x=>x.type==="send").at(-1)?.request,text:document.querySelector("aside")?.textContent.slice(-700)})', returnByValue: true });
    console.error(diagnostic.result.value);
  }
  assert.equal(failure, undefined, failure);
  assert.match(output, /data-agent-booking-passed="true"/, output.slice(-4500));
  if (screenshot) {
    await invoke('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true });
    const capture = await invoke('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(screenshot, Buffer.from(capture.data, 'base64'));
  }
  if (screenshot) console.log(`Ảnh kiểm tra giao diện: ${screenshot}`);
  if (modelRecovery) console.log(`Đạt phục hồi model (${viewport}): phản hồi tạm dừng, thử lại cùng yêu cầu, không lặp tin nhắn khách.`);
  if (newSession) console.log(`Đạt tạo phiên (${viewport}): dấu cộng khi chưa có phiên, gửi tin đầu tiên và đặt lại phiên đã lưu.`);
  if (voucherForm) console.log(`Đạt voucher trong form (${viewport}): vị trí, mặc định, phần trăm, chọn/bỏ mã, giá backend, lỗi và khóa form cũ.`);
  if (flowExtensions) console.log(`Đạt mở rộng agent (${viewport}): địa chỉ một lần, thợ thực tế/gọi/chat/bản đồ, thử lại lỗi, đánh giá mới/sửa/từ chối và gửi ảnh hỗ trợ sau đặt đơn.`);
  if (paymentCancellation) console.log(`Đạt hủy QR (${viewport}): xác nhận/từ chối, giữ đơn, lỗi hủy giữ QR, ẩn QR sau xác minh và nhận tiền đồng thời.`);
  if (!voucherForm && !newSession && !modelRecovery && !paymentCancellation && !flowExtensions) console.log(historyActions ? `Đạt tìm đơn/thợ cũ (${viewport}): thao tác đúng đơn, chọn đúng thợ trùng tên, giữ bản nháp, phân trang, rỗng và thử lại.` : scroll ? `Đạt cuộn chat (${viewport}): giữ tin vừa gửi khi chờ phản hồi và khi có bản xác nhận dài.` : visual ? `Đạt kiểm tra bố cục (${viewport}, ${visual}).` : business ? `Đạt 9–14 trên web (${viewport}): kiểm tra ảnh/giới hạn/lỗi upload, ảnh trong tin nhắn và xác nhận, bỏ ảnh, xác nhận lại và nút tra cứu đúng đơn.` : `Đạt 1–6 (${viewport}): sửa form và thử lại an toàn, chọn lịch UTC+7, hồ sơ thợ, nạp ví quay lại đúng đơn, chính sách và hành động theo trạng thái.`);
} finally {
  connection?.close();
  if (browser && browser.exitCode === null) {
    const closed = new Promise((resolve) => browser.once('close', resolve));
    browser.kill();
    await closed;
  }
  server?.closeAllConnections();
  await new Promise((resolve) => server ? server.close(resolve) : resolve());
  const relative = path.relative(tmpdir(), folder);
  if (!relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(folder).startsWith('handigo-agent-booking-')) {
    await rm(folder, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
  }
}
