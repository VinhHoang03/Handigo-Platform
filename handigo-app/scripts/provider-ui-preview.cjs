// Bật/tắt dữ liệu xem thử trong bộ nhớ qua Dart VM Service của bản debug.
const input = process.argv[2];
if (!input || typeof WebSocket === 'undefined') {
  console.error('Cần Node.js 22 trở lên. Cách chạy: node scripts/provider-ui-preview.cjs "URL_VM_SERVICE" [--off]');
  process.exit(1);
}
let address;
try {
  address = new URL(input);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(address.hostname)
      || !['http:', 'ws:'].includes(address.protocol)) throw new Error();
  address.protocol = 'ws:';
  if (!address.pathname.endsWith('/ws')) address.pathname = `${address.pathname.replace(/\/$/, '')}/ws`;
  address.search = '';
  address.hash = '';
} catch {
  console.error('Dùng URL Dart VM Service local do Flutter in ra, không dùng URL DevTools.');
  process.exit(1);
}
const enabled = !process.argv.includes('--off');
const socket = new WebSocket(address);
let sequence = 0;
const pending = new Map();
const timeout = setTimeout(() => {
  console.error('Phiên debug quá hạn. Kiểm tra Flutter đang chạy và URL VM Service còn hiệu lực.');
  process.exit(1);
}, 15000);
function rpc(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = String(++sequence);
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
  });
}
socket.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error('Không tìm thấy chế độ xem thử. Mở app debug và đăng nhập tài khoản thợ đã duyệt.'));
  else request.resolve(message.result);
};
socket.onopen = async () => {
  try {
    const vm = await rpc('getVM');
    const isolate = vm.isolates.find((item) => item.name === 'main') ?? vm.isolates[0];
    if (!isolate) throw new Error('Chưa có isolate chính.');
    await rpc('ext.handigo.schedulePreview', { isolateId: isolate.id, enabled: String(enabled) });
    console.log(enabled
      ? 'Đã bật dữ liệu mẫu cho Tổng quan, Đơn hàng và Lịch hẹn. Load lại app/hot restart sẽ tự xóa.'
      : 'Đã bỏ dữ liệu mẫu, quay về dữ liệu API.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    clearTimeout(timeout);
    socket.close();
  }
};
socket.onerror = () => {
  clearTimeout(timeout);
  console.error('Không kết nối được phiên debug. Sao chép lại URL Dart VM Service từ terminal Flutter.');
  process.exitCode = 1;
};
