const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');

const filename = path.join(__dirname, '../src/features/provider/components/orders/CustomerInformationCard.tsx');
const componentExports = {};
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
vm.runInNewContext(code, { exports: componentExports, require(name) {
  if (name === 'react/jsx-runtime') return require(name);
  if (name === 'lucide-react') return { CalendarDays: () => null, MapPin: () => null, Phone: () => null,
    Ticket: () => null, User: () => null, Wrench: () => null };
  if (name.includes('providerOrder.utils')) return { formatDateTime: () => 'Ngày thử nghiệm' };
  if (name.includes('InitialsAvatar')) return { InitialsAvatar: () => null };
  if (name.includes('ReliableImage')) return { ReliableImage: () => null };
  if (name.includes('imageUrl')) return { normalizeImageUrl: value => value };
  if (name.includes('CardTitle')) return { CardTitle: () => null };
  throw new Error(`Chưa giả lập ${name}`);
} });

for (const [name, phone, addressSnapshot, addressId, expected, excluded] of [
  ['ưu tiên số tài khoản hiện tại', '0773368198', { recipientPhone: '0345643125' }, { recipientPhone: '0345643125' }, '0773368198', '0345643125'],
  ['thiếu số tài khoản lấy số đã lưu trên đơn', '', { recipientPhone: '0345643125' }, { recipientPhone: '0773368198' }, '0345643125', '0773368198'],
  ['đơn cũ không có snapshot lấy địa chỉ', undefined, undefined, { recipientPhone: '0345643125' }, '0345643125', '0773368198'],
]) {
  test(`Số thợ nhìn thấy ${name}`, () => {
    const html = renderToStaticMarkup(componentExports.CustomerInformationCard({
      customer: { fullName: 'Khách thử', phone }, addressLine: 'Địa chỉ thử', orderType: 'Theo lịch hẹn',
      order: { serviceId: { name: 'Vệ sinh điều hòa' }, addressId, addressSnapshot, orderCode: 'DON-THU' },
    }));
    assert.ok(html.includes(expected));
    assert.equal(html.includes(excluded), false);
  });
}
