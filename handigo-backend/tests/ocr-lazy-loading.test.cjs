const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const file = path.join(__dirname, '../src/services/ocr.service.ts');
const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    esModuleInterop: true,
  },
}).outputText;

// Dùng dịch vụ giả lập để kiểm tra thời điểm nạp, không truy cập mạng hoặc credential.
function setup({ failImport = false, failConstructor = false, pages = 2, invalidPdf = false } = {}) {
  const loaded = [];
  const calls = [];
  let constructors = 0;
  const annotation = { fullTextAnnotation: { text: 'Nội dung OCR', pages: [{ blocks: [{ confidence: 0.9 }] }] } };
  class ImageAnnotatorClient {
    constructor() {
      constructors++;
      if (failConstructor) {
        failConstructor = false;
        throw new Error('Khởi tạo thất bại');
      }
    }
    async textDetection(request) { calls.push(request); return [annotation]; }
    async batchAnnotateFiles(request) {
      calls.push(request);
      return [{ responses: [{ responses: [annotation] }] }];
    }
  }
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    process: { env: {} },
    require(name) {
      loaded.push(name);
      if (name === '@google-cloud/vision') {
        if (failImport) {
          failImport = false;
          throw new Error('Nạp thư viện thất bại');
        }
        return { ImageAnnotatorClient };
      }
      if (name === 'pdf-lib') return { PDFDocument: { async load(buffer, options) {
        calls.push({ buffer, options });
        if (invalidPdf) throw new Error('PDF lỗi');
        return { getPageCount: () => pages };
      } } };
      if (name === 'node:fs' || name === 'node:path') return require(name);
      throw new Error(`Module ngoài dự kiến: ${name}`);
    },
  }, { filename: file });
  return { ...exports, loaded, calls, constructors: () => constructors };
}

test('Nạp service không nạp Vision hoặc PDF; OCR ảnh chỉ nạp Vision và dùng chung client', async () => {
  const context = setup();
  assert.equal(context.loaded.includes('@google-cloud/vision'), false);
  assert.equal(context.loaded.includes('pdf-lib'), false);
  const buffer = Buffer.from('ảnh giả lập');
  const results = await Promise.all([
    context.extractText(buffer, 'image/png'),
    context.extractText(buffer, 'image/jpeg'),
  ]);
  await context.extractText(buffer, 'image/webp');
  assert.equal(context.constructors(), 1);
  assert.equal(context.loaded.filter(name => name === '@google-cloud/vision').length, 1);
  assert.equal(context.loaded.includes('pdf-lib'), false);
  assert.equal(results[0].text, 'Nội dung OCR');
  assert.equal(results[0].confidence, 0.9);
  assert.equal(context.calls[0].image.content, buffer);
});

test('OCR PDF nạp thư viện đúng lúc và gửi đúng danh sách trang', async () => {
  const context = setup();
  const buffer = Buffer.from('PDF giả lập');
  const result = await context.extractText(buffer, 'application/pdf');
  assert.equal(context.loaded.includes('pdf-lib'), true);
  assert.equal(context.calls[0].buffer, buffer);
  assert.equal(context.calls[0].options.updateMetadata, false);
  assert.deepEqual(Array.from(context.calls[1].requests[0].pages), [1, 2]);
  assert.equal(context.calls[1].requests[0].inputConfig.content, buffer);
  assert.equal(result.text, 'Nội dung OCR');
});

for (const options of [{ invalidPdf: true }, { pages: 6 }]) {
  test(`PDF ${options.invalidPdf ? 'không hợp lệ' : 'quá 5 trang'} vẫn bị từ chối trước khi gửi OCR`, async () => {
    const context = setup(options);
    await assert.rejects(context.extractText(Buffer.from('PDF'), 'application/pdf'), error => error.statusCode === 400);
    assert.equal(context.calls.length, 1);
  });
}

for (const option of ['failImport', 'failConstructor']) {
  test(`Có thể thử lại OCR sau lỗi ${option === 'failImport' ? 'nạp thư viện' : 'khởi tạo client'}`, async () => {
    const context = setup({ [option]: true });
    await assert.rejects(context.extractText(Buffer.from('ảnh'), 'image/png'));
    const result = await context.extractText(Buffer.from('ảnh'), 'image/png');
    assert.equal(result.text, 'Nội dung OCR');
    assert.equal(context.calls.length, 1);
  });
}
