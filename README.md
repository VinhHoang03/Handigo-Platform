## Phát triển ứng dụng Flutter bằng Codex và terminal

Mở emulator Android trước. Chạy backend trong terminal riêng:

```powershell
npm --prefix handigo-backend run dev
```

Trong terminal thứ hai, tại thư mục gốc Handigo:

```powershell
node scripts/dev-app.mjs
```

Lệnh chạy app ở chế độ debug và tự hot reload khi file Dart trong
`handigo-app/lib` thay đổi, kể cả khi Codex sửa file. Các thay đổi liên tiếp
được gom lại trước khi reload; thay đổi trong lúc Flutter đang build được
áp dụng sau khi app sẵn sàng. Không cần cài package Node.js cho script này.

- Nhập `r` rồi Enter: hot reload, giữ trạng thái app khi Flutter hỗ trợ.
- Nhập `R` rồi Enter: hot restart, khởi tạo lại trạng thái Dart.
- Nhập `q` rồi Enter hoặc `Ctrl+C`: dừng phiên chạy app.
- Thêm `--no-watch` nếu chỉ muốn reload thủ công.

Mặc định dùng `emulator-5554` và API `http://10.0.2.2:5000`.
Kiểm tra mã thiết bị bằng `flutter devices`, rồi đổi khi cần:

```powershell
node scripts/dev-app.mjs --device emulator-5556 --api http://10.0.2.2:5000
```

Với điện thoại thật, dùng mã thiết bị và địa chỉ IP LAN của máy chạy backend.
Khi thay đổi `main()`, `initState()` hoặc giá trị khởi tạo, có thể cần `R`.
Khi thay đổi plugin native, Gradle, AndroidManifest hoặc `--dart-define`, dừng
và chạy lại app. Hot reload không khắc phục lỗi DNS/Internet của emulator.

Hướng dẫn IDE và các lệnh kiểm tra nằm trong [README của app](handigo-app/README.md).

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
