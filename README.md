## Scripts Reference

> Chạy tất cả lệnh từ thư mục **root** của project (không cần `cd` vào từng folder).

### Backend

| Lệnh | Mô tả |
|---|---|
| `npm run backend:dev` | Khởi động backend với hot reload (ts-node-dev) |
| `npm run backend:build` | Build TypeScript backend ra `dist/` |
| `npm run backend:start` | Chạy backend từ bản đã build |

### Frontend (Web)

| Lệnh | Mô tả |
|---|---|
| `npm run web:dev` | Khởi động Vite dev server |
| `npm run web:build` | Build frontend |
| `npm run web:preview` | Preview bản build |
| `npm run web:lint` | Lint frontend |

### Tiện ích

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Khởi động **cả backend lẫn web** cùng lúc |
| `npm run install:all` | Cài dependencies cho cả backend và web |
| `npm run build:all` | Build cả backend và web |
