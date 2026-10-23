const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function modalSession(initialOverflow = '') {
  const filename = path.join(__dirname, '../src/components/common/Modal.tsx');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const body = { style: { overflow: initialOverflow } };
  let cleanups;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    HTMLElement: class {},
    document: { body, activeElement: null, addEventListener() {}, removeEventListener() {} },
    window: { requestAnimationFrame() {} },
    require(name) {
      if (name === 'react') return {
        useId: () => 'hop-thoai', useRef: (current) => ({ current }),
        useEffect(callback) { const cleanup = callback(); if (cleanup) cleanups.push(cleanup); },
      };
      if (name === 'react-dom') return { createPortal: (element) => element };
      if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null };
      throw new Error(`Module chưa được giả lập: ${name}`);
    },
  }, { filename });
  return {
    body,
    open(open = true) {
      cleanups = [];
      exports.Modal({ open, title: 'Cấu hình hệ thống', onClose() {} });
      const currentCleanups = cleanups;
      return () => currentCleanups.forEach((cleanup) => cleanup());
    },
  };
}

test('Lưu cấu hình đóng form trước rồi đóng xác nhận vẫn khôi phục cuộn trang', () => {
  const { body, open } = modalSession();
  const closeForm = open();
  const closeConfirm = open();
  closeForm();
  closeConfirm();
  assert.equal(body.style.overflow, '');
});

test('Không mở khóa cuộn khi vẫn còn hộp thoại xác nhận', () => {
  const { body, open } = modalSession();
  const closeForm = open();
  const closeConfirm = open();
  closeForm();
  assert.equal(body.style.overflow, 'hidden');
  closeConfirm();
  assert.equal(body.style.overflow, '');
});

test('Hủy xác nhận vẫn khóa cuộn khi form còn mở và khôi phục giá trị overflow ban đầu', () => {
  for (const initialOverflow of ['', 'auto', 'scroll', 'hidden']) {
    const { body, open } = modalSession(initialOverflow);
    const closeForm = open();
    const closeConfirm = open();
    closeConfirm();
    assert.equal(body.style.overflow, 'hidden');
    closeForm();
    assert.equal(body.style.overflow, initialOverflow);
  }
});

test('Mở lại và chu kỳ gắn/gỡ của StrictMode không để lại khóa cuộn', () => {
  const { body, open } = modalSession('auto');
  open(false)();
  assert.equal(body.style.overflow, 'auto');
  for (let index = 0; index < 3; index++) {
    const close = open();
    assert.equal(body.style.overflow, 'hidden');
    close();
    assert.equal(body.style.overflow, 'auto');
  }
});
