import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { rolldown } from 'rolldown';

// Kiểm tra bằng Chrome thật với ảnh PNG thật; dữ liệu giao dịch là giả lập, không tải PayOS/CDN.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const qr = require('../../handigo-backend/node_modules/qrcode');
const png = await qr.toDataURL('000201010212-PAYOS-KIEM-THU', { width: 360, margin: 4 });
const folder = await mkdtemp(path.join(tmpdir(), 'handigo-qr-browser-'));
try {
  const component = path.join(root, 'src/features/chatbot/components/AgentPayosCheckout.tsx');
  const messageList = path.join(root, 'src/features/chatbot/components/ChatbotMessageList.tsx');
  const bundle = await rolldown({
    input: 'test:qr', cwd: root,
    transform: { jsx: 'react-jsx' },
    plugins: [{ name: 'giao-dich-gia-lap', resolveId(id) {
      if (id === 'test:qr' || id.includes('booking.api') || id.includes('authenticatedSocket')) return '\0' + id;
      if (id === '@/utils/apiError') return path.join(root, 'src/utils/apiError.ts');
    }, load(id) {
      if (id === '\0test:qr') return `
        import React from 'react'; import { createRoot } from 'react-dom/client';
        import { AgentPayosCheckout } from ${JSON.stringify(component)};
        import { ChatbotMessageList } from ${JSON.stringify(messageList)};
        function Chat() {
          const [messages, setMessages] = React.useState([{ _id: 'don', sender: 'assistant', content: 'Đơn đã tạo', createdAt: '2026-10-04T00:00:00Z' }]);
          React.useEffect(() => { setTimeout(() => {
            const list = document.getElementById('root').firstElementChild;
            list.scrollTop = 0; list.dispatchEvent(new Event('scroll', { bubbles: true }));
            setMessages((items) => [...items, { _id: 'moi', sender: 'user', content: 'Tin nhắn mới sau form', createdAt: '2026-10-04T00:00:01Z' }]);
          }, 600); }, []);
          return React.createElement(ChatbotMessageList, { messages, audience: 'CUSTOMER', isReplying: false,
            renderAfterMessage: (message) => message._id === 'don' ? React.createElement(AgentPayosCheckout, {
              payment: { orderId: 'don', paymentId: 'giao-dich', orderCode: 'ORD-QR' }, disabled: false, onCheck() {}
            }) : null
          });
        }
        createRoot(document.getElementById('root')).render(React.createElement(Chat));
        setInterval(() => { const image = document.querySelector('img');
          if (image?.complete && image.naturalWidth === 360) document.body.dataset.qrLoaded = 'true';
          const message = [...document.querySelectorAll('p')].find((item) => item.textContent === 'Tin nhắn mới sau form');
          const list = document.getElementById('root').firstElementChild;
          if (message && image && image.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING) {
            const box = message.getBoundingClientRect(); const bounds = list.getBoundingClientRect();
            if (box.top >= bounds.top && box.bottom <= bounds.bottom) document.body.dataset.messageVisible = 'true';
          }
        }, 50);`;
      if (id.includes('booking.api')) return `export const bookingApi = {
        getPaymentById: async () => ({ _id: 'giao-dich', orderId: 'don', method: 'payos', status: 'pending' }),
        getPaymentQr: async () => { document.body.dataset.qrRequests = String(Number(document.body.dataset.qrRequests || 0) + 1); return (await fetch(${JSON.stringify(png)})).blob(); }
      };`;
      if (id.includes('authenticatedSocket')) return `export const createAuthenticatedSocket = () => ({ socket: { on() {}, off() {} }, dispose() {} });`;
    } }],
  });
  await bundle.write({ file: path.join(folder, 'app.js'), format: 'iife' });
  await bundle.close();
  const html = path.join(folder, 'index.html');
  await writeFile(html, '<!doctype html><html lang="vi"><meta charset="utf-8"><style>#root>div{height:260px;overflow-y:auto}img{width:280px;height:280px}p{margin:12px 0}</style><body><div id="root" style="width:320px"></div><script src="app.js"></script></body></html>');
  const chrome = process.env.QR_TEST_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const result = spawnSync(chrome, ['--headless', '--disable-gpu', '--no-first-run', '--disable-background-networking',
    `--user-data-dir=${path.join(folder, 'profile')}`, '--virtual-time-budget=3000', '--dump-dom', `file:///${html.replaceAll('\\', '/')}`],
    { encoding: 'utf8', timeout: 30000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(result.status, 0, result.error?.message || result.stderr.slice(-1000));
  assert.match(result.stdout, /data-qr-loaded="true"/, 'Chrome phải tải và hiển thị ảnh QR kích thước 360px.');
  assert.match(result.stdout, /src="blob:/);
  assert.match(result.stdout, /data-message-visible="true"/, 'Tin nhắn mới nằm sau form cũ và trong vùng nhìn thấy.');
  assert.match(result.stdout, /data-qr-requests="1"/, 'Gửi tin nhắn không làm mất hoặc tải lại form QR đang chờ.');
  assert.doesNotMatch(result.stdout, /<iframe/);
  console.log('Chrome đã hiển thị ảnh QR thật trong component chat mà không dùng iframe/CDN.');
} finally {
  await rm(folder, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
}
