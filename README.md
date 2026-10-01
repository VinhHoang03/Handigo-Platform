[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/XhGpqJyF)

---

## CI với GitHub Actions

Workflow [CI Handigo](.github/workflows/ci.yml) chạy khi push lên `develop` hoặc `main`,
hoặc khi mở/cập nhật pull request có nhánh đích là `develop` hoặc `main`.
Pipeline sử dụng Node.js 22, cài dependency bằng `npm ci` theo lockfile của từng
ứng dụng và lưu cache npm riêng cho backend/web.

| Job | Nội dung kiểm tra |
|---|---|
| `Backend - build` | Build TypeScript |
| `Web - lint và build` | ESLint toàn bộ frontend, kiểm tra TypeScript và build Vite |

Các job không cần cấu hình secrets, backend đang chạy hay MongoDB.
Pipeline chỉ kiểm tra, không triển khai. Lượt chạy cũ cùng nhánh/pull request
được hủy khi có lượt mới.

Sau khi đưa workflow lên GitHub, mở **Actions → CI Handigo** để xem kết quả.
Nếu muốn chặn merge khi CI lỗi, quản trị viên cấu hình ruleset/branch protection
cho nhánh đích và chọn cả hai job trên làm kiểm tra bắt buộc sau lượt chạy đầu tiên.

Chạy lại các kiểm tra từ thư mục gốc:

```powershell
npm --prefix handigo-backend ci
npm --prefix handigo-backend run build
npm --prefix handigo-web ci
npm --prefix handigo-web run lint
npm --prefix handigo-web run build
```


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
