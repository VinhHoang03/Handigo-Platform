const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require('typescript');

const backend = path.resolve(__dirname, '../../handigo-backend');
const backendRequire = createRequire(path.join(backend, 'package.json'));
function load(file, modules = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) {
    if (name in modules) return modules[name];
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), `${name}.ts`));
    return backendRequire(name);
  } });
  return exports;
}
const { providerApplicationListQuerySchema: schema } = load(path.join(backend, 'src/validations/providerApplication.validator.ts'));
const { applicationSummaryFilters } = load(path.resolve(__dirname, '../src/features/admin/components/applications/application-summary.utils.ts'), { 'lucide-react': {} });

test('Tái hiện lỗi: API từ chối trạng thái hoặc loại đơn rỗng trong truy vấn thống kê', () => {
  for (const { status, applicationType } of applicationSummaryFilters) {
    if (status && applicationType) continue;
    assert.equal(schema.safeParse({ status, applicationType, page: 1, limit: 1 }).success, false);
  }
});

test('Thẻ bổ sung chỉ đếm và lọc hồ sơ đang chờ duyệt, không gồm hồ sơ đã duyệt hoặc từ chối', () => {
  const addition = applicationSummaryFilters.find(item => item.key === 'addition');
  assert.equal(addition.status, 'pending');
  assert.equal(addition.applicationType, 'service_addition');
  assert.equal(addition.label, 'Bổ sung chờ duyệt');
  assert.equal(schema.safeParse({ status: addition.status, applicationType: addition.applicationType }).success, true);
});

test('Chuẩn hóa truy vấn của cả 5 thẻ và thao tác bỏ bộ lọc đều hợp lệ với schema backend', async () => {
  const calls = [];
  const { adminApi } = load(path.resolve(__dirname, '../src/features/admin/api/admin.api.ts'), {
    '@/api/client': { get: async (url, config) => {
      calls.push({ url, params: config.params });
      return { data: { data: { items: [], pagination: { total: 0 } } } };
    } },
  });
  for (const { status, applicationType } of applicationSummaryFilters) {
    const result = await adminApi.applications({ status, applicationType, categoryId: '', fromDate: '', toDate: '', page: 1, limit: 1 });
    assert.equal(result.pagination.total, 0);
  }
  for (const { url, params } of calls) {
    assert.equal(url, '/admin/provider-applications');
    assert.equal(schema.safeParse(params).success, true);
    assert.equal(params.categoryId, undefined);
  }
  await adminApi.applications({ status: 'resubmitted', applicationType: 'initial', categoryId: '507f1f77bcf86cd799439011', fromDate: '2026-10-01', toDate: '2026-10-29', page: 2, limit: 20 });
  const query = calls.at(-1).params;
  assert.equal(schema.safeParse(query).success, true);
  assert.equal(query.status, 'resubmitted');
  assert.equal(query.applicationType, 'initial');
  assert.equal(query.page, 2);
});
