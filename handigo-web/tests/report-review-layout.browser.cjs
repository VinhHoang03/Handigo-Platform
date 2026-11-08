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
const sourceId = '672e25fcb4cf57e499c53ba5';
const assessment = { _id: 'phan-tich', feature: 'complaint_summary', sourceType: 'report', sourceId, preview: false,
  status: 'manual', outcome: 'auto_intake', createdAt: '2026-11-05T01:30:00Z', revision: 2, checks: [],
  output: { summary: 'Khách yêu cầu hoàn 150.000 đồng cho đơn hàng đã hủy. Hệ thống chưa ghi nhận thanh toán; cần đối soát khoản tiền mặt trước khi kết luận.',
    missingData: ['Chưa có chứng từ thanh toán tiền mặt.'], evidence: [], timeline: [], duplicateServiceIds: [],
    complaintResolution: { severity: 'LOW', severityReason: 'Chưa có căn cứ xác nhận khoản tiền đã trả.', evidenceStatus: 'insufficient', disputed: false,
      policyFindings: [], escalationReasons: [], recommendation: 'Thu thập chứng từ và xác minh với hai bên.',
      workflow: { category: 'refund', proposedStatus: 'evidence_requested', allegations: ['Khách trình bày đã trả tiền mặt.'], facts: [],
        missingEvidence: [{ owner: 'reporter', description: 'Biên nhận thanh toán và xác nhận của thợ.' }],
        tasks: [{ owner: 'admin', kind: 'verify', instruction: 'Đối chiếu khoản tiền khách khai đã trả.', completionCondition: 'Có kết quả đối soát từ hai bên.' },
          { owner: 'admin', kind: 'contact', instruction: 'Liên hệ thợ để xác nhận khoản tiền mặt.', completionCondition: 'Ghi nhận phản hồi của thợ.' }] } } } };
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  let stateIndex = 0;
  vm.runInNewContext(code, { exports, require(name) {
    if (name === 'react' && file.endsWith('ComplaintReviewPanel.tsx')) return {
      useState: () => [[assessment, false, false, '', 0, true][stateIndex++], () => {}], useEffect() {},
    };
    if (name === 'react' && file.endsWith('ReportReviewForm.tsx')) return {
      useId: () => 'trang-thai', useState: initial => [initial, () => {}],
    };
    if (name.endsWith('/adminAI.api')) return { adminAI: {} };
    if (name.endsWith('/adminCases.api')) return { adminCasesApi: {} };
    if (name === '@/utils/apiError') return { getErrorMessage: () => '' };
    if (name === 'react-router-dom') return { Link: ({ to, children, ...props }) => React.createElement('a', { ...props, href: to }, children) };
    if (!name.startsWith('.')) return require(name);
    const base = path.resolve(path.dirname(file), name);
    return load(['.ts', '.tsx'].map(ext => base + ext).find(fs.existsSync));
  } }, { filename: file });
  return exports;
}

async function run() {
  const folder = await fsp.mkdtemp(path.join(os.tmpdir(), 'handigo-review-layout-'));
  let browser, socket;
  try {
    const { ComplaintReviewPanel } = load(path.join(root, 'src/features/admin/ai/ComplaintReviewPanel.tsx'));
    const markup = renderToStaticMarkup(React.createElement(ComplaintReviewPanel, { reportId: sourceId, active: true }));
    const input = path.join(root, 'src/index.css');
    const css = (await postcss([tailwind({ base: root })]).process(fs.readFileSync(input, 'utf8'), { from: input })).css;
    const page = path.join(folder, 'preview.html');
    await fsp.writeFile(page, `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}body{background:#f4f6fa;font-family:Arial,sans-serif;padding:24px 16px}main{max-width:1024px;margin:auto;background:white;border:1px solid #e2e5ed;border-radius:18px;padding:24px}header{border-bottom:1px solid #e2e5ed;padding-bottom:16px;margin-bottom:20px}header h1{font-size:18px;font-weight:600;margin:0 0 8px}header p{color:#64748b;font-size:13px;margin:0}@media(max-width:640px){body{padding:12px}main{padding:16px}}</style><body><main><header><h1>Yêu cầu hoàn tiền cho đơn hàng đã hủy</h1><p>Báo cáo thanh toán · Đang xem xét</p></header><div id="case-scroll" style="max-height:580px;overflow-x:hidden;overflow-y:auto">${markup}</div></main></body></html>`, 'utf8');
    const profile = path.join(folder, 'profile');
    browser = spawn(process.env.QR_TEST_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    let port;
    for (let index = 0; index < 60; index++) {
      try { port = Number((await fsp.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; }
      catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    assert(port, 'Không mở được Chrome kiểm tra bố cục.');
    const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    socket = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let sequence = 0;
    const pending = new Map();
    socket.onmessage = event => {
      const data = JSON.parse(event.data), call = pending.get(data.id);
      if (call) { pending.delete(data.id); data.error ? call.reject(Error(JSON.stringify(data.error))) : call.resolve(data.result); }
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
    });
    const results = { folder };
    for (const [name, width] of [['desktop', 1200], ['mobile', 390]]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: name === 'mobile' });
      await send('Page.navigate', { url: pathToFileURL(page).href });
      await new Promise(resolve => setTimeout(resolve, 300));
      const data = await send('Runtime.evaluate', { expression: `(()=>{const panel=document.querySelector('section[aria-label]');const form=document.querySelector('form');const p=panel.getBoundingClientRect(),f=form.getBoundingClientRect();return{viewport:innerWidth,panelWidth:p.width,formWidth:f.width,formHeight:f.height,formLeft:f.left,panelLeft:p.left,columns:getComputedStyle(panel).gridTemplateColumns,formCount:document.querySelectorAll('form').length,overflow:document.documentElement.scrollWidth>innerWidth}})()`, returnByValue: true });
      const metrics = data.result.value;
      assert.equal(metrics.formCount, 1);
      assert.equal(metrics.overflow, false);
      assert(metrics.formWidth <= 340 && metrics.formHeight < 340);
      if (name === 'desktop') { assert.equal(metrics.formWidth, 320); assert(metrics.formLeft > metrics.panelLeft + 300); }
      if (name === 'desktop') {
        const sticky = await send('Runtime.evaluate', { expression: `(()=>{const scroll=document.getElementById('case-scroll');const panel=document.querySelector('section[aria-label]');panel.querySelector('details').open=true;const form=panel.querySelector('form');const note=form.querySelector('textarea').value;const before=form.getBoundingClientRect().top;scroll.scrollTop=300;const first=form.getBoundingClientRect().top;scroll.scrollTop=500;return{before,first,after:form.getBoundingClientRect().top,scrollTop:scroll.scrollTop,containerTop:scroll.getBoundingClientRect().top,notePreserved:form.querySelector('textarea').value===note}})()`, returnByValue: true });
        const result = sticky.result.value;
        assert(result.scrollTop >= 400, 'Nội dung chi tiết phải đủ dài để kiểm tra cuộn.');
        assert(Math.abs(result.after - result.containerTop) <= 2, 'Form phải bám đầu vùng cuộn của modal.');
        assert(Math.abs(result.first - result.after) <= 2, 'Cuộn tiếp không làm form trôi đi.');
        assert.equal(result.notePreserved, true);
        metrics.sticky = result;
        await send('Runtime.evaluate', { expression: "document.getElementById('case-scroll').scrollTop=0;document.querySelector('section[aria-label] details').open=false" });
      }
      const capture = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      const screenshot = path.join(folder, `${name}.png`);
      await fsp.writeFile(screenshot, Buffer.from(capture.data, 'base64'));
      results[name] = { screenshot, metrics };
    }
    console.log(JSON.stringify(results));
  } finally {
    socket?.close(); browser?.kill();
    if (!process.argv.includes('--keep-preview')) {
      const relative = path.relative(os.tmpdir(), folder);
      if (!relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(folder).startsWith('handigo-review-layout-')) await fsp.rm(folder, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
    }
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
