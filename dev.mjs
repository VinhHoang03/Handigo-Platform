import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startSession } from './scripts/dev-app.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const appUrl = 'http://localhost:8081';
const children = new Set();
let session;
let timer;
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  clearTimeout(timer);
  session?.cleanup();
  process.exitCode = code;
  for (const child of children) {
    if (child.pid) spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
  }
}

function launch(label, command, directory, machine = false) {
  const child = spawn('cmd.exe', ['/d', '/c', command], {
    cwd: path.join(root, directory),
    windowsHide: true,
    stdio: machine ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'],
  });
  children.add(child);
  child.on('error', (error) => {
    console.error(`[${label}] Không khởi động được: ${error.message}`);
    stop(1);
  });
  child.on('close', (code) => {
    children.delete(child);
    if (!stopping) {
      console.error(`[${label}] Đã dừng, mã thoát: ${code}. Đang dừng các ứng dụng còn lại.`);
      stop(code || 1);
    }
  });
  return child;
}

function browserPath(name, relativePath) {
  for (const base of [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]) {
    if (base && existsSync(path.join(base, relativePath))) return path.join(base, relativePath);
  }
  throw new Error(`Không tìm thấy ${name}. Hãy cài trình duyệt trước khi chạy.`);
}

async function checkPort(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`Cổng ${port} đang được sử dụng. Hãy dừng phiên cũ trước khi chạy.`)));
    server.listen(port, () => server.close(resolve));
  });
}

function openWhenReady(browsers, deadline = Date.now() + 300_000) {
  if (stopping) return;
  const retry = () => {
    if (stopping) return;
    if (Date.now() > deadline) {
      console.error('[APP] Hết thời gian chờ Flutter khởi động. Kiểm tra lỗi phía trên.');
      stop(1);
    } else timer = setTimeout(() => openWhenReady(browsers, deadline), 1000);
  };
  const request = http.get(appUrl, (response) => {
    response.resume();
    if (stopping) return;
    if (response.statusCode !== 200) return retry();
    for (const executable of browsers) {
      const browser = spawn(executable, ['--new-window', appUrl], { detached: true, stdio: 'ignore', windowsHide: true });
      browser.on('error', (error) => console.error(`[APP] Không mở được trình duyệt: ${error.message}. Mở ${appUrl} thủ công.`));
      browser.unref();
    }
    console.log(`[APP] Đã mở Edge và Chrome: ${appUrl}`);
  });
  request.setTimeout(2000, () => request.destroy());
  request.once('error', retry);
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log('Chạy từ thư mục gốc: node dev.mjs');
    console.log('Chạy backend, web và app Flutter trên Edge + Chrome. Nhập q hoặc Ctrl+C để dừng tất cả.');
    console.log('Chỉ kiểm tra điều kiện khởi chạy: node dev.mjs --check');
    return;
  }
  if (process.platform !== 'win32') throw new Error('Lệnh này dành cho Windows với Edge và Chrome.');
  if (process.argv.slice(2).some((arg) => arg !== '--check')) throw new Error('Tham số không hợp lệ. Xem node dev.mjs --help.');
  const browsers = [
    browserPath('Edge', 'Microsoft/Edge/Application/msedge.exe'),
    browserPath('Chrome', 'Google/Chrome/Application/chrome.exe'),
  ];
  for (const command of ['npm', 'flutter']) {
    if (spawnSync('where.exe', [command], { windowsHide: true, stdio: 'ignore' }).status !== 0) {
      throw new Error(`Không tìm thấy ${command} trên PATH.`);
    }
  }
  for (const directory of ['handigo-backend', 'handigo-web']) {
    if (!existsSync(path.join(root, directory, 'node_modules'))) throw new Error(`Chưa cài thư viện: chạy npm --prefix ${directory} install.`);
  }
  await Promise.all([5000, 5173, 8081].map(checkPort));
  if (process.argv.includes('--check')) {
    console.log('Đã kiểm tra: npm, Flutter, Edge, Chrome, thư viện Node.js và các cổng đều sẵn sàng.');
    return;
  }
  console.log('Đang chạy backend, web và Flutter. Web: https://localhost:5173; app: http://localhost:8081.');
  launch('BACKEND', 'npm run dev', 'handigo-backend');
  launch('WEB', 'npm run dev -- --strictPort', 'handigo-web');
  const flutter = launch('APP', 'flutter run --machine --debug -d web-server --web-hostname=localhost --web-port=8081 --dart-define=API_BASE_URL=http://localhost:5000', 'handigo-app', true);
  session = startSession(flutter, path.join(root, 'handigo-app/lib'));
  process.stdin.on('data', (data) => { if (data.toString().trim() === 'q') stop(); });
  process.on('SIGINT', () => stop());
  process.on('SIGTERM', () => stop());
  openWhenReady(browsers);
}

main().catch((error) => {
  console.error(`[DEV] ${error.message}`);
  stop(1);
});
