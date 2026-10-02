# Kế hoạch triển khai toàn bộ giao diện Handigo Flutter theo Feature-based

## 1. Mục tiêu và phạm vi

### Mục tiêu

Chuyển toàn bộ bộ giao diện Stitch hiện có thành ứng dụng Flutter theo kiến trúc feature-based, giữ đúng design system trong `DESIGN.md`, kết nối với backend Handigo hiện tại và hỗ trợ đầy đủ hai role:

- `CUSTOMER`
- `PROVIDER`

Không triển khai giao diện hoặc luồng `ADMIN` trong Flutter.

Hiện thư mục Stitch có 25 màn hình HTML:

- 12 màn hình ban đầu.
- 13 màn hình mới được bổ sung theo các mục bôi vàng trong ảnh.

Các màn hình HTML chỉ được dùng làm tài liệu visual/reference. Không nhúng HTML vào Flutter và không giữ dữ liệu hard-code trong giao diện production.

### Phạm vi CUSTOMER

Bao gồm:

- Đăng nhập.
- Đăng ký.
- Xác thực OTP đăng ký.
- Quên mật khẩu và OTP.
- Trang chủ.
- Danh mục dịch vụ.
- Chi tiết dịch vụ.
- Đặt dịch vụ.
- Xác nhận và thanh toán.
- Màn hình đặt hàng thành công.
- Danh sách lịch sử đơn hàng.
- Chi tiết đơn hàng.
- Theo dõi đơn hàng.
- Chat với provider.
- Trung tâm thông báo.
- Kho voucher.
- Sổ địa chỉ.
- Thông tin cá nhân.
- Ví Handigo.
- Đánh giá provider và dịch vụ.
- Hủy đơn, hoàn tiền và khiếu nại.
- Tài khoản và cài đặt.

### Phạm vi PROVIDER

Bao gồm:

- Đăng ký trở thành provider.
- Hồ sơ đăng ký provider.
- Upload CCCD, chứng chỉ và ảnh hồ sơ.
- Theo dõi trạng thái xét duyệt.
- Dashboard provider.
- Danh sách đơn được giao.
- Chi tiết đơn provider.
- Nhận hoặc từ chối đơn.
- Bắt đầu thực hiện đơn.
- Gửi báo giá vật tư.
- Khách hàng duyệt báo giá.
- Cập nhật thời gian dự kiến hoàn tất.
- Hoàn tất và nghiệm thu đơn.
- Lịch làm việc/lịch hẹn.
- Hồ sơ provider.
- Khu vực và dịch vụ cung cấp.
- Ví, thu nhập và rút tiền.
- Tài khoản ngân hàng.
- Đánh giá từ khách hàng.
- Thông báo đơn mới.
- Chat và hỗ trợ đơn hàng.

### Không triển khai

- Dashboard ADMIN.
- Quản trị user, voucher, service, category.
- Duyệt hồ sơ provider trên mobile.
- Báo cáo quản trị.
- Quản lý doanh thu hệ thống.
- Các route chỉ dành cho ADMIN.

## 2. Các quyết định kiến trúc chính

### Cấu trúc Feature-based

Giữ cấu trúc hiện có và mở rộng theo từng nghiệp vụ:

```text
lib/
├── app/
│   ├── app.dart
│   ├── providers/
│   ├── routing/
│   │   ├── app_router.dart
│   │   ├── auth_redirect.dart
│   │   └── route_names.dart
│   └── theme/
│       ├── app_theme.dart
│       ├── app_tokens.dart
│       └── material_symbols.dart
├── core/
│   ├── config/
│   ├── network/
│   ├── storage/
│   ├── errors/
│   ├── permissions/
│   └── utils/
├── features/
│   ├── auth/
│   ├── customer_home/
│   ├── service_catalog/
│   ├── booking/
│   ├── orders/
│   ├── tracking/
│   ├── chat/
│   ├── notifications/
│   ├── addresses/
│   ├── profile/
│   ├── wallet/
│   ├── rewards/
│   ├── feedback/
│   ├── support/
│   ├── provider_onboarding/
│   ├── provider_dashboard/
│   ├── provider_orders/
│   ├── provider_schedule/
│   ├── provider_profile/
│   └── provider_finance/
└── shared/
    ├── design_system/
    ├── widgets/
    └── layouts/
```

Mỗi feature dùng cấu trúc:

```text
feature/
├── data/
│   ├── repository.dart
│   ├── remote_source.dart
│   └── dto/
├── domain/
│   ├── model.dart
│   └── enums.dart
└── presentation/
    ├── pages/
    ├── widgets/
    └── providers/
```

Không tạo abstraction chung nếu chỉ được dùng bởi một feature. Chỉ đưa widget vào `shared` khi được dùng ở ít nhất hai feature.

### State management

Sử dụng Riverpod đã có trong `pubspec.yaml`:

- `Provider` cho dependency và repository.
- `FutureProvider`/`AsyncNotifier` cho dữ liệu tải từ API.
- `Notifier` cho form nhiều bước và state tương tác.
- `AsyncValue` để bắt buộc xử lý loading, error và empty state.
- Không tạo state management riêng hoặc thêm BLoC/Provider package khác.

### Routing

Sử dụng `go_router` đã có:

- Auth stack riêng.
- Customer shell riêng.
- Provider shell riêng.
- Redirect dựa trên session và role.
- `ADMIN` không có route mobile; tài khoản ADMIN tiếp tục bị từ chối như logic hiện tại.
- Mỗi màn hình có route có tên rõ ràng và hỗ trợ deep link cho chi tiết đơn, chat và thanh toán.

Đề xuất route chính:

```text
/auth/login
/auth/register
/auth/register/otp
/auth/forgot-password
/auth/forgot-password/otp

/customer/home
/customer/services
/customer/services/:id
/customer/bookings/new
/customer/bookings/payment
/customer/bookings/success
/customer/orders
/customer/orders/:id
/customer/orders/:id/tracking
/customer/notifications
/customer/chat/:conversationId
/customer/account
/customer/profile
/customer/addresses
/customer/wallet
/customer/rewards

/provider/apply
/provider/application
/provider/home
/provider/orders
/provider/orders/:id
/provider/orders/:id/quotation
/provider/schedule
/provider/profile
/provider/finance
/provider/bank-accounts
```

### Navigation shell

Customer:

```text
Trang chủ | Đơn hàng | Tin nhắn | Tài khoản
```

Provider:

```text
Đơn việc | Lịch hẹn | Thu nhập | Tài khoản
```

Các màn hình đặt dịch vụ, chi tiết đơn, voucher, thông báo và chat là route con, không đưa toàn bộ vào bottom navigation.

## 3. Design system Flutter

Chuyển các giá trị từ `DESIGN.md` thành token dùng chung, không rải màu và spacing trực tiếp trong widget.

### Màu sắc

Đưa vào `AppTokens`/`ThemeExtension`:

- Primary: `#3525CD`
- Secondary: `#00687A`
- Tertiary: màu accent cam/nâu.
- Background: `#FAF8FF`
- On surface: `#131B2E`
- Surface container theo các cấp độ trong `DESIGN.md`.
- Success: xanh lá.
- Warning/star: vàng.
- Error: đỏ.

### Typography

- Heading: Hanken Grotesk.
- Body/label: Inter.
- Giữ các cấp độ `headline-xl`, `headline-lg`, `headline-md`, `body-lg`, `body-md`, `label-md`, `label-sm`.
- Trên mobile dùng scale nhỏ theo `headline-lg-mobile`.

Font sẽ được đăng ký thành asset local trong Flutter để giao diện không phụ thuộc mạng runtime. Nếu font asset chưa có sẵn, cần lấy từ nguồn font hợp lệ trước khi hoàn thiện visual QA.

### Component dùng chung

Tạo các component dùng lại:

- `HandigoScaffold`.
- `HandigoAppBar`.
- `CustomerBottomNav`.
- `ProviderBottomNav`.
- `GlassCard`.
- `ServiceCard`.
- `ProviderCard`.
- `OrderStatusBadge`.
- `PriceRow`.
- `PrimaryButton`.
- `SecondaryButton`.
- `IconActionButton`.
- `SectionHeader`.
- `AppLoading`.
- `AppErrorState`.
- `AppEmptyState`.
- `BottomSheetSelector`.
- `StepIndicator`.
- `Timeline`.
- `AvatarWithStatus`.
- `RatingStars`.
- `SecureInfoBanner`.

Tất cả button tương tác phải đạt touch target tối thiểu 48px như `DESIGN.md`.

## 4. Hợp đồng dữ liệu và repository

Không thay đổi API contract backend nếu chưa có yêu cầu riêng.

### Các domain model cần bổ sung

- `ServiceCategory`.
- `ServiceDetail`.
- `ServiceOption`.
- `Address`.
- `Order`.
- `OrderStatus`.
- `OrderTimelineItem`.
- `Payment`.
- `PaymentMethod`.
- `Voucher`.
- `Notification`.
- `Conversation`.
- `ChatMessage`.
- `Wallet`.
- `WalletTransaction`.
- `BankAccount`.
- `Feedback`.
- `Provider`.
- `ProviderApplication`.
- `ProviderApplicationAsset`.
- `ProviderAssignment`.
- `OrderQuotation`.
- `QuotationItem`.
- `ProviderScheduleEntry`.

Các enum trạng thái phải map từ backend và có label tiếng Việt riêng, không hiển thị raw enum trực tiếp cho người dùng.

### Repository cần triển khai

Giữ lại và mở rộng:

- `AuthRepository`.
- `ServiceRepository`.
- `OrderRepository`.

Bổ sung:

- `CategoryRepository`.
- `BookingRepository`.
- `PaymentRepository`.
- `AddressRepository`.
- `NotificationRepository`.
- `ChatRepository`.
- `WalletRepository`.
- `VoucherRepository`.
- `FeedbackRepository`.
- `SupportRepository`.
- `ProviderApplicationRepository`.
- `ProviderRepository`.
- `ProviderAssignmentRepository`.
- `ProviderScheduleRepository`.
- `BankAccountRepository`.

### API mapping chính

#### Auth

- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/verify-register-otp`
- `POST /auth/resend-register-otp`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /auth/me`
- `POST /auth/refresh-token`
- `POST /auth/logout`

Lưu ý:

- Backend hiện yêu cầu `email` cho login.
- UI HTML ghi “số điện thoại hoặc email”, nhưng Flutter không được gửi số điện thoại vào field `email` nếu backend chưa hỗ trợ.
- Bản đầu tiên dùng email đúng theo contract hiện tại.
- OTP đăng ký và reset password hiện theo email/backend contract, không tự giả định SMS hoặc Zalo ZNS.
- Google/Apple/Zalo chỉ hiển thị khi có mobile OAuth contract hoàn chỉnh; không triển khai nút giả lập.

#### Customer services/booking

- `GET /categories/active`
- `GET /categories/active-with-services`
- `GET /services`
- `GET /services/:id`
- `GET /services/:id/options`
- `POST /orders/preview`
- `POST /orders`
- `POST /orders/attachments`
- `GET /addresses`
- `POST /addresses`
- `GET /locations/reverse-geocode`

#### Customer orders/payment

- `GET /orders`
- `GET /orders/:orderId`
- `GET /orders/:orderId/series`
- `PATCH /orders/:orderId/cancel`
- `GET /orders/:orderId/cancellation-preview`
- `PATCH /orders/:orderId/cancel-series`
- `GET /orders/:orderId/quotation`
- `POST /orders/quotations/:quotationId/confirm`
- `POST /orders/quotations/:quotationId/reject`
- `POST /payments/create`
- `GET /payments/:id`
- `GET /payments/order/:orderId`
- `POST /payments/order/:orderId/reconcile`

#### Notifications/chat

- `GET /notifications`
- `GET /notifications/unread-count`
- `PATCH /notifications/read-all`
- `PATCH /notifications/:id/read`
- `GET /chat/conversations`
- `GET /chat/orders/:orderId/conversation`
- `GET /chat/conversations/:conversationId/messages`
- Gửi, xóa và đánh dấu đã xem message theo contract hiện tại.

Socket.IO chỉ kết nối sau khi có token hợp lệ, tự cập nhật token khi refresh và disconnect khi logout.

#### Provider onboarding

- `POST /provider-applications`
- `GET /provider-applications/me`
- `GET /provider-applications`
- `GET /provider-applications/:id`
- `PATCH /provider-applications/:id`
- `PATCH /provider-applications/:id/resubmit`
- Upload asset qua `/provider-application-assets`.

#### Provider operations

- `GET /dashboard/overview`
- `PATCH /dashboard/provider/availability`
- `GET /orders/provider/recent`
- `GET /orders/provider`
- `GET /orders/assignments/pending`
- `POST /orders/assignments/:assignmentId/accept`
- `POST /orders/assignments/:assignmentId/reject`
- `GET /orders/:orderId`
- `POST /orders/:orderId/start`
- `PATCH /orders/:orderId/expected-end`
- `POST /orders/:orderId/quotations`
- `POST /orders/:orderId/complete`
- `GET /providers/me`
- `PATCH /providers/me`
- `GET /feedback/provider/me`
- `GET /wallets/me`
- `GET /withdrawals/me`
- `POST /withdrawals`
- CRUD tài khoản ngân hàng qua `/bank-accounts`.

## 5. Các giai đoạn triển khai

## Giai đoạn 0 — Chuẩn hóa yêu cầu, contract và design foundation

### Công việc

- Chốt danh sách 25 màn HTML và nhóm theo feature.
- Đọc `DESIGN.md` và chuyển color, typography, radius, spacing thành token Flutter.
- Kiểm tra response thực tế của các API từ backend/web.
- Chuẩn hóa model và enum trước khi dựng UI.
- Xác định các dữ liệu demo trong HTML cần thay bằng API.
- Đăng ký font và icon asset.
- Xác định dependency native cần thiết:
  - `image_picker`.
  - `geolocator`.
  - `socket_io_client`.
  - `local_auth`.
  - `url_launcher`.
  - Deep link package nếu luồng PayOS yêu cầu.
- Không thêm package nếu chức năng tương ứng chưa cần trong giai đoạn đó.

### Kết quả

- Contract matrix cho từng feature.
- Design token Flutter.
- Danh sách route.
- Danh sách model/repository.
- Danh sách dependency được duyệt.
- Không có thay đổi backend.

### Điều kiện hoàn tất

- Mọi màn HTML đã được gắn vào một feature.
- Mọi API cần gọi đã có endpoint và response shape rõ ràng.
- Không còn dùng dữ liệu hard-code cho các giá trị nghiệp vụ.

## Giai đoạn 1 — Bootstrap Flutter, theme và authentication

### Màn hình

- Đăng nhập.
- Đăng ký.
- Xác thực OTP đăng ký.
- Quên mật khẩu.
- Xác nhận OTP reset password.
- Session restore.
- Session expired.

### Công việc

- Tạo `HandigoApp`.
- Bọc app bằng `ProviderScope`.
- Khởi tạo `ApiClient`, secure cookie storage và repositories.
- Kết nối `AppTheme.light`/`dark`.
- Tạo `GoRouter` và auth redirect.
- Dùng `AuthRepository` hiện có, không viết lại cơ chế refresh token.
- Xử lý form validation, loading, error và retry.
- Sau login:
  - `CUSTOMER` vào customer shell.
  - `PROVIDER` vào provider shell.
  - `ADMIN` bị từ chối bằng thông báo tiếng Việt như logic hiện tại.

### Điều kiện hoàn tất

- Người dùng có thể đăng nhập bằng email.
- Có thể đăng ký và xác thực OTP theo backend.
- Có thể reset password.
- Refresh token được lưu bảo mật.
- Khởi động lại app vẫn khôi phục được session hợp lệ.
- ADMIN không được vào mobile app.
- Không có route cần auth bị truy cập khi chưa đăng nhập.

## Giai đoạn 2 — Shared layout và Customer shell

### Màn hình

- Customer home shell.
- Bottom navigation.
- App bar, loading, error, empty state.
- Account shell.

### Công việc

- Tạo `CustomerShell`.
- Tạo bottom navigation:
  - Trang chủ.
  - Đơn hàng.
  - Tin nhắn.
  - Tài khoản.
- Tạo các shared cards và section layout.
- Dựng trang chủ khách hàng theo `trang_ch_kh_ch_h_ng_handigo_mobile`.
- Kết nối:
  - Category.
  - Featured services.
  - Featured providers.
  - Notification unread count.
- Dữ liệu rỗng phải có empty state, không để card demo xuất hiện khi API không trả dữ liệu.

### Điều kiện hoàn tất

- Trang chủ hiển thị được dữ liệu thật.
- Chuyển tab không làm mất session/state không cần thiết.
- UI không overflow ở kích thước khoảng 390x844.
- Visual giữ đúng màu, radius, spacing và typography trong `DESIGN.md`.

## Giai đoạn 3 — Customer service catalog và booking

### Màn hình

- Danh mục dịch vụ đầy đủ.
- Chi tiết dịch vụ.
- Đặt dịch vụ.
- Chọn gói và option.
- Lịch, địa chỉ và ảnh sự cố.
- Xác nhận thanh toán.
- Đặt hàng thành công.

### Công việc

- Dựng `service_catalog` từ:
  - `danh_m_c_d_ch_v_y_handigo_mobile`.
  - `chi_ti_t_d_ch_v_handigo_mobile`.
- Dùng service/options API, không hard-code giá.
- Tạo booking state riêng bằng Riverpod.
- Giữ dữ liệu khi chuyển giữa các bước.
- Gọi `/orders/preview` trước khi hiển thị tổng tiền.
- Hỗ trợ:
  - Đặt bình thường.
  - Đặt khẩn cấp.
  - Đặt theo lịch.
  - Đặt định kỳ nếu backend trả đủ dữ liệu.
- Quản lý địa chỉ trong flow đặt hàng.
- Upload tối đa số ảnh theo backend contract.
- Xác nhận giá và voucher từ backend.

### Thanh toán

- Ví Handigo.
- PayOS/bank theo response backend.
- Tiền mặt nếu order type cho phép.
- Mở `checkoutUrl` bằng cơ chế an toàn.
- Sau khi quay lại app, gọi reconcile/payment API.
- Không tự đánh dấu thanh toán thành công trên client.
- Có trạng thái success, pending, failed.

### Điều kiện hoàn tất

- Không thể tạo order nếu thiếu service, option, address hoặc payment method.
- Tổng tiền hiển thị đúng response preview/backend.
- Voucher chỉ được áp dụng qua backend.
- Tạo order thành công dẫn tới màn success hoặc payment pending.
- Payment thất bại không làm mất booking state.
- Không hiển thị thành công trước khi backend xác nhận.

## Giai đoạn 4 — Customer order lifecycle, tracking, chat và notifications

### Màn hình

- Lịch sử đơn hàng.
- Chi tiết đơn hàng.
- Theo dõi đơn.
- Chat dịch vụ.
- Trung tâm thông báo.
- Luồng hủy đơn.
- Luồng xác nhận/reject báo giá.

### Công việc

- Dựng `l_ch_s_n_h_ng_handigo_mobile`.
- Mở rộng order model từ `OrderSummary` thành `OrderDetail`.
- Dựng customer order detail theo trạng thái.
- Tách trạng thái:
  - Đã tạo.
  - Chờ thanh toán.
  - Đã thanh toán.
  - Đang điều phối.
  - Provider đang di chuyển.
  - Đang thực hiện.
  - Chờ báo giá.
  - Hoàn thành.
  - Đã hủy.
  - Hoàn tiền.
- Dùng tracking route API và polling/socket tùy khả năng backend.
- Dựng chat từ `h_i_tho_i_d_ch_v_handigo_mobile`.
- Dựng notification center từ `th_ng_b_o_handigo_mobile`.
- Hỗ trợ đánh dấu đã đọc và đọc tất cả.
- Dùng notification action URL để điều hướng tới order/chat/wallet.
- Tạo cancellation preview trước khi hủy.
- Sau khi hoàn thành đơn, hiển thị đánh giá.

### Điều kiện hoàn tất

- Danh sách đơn có filter, search, pagination.
- Chi tiết đơn phản ánh đúng payment/order/quotation status.
- Tracking không hiển thị sai provider hoặc order không thuộc user.
- Chat kiểm tra ownership qua backend và cập nhật realtime.
- Notification unread count đồng bộ với backend.
- Hủy đơn yêu cầu lý do và xử lý đúng kết quả backend.

## Giai đoạn 5 — Customer profile, wallet, voucher, feedback và support

### Màn hình

- Tài khoản và cài đặt.
- Thông tin cá nhân.
- Sổ địa chỉ.
- Ví Handigo.
- Kho voucher.
- Cài đặt bảo mật/thông báo.
- Đánh giá provider và dịch vụ.
- Khiếu nại/báo cáo sự cố.
- Trung tâm hỗ trợ.

### Công việc

- Dựng các màn hình Stitch hiện có cho account, profile, address, wallet, voucher và security.
- Bổ sung các repository còn thiếu.
- Tách cài đặt UI khỏi trạng thái notification thực tế.
- Thực hiện biometric bằng `local_auth`, chỉ bật khi thiết bị hỗ trợ.
- Quản lý địa chỉ:
  - Thêm.
  - Sửa.
  - Xóa.
  - Đặt mặc định.
  - GPS/reverse geocode.
- Wallet:
  - Số dư.
  - Lịch sử giao dịch.
  - Nạp tiền.
  - Payment return.
  - Trạng thái pending/failed.
- Voucher:
  - Available vouchers.
  - Apply/remove voucher.
  - Không tự tính discount.
- Feedback:
  - Đánh giá sau khi order hoàn tất.
  - Upload ảnh nếu backend cho phép.
  - Xem feedback của chính user.
- Support:
  - Tạo support ticket.
  - Tạo complaint/report.
  - Xem trạng thái xử lý.

### Điều kiện hoàn tất

- Không lộ dữ liệu nhạy cảm.
- User chỉ sửa tài nguyên của chính mình.
- Wallet và payment không được cập nhật số dư từ client.
- Review chỉ được tạo cho order hợp lệ.
- Mọi màn hình đều có loading, error và empty state.

## Giai đoạn 6 — Provider onboarding

### Màn hình

- Đăng ký trở thành provider.
- Hồ sơ đăng ký provider.
- Upload giấy tờ.
- Theo dõi trạng thái xét duyệt.
- Bổ sung/resubmit hồ sơ.

### Công việc

- Dựng:
  - `ng_k_tr_th_nh_i_t_c_handigo_mobile`.
  - `h_s_ng_k_i_t_c_handigo_mobile`.
- Chia onboarding thành form state nhiều bước:
  - Thông tin cá nhân.
  - Số điện thoại.
  - Khu vực hoạt động.
  - Nhóm chuyên môn.
  - Kinh nghiệm.
  - Phương tiện/dụng cụ.
  - CCCD.
  - Chứng chỉ.
- Upload asset bằng multipart tới backend.
- Hiển thị trạng thái:
  - Draft.
  - Submitted.
  - Pending.
  - Approved.
  - Rejected.
  - Need resubmit.
- Khi hồ sơ bị từ chối, hiển thị lý do và cho phép resubmit.
- Không cho provider chưa được duyệt truy cập order operation.

### Điều kiện hoàn tất

- Customer có thể bắt đầu đăng ký provider từ account.
- Draft có thể tiếp tục sau khi rời app nếu backend hỗ trợ.
- Upload thất bại không làm mất dữ liệu form.
- Provider chỉ chuyển sang provider shell khi backend xác nhận role/status hợp lệ.
- Không có logic tự approve trên client.

## Giai đoạn 7 — Provider dashboard, orders, quotation và schedule

### Màn hình

- Dashboard provider.
- Danh sách đơn được giao.
- Chi tiết đơn provider.
- Báo giá vật tư.
- Cập nhật thời gian dự kiến hoàn tất.
- Lịch làm việc/lịch hẹn.
- Provider chat và hỗ trợ.

### Công việc

- Dựng:
  - `b_ng_i_u_khi_n_th_handigo_mobile`.
  - `danh_s_ch_n_c_giao_handigo_mobile`.
  - `chi_ti_t_n_h_ng_th_handigo_mobile`.
  - `g_i_b_o_gi_v_t_t_handigo_mobile`.
  - `l_ch_l_m_vi_c_l_ch_h_n_handigo_mobile`.
- Dashboard:
  - Availability toggle.
  - Pending assignment.
  - Revenue summary.
  - Current orders.
- Assignment:
  - Accept.
  - Reject có lý do.
  - Countdown hết hạn nếu backend có thời gian.
- Order detail:
  - Thông tin customer.
  - Địa chỉ.
  - Ảnh sự cố.
  - Process timeline.
  - Start order.
  - Complete order.
  - Call/chat customer.
- Quotation:
  - Thêm/sửa/xóa vật tư.
  - Số lượng.
  - Giá.
  - Ảnh hiện trường.
  - Mô tả giải trình.
  - Gửi khách duyệt.
- Cập nhật expected end:
  - Dùng bottom sheet/dialog từ provider order detail.
  - Gọi `PATCH /orders/:orderId/expected-end`.
  - Không tạo route độc lập nếu chỉ là một action của chi tiết đơn.
- Schedule:
  - Xem theo ngày/tuần/tháng.
  - Hiển thị lịch hẹn.
  - Điều hướng tới order detail.
- Realtime:
  - Nhận assignment mới.
  - Cập nhật trạng thái order.
  - Cập nhật chat.
  - Ngắt socket khi logout hoặc mất quyền provider.

### Điều kiện hoàn tất

- Provider chưa được duyệt không thể nhận hoặc xử lý đơn.
- Accept/reject cập nhật lại danh sách và dashboard.
- Báo giá chỉ gửi được khi order ở trạng thái phù hợp.
- Customer/provider nhìn thấy cùng một quotation status.
- Không thể complete order khi chưa qua trạng thái nghiệp vụ bắt buộc.
- Lịch provider không hiển thị dữ liệu của provider khác.

## Giai đoạn 8 — Provider profile, finance, feedback và settings

### Màn hình

- Hồ sơ provider.
- Dịch vụ/chuyên môn.
- Khu vực phục vụ.
- Chứng chỉ.
- Ví provider.
- Thu nhập.
- Rút tiền.
- Tài khoản ngân hàng.
- Đánh giá khách hàng.
- Thông báo provider.
- Cài đặt và logout.

### Công việc

- Dùng provider profile API cho dữ liệu thật.
- Tách profile public và profile cá nhân.
- Quản lý certificate/asset theo quyền provider.
- Dùng wallet API để hiển thị số dư và transaction.
- Dùng withdrawal API để tạo và theo dõi yêu cầu rút tiền.
- Dùng bank account API để thêm/sửa/xóa/đặt mặc định.
- Hiển thị feedback provider.
- Reuse notification/chat infrastructure từ customer nhưng dùng role-aware route/data.
- Không tạo bản sao repository nếu response contract giống nhau; chỉ tách model khi nghiệp vụ khác thật sự.

### Điều kiện hoàn tất

- Provider xem đúng dữ liệu tài chính của mình.
- Client không tự điều chỉnh số dư.
- Tạo withdrawal có validation số tiền và bank account.
- Tài khoản ngân hàng được bảo vệ bằng ownership từ backend.
- Provider xem được đánh giá nhưng không được sửa đánh giá khách hàng.

## Giai đoạn 9 — Tích hợp, kiểm thử và visual QA

### Kiểm thử logic

- Auth:
  - Login đúng/sai.
  - Register.
  - OTP hết hạn.
  - Reset password.
  - Refresh token.
  - Logout.
  - ADMIN bị chặn.
- Customer:
  - Load home.
  - Service list/detail.
  - Booking preview.
  - Create order.
  - Apply voucher.
  - Payment pending/success/failure.
  - Order history/detail.
  - Cancel order.
  - Chat.
  - Notification read state.
  - Address ownership.
  - Feedback.
- Provider:
  - Application create/update/resubmit.
  - Upload asset.
  - Pending assignment.
  - Accept/reject.
  - Start/quotation/expected end/complete.
  - Schedule.
  - Wallet/withdrawal/bank account.
  - Provider role guard.

### Kiểm thử UI

- Android emulator.
- iOS simulator nếu môi trường hỗ trợ.
- Kích thước tham chiếu:
  - 390x844.
  - 402x874.
  - Thiết bị màn hình nhỏ hơn.
- Kiểm tra:
  - Không overflow.
  - Không bị keyboard che input.
  - Safe area.
  - Loading/error/empty state.
  - Dark mode nếu được giữ trong scope.
  - Font tiếng Việt.
  - Touch target.
  - Accessibility label.
  - Độ tương phản.

### Visual QA

So sánh từng màn Flutter với `screen.png` tương ứng:

- Spacing.
- Radius.
- Typography.
- Màu nền/surface.
- Card elevation.
- Bottom navigation.
- Icon.
- Trạng thái active/disabled.
- Empty/loading/error state.

### Validation kỹ thuật

Chạy trong thư mục `handigo-app`:

```text
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
```

Nếu bổ sung native package, kiểm tra riêng Android/iOS build và permission manifest.

## 6. Tiêu chí nghiệm thu toàn bộ

Ứng dụng được xem là hoàn tất khi:

- Không còn `Hello World` trong `main.dart`.
- Customer đăng nhập và hoàn thành được luồng:

  ```text
  Đăng nhập
  → Xem dịch vụ
  → Đặt dịch vụ
  → Thanh toán
  → Theo dõi
  → Chat
  → Hoàn thành
  → Đánh giá
  ```

- Customer quản lý được:
  - Đơn hàng.
  - Địa chỉ.
  - Voucher.
  - Ví.
  - Thông báo.
  - Tài khoản.
  - Khiếu nại/hỗ trợ.

- Provider hoàn thành được luồng:

  ```text
  Đăng ký provider
  → Upload hồ sơ
  → Chờ duyệt
  → Nhận đơn
  → Chấp nhận
  → Thực hiện
  → Gửi báo giá
  → Cập nhật tiến độ
  → Hoàn tất
  → Nhận thu nhập
  ```

- Tất cả dữ liệu nghiệp vụ lấy từ backend.
- Không tự tính hoặc tự xác nhận payment/order/wallet ở client.
- Không có route ADMIN trong mobile.
- UI đồng bộ với `DESIGN.md`.
- Các feature độc lập, dễ kiểm thử và không phụ thuộc ngược vào presentation của feature khác.
- Các API hiện có không bị đổi response shape, field name, enum hoặc status code.

## 7. Giả định và rủi ro

### Giả định

- Backend hiện tại là nguồn sự thật cho nghiệp vụ.
- Không cần sửa backend để phục vụ giao diện Flutter.
- HTML Stitch là visual reference, không phải API contract.
- Customer có thể đăng ký provider từ app, nhưng chỉ được hoạt động sau khi backend duyệt.
- Tất cả text hướng tới người dùng sẽ dùng tiếng Việt có dấu.
- ADMIN tiếp tục dùng web.

### Rủi ro và cách xử lý

- HTML chứa dữ liệu demo cố định: thay bằng DTO/API trước khi hoàn thiện từng feature.
- UI login ghi hỗ trợ phone nhưng backend hiện yêu cầu email: khóa theo email cho bản đầu tiên, không tự sửa contract.
- HTML ghi SMS/Zalo OTP nhưng backend hiện dùng email: hiển thị theo hành vi backend thực tế.
- PayOS cần mở checkout ngoài app: dùng checkout URL, reconcile sau khi quay lại, không xác nhận ở client.
- Socket mất kết nối: có reconnect giới hạn và fallback reload/polling.
- Upload ảnh/CCCD lỗi giữa chừng: lưu state form cục bộ trong session và cho phép retry.
- Provider role/status thay đổi trong lúc app đang mở: kiểm tra lại `/auth/me` và xử lý logout/redirect nếu mất quyền.
- Font/icon asset chưa có trong Flutter: hoàn thiện asset foundation trước khi bắt đầu visual QA.
- API response không đồng nhất: mỗi repository có DTO/parser riêng, không dùng một parser chung cho mọi endpoint.

## 8. Ghi chú triển khai

- Đã triển khai Giai đoạn 1 trong `handigo-app`, bao gồm bootstrap Flutter, theme, Riverpod, GoRouter, session restore, route guard và các luồng xác thực kết nối backend.
- Khi kiểm tra sau triển khai, lệnh `flutter analyze`/`dart analyze` bị treo và không trả output trong môi trường hiện tại. Vì vậy kết quả `analyze/build` chưa được xác nhận tự động; cần chạy lại trên môi trường Flutter hoạt động bình thường trước khi nghiệm thu Giai đoạn 1.
- Đã triển khai Giai đoạn 2 trong `handigo-app`: customer shell với 4 tab, account shell, shared loading/error/empty state, customer home feature-based và kết nối dữ liệu thật từ `/categories/active`, `/services`, `/providers/featured`, `/notifications/unread-count`.
- Các tab Đơn hàng và Tin nhắn ở Giai đoạn 2 mới dừng ở shell và empty state; nghiệp vụ đầy đủ được để đúng phạm vi Giai đoạn 4. Lệnh format/analyze sau thay đổi tiếp tục bị treo trong môi trường hiện tại nên chưa có xác nhận tự động về build/analyze.
- Đã triển khai Giai đoạn 3 trong `handigo-app`: feature `service_catalog` có danh mục, tìm kiếm/lọc danh mục, chi tiết service và options từ API; feature `booking` có draft state bằng Riverpod, chọn option/số lượng, loại đơn bình thường/khẩn cấp/đặt lịch/định kỳ, chọn hoặc thêm địa chỉ, mô tả và upload tối đa 4 ảnh sự cố qua `/orders/attachments`.
- Luồng booking gọi `/orders/preview` trước bước xác nhận, tạo order qua `/orders`, sau đó khởi tạo thanh toán qua `/payments/create`; tổng tiền chỉ hiển thị từ backend, không tự xác nhận payment trên client. Có trạng thái loading/error/empty và màn hình success/pending cơ bản. Các màn hình voucher nâng cao, PayOS return/reconcile và quản lý địa chỉ đầy đủ tiếp tục cần hoàn thiện ở các giai đoạn sau.
- Lệnh `flutter analyze --no-pub` sau Giai đoạn 3 tiếp tục treo không trả output trong môi trường hiện tại và đã được dừng; chưa xác nhận tự động về analyze/build.

### Rà soát bổ sung sau Giai đoạn 2 và 3

- **Giai đoạn 2 — phụ thuộc tải dữ liệu trang chủ:** `CustomerHomeRepository` dùng một `Future.wait` cho category, service, provider và unread notification. Chỉ cần một API lỗi hoặc hết phiên là toàn bộ trang chủ chuyển sang error, dù các nhóm dữ liệu còn lại có thể đã tải được. Giai đoạn sau nên tách trạng thái theo từng section hoặc cho phép trang chủ hiển thị dữ liệu đã tải kèm retry riêng.
- **Giai đoạn 2 — hành động còn là placeholder:** nút thông báo, một số nút “Xem tất cả”/card provider và các tab Đơn hàng/Tin nhắn chưa điều hướng tới nghiệp vụ thật. Đây là giới hạn phạm vi hiện tại, cần hoàn thiện khi triển khai Giai đoạn 4 và feature notifications/chat/orders.
- **Giai đoạn 3 — lỗi cần sửa trước nghiệm thu:** UI có upload ảnh sự cố và lưu URL vào booking draft, nhưng payload `createOrder` hiện chưa truyền `customerAttachments`; vì vậy ảnh có thể upload thành công nhưng không gắn vào order. Cần bổ sung kiểm thử từ chọn ảnh → upload → tạo order → kiểm tra `customerAttachments`.
- **Giai đoạn 3 — thanh toán chưa khép kín:** app mới gọi `/payments/create` và mở `checkoutUrl`, chưa có route return/cancel và chưa gọi `/payments/order/:orderId/reconcile` sau khi quay lại từ PayOS. Không được hiển thị thành công cuối cùng cho PayOS chỉ dựa vào kết quả mở URL; cần polling/reconcile và trạng thái pending/failed rõ ràng.
- **Giai đoạn 3 — lỗi giữa create order và create payment:** nếu order tạo thành công nhưng `/payments/create` lỗi, UI báo lỗi chung và giữ draft nhưng chưa cung cấp hành động tiếp tục thanh toán/retry theo `orderId`. Có rủi ro người dùng tạo lại order trùng; cần lưu order pending và cho retry payment hoặc dẫn tới chi tiết order.
- **Giai đoạn 3 — booking định kỳ chưa đủ:** UI chưa cho chọn đầy đủ số buổi hợp lệ theo backend (weekly: 1–4, monthly: 4/8/12) và chưa bắt buộc lịch thực hiện cho `recurring` ở bước client. Cần bổ sung lựa chọn và validation trước preview/create order.
- **Giai đoạn 3 — voucher chưa triển khai:** booking hiện chưa gọi API apply/remove voucher và chưa truyền `voucherCode`/`voucherId`; phần xác nhận giá mới bao phủ tổng tiền cơ bản từ preview. Cần hoàn thiện ở phần booking/payment hoặc Giai đoạn 5 theo quyết định scope.
- **Giai đoạn 3 — deep link booking chưa bền vững:** route `/customer/bookings/new` đang phụ thuộc `state.extra` là `ServiceDetail`, nên mở trực tiếp route hoặc khôi phục app giữa chừng sẽ không có dữ liệu. Khi hoàn thiện navigation cần truyền `serviceId` qua path/query và tải lại detail từ repository.
- Các điểm trên chưa được xác nhận bằng `flutter analyze`/build vì công cụ vẫn treo trong môi trường hiện tại; cần chạy lại `flutter pub get`, `flutter analyze`, test và build trên môi trường Flutter hoạt động trước nghiệm thu.

- Đã triển khai Giai đoạn 4 ở lát cắt Customer trong `handigo-app`: tab lịch sử đơn hàng kết nối `/orders`, màn chi tiết kết nối `/orders/:orderId`, cancellation preview + hủy đơn, báo giá phát sinh confirm/reject; trung tâm thông báo kết nối danh sách/đánh dấu đã đọc; chat kết nối danh sách conversation, conversation theo order, tải/gửi tin nhắn và đánh dấu đã xem; tracking gọi `/orders/:orderId/tracking-route` với trạng thái fallback khi backend chưa trả đủ dữ liệu bản đồ.
- Giai đoạn 4 hiện dùng refresh/polling thủ công thay cho Socket.IO vì Flutter chưa có client socket trong dependency. Cần bổ sung realtime/reconnect ở bước tích hợp sau khi chốt package và auth handshake tương thích backend.
- Route notification action URL, filter/search/pagination nâng cao của order, tải thêm lịch sử chat, gửi ảnh chat, report conversation và UI bản đồ native chưa hoàn thiện; các phần này cần xử lý trong phần hoàn thiện Giai đoạn 4 hoặc Giai đoạn 9, không được coi là đã nghiệm thu đầy đủ.
- `dart format` và `dart analyze` không trả output trong môi trường hiện tại nên chưa có xác nhận tự động về build/analyze. Cần chạy lại `flutter pub get`, `flutter analyze`, `flutter test` và `flutter build apk --debug` trên môi trường Flutter hoạt động trước khi nghiệm thu.

- Đã triển khai lát cắt đầu tiên của **Giai đoạn 5** trong `handigo-app` theo feature `account`: customer account shell đã nối tới hồ sơ cá nhân, sổ địa chỉ, ví Handigo, kho voucher, đánh giá, trung tâm hỗ trợ, khiếu nại và cài đặt; các repository dùng API backend hiện có và ownership vẫn do backend kiểm tra.
- Giai đoạn 5 hiện đã có loading/error/empty state, cập nhật hồ sơ, CRUD cơ bản địa chỉ, đặt mặc định qua `PUT /addresses/:id` với `isDefault`, hiển thị ví/lịch sử giao dịch, tạo liên kết nạp ví, danh sách voucher, danh sách feedback và tạo support ticket/complaint. Client không tự điều chỉnh số dư, trạng thái thanh toán hoặc trạng thái xử lý.
- Phần chưa hoàn thiện trong lát cắt này: chưa upload avatar/ảnh feedback/evidence vì cần dùng multipart upload riêng; chưa tích hợp `local_auth` nên công tắc sinh trắc học mới là trạng thái UI; chưa có màn hình chi tiết/phản hồi ticket và complaint; luồng voucher apply/remove vẫn cần gắn trực tiếp vào booking order cụ thể, không chỉ hiển thị kho voucher.
- Cần xác minh lại shape response thực tế của `/feedback/me`, `/vouchers/available`, `/wallets/me/transactions`, `/support-tickets/me` và `/complaints/me` bằng test API trước nghiệm thu. Lệnh `dart format` đã tiếp tục bị treo/không trả output trong môi trường hiện tại; chưa xác nhận tự động bằng `flutter analyze`, `flutter test` hoặc build APK.

- Đã triển khai lát cắt đầu tiên của **Giai đoạn 6** theo feature `provider_onboarding`: customer có thể bắt đầu đăng ký provider từ màn hình Tài khoản; form được chia 3 bước cho kinh nghiệm/dịch vụ, khu vực/giấy tờ và rà soát gửi hồ sơ; có lưu nháp qua `/provider-applications/me/draft`, gửi mới, resubmit hồ sơ bị từ chối và tải giấy tờ qua multipart `/provider-application-assets/images`.
- Lát cắt này hiển thị các trạng thái `draft`, `pending`, `resubmitted`, `approved`, `rejected`; không có logic tự duyệt. Dữ liệu dịch vụ lấy từ `/services`, ownership và điều kiện chuyển trạng thái vẫn do backend kiểm tra.
- Đã thêm route guard để tài khoản có role `PROVIDER` không truy cập các route Customer/order operation; riêng route onboarding vẫn được phép mở để tiếp tục hoàn thiện hồ sơ. Provider shell nghiệp vụ đầy đủ tiếp tục thuộc Giai đoạn 7.
- Chưa hoàn thiện toàn bộ Giai đoạn 6: chưa có GPS/reverse geocode, chưa có OCR UI chuyên dụng/preview ảnh nâng cao, chưa lưu draft cục bộ khi offline, chưa có provider shell đầy đủ để kiểm tra end-to-end quyền `APPROVED`. Contract hiện yêu cầu ảnh mặt trước CCCD hoặc ảnh hộ chiếu tương ứng; phần upload tài liệu nâng cao vẫn để sau.
- Chưa xác nhận tự động bằng `flutter analyze`, `flutter test` hoặc build APK vì lệnh Flutter/Dart trong môi trường hiện tại tiếp tục treo không trả output; cần chạy lại trên môi trường Flutter hoạt động.

- Đã triển khai lát cắt đầu tiên của **Giai đoạn 7** theo feature `provider`: provider đã được duyệt có shell 4 tab gồm tổng quan, đơn được giao, lịch hẹn và tài khoản; dashboard dùng `/dashboard/overview` và cập nhật availability qua `/dashboard/provider/availability`.
- Đã kết nối danh sách order provider, pending assignment và các thao tác nhận/từ chối assignment; màn chi tiết provider có bắt đầu đơn, gửi báo giá vật tư, cập nhật expected end và gửi nghiệm thu với ảnh upload qua `/orders/attachments`. Các thao tác đều gọi API backend, không tự đổi trạng thái ở client.
- Lịch hiện được dựng từ danh sách đơn provider có `scheduledAt` vì backend hiện chưa có endpoint lịch riêng; đây là lịch đọc từ dữ liệu đơn, chưa phải lịch tuần/tháng có khả năng chỉnh sửa.
- Route guard chỉ cho provider có `providerOnboardingStatus = APPROVED` vào provider shell; provider chưa được duyệt bị đưa về tiếp tục onboarding. Chưa hoàn thiện realtime assignment/chat, upload nhiều ảnh nghiệm thu, filter/pagination nâng cao, lịch tuần/tháng và provider profile/finance/settings chi tiết của Giai đoạn 8.
- Lệnh `dart format` sau Giai đoạn 7 tiếp tục bị treo không trả output trong môi trường hiện tại và đã được dừng; chưa xác nhận tự động bằng `flutter analyze`, `flutter test` hoặc build APK. Cần chạy lại toàn bộ validation trên môi trường Flutter hoạt động.

- Đã triển khai lát cắt chính của **Giai đoạn 8** theo feature `provider`: tài khoản provider có hồ sơ cá nhân, dịch vụ/khu vực hiển thị, quản lý chứng chỉ, ví và giao dịch, tạo/theo dõi yêu cầu rút tiền, quản lý tài khoản ngân hàng, xem feedback khách hàng, thông báo, cài đặt và logout.
- Các API đã tích hợp gồm `/providers/me`, `/providers/me/certificates`, `/wallets/me`, `/wallets/me/transactions`, `/withdrawals`, `/withdrawals/me`, `/bank-accounts` và `/feedback/provider/me`; backend vẫn là nguồn sự thật cho ownership, số dư, validation số tiền và trạng thái withdrawal.
- Giai đoạn 8 hiện chưa có upload ảnh chứng chỉ/avatar và chưa có chỉnh sửa/xóa chứng chỉ với form đầy đủ; phần thêm chứng chỉ mới tạo metadata tối thiểu để giữ scope nhỏ. Cài đặt thông báo hiện là trạng thái UI tại session, chưa lưu preference vì backend chưa được xác minh có API tương ứng.
- `NotificationCenterScreen` được tái sử dụng cho provider qua route role-aware; không thêm route ADMIN. Cần kiểm tra response thực tế của provider feedback, profile populate và bank/withdrawal trên dữ liệu staging trước nghiệm thu.
- Lệnh `dart format`/`flutter analyze`/`flutter test`/build chưa được xác nhận tự động vì Flutter/Dart trong môi trường hiện tại tiếp tục treo không trả output; cần chạy lại toàn bộ validation trên môi trường Flutter hoạt động.

- Đã triển khai lát cắt tích hợp của **Giai đoạn 9**: booking truyền ảnh sự cố vào `customerAttachments`, truyền mã voucher theo contract tạo order, bổ sung kiểm tra chu kỳ/số buổi định kỳ theo rule backend và thêm repository methods cho apply/remove voucher.
- Luồng PayOS có thêm nút mở checkout và đối soát trạng thái qua `POST /payments/order/:orderId/reconcile`; UI vẫn phân biệt trạng thái đã thanh toán và đang chờ, không tự kết luận thanh toán thành công từ việc mở URL.
- Đã thêm smoke tests cho giới hạn số lượng option, chuẩn hóa voucher và mapping booking/payment trong `handigo-app/test/phase_9_smoke_test.dart`.
- Giai đoạn 9 vẫn chưa thể nghiệm thu tự động trong môi trường hiện tại: `dart format`, `flutter analyze`, `flutter test` và `flutter build apk --debug` tiếp tục cần chạy trên môi trường Flutter hoạt động; chưa có xác nhận Android emulator/iOS simulator hoặc visual regression với các `screen.png`.
- Đã thử chạy mobile audit script nhưng máy hiện tại không có Python (`python`/`py` không tồn tại trong PATH); vì vậy audit touch/accessibility tự động chưa được thực hiện.
- Các giới hạn còn lại cần kiểm tra thủ công/staging: response thật của voucher/PayOS, deep link return/cancel của PayOS, Socket.IO realtime, accessibility semantics đầy đủ và visual QA trên kích thước 390x844/402x874.

### Rà soát và sửa lỗi sau analyze

- Đã xử lý nhóm lỗi compile ban đầu của Flutter: tương thích Riverpod 3 cho `main.dart`, legacy `ChangeNotifierProvider` hiện hữu, `AsyncValue.asData`, nullability của voucher và provider wiring onboarding.
- Đã sửa và cấu trúc lại các màn hình auth, account, chat, provider, provider onboarding, provider order detail và booking để loại bỏ lỗi cú pháp/dấu ngoặc gây lan truyền hàng loạt lỗi analyze.
- Đã bổ sung route booking theo `serviceId` (`/customer/bookings/new/:serviceId`) để không còn phụ thuộc bắt buộc vào `state.extra`, đồng thời màn booking tự tải lại service detail khi mở trực tiếp hoặc khôi phục navigation.
- Khi tạo order thành công nhưng khởi tạo payment lỗi, app giữ `orderId`, chuyển sang trạng thái thanh toán chờ và cho phép tiếp tục kiểm tra/reconcile thay vì tạo lại order trùng.
- Validation thực tế sau sửa:
  - `flutter analyze`: không còn error; còn warning/info style, deprecated API và async-context cần xử lý dần, không chặn compile.
  - `flutter test`: pass 3/3 smoke tests Giai đoạn 9.
  - `flutter build apk --debug`: thành công, tạo `build/app/outputs/flutter-apk/app-debug.apk`.
- Chưa xác nhận visual QA và thao tác cài/mở tương tác trên emulator qua terminal do lệnh ADB/Flutter interactive không trả log ổn định; cần mở Android Studio hoặc chạy `flutter run -d emulator-5554` từ terminal của người dùng để kiểm tra trực tiếp.
- Các việc còn lại: giảm warning/deprecated API, kiểm thử API staging cho voucher/PayOS/provider finance, deep link PayOS return/cancel, realtime Socket.IO, accessibility và visual QA.
