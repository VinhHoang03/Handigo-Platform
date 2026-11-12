const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const root = path.resolve(__dirname, '..');
const cache = new Map();

function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(code, { exports, require(name) {
    if (name === '../support/support.constants') return { ticketAge: () => '1 ngày' };
    if (!name.startsWith('.') && !name.startsWith('@/')) return require(name);
    const base = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : path.resolve(path.dirname(file), name);
    return load(['.ts', '.tsx'].map(extension => base + extension).find(fs.existsSync));
  } }, { filename: file });
  return exports;
}

async function run() {
  const { DataTable } = load(path.join(root, 'src/components/common/dashboard/DataTable.tsx'));
  const { caseTableColumns } = load(path.join(root, 'src/features/admin/components/cases/case-table-columns.tsx'));
  const row = { _id: 'd607ebe23a6d6e6195995860', title: '[TEST AI ADMIN] KN01 Chất lượng dịch vụ và lời trình bày mâu thuẫn',
    reporterId: { fullName: 'Khách kiểm thử' }, status: 'pending', createdAt: '2026-10-31T08:00:00Z' };
  const html = renderToStaticMarkup(React.createElement(DataTable, { columns: caseTableColumns, rows: [row], rowKey: item => item._id, minWidthClassName: 'min-w-[1150px]' }));
  const cssFile = path.join(root, 'src/index.css');
  const css = (await postcss([tailwind({ base: root })]).process(fs.readFileSync(cssFile, 'utf8'), { from: cssFile })).css;
  const folder = await fsp.mkdtemp(path.join(os.tmpdir(), 'handigo-case-title-'));
  try {
    const file = path.join(folder, 'cases.html');
    await fsp.writeFile(file, `<!doctype html><html lang="vi"><meta charset="utf-8"><style>${css}</style><body>
      <div id="old" style="width:1100px">${html.replace('w-full max-w-[36rem]', 'max-w-xl')}</div>
      <div id="desktop" style="width:1100px">${html}</div><div id="mobile" style="width:375px">${html}</div>
      <script>const result = Object.fromEntries(['old','desktop','mobile'].map(id => {
        const element = document.querySelector('#'+id+' tbody p');
        return [id, {width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height, maxWidth: getComputedStyle(element).maxWidth}];
      })); document.body.dataset.caseMetrics = JSON.stringify(result);</script></body></html>`, 'utf8');
    const output = await new Promise((resolve, reject) => {
      const browser = spawn(process.env.QR_TEST_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless', '--disable-gpu', '--no-first-run', '--disable-background-networking', `--user-data-dir=${path.join(folder, 'profile')}`,
        '--dump-dom', '--virtual-time-budget=1000', pathToFileURL(file).href,
      ], { windowsHide: true });
      let stdout = '', stderr = '';
      const timer = setTimeout(() => { browser.kill(); reject(Error('Quá thời gian kiểm tra tiêu đề.')); }, 30000);
      browser.stdout.on('data', chunk => { stdout += chunk; });
      browser.stderr.on('data', chunk => { stderr += chunk; });
      browser.on('error', error => { clearTimeout(timer); reject(error); });
      browser.on('close', code => { clearTimeout(timer); code === 0 ? resolve(stdout) : reject(Error(stderr.slice(-1000))); });
    });
    const raw = /data-case-metrics="([^"]+)"/.exec(output)?.[1];
    assert(raw, 'Không lấy được kích thước tiêu đề trong Chrome.');
    const metrics = JSON.parse(raw.replaceAll('&quot;', '"').replaceAll('&amp;', '&'));
    assert.equal(metrics.old.width, 80, 'Tái hiện đúng giới hạn 80px từ token spacing-xl.');
    for (const id of ['desktop', 'mobile']) {
      assert(metrics[id].width >= 300, `Tiêu đề ${id} bị ép hẹp.`);
      assert(metrics[id].height <= 72, `Tiêu đề ${id} xuống quá nhiều dòng.`);
      assert.equal(metrics[id].maxWidth, '576px');
    }
    console.log('Đạt trên Chrome: lỗi cũ rộng 80px; tiêu đề sau sửa có chiều rộng phù hợp trên khung 1100px và 375px, không dồn chữ thành cột dọc.');
    console.log(JSON.stringify(metrics));
  } finally {
    const relative = path.relative(os.tmpdir(), folder);
    if (!relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(folder).startsWith('handigo-case-title-')) {
      await fsp.rm(folder, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
    }
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
