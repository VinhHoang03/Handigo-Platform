# FixNow Frontend - Giao diện đã được code theo Figma

## 🎨 Các trang đã được code

### 1. **Đăng Nhập (Login Page)**
- Giao diện bên trái có hình nền gradient tím
- Form đăng nhập với email/điện thoại và mật khẩu
- Nút "Ghi nhớ tôi" và "Quên mật khẩu?"
- Nút đăng nhập với OAuth (Google, Facebook)
- Link chuyển sang trang đăng ký

### 2. **Đăng Ký (Register Page)**
- Lựa chọn vai trò: **Khách hàng** hoặc **Thợ dịch vụ**
- Form nhập: Họ tên, Email, Mật khẩu, Xác nhận mật khẩu
- Checkbox chấp nhận điều khoản
- OAuth buttons

### 3. **Xác Nhận OTP (Verify OTP Page)**
- Nhập mã OTP 6 ký tự
- Timer tự động đếm ngược
- Nút "Gửi lại mã OTP"

### 4. **Quên Mật Khẩu (Forgot Password)**
- Form nhập email
- Sau khi submit thành công → hiển thị success message

### 5. **Đặt Lại Mật Khẩu (Reset Password)**
- 3 bước: Email → OTP → Mật khẩu mới
- Navigation giữa các bước

## 🔧 Cách cài đặt

### 1. Cài dependencies

```bash
cd handigo-web
npm install
```

### 2. Tạo `.env.local` file

```bash
# Copy từ .env.example
cp .env.example .env.local
```

### 3. Cấu hình environment variables

```env
VITE_API_BASE_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

### 4. Chạy dev server

```bash
npm run dev
```

Ứng dụng sẽ chạy tại `http://localhost:5173`

## 🔐 Kết nối API

### API Service (`src/services/authService.ts`)
- ✅ `login()` - Đăng nhập
- ✅ `register()` - Đăng ký
- ✅ `sendOtp()` - Gửi OTP
- ✅ `verifyOtp()` - Xác nhận OTP
- ✅ `forgotPassword()` - Quên mật khẩu
- ✅ `resetPassword()` - Đặt lại mật khẩu
- ✅ `oauthLogin()` - OAuth login
- ✅ `getMe()` - Lấy info người dùng
- ✅ `logout()` - Đăng xuất

### State Management (Zustand)
- `useAuthStore` - Quản lý auth state
- Hooks: `useUser()`, `useIsAuthenticated()`, `useAuthLoading()` etc.

### Axios Interceptor
- ✅ Tự động attach access token vào request
- ✅ Tự động refresh token khi hết hạn
- ✅ Xử lý 401 errors

## 🎯 Các component đã tạo

```
src/
├── types/auth.ts                              # Type definitions
├── features/auth/
│   ├── index.tsx                             # Exports
│   └── components/
│       ├── LoginForm.tsx                     # Form đăng nhập
│       ├── RegisterForm.tsx                  # Form đăng ký (có lựa chọn role)
│       ├── ForgotPasswordForm.tsx            # Form quên mật khẩu
│       ├── ResetPasswordForm.tsx             # Form đặt lại mật khẩu (3 bước)
│       ├── OtpInput.tsx                      # Component nhập OTP
│       └── OAuthButton.tsx                   # OAuth buttons
├── pages/
│   ├── LoginPage.tsx                         # Trang đăng nhập
│   ├── RegisterPage.tsx                      # Trang đăng ký
│   ├── VerifyOtpPage.tsx                     # Trang xác nhận OTP
│   ├── ForgotPasswordPage.tsx                # Trang quên mật khẩu
│   └── ResetPasswordPage.tsx                 # Trang đặt lại mật khẩu
├── store/
│   └── authStore.ts                          # Zustand auth store (đã có sẵn)
├── services/
│   └── authService.ts                        # API calls (đã có sẵn)
└── utils/
    └── tokenManager.ts                       # Token management (đã có sẵn)
```

## 🎨 Design System

### Colors (Tailwind)
- Primary: `#6b63f5` (xanh tím)
- All colors defined in `tailwind.config.js`

### Typography
- Font: Inter (configured in Tailwind)
- Responsive text sizes using Tailwind utilities

### Components
- Buttons: Teal primary, rounded corners
- Inputs: Bordered with focus ring
- Forms: With labels và validation messages

## 📱 Responsive Design

- **Desktop**: 2 cột layout (left side image + right side form)
- **Mobile/Tablet**: Full width form, image ẩn trên lg breakpoint

## 🚀 Tiếp theo

1. **Placeholder pages**:
   - `/customer/home` - Customer dashboard
   - `/worker/dashboard` - Worker dashboard
   - `/admin/dashboard` - Admin dashboard

2. **API integration**:
   - Kiểm tra resend OTP logic
   - Refresh token khi hết hạn

3. **Error handling**:
   - Global error toast/notification
   - Field-level validation messages

4. **Loading states**:
   - Skeleton loaders
   - Button loading spinners

## 📚 API Endpoints

Backend cần implement các endpoints sau:

```
POST /auth/register           - Đăng ký
POST /auth/login              - Đăng nhập
POST /auth/oauth              - OAuth login (Google, Facebook)
POST /auth/otp/send           - Gửi OTP
POST /auth/otp/verify         - Xác nhận OTP
POST /auth/forgot-password    - Gửi reset link
POST /auth/reset-password     - Đặt lại mật khẩu
POST /auth/logout             - Đăng xuất
GET  /auth/me                 - Lấy info người dùng
```

## 🔑 Environment Variables

```env
# API
VITE_API_BASE_URL=http://localhost:5000

# OAuth
VITE_GOOGLE_CLIENT_ID=your_google_client_id

# Google Maps Places Autocomplete
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# App
VITE_APP_NAME=FixNow
VITE_APP_VERSION=1.0.0
```

## 📝 Notes

- Tất cả form đều có validation
- Loading states trên buttons khi submit
- Error messages hiển thị dưới form
- Token được lưu vào localStorage
- Axios interceptor xử lý token refresh tự động
- OAuth buttons integrate Google Sign-In SDK

Mọi chi tiết giao diện đều tuân theo Figma design được cung cấp!
