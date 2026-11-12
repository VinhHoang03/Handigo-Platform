const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const file = path.join(__dirname, '../src/features/admin/components/support/TicketSidebar.tsx');
const component = {};
const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
vm.runInNewContext(code, { exports: component, require(name) {
  if (name === './support.constants') return { STATUS_LABELS: { in_progress: 'Đang xử lý' }, STATUS_TRANSITIONS: {
    open: ['in_progress'], in_progress: ['resolved'], waiting_user: ['in_progress'], resolved: ['in_progress', 'closed'], closed: [], cancelled: [],
  } };
  return require(name);
} });

for (const status of ['open', 'in_progress', 'waiting_user', 'resolved', 'closed', 'cancelled']) {
  test(`Ticket ${status} hiển thị thao tác vi phạm đúng trạng thái`, () => {
    const html = renderToStaticMarkup(React.createElement(component.TicketSidebar, {
      ticket: { _id: 'ticket', status }, admins: [], adminsLoading: false, adminsError: '', busy: false,
      onReloadAdmins() {}, onAssign() {}, onStatusChange() {}, onCreateViolation() {},
    }));
    assert.equal(html.includes('Tạo vi phạm và áp dụng hình phạt'), ['open', 'in_progress', 'waiting_user'].includes(status));
  });
}
