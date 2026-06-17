# Handigo - Thông tin tổng quan dự án

## 1. Giới thiệu dự án

Handigo là nền tảng kết nối khách hàng với thợ và các đơn vị cung cấp dịch vụ tại nhà. Mục tiêu của dự án là giúp khách hàng tìm kiếm, đặt lịch và quản lý các dịch vụ sửa chữa/bảo trì trong gia đình một cách nhanh chóng, minh bạch và đáng tin cậy.

Dự án hướng tới các nhóm dịch vụ như điện, nước, điện lạnh, vệ sinh, thiết bị gia dụng, internet/wifi, camera an ninh và sơn sửa nhà.

Tên thương hiệu chính thức của dự án là **Handigo**.

## 2. Bài toán sản phẩm

Khách hàng thường gặp khó khăn khi cần tìm thợ uy tín, biết rõ thông tin dịch vụ, liên hệ nhanh, theo dõi quá trình xử lý và đánh giá chất lượng sau khi hoàn thành. Ở chiều ngược lại, thợ hoặc đối tác cung cấp dịch vụ cần một kênh nhận việc ổn định, quản lý hồ sơ, xây dựng uy tín và tiếp cận nhiều khách hàng hơn.

Handigo giải quyết bài toán này bằng cách đóng vai trò là nền tảng trung gian giữa khách hàng, thợ/đối tác và admin vận hành hệ thống.

## 3. Nhóm người dùng chính

- **Customer**: khách hàng có nhu cầu đặt dịch vụ tại nhà.
- **Provider**: thợ hoặc đối tác cung cấp dịch vụ.
- **Admin**: người quản trị hệ thống, quản lý người dùng, dịch vụ, yêu cầu đặt dịch vụ và các vấn đề vận hành.

## 4. Phạm vi dịch vụ dự kiến

- Sửa điện, lắp đặt và xử lý sự cố điện.
- Sửa nước, rò rỉ, thông tắc đường ống.
- Điện lạnh: vệ sinh, sửa chữa máy lạnh, nạp gas.
- Vệ sinh nhà cửa, sofa, thảm.
- Sửa chữa thiết bị gia dụng như tủ lạnh, máy giặt, lò vi sóng.
- Internet/Wifi, camera an ninh.
- Sơn sửa nhà.

## 5. Cấu trúc repository

Repo hiện tại gồm hai ứng dụng chính:

- `handigo-backend`: backend Node.js/Express viết bằng TypeScript, kết nối MongoDB bằng Mongoose.
- `handigo-web`: frontend web React/Vite viết bằng TypeScript, sử dụng React Router và Tailwind CSS.

File tài liệu chi tiết:

- `HANDIGO_PROJECT_INFO.md`: tổng quan toàn dự án.
- `handigo-backend/BACKEND_INFO.md`: thông tin backend, API, chức năng đã làm và Postman cases.
- `handigo-web/FRONTEND_WEB_INFO.md`: thông tin frontend web, màn hình, route và trạng thái tích hợp API.

Ba file tài liệu này đã được thêm vào `.gitignore` để không bị push lên Git.

## 6. Công nghệ chính

Backend:

- Node.js, Express 5.
- TypeScript.
- MongoDB, Mongoose.
- JWT authentication.
- Bcrypt hash password.
- Zod validation.
- Nodemailer gửi OTP qua email.
- Multer, Cloudinary cho hướng upload ảnh.
- PayOS config cho hướng thanh toán sau này.

Frontend web:

- React 19.
- Vite.
- TypeScript.
- React Router DOM.
- Tailwind CSS.
- ESLint.

## 7. Chức năng đã làm

Backend đã làm:

- Khởi tạo server Express.
- Kết nối MongoDB.
- Cấu hình CORS, cookie parser, JSON parser, URL encoded parser.
- Logging request cơ bản.
- Error handler cho JSON sai format và lỗi runtime.
- Model `User` với role `CUSTOMER`, `PROVIDER`, `ADMIN`.
- Đăng ký tài khoản bằng email/password.
- Gửi OTP đăng ký qua email.
- Xác thực OTP đăng ký.
- Gửi lại OTP đăng ký.
- Đăng nhập và trả về JWT token.
- Lấy thông tin user hiện tại qua Bearer token.
- Quên mật khẩu và gửi OTP reset password.
- Reset password bằng OTP.
- Đổi mật khẩu khi đã đăng nhập.
- Logout trả message và clear cookie `token`.
- Postman collection cho module auth.

Frontend đã làm:

- Route `/` cho landing page.
- Route `/signin` cho trang đăng nhập.
- Landing page giới thiệu Handigo, danh mục dịch vụ, danh sách thợ mẫu, lợi ích, thống kê, đánh giá khách hàng và footer.
- Trang đăng nhập dạng UI tĩnh với form email/số điện thoại, mật khẩu, remember me, forgot password và nút social login.
- Đổi các text thương hiệu cũ `FixNow` sang `Handigo`.

## 8. API hiện có

Base URL khi chạy local: `http://localhost:5000`

Các API đã mount trong `src/app.ts`:

- `POST /auth/register`
- `POST /auth/verify-register-otp`
- `POST /auth/resend-register-otp`
- `POST /auth/login`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/change-password`
- `POST /auth/logout`
- `GET /auth/me`

Route user profile có file riêng trong backend nhưng chưa được mount trong `app.ts`, nên hiện chưa được tính là API đang hoạt động chính thức.

## 9. Postman test cases hiện có

Collection: `handigo-backend/postman/handigo-auth.postman_collection.json`

Collection hiện có các case:

- Register.
- Verify Register OTP.
- Resend Register OTP.
- Login.
- Me.
- Forgot Password.
- Reset Password.
- Change Password.
- Logout.

Biến Postman đang có:

- `baseUrl`: `http://localhost:5000`
- `email`: `test@example.com`
- `password`: `Password123`
- `newPassword`: `NewPassword123`
- `otp`: `123456`
- `token`: lưu token sau login.

Case `Login` có script lưu `body.token` vào collection variable `token` để các case cần Bearer token như `Me` và `Change Password` sử dụng lại.

## 10. Trạng thái tích hợp giữa frontend và backend

Frontend hiện tại chưa gọi API backend thật. Các form và nút trên web đang ở mức giao diện tĩnh. Backend auth đã có API nhưng chưa được nối vào form đăng nhập, đăng ký, xác thực OTP hay reset password trên frontend.

## 11. Các chức năng dự kiến phát triển tiếp

- Đăng ký và đăng nhập từ frontend gọi API thật.
- Màn hình verify OTP.
- Màn hình forgot password/reset password.
- Quản lý hồ sơ khách hàng.
- Quản lý hồ sơ provider/thợ.
- Quản lý danh mục dịch vụ và gói dịch vụ.
- Tạo yêu cầu đặt dịch vụ tại nhà.
- Provider nhận/từ chối/hoàn thành công việc.
- Thanh toán.
- Đánh giá, phản hồi, khiếu nại.
- Chat giữa khách hàng và thợ.
- Admin dashboard.
- Theo dõi trạng thái công việc theo thời gian thực.
