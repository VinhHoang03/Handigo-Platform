import assert from 'node:assert/strict';
import path from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium, expect } from '@playwright/test';

// Dựng riêng bộ chọn giờ, không dùng đăng nhập, API hay cấu hình bí mật.
const entry = 'virtual:wheel-preview';
const code = `
  import React from 'react';
  import {createRoot} from 'react-dom/client';
  import '/src/index.css';
  import {Step2TimeSlotFieldset} from '/src/features/booking/components/Step2TimeSlotFieldset.tsx';
  import {getDefaultScheduledAt, getInitialScheduledAt} from '/src/features/booking/components/step2Helpers.ts';
  window.__bookingScheduleHelpers = {getDefaultScheduledAt, getInitialScheduledAt};
  function App() {
    const [time, setTime] = React.useState('2030-10-04T17:45:00');
    return React.createElement(Step2TimeSlotFieldset, {
      scheduledAt: time, currentTimestamp: new Date('2030-10-04T16:30:00').getTime(),
      onSelectSlot: value => setTime('2030-10-04T' + value + ':00')
    });
  }
  createRoot(document.getElementById('root')).render(React.createElement(App));
`;
const server = await createServer({
  configFile: false, envFile: false, root: process.cwd(),
  resolve: { alias: { '@': path.resolve('src') } },
  server: { host: '127.0.0.1', port: 5189, strictPort: true },
  plugins: [react(), {
    name: 'wheel-preview',
    resolveId(id) { if (id === entry) return '\0' + entry; },
    load(id) { if (id === '\0' + entry) return code; },
    configureServer(instance) {
      instance.middlewares.use('/wheel-check', async (_req, res) => {
        const html = await instance.transformIndexHtml('/wheel-check', '<html><head></head><body><div id="root" style="width:300px;margin:40px"></div><script type="module" src="/@id/__x00__virtual:wheel-preview"></script></body></html>');
        res.setHeader('Content-Type', 'text/html');
        res.end(html);
      });
    },
  }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5189/wheel-check');
  const defaults = await page.evaluate(() => {
    const {getDefaultScheduledAt, getInitialScheduledAt} = window.__bookingScheduleHelpers;
    const now = new Date(2030, 9, 4, 16, 37, 45);
    const currentMinute = getDefaultScheduledAt(now);
    return {
      currentMinute,
      restoredCurrentMinute: getInitialScheduledAt(currentMinute, now),
      beforeOpening: getDefaultScheduledAt(new Date(2030, 9, 4, 7, 59, 45)),
      afterClosing: getDefaultScheduledAt(new Date(2030, 9, 4, 22, 0, 0)),
    };
  });
  assert.match(defaults.currentMinute, /T16:37:00$/);
  assert.equal(defaults.restoredCurrentMinute, defaults.currentMinute);
  assert.match(defaults.beforeOpening, /T08:00:00$/);
  assert.match(defaults.afterClosing, /T08:00:00$/);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const trigger = page.getByRole('button', { name: 'Chọn khung giờ', exact: true });
  await expect(trigger).toHaveText('17:45');
  await trigger.click();
  const hour = page.getByRole('listbox', { name: 'Giờ', exact: true });
  const minute = page.getByRole('listbox', { name: 'Phút', exact: true });
  await expect(hour).toBeVisible();
  await expect(minute).toBeVisible();
  await minute.focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('button', { name: 'Chọn 17:59', exact: true })).toBeEnabled();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Chọn 17:00', exact: true })).toBeEnabled();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('button', { name: 'Chọn 17:59', exact: true })).toBeEnabled();
  // Cuộn chuột qua biên 59 → 00 và kiểm tra giá trị nằm giữa.
  await minute.hover();
  await page.mouse.wheel(0, 44);
  await expect(page.getByRole('button', { name: 'Chọn 17:00', exact: true })).toBeEnabled();
  // Cuộn tới giờ đã qua thì không cho xác nhận.
  await hour.evaluate((element) => { element.scrollTop = 14 * 44; });
  await expect(page.getByRole('button', { name: 'Chọn 08:00', exact: true })).toBeDisabled();
  await hour.focus();
  await page.keyboard.press('End');
  await minute.focus();
  await page.keyboard.press('End');
  await page.getByRole('button', { name: 'Chọn 21:59', exact: true }).click();
  await expect(trigger).toHaveText('21:59');
  await trigger.click();
  await expect(minute.getByRole('option', { selected: true })).toHaveText('59');
  await expect(hour.getByRole('option', { selected: true })).toHaveText('21');
  await page.keyboard.press('Escape');
  await expect(hour).toHaveCount(0);
  assert.deepEqual(errors, []);
  console.log('Đạt: cuộn vòng, phím mũi tên, chặn giờ đã qua, xác nhận và mở lại đúng giá trị.');
} finally {
  await browser?.close();
  await server.close();
}
