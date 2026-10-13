import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function parseOptions(args) {
  const options = { device: 'emulator-5554', api: 'http://10.0.2.2:5000', watch: true };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--no-watch') options.watch = false;
    else if (arg === '--device' || arg === '--api') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`Thiếu giá trị cho ${arg}`);
      options[arg === '--device' ? 'device' : 'api'] = value;
    } else throw new Error(`Tham số không được hỗ trợ: ${arg}`);
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(options.device)) throw new Error('Mã thiết bị không hợp lệ.');
  let api;
  try { api = new URL(options.api); } catch { throw new Error('Địa chỉ API không hợp lệ.'); }
  if (!['http:', 'https:'].includes(api.protocol) || !api.hostname || api.username || api.password || api.search || api.hash || !/^[a-zA-Z0-9._:/-]+$/.test(options.api)) {
    throw new Error('Địa chỉ API phải là HTTP/HTTPS, không chứa thông tin đăng nhập hoặc tham số truy vấn.');
  }
  return options;
}

export function startSession(child, sourceDirectory, { input = process.stdin, log = console.log, autoWatch = true } = {}) {
  let appId;
  let ready = false;
  let stopping = false;
  let requestId = 0;
  let activeRequest;
  let queuedReload = false;
  let queuedRestart = false;
  let debounceTimer;
  let closed = false;

  const send = (method, params = {}) => {
    const id = ++requestId;
    child.stdin.write(`${JSON.stringify([{ id, method, params }])}\n`);
    return id;
  };

  const reload = (fullRestart = false) => {
    if (stopping || closed) return;
    queuedReload = true;
    queuedRestart ||= fullRestart;
    if (!ready || activeRequest !== undefined) return;
    const restart = queuedRestart;
    queuedReload = false;
    queuedRestart = false;
    activeRequest = send('app.restart', { appId, fullRestart: restart, pause: false, reason: 'Lưu mã nguồn Handigo' });
    log(restart ? '[APP] Đang hot restart...' : '[APP] Đang hot reload...');
  };

  const stop = () => {
    if (stopping || closed) return;
    stopping = true;
    clearTimeout(debounceTimer);
    log('[APP] Đang dừng phiên Flutter...');
    send('daemon.shutdown');
  };

  const watcher = autoWatch ? watch(sourceDirectory, { recursive: true }, (_, filename) => {
    if (!filename?.endsWith('.dart') || stopping || closed) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => reload(), 400);
  }) : undefined;
  watcher?.on('error', (error) => { log(`[APP] Lỗi theo dõi file: ${error.message}`); stop(); });

  const lines = createInterface({ input: child.stdout });
  const commands = createInterface({ input });
  commands.on('line', (command) => {
    if (command.trim() === 'r') reload();
    else if (command.trim() === 'R') reload(true);
    else if (command.trim() === 'q') stop();
  });

  lines.on('line', (line) => {
    let messages;
    try { messages = JSON.parse(line); } catch { if (line.trim()) log(line); return; }
    if (!Array.isArray(messages)) return;
    for (const message of messages) {
      const params = message.params ?? {};
      if (message.event === 'app.start') appId = params.appId;
      else if (message.event === 'app.started') {
        ready = true;
        log('[APP] Đã sẵn sàng. Lưu file Dart để reload; nhập r / R / q rồi Enter.');
        if (queuedReload) reload();
      } else if (message.event === 'app.log') log(params.log ?? '');
      else if (message.event === 'daemon.logMessage') log(params.message ?? '');
      else if (message.event === 'app.progress' && params.message && !params.finished) log(params.message);
      else if (message.id === activeRequest && activeRequest !== undefined) {
        activeRequest = undefined;
        const result = message.result;
        if (message.error || result?.code) log(`[APP] Reload chưa thành công: ${JSON.stringify(message.error ?? result.message)}. Sửa lỗi hoặc dùng R để restart.`);
        else log('[APP] Đã cập nhật app.');
        if (queuedReload) reload();
      } else if (message.event === 'app.stop') {
        ready = false;
        log('[APP] App đã dừng.');
      }
    }
  });

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (data) => log(data.trimEnd()));
  child.stdin.on('error', (error) => { if (!stopping && !closed) log(`[APP] Không gửi được lệnh tới Flutter: ${error.message}`); });

  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearTimeout(debounceTimer);
    watcher?.close();
    commands.close();
    lines.close();
    input.pause();
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  child.on('error', (error) => { log(`[APP] Không khởi động được Flutter: ${error.message}`); cleanup(); });
  child.on('close', cleanup);
  return { cleanup, stop };
}

function main() {
  if (process.argv.includes('--help')) {
    console.log('Chạy từ root: node scripts/dev-app.mjs [--device emulator-5554] [--api http://10.0.2.2:5000] [--no-watch]');
    console.log('Yêu cầu: Node.js, Flutter trên PATH, emulator và backend đã chạy.');
    return;
  }
  const options = parseOptions(process.argv.slice(2));
  const appDirectory = fileURLToPath(new URL('../handigo-app/', import.meta.url));
  const args = ['run', '--machine', '--debug', '-d', options.device, `--dart-define=API_BASE_URL=${options.api}`];
  // Các giá trị đưa vào cmd đã được giới hạn ký tự trong parseOptions.
  const child = process.platform === 'win32'
    ? spawn('cmd.exe', ['/d', '/c', `flutter ${args.join(' ')}`], { cwd: appDirectory, windowsHide: true })
    : spawn('flutter', args, { cwd: appDirectory });
  console.log(`[APP] Thiết bị: ${options.device}; API: ${options.api}`);
  startSession(child, path.join(appDirectory, 'lib'), { autoWatch: options.watch });
  child.on('error', () => { process.exitCode = 1; });
  child.on('close', (code) => { process.exitCode = code ?? 1; });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(`[APP] ${error.message}`); process.exitCode = 1; }
}
