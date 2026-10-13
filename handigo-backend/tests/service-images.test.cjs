const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable, Writable } = require('node:stream');

const cloudPath = require.resolve('../dist/configs/cloudinary');
let resources = [];
let uploadCount = 0;
let uploadResult = null;
const metadata = { width: 1280, height: 720, bytes: 1000, format: 'png' };
const cloud = {
  config: () => ({ cloud_name: 'test-cloud' }),
  api: { resource: async id => { resources.push(id); return metadata; } },
  uploader: {
    upload_stream: (_options, callback) => new Writable({
      write(_chunk, _encoding, done) { done(); },
      final(done) {
        uploadCount++;
        callback(null, uploadResult || { ...metadata, secure_url: url('upload'), public_id: 'handigo/service-images/upload' });
        done();
      },
    }),
    destroy: async () => undefined,
  },
};
require.cache[cloudPath] = { id: cloudPath, filename: cloudPath, loaded: true, exports: { __esModule: true, default: cloud, isCloudinaryConfigured: true } };
const url = id => `https://res.cloudinary.com/test-cloud/image/upload/v1/handigo/service-images/${id}.png`;
const { Service } = require('../dist/models/service.model');
const { serviceImageResponse } = require('../dist/utils/serviceImageResponse');
const { Category } = require('../dist/models/category.model');
const { createServiceSchema, updateServiceSchema } = require('../dist/validations/service.validator');
const { validateServiceImageMetadata, validateNewServiceImages } = require('../dist/services/serviceImage.service');
const { createService, updateService } = require('../dist/services/service.service');
const { uploadServiceImage } = require('../dist/middlewares/serviceImageUpload.middleware');
const base = { categoryId: '507f1f77bcf86cd799439011', name: 'Dịch vụ thử', slug: 'dich-vu-thu', serviceType: 'fixed_price' };
const id = '507f1f77bcf86cd799439012';

test('Kiểm tra chuẩn ảnh, số lượng, thứ tự và dữ liệu cũ', async () => {
  assert.doesNotThrow(() => validateServiceImageMetadata(metadata));
  for (const patch of [
    { width: 799 }, { height: 449 }, { width: 1290, height: 721 },
    { width: 1000, height: 1000 }, { bytes: 5242881 },
    { format: 'gif' }, { width: NaN }, { bytes: 0 }, { width: 8192, height: 4608 },
  ]) assert.throws(() => validateServiceImageMetadata({ ...metadata, ...patch }));

  assert.equal(createServiceSchema.safeParse({ ...base, coverImage: url('cover'), galleryImages: [url('b'), url('a')] }).success, true);
  assert.equal(updateServiceSchema.safeParse({ coverImage: null, galleryImages: [] }).success, true);
  assert.equal(updateServiceSchema.safeParse({ galleryImages: Array.from({ length: 9 }, (_, i) => url(String(i))) }).success, false);
  assert.equal(updateServiceSchema.safeParse({ galleryImages: [url('a'), url('a')] }).success, false);
  assert.equal(updateServiceSchema.safeParse({ galleryImages: ['file:///etc/passwd'] }).success, false);
  // URL ngoài kho bị chặn ở service, không có request tới máy chủ tùy ý.
  await assert.rejects(validateNewServiceImages(['file:///etc/passwd']));
  await assert.rejects(validateNewServiceImages(['https://example.com/image.png']));
  await assert.rejects(validateNewServiceImages(['https://res.cloudinary.com/test-cloud/image/upload/c_fill/handigo/service-images/a.png']));
  resources = [];
  await validateNewServiceImages([url('new'), url('old')], [url('old')]);
  assert.deepEqual(resources, ['handigo/service-images/new']);

  const legacy = new Service({ ...base, image: 'https://example.com/old.jpg' });
  assert.equal(legacy.toJSON().coverImage, legacy.image);
  assert.deepEqual(legacy.galleryImages, []);
  const removed = new Service({ ...base, image: legacy.image, coverImage: null });
  assert.equal(removed.toJSON().coverImage, null);
  assert.equal(removed.toJSON().image, null);
  assert.deepEqual(serviceImageResponse({ name: 'Dịch vụ', coverImage: url('cover') }),
    { name: 'Dịch vụ', coverImage: url('cover'), image: url('cover') });
  assert.equal(serviceImageResponse({ image: url('old'), coverImage: null }).image, null);
  assert.equal(serviceImageResponse({ image: url('old') }).coverImage, url('old'));
  assert.equal(serviceImageResponse(null), null);
});

test('Create và update giữ ảnh, thêm, xóa, đổi thứ tự; không ghi trùng cover', async t => {
  const previous = { findOne: Service.findOne, create: Service.create, exists: Service.exists, category: Category.findOne };
  t.after(() => { Service.findOne = previous.findOne; Service.create = previous.create; Service.exists = previous.exists; Category.findOne = previous.category; });
  Category.findOne = async () => ({ isActive: true });
  Service.exists = async () => null;
  Service.create = async value => {
    const doc = new Service(value); await doc.validate(); return doc;
  };
  resources = [];
  const created = await createService({ ...base, coverImage: url('cover'), galleryImages: [url('a'), url('b')] });
  assert.equal(created.coverImage, url('cover'));
  assert.equal(created.image, undefined);
  assert.deepEqual([...created.galleryImages], [url('a'), url('b')]);
  assert.deepEqual(resources, ['handigo/service-images/cover', 'handigo/service-images/a', 'handigo/service-images/b']);

  const doc = new Service({ ...base, _id: id, image: 'http://res.cloudinary.com/legacy/image/upload/old.jpg', galleryImages: [url('a'), url('b')] });
  doc.save = async () => { await doc.validate(); return doc; };
  Service.findOne = async () => doc;
  resources = [];
  await updateService(id, { name: 'Tên mới' });
  assert.equal(doc.coverImage, 'https://res.cloudinary.com/legacy/image/upload/old.jpg');
  assert.equal(doc.image, undefined);
  assert.deepEqual([...doc.galleryImages], [url('a'), url('b')]);
  assert.deepEqual(resources, []);

  await updateService(id, { galleryImages: [url('b'), url('a')] });
  assert.deepEqual([...doc.galleryImages], [url('b'), url('a')]);
  assert.deepEqual(resources, []);
  await updateService(id, { galleryImages: [url('b'), url('c')] });
  assert.deepEqual(resources, ['handigo/service-images/c']);
  assert.deepEqual([...doc.galleryImages], [url('b'), url('c')]);
  const preserved = doc.coverImage;
  await assert.rejects(updateService(id, { coverImage: 'https://example.com/bad.png' }));
  assert.equal(doc.coverImage, preserved);
  await updateService(id, { coverImage: null, galleryImages: [] });
  assert.equal(doc.coverImage, null);
  assert.deepEqual([...doc.galleryImages], []);
  assert.equal(doc.toJSON().image, null);
});

const pngHeader = (width = 1280, height = 720) => {
  const buffer = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16); buffer.writeUInt32BE(height, 20);
  return buffer;
};
async function upload(buffer, mime = 'image/png') {
  const boundary = 'handigo-test-boundary';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="test.png"\r\nContent-Type: ${mime}\r\n\r\n`),
    buffer, Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const req = Readable.from([body]);
  req.headers = { 'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': String(body.length) };
  req.method = 'POST';
  return new Promise(resolve => {
    const res = { locals: {}, status(code) { this.code = code; return this; }, json(body) { resolve({ status: this.code, body }); } };
    uploadServiceImage(req, res, () => resolve({ status: 200, url: res.locals.imageUrl }));
  });
}
test('Upload chặn MIME giả, kích thước sai và file quá dung lượng trước khi lưu', async () => {
  uploadCount = 0;
  assert.equal((await upload(Buffer.from('not a PNG'))).status, 400);
  assert.equal((await upload(pngHeader(), 'image/jpeg')).status, 400);
  assert.equal((await upload(pngHeader(1000, 1000))).status, 400);
  assert.equal((await upload(Buffer.alloc(5 * 1024 * 1024 + 1))).status, 400);
  assert.equal(uploadCount, 0);
  assert.equal((await upload(pngHeader())).status, 200);
  assert.equal(uploadCount, 1);
  uploadResult = { ...metadata, width: 1000, height: 1000, public_id: 'handigo/service-images/bad' };
  assert.equal((await upload(pngHeader())).status, 400);
  uploadResult = null;
});
