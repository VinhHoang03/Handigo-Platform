# Handigo App

Skeleton Flutter cho ứng dụng Handigo, dành cho CUSTOMER và PROVIDER.

Thư mục này chứa mã Flutter, cấu hình Android/iOS/Web, tài nguyên và lớp gọi
API. Backend được tái sử dụng từ `../handigo-backend`.

## Chạy local

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5000
```

Đổi `API_BASE_URL` theo thiết bị đang chạy. Không đưa secret backend vào app.

### Hot reload khi Codex sửa code

Chạy từ thư mục gốc repository, sau khi mở emulator và chạy backend:

```powershell
node scripts/dev-app.mjs
```

Script theo dõi file Dart trong `lib`, tự gửi hot reload sau khi lưu và giữ
trạng thái app. Nhập `r`, `R` hoặc `q` rồi Enter để reload, restart hoặc dừng.
Nếu đang chạy app bằng IDE/terminal khác, dừng phiên đó trước khi dùng script
để tránh hai phiên debug trên cùng thiết bị. Lệnh không tự chạy backend.

```powershell
node scripts/dev-app.mjs --device emulator-5554 --api http://10.0.2.2:5000
node --test scripts/dev-app.test.mjs
```

Hai lệnh trên đều chạy từ root. Node.js và Flutter phải có trên PATH.
Script chỉ theo dõi `lib/**/*.dart`; chỉnh sửa cấu hình native hoặc
dependencies cần dừng app, chạy `flutter pub get` khi cần, rồi chạy lại.
Nếu chỉ muốn reload thủ công, thêm `--no-watch`.

### Debug bằng VS Code hoặc Cursor

Mở thư mục gốc repository và cài hai extension được đề xuất: Dart và Flutter.
Chọn emulator ở thanh trạng thái, vào **Run and Debug**, chọn
**Handigo App: Debug trên thiết bị đã chọn**, rồi nhấn `F5`.
Địa chỉ API mặc định là `http://10.0.2.2:5000`, có thể đổi trong hộp nhập khi chạy.

`.vscode/settings.json` bật hot reload khi lưu và theo dõi thay đổi từ công cụ
bên ngoài như Codex. Tính năng theo dõi này là tùy chọn preview của Dart Code;
nếu extension không hỗ trợ, dùng script terminal ở trên. Các task có sẵn:
lấy dependencies, phân tích Dart, chạy kiểm thử và chạy backend development.

Nếu dùng Android Studio, mở `handigo-app`, chọn emulator và chạy `lib/main.dart`
ở chế độ debug. Dùng nút **Hot Reload** hoặc **Hot Restart** của Flutter plugin;
cấu hình `.vscode` chỉ áp dụng cho VS Code/Cursor.

### OTP và khôi phục mật khẩu

OTP được gửi qua email, có hạn 10 phút theo backend; bộ đếm trên app bắt đầu từ lúc gửi yêu cầu. Nút gửi lại có thời gian chờ 60 giây. Backend vẫn quyết định mã còn hợp lệ hay không.

Luồng khôi phục gồm gửi mã qua `/auth/forgot-password`, xác thực tại `/auth/verify-reset-password-otp` với `{ email, otp }`, rồi nhập và xác nhận mật khẩu mới. Endpoint xác thực trả `{ message }` khi thành công và dùng middleware giới hạn số lần thử OTP. `/auth/reset-password` vẫn nhận `{ email, otp, newPassword }` và kiểm tra lại mã trước khi đổi mật khẩu; API cũ của web giữ nguyên.

Backend gửi thư qua Gmail bằng cấu hình `EMAIL_USER` và `EMAIL_PASSWORD` ở phía server. Phản hồi gửi mã quên mật khẩu không xác nhận email có tài khoản: email chưa tồn tại vẫn nhận phản hồi chung nhưng không có thư được gửi. Kiểm tra hộp thư rác và lỗi gửi thư phía server khi không nhận được mã. Không đưa thông tin cấu hình email hoặc mã OTP vào log/app.

Chạy bản Web trên Chrome:

```bash
flutter run -d chrome --web-hostname=localhost --web-port=8081 --dart-define=API_BASE_URL=http://localhost:5000
```

Chạy bản Web trên Edge:

```bash
flutter run -d edge --web-hostname=localhost --web-port=8081 --dart-define=API_BASE_URL=http://localhost:5000
```

Cổng `8081` đã nằm trong danh sách CORS local của backend. Cần chạy backend
ở cổng `5000` để đăng nhập và lấy dữ liệu. Nếu backend chưa chạy, app vẫn mở
màn hình đăng nhập và hiển thị lỗi kết nối. Dừng phiên Flutter cũ bằng `Ctrl+C`
trước khi chạy lại để tránh trùng cổng. Có thể mở `http://localhost:8081`
trực tiếp khi trình duyệt không tự mở đúng trang.

Nếu phiên debugger Edge bị mất kết nối sau khi hot restart, dừng phiên cũ
rồi chạy máy chủ Web và tự mở địa chỉ trên trong Edge:

```bash
flutter run -d web-server --web-hostname=localhost --web-port=8081 --dart-define=API_BASE_URL=http://localhost:5000
```

Lần khởi động debug đầu tiên cần biên dịch và tải nhiều module JavaScript.
Chờ terminal báo máy chủ đã sẵn sàng trước khi tải lại trang.

Build bản Web để triển khai:

```bash
flutter build web --release --dart-define=API_BASE_URL=https://api.example.com
```

## Cấu trúc

- `lib/app`: theme, routing và provider cấp ứng dụng.
- `lib/core`: cấu hình, network, lưu trữ bảo mật và tiện ích dùng chung.
- `lib/features`: module theo nghiệp vụ (`auth`, `services`, `orders`, ...).
- `lib/shared`: widget và theme dùng lại.
- `docs/backend-contract.md`: contract backend được app tái sử dụng.

Các thư mục mở rộng có `.gitkeep` để không bị mất khi commit lên GitHub.
