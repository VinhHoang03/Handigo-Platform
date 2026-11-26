const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const axios = require('axios');

test('Tải ảnh chatbot giữ nguyên tệp multipart khi API client mặc định gửi JSON', async () => {
  const image = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const url = 'https://example.com/anh.png';
  const api = axios.create({
    headers: { 'Content-Type': 'application/json' },
    adapter: async config => {
      assert.equal(config.url, '/ai/sessions/phien-thu-nghiem/attachments');
      assert.ok(config.data instanceof FormData, 'Ảnh phải được gửi dưới dạng FormData thay vì JSON');
      const file = config.data.get('image');
      assert.equal(file.name, 'anh.png');
      assert.equal(file.type, 'image/png');
      assert.deepEqual(Buffer.from(await file.arrayBuffer()), image);
      return { data: { success: true, data: { url } }, status: 200, statusText: 'OK', headers: {}, config };
    },
  });
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/features/chatbot/api/agent.api.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, FormData,
    require: name => {
      if (name === '@/api/client') return { default: api, __esModule: true };
      if (name === '@/api/response') return { unwrap: response => response.data.data };
      throw new Error(`Module ngoài phạm vi kiểm thử: ${name}`);
    },
  });
  const result = await exports.agentApi.uploadAttachment('phien-thu-nghiem', new File([image], 'anh.png', { type: 'image/png' }));
  assert.equal(result.url, url);
});
