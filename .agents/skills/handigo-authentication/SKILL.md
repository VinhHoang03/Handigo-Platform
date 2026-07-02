---
name: handigo-authentication
description: Hướng dẫn xác thực và phân quyền Handigo. Dùng khi sửa login, register, OTP, JWT, refresh token, OAuth Google/Facebook, RouteGuard, role ADMIN/CUSTOMER/PROVIDER hoặc bảo vệ route backend/frontend.
---

# Handigo Authentication

## Backend

- `auth.middleware.ts` đọc Bearer token từ header `Authorization`.
- Secret access token lấy từ `ACCESS_TOKEN_SECRET` hoặc fallback `JWT_SECRET`.
- Middleware kiểm tra user còn tồn tại, `isDeleted: false`, và không bị `status: "locked"`.
- `req.user` phải là nguồn user hiện tại cho service/controller.
- `roleMiddleware` dùng cho route cần role cụ thể.

## Token và session

- Auth service dùng access token, refresh token và `Session`.
- Refresh token được hash trước khi lưu.
- Controller auth đặt refresh token trong cookie `httpOnly`.
- Frontend dùng `src/api/client.ts` để tự refresh access token.

## OAuth và OTP

- Google/Facebook login nằm trong auth route/controller/service.
- OTP đăng ký và reset password dùng helper trong `utils/otp` và gửi mail qua `utils/mail`.
- Không log OTP, token, password hoặc secret.

## Checklist bảo mật

- Không nhận role từ body để cấp quyền.
- Không trả `passwordHash`, refresh token hash hoặc secret.
- Password phải hash bằng cơ chế hiện có.
- Error message hướng tới user nên dùng tiếng Việt có dấu khi sửa hoặc thêm mới.

