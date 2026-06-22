# Triển khai production Handigo

## 1. Backend

Thư mục deploy: `handigo-backend`.

- Build: `npm ci && npm run build`
- Start: `npm start`
- Health check: `GET /health`
- Runtime khuyến nghị: Node.js 22

Thiết lập các biến trong `handigo-backend/.env.example` trên nền tảng deploy. Không tải file `.env` thật lên Git.

Các biến bắt buộc khi `NODE_ENV=production`:

- `MONGO_URI` hoặc `MONGODB_URI`
- `ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_SECRET`
- `FRONTEND_URL` hoặc `FRONTEND_URLS`

`FRONTEND_URLS` nhận nhiều domain, phân cách bằng dấu phẩy. URL không nên có dấu `/` ở cuối.

Ví dụ:

```text
FRONTEND_URL=https://handigo.example.com
FRONTEND_URLS=https://www.handigo.example.com
```

Backend đã lắng nghe trên `0.0.0.0` và sử dụng biến `PORT` do nền tảng cung cấp. Socket.IO chạy chung domain và cổng với REST API.

## 2. Frontend

Thư mục deploy: `handigo-web`.

- Build: `npm ci && npm run build`
- Output: `dist`

Các biến `VITE_*` phải được cung cấp tại thời điểm build:

```text
VITE_API_BASE_URL=https://api.handigo.example.com
VITE_GOOGLE_CLIENT_ID=...
VITE_FACEBOOK_APP_ID=...
VITE_GOOGLE_MAPS_API_KEY=...
```

Hosting frontend phải fallback mọi route chưa có file vật lý về `index.html` để React Router hoạt động. File `nginx.conf` đã cấu hình sẵn quy tắc này cho Docker.

## 3. Docker

Build backend:

```bash
docker build -t handigo-backend ./handigo-backend
```

Build frontend:

```bash
docker build -t handigo-web \
  --build-arg VITE_API_BASE_URL=https://api.handigo.example.com \
  --build-arg VITE_GOOGLE_CLIENT_ID=... \
  --build-arg VITE_FACEBOOK_APP_ID=... \
  --build-arg VITE_GOOGLE_MAPS_API_KEY=... \
  ./handigo-web
```

Secret backend phải được truyền vào container lúc chạy, không truyền bằng Docker build argument.

## 4. Thiết lập dịch vụ bên ngoài

- MongoDB Atlas: cho phép IP của backend và dùng tài khoản có quyền tối thiểu cần thiết.
- Google OAuth: thêm domain frontend vào Authorized JavaScript origins.
- Google Maps: giới hạn API key theo domain frontend và chỉ bật API cần sử dụng.
- Facebook Login: thêm domain production và callback hợp lệ.
- PayOS: cấu hình URL trả về/cancel bằng domain frontend production.
- Cloudinary và email: cấu hình credential trên secret manager của nền tảng.

## 5. Kiểm tra sau deploy

1. Gọi `/health` và xác nhận HTTP 200.
2. Đăng nhập và refresh trang để kiểm tra refresh-token cookie.
3. Mở hai tài khoản customer/provider để kiểm tra Socket.IO và modal matching.
4. Nhận đơn rồi kiểm tra tracking vị trí trên hai thiết bị.
5. Kiểm tra callback thanh toán và upload ảnh.
