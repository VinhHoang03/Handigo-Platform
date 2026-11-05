require('ts-node/register/transpile-only');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable, Writable } = require('node:stream');
const { AppError } = require('../src/utils/appError');

let analysisError;
let storageError;
let relevant = true;
let uploads = 0;
const cloud = {
  default: {
    uploader: {
      upload_stream: (_options, callback) => new Writable({
        write(_chunk, _encoding, done) { done(); },
        final(done) {
          uploads++;
          callback(storageError, storageError ? undefined : { secure_url: 'https://example.com/anh.png' });
          done();
        },
      }),
    },
  },
  __esModule: true,
  isCloudinaryConfigured: true,
};
require.cache[require.resolve('../src/configs/cloudinary')] = { exports: cloud };
require.cache[require.resolve('../src/services/orderAttachmentImageAnalysis.service')] = {
  exports: {
    analyzeOrderProblemImage: async () => {
      if (analysisError) throw analysisError;
      return { isRelevant: relevant, confidence: 1, reason: 'Ảnh không liên quan.', detectedObjects: [] };
    },
  },
};
const { uploadOrderAttachmentImage } = require('../src/middlewares/orderAttachmentUpload.middleware');

function upload() {
  const boundary = 'handigo-test';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="purpose"\r\n\r\norder_problem\r\n--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="anh.png"\r\nContent-Type: image/png\r\n\r\n`),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const req = Readable.from([body]);
  req.headers = { 'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': String(body.length) };
  return new Promise((resolve, reject) => {
    const res = {
      locals: {},
      once() {},
      status(status) { this.statusCode = status; return this; },
      json(data) { resolve({ status: this.statusCode, data, locals: this.locals }); },
    };
    uploadOrderAttachmentImage(req, res, error => error ? reject(error) : resolve({ status: 200, locals: res.locals }));
  });
}

test('Phân biệt lỗi phân tích ảnh, kho ảnh và ảnh bị từ chối', async () => {
  analysisError = new AppError('Dịch vụ kiểm tra ảnh đang quá hạn mức. Vui lòng thử lại sau.', 503);
  let result = await upload();
  assert.equal(result.status, 503);
  assert.equal(result.data.message, analysisError.message);
  assert.equal(uploads, 0);

  analysisError = new Error('Thông tin kỹ thuật nội bộ');
  result = await upload();
  assert.equal(result.status, 503);
  assert.doesNotMatch(result.data.message, /Thông tin kỹ thuật/);

  analysisError = undefined;
  relevant = false;
  result = await upload();
  assert.equal(result.status, 400);
  assert.equal(result.data.message, 'Ảnh không liên quan.');
  assert.equal(uploads, 0);

  relevant = true;
  cloud.isCloudinaryConfigured = false;
  result = await upload();
  assert.equal(result.status, 502);
  assert.match(result.data.message, /chưa cấu hình kho lưu ảnh/);
  assert.equal(uploads, 0);

  cloud.isCloudinaryConfigured = true;
  storageError = { http_code: 401, message: 'Thông tin xác thực nội bộ' };
  result = await upload();
  assert.equal(result.status, 502);
  assert.match(result.data.message, /lỗi xác thực hoặc quyền truy cập/);
  assert.doesNotMatch(result.data.message, /Thông tin xác thực nội bộ/);

  storageError = undefined;
  result = await upload();
  assert.equal(result.status, 200);
  assert.equal(result.locals.imageUrl, 'https://example.com/anh.png');
  assert.equal(result.locals.imageAnalysis.isRelevant, true);
});

test('Kiểm tra ảnh dùng khóa Gemini chung và tương thích khóa riêng cũ', async () => {
  let usedKey;
  let calls = 0;
  let failures = [];
  let imageRelevant = true;
  class FakeFetchError extends Error {
    constructor(status) { super('Lỗi thử nghiệm'); this.status = status; }
  }
  class FakeGemini {
    constructor(key) { usedKey = key; }
    getGenerativeModel() {
      return {
        generateContent: async (_request, options) => {
          calls++;
          assert.equal(options.timeout, 20000);
          const status = failures.shift();
          if (status) throw new FakeFetchError(status);
          return {
            response: {
              text: () => JSON.stringify({ isRelevant: imageRelevant, confidence: 1, reason: 'Kết quả kiểm tra.', detectedObjects: [] }),
            },
          };
        },
      };
    }
  }
  require.cache[require.resolve('@google/generative-ai')] = {
    exports: { GoogleGenerativeAI: FakeGemini, GoogleGenerativeAIFetchError: FakeFetchError },
  };
  delete require.cache[require.resolve('../src/services/orderAttachmentImageAnalysis.service')];
  const { analyzeOrderProblemImage } = require('../src/services/orderAttachmentImageAnalysis.service');
  // Chỉ dùng cấu hình giả trong tiến trình kiểm thử, không đọc tệp môi trường.
  process.env.GEMINI_API_KEY = 'khoa-chung-thu-nghiem';
  process.env.GEMINI_API_KEY_1 = '   ';
  const result = await analyzeOrderProblemImage(Buffer.from('anh'), 'image/png');
  assert.equal(result.isRelevant, true);
  assert.equal(usedKey, 'khoa-chung-thu-nghiem');

  process.env.GEMINI_API_KEY_1 = 'khoa-rieng-thu-nghiem';
  await analyzeOrderProblemImage(Buffer.from('anh'), 'image/png');
  assert.equal(usedKey, 'khoa-rieng-thu-nghiem');

  calls = 0;
  failures = [503];
  assert.equal((await analyzeOrderProblemImage(Buffer.from('anh'), 'image/png')).isRelevant, true);
  assert.equal(calls, 2);

  calls = 0;
  failures = [503, 503, 503];
  await assert.rejects(analyzeOrderProblemImage(Buffer.from('anh'), 'image/png'), AppError);
  assert.equal(calls, 3);

  calls = 0;
  failures = [403];
  await assert.rejects(analyzeOrderProblemImage(Buffer.from('anh'), 'image/png'), AppError);
  assert.equal(calls, 1);

  calls = 0;
  imageRelevant = false;
  assert.equal((await analyzeOrderProblemImage(Buffer.from('anh'), 'image/png')).isRelevant, false);
  assert.equal(calls, 1);

  delete process.env.GEMINI_API_KEY_1;
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(
    analyzeOrderProblemImage(Buffer.from('anh'), 'image/png'),
    error => error instanceof AppError && error.statusCode === 503,
  );
});
