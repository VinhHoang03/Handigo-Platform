---
name: handigo-express-api
description: Hướng dẫn làm việc với backend Express.js của Handigo. Dùng khi thêm, sửa, debug hoặc review route, controller, service, middleware, validation, error handling trong `handigo-backend/src`.
---

# Handigo Express API

## Quy trình

1. Đọc route hiện có trong `handigo-backend/src/routes`.
2. Xác định controller tương ứng trong `controllers`.
3. Đưa nghiệp vụ vào `services`; controller chỉ nhận request, gọi service và trả response.
4. Validate input bằng schema trong `validations` và middleware `validate`.
5. Gắn `authMiddleware` và `roleMiddleware` cho route cần bảo vệ.
6. Giữ nguyên response shape, status code, field name và route hiện có nếu không có yêu cầu đổi contract.

## Pattern hiện có

- Route dùng `Router()` từ Express và export default router.
- Controller dùng `try/catch` và `next(error)`.
- Service ném `AppError` cho lỗi nghiệp vụ.
- Route được mount tập trung trong `src/app.ts`.
- Health check hiện ở `GET /health`.

## Checklist khi sửa API

- Không tin `role`, `userId`, `providerId`, `isAdmin`, `isVerified` từ client.
- Lấy user hiện tại từ `req.user` sau `authMiddleware`.
- Không trả password, token nhạy cảm, internal note hoặc dữ liệu không thuộc quyền user.
- Với route ADMIN, bắt buộc kiểm tra role `ADMIN`.
- Với tài nguyên của user/provider, kiểm tra ownership trong service.
- Nếu thêm route mới, cập nhật route file, controller, service, validation và mount trong `app.ts` khi cần.

