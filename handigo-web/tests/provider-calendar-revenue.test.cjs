const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function fixture() {
  let state = null, dependencies, cleanup, pendingEffect;
  const requests = [];
  const exports = {};
  const modules = {
    react: {
      useState: () => [state, value => { state = value; }],
      useEffect: (effect, nextDependencies) => {
        if (!dependencies || dependencies.some((value, index) => value !== nextDependencies[index])) {
          cleanup?.();
          pendingEffect = effect;
          dependencies = nextDependencies;
        }
      },
    },
    '../api/providerDashboard.api': { providerDashboardApi: { earnings: (fromDate, toDate) => new Promise((resolve, reject) => {
      requests.push({ fromDate, toDate, resolve, reject });
    }) } },
    '../components/home/providerHome.utils': {
      dateKey: date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    },
  };
  const source = fs.readFileSync(path.resolve(__dirname, '../src/features/provider/hooks/useProviderCalendarRevenue.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => modules[name] });
  return {
    requests,
    render: month => {
      const result = exports.useProviderCalendarRevenue(month);
      if (pendingEffect) { cleanup = pendingEffect(); pendingEffect = null; }
      return result;
    },
  };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('Lấy đủ ngày trong tháng, kể cả tháng nhuận, và cộng doanh thu theo ngày', async () => {
  const f = fixture(), month = new Date(2024, 1, 1);
  assert.equal(f.render(month).loading, true);
  assert.equal(f.requests[0].fromDate, '2024-02-01');
  assert.equal(f.requests[0].toDate, '2024-02-29');
  f.requests[0].resolve({ earningsByDay: [{ day: '2024-02-01', amount: 100000 }, { day: '2024-02-29', amount: 250000 }] });
  await settle();
  const result = f.render(month);
  assert.equal(result.loading, false);
  assert.equal(result.total, 350000);
  assert.equal(result.earningsByDay.get('2024-02-29'), 250000);
});

test('Đổi tháng không giữ doanh thu cũ và bỏ phản hồi đến muộn', async () => {
  const f = fixture(), december = new Date(2026, 11, 1), january = new Date(2027, 0, 1);
  f.render(december);
  f.requests[0].resolve({ earningsByDay: [{ day: '2026-12-01', amount: 80000 }] });
  await settle();
  assert.equal(f.render(december).total, 80000);
  const loading = f.render(january);
  assert.equal(loading.loading, true);
  assert.equal(loading.earningsByDay.size, 0);
  assert.equal(f.requests[1].fromDate, '2027-01-01');
  f.render(december);
  f.requests[2].resolve({ earningsByDay: [{ day: '2026-12-02', amount: 90000 }] });
  await settle();
  f.requests[1].resolve({ earningsByDay: [{ day: '2027-01-01', amount: 999999 }] });
  await settle();
  assert.equal(f.render(december).total, 90000);
  assert.equal(f.render(december).earningsByDay.has('2027-01-01'), false);
});

test('Tháng không có doanh thu và lỗi tải có trạng thái riêng', async () => {
  const f = fixture(), month = new Date(2026, 9, 1), next = new Date(2026, 10, 1);
  f.render(month);
  f.requests[0].resolve({ earningsByDay: [] });
  await settle();
  assert.equal(f.render(month).total, 0);
  assert.equal(f.render(month).error, null);
  f.render(next);
  f.requests[1].reject(new Error('Lỗi thử nghiệm'));
  await settle();
  assert.equal(f.render(next).loading, false);
  assert.match(f.render(next).error, /Không thể tải/);
  assert.equal(f.render(next).earningsByDay.size, 0);
});
