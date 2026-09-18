# Kiểm thử trình duyệt Handigo

Bộ test chạy giao diện React thật trên Chromium và mô phỏng API bằng Playwright.
Không cần chạy backend, MongoDB, tài khoản thật hoặc thanh toán thật.
Mỗi test có browser context và trạng thái API riêng để tránh phụ thuộc thứ tự chạy.

## Chạy test

Trong thư mục `handigo-web`:

```powershell
npx playwright install chromium
npm run test:e2e -- --workers=2
npm run test:e2e:ui
npm run test:e2e:report
```

Chạy một nhóm:

```powershell
npm run test:e2e -- tests/e2e/login.spec.ts
npm run test:e2e -- tests/e2e/authorization.spec.ts
npm run test:e2e -- tests/e2e/booking.spec.ts
```

Cấu hình hiện có tự mở Vite tại `https://localhost:5173`, hoặc dùng lại server đang chạy.
Hai thiết lập `ignoreHTTPSErrors` phục vụ chứng chỉ tự ký của môi trường local.
Khi cổng 5173 đang được ứng dụng khác dùng, dừng ứng dụng đó trước khi chạy.

## Phạm vi

| File | Tình huống |
| --- | --- |
| `login.spec.ts` | Hiển thị form, hiện/ẩn mật khẩu, dữ liệu thiếu/email sai, API từ chối, CUSTOMER ghi nhớ hoặc không ghi nhớ, khôi phục phiên, chuyển trang quên mật khẩu/đăng ký, đăng nhập ADMIN/PROVIDER |
| `authorization.spec.ts` | Chặn khách chưa đăng nhập, ma trận chuyển hướng sai role, cho ADMIN/PROVIDER vào trang đúng quyền, chặn provider chưa duyệt, phiên hết hiệu lực |
| `booking.spec.ts` | Chưa chọn dịch vụ, mô tả quá ngắn, không có chuyên gia, tạo đơn tiền mặt thành công và xuất hiện trong lịch sử, API tạo đơn thất bại |

Luồng chính được chọn: dịch vụ giá cố định → địa chỉ mặc định → đặt lịch ngay → mô tả → tiền mặt → thành công → lịch sử.
Test kiểm tra cả payload tạo đơn, phương thức thanh toán và mã đơn trong liên kết chi tiết.
Lịch sử mô phỏng chỉ có đơn sau khi API tạo đơn thành công.

## Dữ liệu và giới hạn

`fixtures/handigo.ts` chứa dữ liệu giả có type theo frontend và API mô phỏng.
Chỉ chặn pathname bắt đầu bằng `/api/`; không chặn file nguồn `/src/api/` của Vite.
Request `/socket.io/` bị hủy. API ngoài phạm vi nhận 503 và không được chuyển tới backend thật.
Các tiện ích ngoài phạm vi có thể hiển thị trạng thái lỗi; bộ test không xác minh dashboard, chat, thông báo hay số dư ví.

Đây là kiểm thử hành vi frontend với API mô phỏng, **không chứng minh backend xác thực hoặc phân quyền đúng**.
Chưa bao phủ OAuth, OTP, PayOS, ví, upload ảnh, đặt định kỳ, toàn bộ vòng đời xử lý đơn hoặc các trình duyệt khác.
Để kiểm thử xuyên suốt cần môi trường backend và cơ sở dữ liệu kiểm thử riêng; không bỏ cơ chế chặn API để chạy vào dữ liệu thật.

## Kiểm tra mã test

```powershell
npx eslint tests/e2e playwright.config.ts
npx tsc -p tests/e2e/tsconfig.json
```

TypeScript của bộ test được kiểm tra riêng; không thay đổi cấu hình build ứng dụng.
Khi test thất bại, mở báo cáo HTML để xem ảnh, video và trace. Không dùng thời gian chờ cố định để che lỗi.

## Vấn đề ứng dụng quan sát được

Ở bước địa chỉ, sau khi danh sách chuyên gia đã tải, bấm lại địa chỉ đang được chọn có thể làm nút tiếp tục không chuyển trang.
`handleSelectAddress` đặt `providerAvailability` về `idle`, nhưng `addressId` không đổi nên effect tải chuyên gia không chạy lại.
Nhánh đặt lịch ngay cũng chưa hiển thị `formErrors.preferredProviderId`.
Luồng thành công hiện dùng địa chỉ mặc định được ứng dụng tự chọn; chưa sửa code nghiệp vụ trong công việc thêm test này.

Kiểm tra dependency ngày 18/09/2026: `npm audit --audit-level=high` báo 9 lỗ hổng (7 cao, 2 trung bình) trong cây dependency hiện có.
Chưa nâng phiên bản hoặc chạy `npm audit fix` trong phạm vi bổ sung test.
