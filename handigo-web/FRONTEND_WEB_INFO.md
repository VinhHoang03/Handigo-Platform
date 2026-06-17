# Handigo Web - Thông tin chi tiết frontend

## 1. Tổng quan

Frontend web của Handigo là ứng dụng React/Vite viết bằng TypeScript. Giao diện hiện tại tập trung vào trang giới thiệu dịch vụ tại nhà và trang đăng nhập. Frontend chưa kết nối API backend thật, nhưng đã có nền tảng route và UI để phát triển tiếp các flow auth và booking.

Thư mục frontend: `handigo-web`

## 2. Công nghệ sử dụng

- **React 19**: xây dựng giao diện.
- **Vite**: dev server và build tool.
- **TypeScript**: kiểm tra kiểu dữ liệu.
- **React Router DOM**: điều hướng client-side.
- **Tailwind CSS**: styling.
- **ESLint**: kiểm tra code style/lỗi tĩnh.
- **Lucide React**: dependency icon đã có trong package, hiện chưa dùng rõ trong UI chính.

## 3. Script

```bash
npm run dev
```

Chạy frontend bằng Vite.

```bash
npm run build
```

Build production bằng TypeScript build và Vite build.

```bash
npm run lint
```

Chạy ESLint.

```bash
npm run preview
```

Preview bản build.

## 4. Cách chạy local

```bash
cd handigo-web
npm install
npm run dev
```

Vite thường chạy ở `http://localhost:5173` nếu port còn trống.

## 5. Cấu trúc thư mục

- `src/main.tsx`: render React app vào DOM.
- `src/App.tsx`: khai báo router.
- `src/pages/HomePage.tsx`: trang chủ/landing page.
- `src/pages/SignInPage.tsx`: trang đăng nhập.
- `src/components/HomeComponents.tsx`: component tái sử dụng cho trang chủ.
- `src/utils/facebookSdk.ts`: tiện ích liên quan Facebook SDK.
- `src/assets/logo.png`: logo.
- `src/assets/hero.png`: asset hero hiện có.
- `src/index.css`: global CSS.
- `src/App.css`: CSS app.
- `tailwind.config.js`: cấu hình theme màu, spacing, font, radius.
- `vite.config.ts`: cấu hình Vite.
- `eslint.config.js`: cấu hình ESLint.

## 6. Routes hiện tại

File: `src/App.tsx`

- `/`: render `HomePage`.
- `/signin`: render `SignInPage`.

Chưa có route cho:

- Đăng ký.
- Verify OTP.
- Forgot password.
- Reset password.
- Customer dashboard.
- Provider dashboard.
- Admin dashboard.
- Booking/service request.

## 7. Trang HomePage

File: `src/pages/HomePage.tsx`

Mục đích: giới thiệu nền tảng Handigo và các nhóm dịch vụ tại nhà.

Các phần giao diện:

- Navigation cố định phía trên, đổi shadow khi scroll.
- Logo và tên thương hiệu Handigo.
- Menu: Trang chủ, Dịch vụ, Trở thành đối tác, Về chúng tôi, Hỗ trợ.
- Link đăng nhập tới `/signin`.
- Hero section giới thiệu dịch vụ tại nhà.
- Form tìm kiếm dịch vụ và vị trí ở mức UI.
- Avatar/social proof và số lượng việc hoàn thành.
- Danh mục dịch vụ.
- Danh sách thợ chuyên nghiệp đang online.
- Feature cards: tracking, verified partners, secure payment, support.
- Stats section.
- Testimonials.
- Footer với link dịch vụ, công ty, hỗ trợ và tải ứng dụng.

Danh mục dịch vụ đang hiển thị:

- Sửa điện.
- Sửa nước.
- Máy lạnh.
- Vệ sinh.
- Gia dụng.
- Internet/Wifi.
- Camera.
- Sơn sửa nhà.

Trạng thái hiện tại:

- Dữ liệu đang hard-code trong component.
- Chưa gọi API lấy category/provider.
- Nút tìm kiếm và đặt ngay chưa có handler nghiệp vụ.
- Một số text tiếng Việt trong file nguồn đang bị lỗi encoding/mojibake và nên sửa lại sau.

## 8. Component HomeComponents

File: `src/components/HomeComponents.tsx`

Các component hiện có:

- `CategoryCard`: card danh mục dịch vụ.
- `ProviderCard`: card thợ/provider.
- `FeatureCard`: card tính năng/lợi ích.
- `StatItem`: thống kê.
- `TestimonialCard`: đánh giá khách hàng.
- `SocialLink`: link mạng xã hội.
- `FooterColumn`: cột link footer.
- `AppBadge`: badge tải app.

Các component này chủ yếu nhận props đơn giản và render UI tĩnh.

## 9. Trang SignInPage

File: `src/pages/SignInPage.tsx`

Mục đích: giao diện đăng nhập cho người dùng.

Các phần giao diện:

- Panel thương hiệu Handigo ở desktop.
- Logo Handigo.
- Hero/image minh họa.
- Form đăng nhập gồm email/số điện thoại và mật khẩu.
- Nút hiển thị mật khẩu ở mức UI.
- Checkbox ghi nhớ.
- Link quên mật khẩu.
- Nút đăng nhập.
- Divider "Hoặc".
- Nút Google/Facebook ở mức UI.
- Link đăng ký.
- Link Trợ giúp, Điều khoản, Bảo mật.

Trạng thái hiện tại:

- Form chưa có state React.
- Chưa validate ở frontend.
- Chưa gọi `POST /auth/login`.
- Chưa lưu token.
- Chưa chuyển hướng sau khi login.
- Chưa có xử lý Google/Facebook thật.

## 10. API backend cần tích hợp

Backend hiện đã có các API auth sau:

- `POST /auth/register`
- `POST /auth/verify-register-otp`
- `POST /auth/resend-register-otp`
- `POST /auth/login`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/change-password`
- `POST /auth/logout`
- `GET /auth/me`

Frontend hiện chưa có API client. Khi tích hợp nên tạo một lớp client riêng, ví dụ:

- `src/api/http.ts`
- `src/api/authApi.ts`
- `src/types/auth.ts`

Các flow nên tích hợp trước:

- Login từ `SignInPage` gọi `POST /auth/login`.
- Lưu token vào state/storage phù hợp.
- Gọi `GET /auth/me` để kiểm tra phiên đăng nhập.
- Logout gọi `POST /auth/logout` và xóa token ở client.
- Register/verify OTP/forgot/reset password bằng các màn hình mới.

## 11. Chức năng đã hoàn thành ở frontend

- Cấu hình React/Vite/TypeScript.
- Cấu hình React Router.
- Cấu hình Tailwind theme.
- Trang chủ responsive ở mức cơ bản.
- Trang đăng nhập UI.
- Component hóa các card chính của landing page.
- Đổi thương hiệu hiển thị từ FixNow sang Handigo.

## 12. Chức năng chưa hoàn thành

- Chưa có kết nối API.
- Chưa có auth state.
- Chưa có protected routes.
- Chưa có màn hình đăng ký.
- Chưa có màn hình OTP.
- Chưa có forgot/reset password UI hoàn chỉnh.
- Chưa có dashboard theo role.
- Chưa có booking/service request.
- Chưa có quản lý provider.
- Chưa có quản lý admin.
- Chưa có test frontend.

## 13. Gợi ý test thủ công frontend

Các case nên kiểm tra hiện tại:

- Mở `/` hiển thị landing page.
- Scroll trang chủ và kiểm tra navbar đổi trạng thái.
- Bấm Đăng nhập từ navbar chuyển tới `/signin`.
- Mở `/signin` hiển thị form đăng nhập.
- Kiểm tra responsive desktop/mobile cho HomePage và SignInPage.
- Kiểm tra text thương hiệu hiển thị là Handigo.

Sau khi tích hợp API, cần bổ sung case:

- Login thành công với email/password đã verify.
- Login thất bại khi sai password.
- Login thất bại khi email chưa verify.
- Hiển thị lỗi từ backend.
- Lưu token sau login.
- Gọi `/auth/me` thành công với token.
- Logout xóa token và chuyển về trang đăng nhập.

## 14. Vấn đề cần lưu ý

- Một số nội dung tiếng Việt trong source hiện bị lỗi mã hóa ký tự. Nên sửa toàn bộ text UI sang UTF-8 chuẩn để tránh hiển thị sai.
- `HomePage` đang hard-code nhiều dữ liệu. Khi backend có category/provider API, nên tách dữ liệu ra API hoặc constants.
- Nút social login đang là UI, chưa có logic OAuth/Facebook SDK hoàn chỉnh.
- Cần thống nhất cách lưu token: localStorage, sessionStorage, cookie HTTP-only hoặc state manager tùy yêu cầu bảo mật.
