# Role và onboarding Provider

## Mô hình quyền

- Mỗi `User` chỉ có một `role`: `CUSTOMER`, `PROVIDER` hoặc `ADMIN`.
- Customer được đặt đơn; Provider không được đặt đơn.
- Khi hồ sơ Become Provider của Customer được duyệt, hệ thống thay role thành `PROVIDER` và giữ nguyên dữ liệu lịch sử theo `userId`.

## Đăng ký Provider trực tiếp

Sau khi OTP được xác thực, tài khoản nhận role `PROVIDER` và trạng thái `PROFILE_INCOMPLETE`. `providerOnboardingStep` lưu bước hồ sơ cần tiếp tục.

Các trạng thái onboarding:

- `PROFILE_INCOMPLETE`: chưa hoàn thành hồ sơ.
- `PENDING_REVIEW`: đã gửi và đang chờ Admin xét duyệt.
- `REJECTED`: bị từ chối, có thể chỉnh sửa và gửi lại.
- `APPROVED`: đã được duyệt và được phép dùng Provider Dashboard.

Provider chưa được duyệt không được nhận assignment hoặc xử lý công việc. Backend kiểm tra cả trạng thái onboarding và `Provider.verified` tại các API nghiệp vụ quan trọng.

## Migration dữ liệu cũ

Chạy trong `handigo-backend` sau khi sao lưu và kiểm tra dữ liệu môi trường đích:

```powershell
npm run migrate:single-user-role
```

Script idempotent chuyển mảng `roles` cũ sang `role` đơn, ưu tiên `ADMIN`, sau đó `PROVIDER`, rồi `CUSTOMER`; đồng thời backfill trạng thái và bước onboarding dựa trên Provider Profile và Provider Application hiện có.
