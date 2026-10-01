# Handigo App

Skeleton Flutter cho ứng dụng Handigo, dành cho CUSTOMER và PROVIDER.

Thư mục này chỉ chứa mã Flutter, cấu hình Android/iOS, tài nguyên và lớp gọi
API. Backend được tái sử dụng từ `../handigo-backend`.

## Chạy local

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5000
```

Đổi `API_BASE_URL` theo thiết bị đang chạy. Không đưa secret backend vào app.

## Cấu trúc

- `lib/app`: theme, routing và provider cấp ứng dụng.
- `lib/core`: cấu hình, network, lưu trữ bảo mật và tiện ích dùng chung.
- `lib/features`: module theo nghiệp vụ (`auth`, `services`, `orders`, ...).
- `lib/shared`: widget và theme dùng lại.
- `docs/backend-contract.md`: contract backend được app tái sử dụng.

Các thư mục mở rộng có `.gitkeep` để không bị mất khi commit lên GitHub.
