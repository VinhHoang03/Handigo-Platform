const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function setup({ busy = false, email = 'khach@example.com' } = {}) {
  const states = [];
  const sent = [];
  let cursor = 0;
  const exports = {};
  const filename = path.resolve(__dirname, '../src/features/admin/components/users/LockUserModal.tsx');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, require(name) {
    if (name === 'react') return { useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => { states[index] = value; }];
    } };
    if (name === '@/components/common/Modal') return { Modal() {} };
    return require(name);
  } }, { filename });
  const render = () => {
    cursor = 0;
    return exports.LockUserModal({ user: { fullName: 'Khách', email }, busy,
      onClose() {}, onConfirm: async payload => { sent.push(payload); } });
  };
  const nodes = node => {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    return [node, ...nodes(node.props?.children)];
  };
  const controls = () => nodes(render()).filter(node => ['select', 'input', 'textarea'].includes(node.type));
  const change = (type, index, value) => controls().filter(node => node.type === type)[index].props.onChange({ target: { value } });
  const submit = () => nodes(render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  return { render, nodes, controls, change, submit, sent };
}

test('Tạm khóa bắt buộc số ngày, gửi lý do đã trim và thời hạn cho backend', async () => {
  const context = setup();
  context.change('textarea', 0, '  Lý do vi phạm đã xác minh  ');
  context.change('input', 0, '3');
  await context.submit();
  assert.equal(context.sent.length, 1);
  assert.equal(context.sent[0].reason, 'Lý do vi phạm đã xác minh');
  assert.equal(context.sent[0].penaltyType, 'TEMPORARY_SUSPEND');
  assert.equal(context.sent[0].duration, 3);
  assert.equal(context.sent[0].durationUnit, 'days');
});

test('Chuyển sang khóa vĩnh viễn loại bỏ số ngày từng nhập và ẩn trường thời hạn', async () => {
  const context = setup();
  context.change('textarea', 0, 'Vi phạm nghiêm trọng');
  context.change('input', 0, '7');
  context.change('select', 1, 'PERMANENT_BAN');
  assert.equal(context.controls().filter(node => node.type === 'input').length, 0);
  await context.submit();
  assert.equal(context.sent[0].penaltyType, 'PERMANENT_BAN');
  assert.equal(context.sent[0].duration, undefined);
  assert.equal(context.sent[0].durationUnit, undefined);
});

test('Chặn lý do rỗng, ngày âm, ngày lẻ và số ngày vượt giới hạn', async () => {
  const context = setup();
  context.change('textarea', 0, '     ');
  context.change('input', 0, '1');
  await context.submit();
  assert.equal(context.sent.length, 0);
  context.change('textarea', 0, 'Lý do vi phạm hợp lệ');
  for (const value of ['', '-1', '0', '1.5', '3651']) {
    context.change('input', 0, value);
    await context.submit();
  }
  assert.equal(context.sent.length, 0);
});

test('Trong khi lưu không gửi lại hoặc sửa các trường quyết định', async () => {
  const context = setup({ busy: true });
  await context.submit();
  assert.equal(context.sent.length, 0);
  assert.ok(context.controls().every(node => node.props.disabled));
  assert.equal(context.render().props.closeOnEsc, false);
  assert.equal(context.render().props.closeOnOverlayClick, false);
});

test('Thông báo rõ khi tài khoản chưa có email', () => {
  const context = setup({ email: '' });
  assert.ok(JSON.stringify(context.render()).includes('Tài khoản chưa có email'));
});

test('Chọn 8 giờ gửi đúng đơn vị, nhập chữ và ký hiệu không thay đổi số đã nhập', async () => {
  const context = setup();
  context.change('textarea', 0, 'Lý do vi phạm hợp lệ');
  context.change('input', 0, '8');
  context.change('select', 2, 'hours');
  for (const invalid of ['abc', '8 giờ', '8.5', '1e3', '-8', '+8']) {
    context.change('input', 0, invalid);
    assert.equal(context.controls().find(node => node.type === 'input').props.value, '8');
  }
  await context.submit();
  assert.equal(context.sent[0].duration, 8);
  assert.equal(context.sent[0].durationUnit, 'hours');
});

test('Đổi từ giờ sang ngày kiểm tra lại giới hạn, không tự cắt hay đổi thời hạn', async () => {
  const context = setup();
  context.change('textarea', 0, 'Lý do vi phạm hợp lệ');
  context.change('select', 2, 'hours');
  context.change('input', 0, '87600');
  context.change('select', 2, 'days');
  await context.submit();
  assert.equal(context.sent.length, 0);
  context.change('input', 0, '30');
  await context.submit();
  assert.equal(context.sent[0].duration, 30);
  assert.equal(context.sent[0].durationUnit, 'days');
});
