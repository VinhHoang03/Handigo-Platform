import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Máy chủ kiểm thử riêng, không tải cấu hình môi trường hoặc gọi backend thật.
export default defineConfig({
  root: process.cwd(), envDir: path.resolve(process.cwd(), 'tests/e2e/empty-environment'),
  plugins: [react()], resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
  server: { host: 'localhost', port: 5187, strictPort: true },
});
