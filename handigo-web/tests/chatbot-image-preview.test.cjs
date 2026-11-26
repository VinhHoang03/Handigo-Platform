const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function loadComponent(name) {
  const state = [];
  let cursor = 0;
  const react = {
    ...React,
    useEffect() {}, useLayoutEffect() {}, useRef: current => ({ current }),
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => {
        state[index] = typeof value === 'function' ? value(state[index]) : value;
      }];
    },
  };
  const filename = path.join(__dirname, `../src/features/chatbot/components/${name}.tsx`);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require(module) {
      if (module === 'react') return react;
      if (module === 'react/jsx-runtime') return require(module);
      if (module.endsWith('/useVoiceInput')) return { useVoiceInput: () => ({ listening: false, cancel() {} }) };
      if (module.endsWith('/agentDisplayText')) return { agentDisplayText: content => content };
      if (module.endsWith('/agentConversationFlow')) return { getAgentConversationFlow: () => 'general' };
      return new Proxy({}, { get: (_target, key) => String(key) });
    },
  }, { filename });
  return props => { cursor = 0; return exports[name](props); };
}

function find(element, predicate) {
  if (!element || typeof element !== 'object') return undefined;
  if (predicate(element)) return element;
  for (const child of [element.props?.children].flat(Infinity)) {
    const result = find(child, predicate);
    if (result) return result;
  }
}

test('Bấm ảnh đã gửi hoặc đang soạn mở đúng ảnh lớn và có thể đóng mà không gửi tin', () => {
  const renderPanel = loadComponent('ChatbotPanel');
  const url = 'https://example.com/anh.png';
  let sends = 0;
  const messages = [{ _id: 'anh-da-gui', sender: 'user', content: '', customerAttachments: [url], createdAt: '2026-11-26T12:00:00Z' }];
  const props = {
    audience: 'CUSTOMER', messages, isLoading: false, isReplying: false, error: '', availabilityMessage: '',
    onClose() {}, onRetry() {}, onSend: async () => { sends++; }, onUploadAttachment: async () => url,
  };
  for (const name of ['ChatbotMessageList', 'ChatbotComposer']) {
    let panel = renderPanel(props);
    assert.equal(find(panel, node => node.type === 'Modal').props.open, false);
    const child = find(panel, node => node.type === name);
    const renderChild = loadComponent(name);
    const tree = renderChild({ ...child.props, attachmentUrls: [url] });
    const trigger = find(tree, node => node.type === 'button' && node.props['aria-label'] === 'Mở ảnh hiện trạng 1');
    assert.ok(trigger, 'Ảnh phải có nút mở xem, kể cả tin nhắn chỉ chứa ảnh');
    assert.equal(trigger.props.type, 'button');
    trigger.props.onClick();
    panel = renderPanel(props);
    const modal = find(panel, node => node.type === 'Modal');
    assert.equal(modal.props.open, true);
    assert.equal(find(modal, node => node.type === 'ReliableImage').props.src, url);
    modal.props.onClose();
    assert.equal(find(renderPanel(props), node => node.type === 'Modal').props.open, false);
    assert.equal(sends, 0);
  }
});

for (const failed of [false, true]) {
  test(`Ảnh rời ô soạn ngay khi gửi, ${failed ? 'được khôi phục khi lỗi' : 'không chờ AI trả lời'}`, async () => {
    const render = loadComponent('ChatbotComposer');
    const url = 'https://example.com/anh-dieu-hoa.png';
    let resolveSend, rejectSend, sent;
    const dirty = [];
    const pending = new Promise((resolve, reject) => { resolveSend = resolve; rejectSend = reject; });
    const props = {
      disabled: false, onPreviewImage() {}, onUploadAttachment: async () => url,
      onAttachmentChange: value => dirty.push(value),
      onSend: (...args) => { sent = args; return pending; },
    };
    let tree = render(props);
    find(tree, node => node.type === 'input' && node.props.type === 'file').props.onChange({
      target: { files: [{ type: 'image/png', size: 8 }], value: 'anh.png' },
    });
    await new Promise(setImmediate);
    tree = render(props);
    assert.ok(find(tree, node => node.type === 'img' && node.props.src === url));
    find(tree, node => node.type === 'textarea').props.onChange({ target: { value: 'Điều hòa chảy nước' } });
    const sending = render(props).props.onSubmit({ preventDefault() {} });
    tree = render(props);
    assert.equal(find(tree, node => node.type === 'img'), undefined);
    assert.equal(find(tree, node => node.type === 'textarea').props.value, '');
    assert.equal(sent[0], 'Điều hòa chảy nước');
    assert.deepEqual([...sent[1]], [url]);
    assert.equal(dirty.at(-1), false);
    if (failed) rejectSend(new Error('Lỗi gửi thử nghiệm')); else resolveSend();
    await sending;
    tree = render(props);
    assert.equal(Boolean(find(tree, node => node.type === 'img' && node.props.src === url)), failed);
    assert.equal(find(tree, node => node.type === 'textarea').props.value, failed ? 'Điều hòa chảy nước' : '');
    assert.equal(dirty.at(-1), failed);
  });
}

test('Ảnh đã nằm trong bản nháp không tự đưa lại vào ô soạn', () => {
  const render = loadComponent('ChatbotPanel');
  const tree = render({
    audience: 'CUSTOMER', messages: [], isLoading: false, isReplying: false, error: '', availabilityMessage: '',
    onClose() {}, onRetry() {}, onSend: async () => {},
    agentSession: { sessionId: 'phien', messages: [], bookingDraft: { status: 'active', revision: 1,
      values: { customerAttachments: ['https://example.com/anh-da-gui.png'] } } },
  });
  assert.equal(find(tree, node => node.type === 'ChatbotComposer').props.attachmentUrls, undefined);
});

test('Gửi ảnh không nhập lời nhắn chỉ hiển thị ảnh, không chèn chỉ dẫn thay khách', async () => {
  const render = loadComponent('ChatbotComposer');
  const url = 'https://example.com/anh.png';
  let sent;
  const props = { disabled: false, attachmentPurpose: 'general', onPreviewImage() {},
    onUploadAttachment: async () => url, onSend: async (...args) => { sent = args; } };
  const picker = find(render(props), node => node.type === 'input' && node.props.type === 'file');
  picker.props.onChange({ target: { files: [{ type: 'image/png', size: 8 }], value: 'anh.png' } });
  await new Promise(setImmediate);
  await render(props).props.onSubmit({ preventDefault() {} });
  assert.deepEqual([...sent[1]], [url]);
  assert.doesNotMatch(sent[0], /Hãy hỏi tôi/);
  const renderMessages = loadComponent('ChatbotMessageList');
  const base = { _id: 'anh', sender: 'user', createdAt: '2026-11-26T12:00:00Z', customerAttachments: [url] };
  for (const content of [sent[0], 'Cập nhật ảnh hiện trạng cho bản nháp đặt dịch vụ này.',
    'Tôi gửi ảnh đính kèm. Hãy hỏi tôi muốn dùng ảnh cho yêu cầu nào nếu chưa rõ.']) {
    const tree = renderMessages({ messages: [{ ...base, content }], isReplying: false, audience: 'CUSTOMER', onPreviewImage() {} });
    assert.ok(find(tree, node => node.type === 'img' && node.props.src === url));
    assert.equal(find(tree, node => node.type === 'p' && node.props.children === content), undefined);
  }
  const content = 'Điều hòa nhà tôi chảy nước';
  const tree = renderMessages({ messages: [{ ...base, content }], isReplying: false, audience: 'CUSTOMER', onPreviewImage() {} });
  assert.ok(find(tree, node => node.type === 'p' && node.props.children === content));
});

test('Ẩn nguồn trong câu trả lời AI cũ, giữ hướng dẫn, liên kết thao tác và nội dung khách', () => {
  const filename = path.join(__dirname, '../src/features/chatbot/utils/agentDisplayText.ts');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports });
  const { agentDisplayText } = exports;
  for (const heading of ['Nguồn:', '**Nguồn:**', '### Nguồn tham khảo:']) {
    const text = `Tạm dừng máy.\n\n${heading} EVN: https://example.com/tai-lieu\n\nBạn có muốn tìm thợ? Mở /services.`;
    const displayed = agentDisplayText(text, true);
    assert.doesNotMatch(displayed, /Nguồn|example.com/);
    assert.match(displayed, /Tạm dừng máy/);
    assert.match(displayed, /Bạn có muốn tìm thợ\? Mở \/services/);
    assert.equal(agentDisplayText(text), text);
  }
});
