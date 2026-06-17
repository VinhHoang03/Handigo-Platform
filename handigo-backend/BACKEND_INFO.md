# Handigo Backend - Thông tin chi tiết

## 1. Tổng quan

Backend của Handigo là ứng dụng Node.js/Express viết bằng TypeScript. Backend hiện tại tập trung vào module xác thực người dùng, quản lý tài khoản cơ bản và chuẩn bị nền tảng cho các module nghiệp vụ như dịch vụ, booking, provider, thanh toán, chat và admin.

Thư mục backend: `handigo-backend`

## 2. Công nghệ sử dụng

- **Node.js**: môi trường chạy backend.
- **Express 5**: framework HTTP API.
- **TypeScript**: kiểu dữ liệu tĩnh.
- **MongoDB + Mongoose**: database và ODM.
- **JWT**: xác thực bằng access token.
- **Bcrypt**: hash password.
- **Zod**: validate request body.
- **Nodemailer**: gửi OTP qua email.
- **Cookie Parser**: hỗ trợ xử lý cookie.
- **CORS**: cấu hình truy cập từ frontend/mobile.
- **Multer + Cloudinary**: chuẩn bị cho upload file/ảnh.
- **PayOS**: chuẩn bị cho luồng thanh toán.

## 3. Script

```bash
npm run dev
```

Chạy server development bằng `ts-node-dev`.

```bash
npm run build
```

Build TypeScript sang thư mục dist bằng `tsc` và xử lý alias bằng `tsc-alias`.

```bash
npm start
```

Chạy bản build từ `dist/server.js`.

## 4. Cách chạy local

```bash
cd handigo-backend
npm install
npm run dev
```

Server mặc định chạy ở port `5000` nếu không có biến môi trường `PORT`.

## 5. Biến môi trường

Backend đọc biến môi trường bằng `dotenv`.

Các biến đang được code sử dụng:

- `PORT`: port chạy server.
- `MONGO_URI`: connection string MongoDB.
- `ACCESS_TOKEN_SECRET`: secret ký JWT.
- `JWT_SECRET`: fallback secret nếu không có `ACCESS_TOKEN_SECRET`.
- `JWT_EXPIRES_IN`: thời hạn token, mặc định `1d`.
- `EMAIL_USER`: email dùng để gửi OTP.
- `EMAIL_PASSWORD`: mật khẩu/app password của email.
- `NODE_ENV`: dùng trong CORS và error response.

Các config đã có nhưng module chưa dùng đầy đủ:

- Cloudinary config.
- PayOS config.

## 6. Cấu trúc thư mục

- `src/server.ts`: entrypoint, load `.env`, connect database, tạo HTTP server.
- `src/app.ts`: cấu hình Express, CORS, parser, logging, route và error handler.
- `src/configs/db.ts`: kết nối MongoDB.
- `src/configs/jwt.config.ts`: cấu hình JWT.
- `src/configs/cloudinary.ts`: cấu hình Cloudinary.
- `src/configs/payos.config.ts`: cấu hình PayOS.
- `src/models/user.model.ts`: model User.
- `src/routes/auth.routes.ts`: route auth.
- `src/routes/user.routes.ts`: route profile, hiện chưa mount trong `app.ts`.
- `src/controllers/auth.controller.ts`: controller auth.
- `src/controllers/user.controller.ts`: controller profile.
- `src/services/auth.service.ts`: nghiệp vụ auth.
- `src/services/user.service.ts`: nghiệp vụ profile.
- `src/middlewares/auth.middleware.ts`: xác thực JWT.
- `src/middlewares/role.middleware.ts`: kiểm tra role.
- `src/middlewares/validate.middleware.ts`: validate body bằng Zod.
- `src/middlewares/multer.middleware.ts`: upload middleware.
- `src/middlewares/cloudinary.middleware.ts`: upload Cloudinary.
- `src/validations/auth.validation.ts`: schema validate auth.
- `src/utils/token.ts`: tạo JWT.
- `src/utils/otp.ts`: tạo, hash và tính hạn OTP.
- `src/utils/mail.ts`: gửi email OTP.
- `src/utils/appError.ts`: custom error có status code.
- `postman/handigo-auth.postman_collection.json`: collection test auth.

## 7. Model User

File: `src/models/user.model.ts`

Các field chính:

- `email`: email đăng nhập, bắt buộc, unique.
- `passwordHash`: mật khẩu đã hash.
- `fullName`: họ tên.
- `phone`: số điện thoại, optional.
- `avatar`: ảnh đại diện, default `null`.
- `role`: `CUSTOMER`, `PROVIDER`, `ADMIN`, default `CUSTOMER`.
- `status`: `ACTIVE`, `INACTIVE`, `BANNED`, default `ACTIVE`.
- `isEmailVerified`: trạng thái xác thực email.
- `registerOtp`: OTP đăng ký đã hash.
- `registerOtpExpire`: thời hạn OTP đăng ký.
- `resetPasswordTokenHash`: token reset password đã hash, hiện chưa dùng trong flow chính.
- `resetPasswordExpire`: hạn token reset password, hiện chưa dùng trong flow chính.
- `resetPasswordOtp`: OTP reset password đã hash.
- `resetPasswordOtpExpire`: thời hạn OTP reset password.

Model có `timestamps`, nên tự có `createdAt` và `updatedAt`.

## 8. API đang hoạt động

Base URL local: `http://localhost:5000`

Base route: `/auth`

### POST `/auth/register`

Đăng ký tài khoản customer và gửi OTP xác thực email.

Request body:

```json
{
  "email": "test@example.com",
  "password": "Password123",
  "fullName": "Test User",
  "phone": "0900000000"
}
```

Response thành công:

```json
{
  "message": "Registration OTP has been sent to your email"
}
```

Ghi chú:

- Nếu email đã tồn tại và đã verify thì trả lỗi `409`.
- Nếu email tồn tại nhưng chưa verify thì cập nhật lại thông tin và gửi OTP mới.
- Password được hash bằng bcrypt.
- OTP được hash trước khi lưu database.

### POST `/auth/verify-register-otp`

Xác thực OTP đăng ký.

Request body:

```json
{
  "email": "test@example.com",
  "otp": "123456"
}
```

Response thành công:

```json
{
  "message": "Email verified successfully"
}
```

Ghi chú:

- OTP phải đúng 6 ký tự.
- OTP hết hạn hoặc sai sẽ trả lỗi `400`.
- User không tồn tại trả lỗi `404`.
- Email đã verified trả lỗi `409`.

### POST `/auth/resend-register-otp`

Gửi lại OTP đăng ký cho user chưa verify email.

Request body:

```json
{
  "email": "test@example.com"
}
```

Response thành công:

```json
{
  "message": "Registration OTP has been resent"
}
```

### POST `/auth/login`

Đăng nhập bằng email/password.

Request body:

```json
{
  "email": "test@example.com",
  "password": "Password123"
}
```

Response thành công:

```json
{
  "message": "Login successful",
  "token": "jwt-token",
  "user": {
    "id": "user-id",
    "email": "test@example.com",
    "fullName": "Test User",
    "phone": "0900000000",
    "avatar": null,
    "role": "CUSTOMER",
    "status": "ACTIVE",
    "isEmailVerified": true
  }
}
```

Ghi chú:

- Email/password sai trả lỗi `401`.
- User `BANNED` hoặc `INACTIVE` trả lỗi `403`.
- Email chưa verify trả lỗi `403`.
- Token được ký bằng `ACCESS_TOKEN_SECRET` hoặc `JWT_SECRET`.

### POST `/auth/forgot-password`

Gửi OTP reset password.

Request body:

```json
{
  "email": "test@example.com"
}
```

Response:

```json
{
  "message": "If the email exists, a reset OTP has been sent"
}
```

Ghi chú:

- Nếu email không tồn tại, service return im lặng để tránh lộ thông tin tài khoản.

### POST `/auth/reset-password`

Đặt lại mật khẩu bằng OTP.

Request body:

```json
{
  "email": "test@example.com",
  "otp": "123456",
  "newPassword": "NewPassword123"
}
```

Response thành công:

```json
{
  "message": "Password reset successfully"
}
```

Ghi chú:

- `newPassword` phải tối thiểu 8 ký tự.
- OTP đúng và chưa hết hạn thì password mới được hash và lưu.
- Sau khi reset thành công, các field OTP reset được xóa.

### POST `/auth/change-password`

Đổi mật khẩu khi đã đăng nhập.

Header:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

Request body:

```json
{
  "currentPassword": "Password123",
  "newPassword": "NewPassword123"
}
```

Response thành công:

```json
{
  "message": "Password changed successfully"
}
```

Ghi chú:

- Cần token hợp lệ.
- Mật khẩu hiện tại sai trả lỗi `400`.
- User không tồn tại trả lỗi `404`.

### POST `/auth/logout`

Logout.

Response:

```json
{
  "message": "Logout successful"
}
```

Ghi chú:

- Controller hiện clear cookie `token`.
- Login hiện trả token trong JSON, chưa set cookie, nên phía client cần tự xóa token nếu đang lưu local/session storage.

### GET `/auth/me`

Lấy thông tin user hiện tại.

Header:

```http
Authorization: Bearer <token>
```

Response:

```json
{
  "user": {
    "_id": "user-id",
    "email": "test@example.com",
    "fullName": "Test User",
    "phone": "0900000000",
    "avatar": null,
    "role": "CUSTOMER",
    "status": "ACTIVE",
    "isEmailVerified": true,
    "createdAt": "date",
    "updatedAt": "date"
  }
}
```

Ghi chú:

- Service loại bỏ `passwordHash`, `registerOtp`, `resetPasswordOtp`.

## 9. Route profile chưa mount

File `src/routes/user.routes.ts` có:

- `GET /me`
- `PUT /profile`

Hai route này dùng `authMiddleware` và controller `user.controller.ts`. Tuy nhiên trong `src/app.ts`, dòng mount `userRoutes` đang bị comment, nên API profile chưa hoạt động từ Express app hiện tại.

## 10. Validation

File: `src/validations/auth.validation.ts`

Các rule chính:

- Email dùng `z.email()`, trim và lowercase.
- Password đăng ký/reset/change phải tối thiểu 8 ký tự.
- OTP phải đúng 6 ký tự.
- `fullName` tối thiểu 2 ký tự.
- `phone` optional.

Middleware `validate` nhận schema Zod và chặn request không hợp lệ trước khi vào controller.

## 11. Authentication middleware

File: `src/middlewares/auth.middleware.ts`

Luồng xử lý:

- Đọc header `Authorization`.
- Chỉ chấp nhận dạng `Bearer <token>`.
- Verify token bằng `ACCESS_TOKEN_SECRET` hoặc `JWT_SECRET`.
- Gán decoded token vào `req.user`.
- Nếu thiếu token hoặc token sai/hết hạn thì trả `401`.

JWT payload hiện có:

- `id`
- `email`
- `role`

## 12. Postman collection

File: `postman/handigo-auth.postman_collection.json`

Tên collection: `Handigo Auth`

Mô tả: auth module endpoints for register/login/password flows.

Biến collection:

- `baseUrl`: `http://localhost:5000`
- `email`: `test@example.com`
- `password`: `Password123`
- `newPassword`: `NewPassword123`
- `otp`: `123456`
- `token`: rỗng ban đầu, được set sau login.

### Case 1: Register

Method: `POST`

URL: `{{baseUrl}}/auth/register`

Body:

```json
{
  "email": "{{email}}",
  "password": "{{password}}",
  "fullName": "Test User",
  "phone": "0900000000"
}
```

Mục đích: tạo user hoặc cập nhật user chưa verify, gửi OTP đăng ký qua email.

### Case 2: Verify Register OTP

Method: `POST`

URL: `{{baseUrl}}/auth/verify-register-otp`

Body:

```json
{
  "email": "{{email}}",
  "otp": "{{otp}}"
}
```

Mục đích: xác thực email sau đăng ký.

Lưu ý: OTP trong collection đang là `123456`. Khi test thật phải thay bằng OTP nhận từ email.

### Case 3: Resend Register OTP

Method: `POST`

URL: `{{baseUrl}}/auth/resend-register-otp`

Body:

```json
{
  "email": "{{email}}"
}
```

Mục đích: gửi lại OTP cho tài khoản chưa verify.

### Case 4: Login

Method: `POST`

URL: `{{baseUrl}}/auth/login`

Body:

```json
{
  "email": "{{email}}",
  "password": "{{password}}"
}
```

Mục đích: đăng nhập và nhận token.

Test script trong Postman:

```javascript
const body = pm.response.json();
if (body.token) {
  pm.collectionVariables.set('token', body.token);
}
```

Script này lưu token sau login vào biến `token` để các request cần auth dùng lại.

### Case 5: Me

Method: `GET`

URL: `{{baseUrl}}/auth/me`

Auth: Bearer token `{{token}}`

Mục đích: kiểm tra token và lấy thông tin user hiện tại.

### Case 6: Forgot Password

Method: `POST`

URL: `{{baseUrl}}/auth/forgot-password`

Body:

```json
{
  "email": "{{email}}"
}
```

Mục đích: gửi OTP reset password.

### Case 7: Reset Password

Method: `POST`

URL: `{{baseUrl}}/auth/reset-password`

Body:

```json
{
  "email": "{{email}}",
  "otp": "{{otp}}",
  "newPassword": "{{newPassword}}"
}
```

Mục đích: đặt lại password bằng OTP.

### Case 8: Change Password

Method: `POST`

URL: `{{baseUrl}}/auth/change-password`

Auth: Bearer token `{{token}}`

Body:

```json
{
  "currentPassword": "{{password}}",
  "newPassword": "{{newPassword}}"
}
```

Mục đích: đổi password khi đã đăng nhập.

Lưu ý: sau khi đổi password thành công, biến `password` trong Postman nên được cập nhật thành giá trị mới nếu muốn login lại.

### Case 9: Logout

Method: `POST`

URL: `{{baseUrl}}/auth/logout`

Mục đích: gọi endpoint logout.

## 13. Chức năng đã hoàn thành ở backend

- Server Express chạy được bằng TypeScript.
- Kết nối MongoDB.
- Model User.
- Đăng ký tài khoản customer.
- Gửi OTP đăng ký.
- Verify OTP đăng ký.
- Gửi lại OTP.
- Login trả JWT token.
- Middleware auth bằng Bearer token.
- Lấy current user.
- Forgot password gửi OTP.
- Reset password bằng OTP.
- Change password.
- Logout.
- Validate input auth bằng Zod.
- Postman collection cho auth flow.

## 14. Phần đã chuẩn bị nhưng chưa hoàn thiện

- Route profile có code nhưng chưa mount.
- Config Cloudinary và middleware upload đã có, chưa thấy flow user-facing hoàn chỉnh.
- Config PayOS đã có, chưa thấy route thanh toán đang mount.
- Trong `app.ts` có nhiều route dự kiến đang comment: payments, requests, platform settings, promotions, analytics, users, addresses, provider requests, providers, admin, services, categories, feedback, withdraw, finance, chat, AI.

## 15. Việc nên làm tiếp

- Mount và hoàn thiện route `/users`.
- Thêm module category/service.
- Thêm module service request/booking.
- Thêm provider workflow.
- Thêm admin APIs.
- Thêm payment flow bằng PayOS.
- Thêm automated tests thay vì chỉ test thủ công bằng Postman.
- Chuẩn hóa format response và error.
- Bổ sung refresh token nếu cần phiên đăng nhập dài hơn.
