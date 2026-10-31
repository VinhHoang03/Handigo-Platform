# Xác thực khi triển khai Vercel và Render

Access token chỉ lưu trong bộ nhớ. Khi tải lại trang, ứng dụng gọi API làm mới token bằng cookie `refreshToken`, sau đó lấy người dùng qua `/auth/me`.

## Cấu hình Vercel

Đặt các biến sau trong phần Environment Variables của dự án Vercel:

```text
VITE_API_BASE_URL=https://handigo-platform.onrender.com
VITE_AUTH_API_BASE_URL=/api
```

Triển khai lại frontend sau khi thay đổi biến vì Vite đọc chúng lúc build. Root Directory của dự án Vercel là `handigo-web` để sử dụng `vercel.json` tại đây.

Rewrite `/api/auth/:path*` phải đứng trước rewrite về `index.html`. Nó chuyển tiếp tới `/auth/:path*` trên Render. Cookie xác thực không đặt `Domain`, nên khi dùng qua proxy, trình duyệt lưu cookie cho website Vercel. Các API khác và Socket.IO tiếp tục kết nối trực tiếp Render. Nếu đổi địa chỉ backend, cập nhật cả biến API và đích rewrite.

## Cấu hình Render

- `NODE_ENV=production` để cookie có `Secure` và `SameSite=None`.
- `FRONTEND_URL=https://handigo-platform-rjr3.vercel.app` hoặc thêm địa chỉ này vào `FRONTEND_URLS`.
- Cấu hình `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `JWT_EXPIRES_IN` và `REFRESH_TOKEN_EXPIRES_IN` trong Render. Giữ secret ổn định qua các lần triển khai; không đưa secret vào biến `VITE_*`.

Thay khóa ký refresh token làm các refresh token đã cấp trước đó mất hiệu lực. Sau khi đổi khóa hoặc chuyển sang proxy, cần đăng nhập lại một lần để nhận cookie mới.

## Kiểm tra sau triển khai

1. Đăng nhập, kiểm tra Network: yêu cầu phải tới `/api/auth/login` trên domain Vercel, phản hồi đặt cookie `refreshToken` có `HttpOnly`.
2. F5 tại trang cần đăng nhập: `/api/auth/refresh-token` và `/api/auth/me` phải trả 200, trang vẫn giữ đúng người dùng và vai trò.
3. Kiểm tra cả chế độ chặn cookie bên thứ ba và lựa chọn không ghi nhớ đăng nhập. Không ghi nhớ vẫn phải giữ phiên khi F5 trong cùng phiên trình duyệt.
4. Đăng xuất rồi F5: không được khôi phục lại phiên vừa đăng xuất. Không chia sẻ giá trị cookie, token hoặc secret khi báo lỗi.

Nếu Render timeout, lỗi mạng hoặc 5xx thì cần kiểm tra tình trạng backend riêng; proxy không xử lý được việc backend ngừng hoạt động.
