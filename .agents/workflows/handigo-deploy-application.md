# Handigo Deploy Application Workflow

## Purpose

Chuẩn bị và kiểm tra deploy Handigo backend/frontend theo cấu hình hiện có, không xử lý secret bằng cách ghi vào repo.

## When To Use It

Dùng khi build production, Dockerize, kiểm tra release, cập nhật biến môi trường deploy hoặc xác minh sau deploy.

## Inputs

- Target deploy: backend, frontend hoặc cả hai.
- Môi trường: staging/production/local Docker.
- Domain frontend/backend.
- Danh sách biến môi trường có sẵn trên nền tảng deploy.

## Expected Outputs

- Build artifact hoặc Docker image sẵn sàng.
- Checklist biến môi trường cần có.
- Kết quả smoke test sau deploy.
- Rủi ro rollout và rollback nếu có.

## Step-by-step Process

1. Đọc `DEPLOYMENT.md`, Dockerfile backend/web và `.env.example`; không đọc `.env` thật.
2. Backend: chạy `npm ci` nếu cần, `npm run build`, start bằng `npm start` hoặc Docker.
3. Frontend: đảm bảo `VITE_*` được truyền lúc build, chạy `npm run build`.
4. Kiểm tra CORS: `FRONTEND_URL`/`FRONTEND_URLS` khớp domain frontend.
5. Kiểm tra secret backend được truyền ở runtime, không qua Docker build arg.
6. Sau deploy, gọi `/health`.
7. Smoke test auth refresh cookie, Socket.IO, payment callback, upload ảnh và route fallback frontend.

## Validation Checklist

- Không commit `.env`, secret, token hoặc credential.
- Backend lắng nghe `0.0.0.0` và dùng `PORT`.
- Frontend hosting fallback route về `index.html`.
- OAuth/Google Maps/Facebook/PayOS/Cloudinary/email cấu hình trên provider tương ứng.
- Rollback path rõ nếu deploy lỗi.

## Completion Criteria

- Backend health check HTTP 200.
- Frontend load được route client-side.
- Luồng auth và ít nhất một luồng domain quan trọng được smoke test.
- Biến môi trường production đã được kiểm tra bằng tên, không lộ giá trị.

