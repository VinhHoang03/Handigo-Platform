import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e', testMatch: 'quotation-agent.spec.ts', workers: 1, timeout: 45_000,
  reporter: 'list', use: { baseURL: 'http://localhost:5187', trace: 'retain-on-failure',
    launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } },
  webServer: { command: 'node node_modules/vite/bin/vite.js --config tests/e2e/quotation.vite.config.ts',
    url: 'http://localhost:5187', reuseExistingServer: false, timeout: 60_000 },
});
