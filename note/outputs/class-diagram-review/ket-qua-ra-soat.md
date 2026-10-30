# Kết quả rà soát 8 sơ đồ class Handigo

Ngày đối chiếu: 20/10/2026.

Nguồn: `C:\Users\gamer\Downloads\all_8_class_diagrams.drawio` và mã nguồn hiện có trong `handigo-backend/src`.

## Kết luận

Cách chia các nhóm chức năng và luồng Route → Controller → Service → dữ liệu nhìn chung phù hợp. Tuy nhiên, chưa thể xác nhận 8 sơ đồ đúng hoàn toàn với implementation: còn tên hàm sai, thuộc tính không tồn tại, chữ ký hàm thiếu tham số và phần dashboard lặp giữa hai trang.

Đây là kết quả đối chiếu tĩnh sơ đồ với code, không phải kết luận kiểm thử runtime hoặc xác nhận toàn bộ chức năng backend đã hoạt động đúng. Những thành phần không được vẽ không mặc nhiên là lỗi nếu sơ đồ chủ đích chỉ thể hiện phần chính.

Bản `all_8_class_diagrams_black.drawio` chỉ đổi màu đường phân cách. Các sai lệch nội dung bên dưới được ghi nhận để chỉnh riêng; chưa được sửa trong bản này.

## Những sai lệch ảnh hưởng trực tiếp đến việc đọc sơ đồ

### 3.1 — Authentication

- Thiếu `verifyResetPasswordOtp` ở Route, Controller và Service. Endpoint hiện có là `POST /verify-reset-password-otp`; service nhận `(email, otp)`.
- `AuthService.resetPassword(payload)` không khớp hàm thực tế `resetPassword(email, otp, newPassword)`.
- `AuthService.changePassword(userId, payload)` không khớp hàm thực tế `changePassword(userId, currentPassword, newPassword)`.
- Các phụ thuộc từ AuthService tới User, Session và Wallet phù hợp với import và xử lý hiện có.

Bằng chứng: `handigo-backend/src/routes/auth.routes.ts:66`, `controllers/auth.controller.ts:238`, `services/auth.service.ts:620`, `services/auth.service.ts:631`, `services/auth.service.ts:735`.

### 3.2 — Account management

- `Address.addressLine` phải là `fullAddress`.
- `ProviderApplication.services` phải là `serviceIds`.
- `Provider.status` không phải thuộc tính cấp gốc của Provider. Trạng thái hoạt động nằm ở `availabilityStatus`, việc xác minh dùng `verified`; trạng thái hồ sơ đăng ký nằm ở ProviderApplication và thông tin onboarding ở User. Cần chọn thuộc tính theo đúng ý nghĩa muốn thể hiện.
- `AdminRoute.getUsersById()` và `AdminController.getUsersById()` phải là `getUserById()`.
- `AddressRoute.setDefaultAddress()` đang thể hiện một thao tác chưa được gắn vào router hiện tại. Controller và Service có hàm này, nhưng `address.routes.ts` không khai báo endpoint gọi nó. Nếu mô tả API hiện hành thì bỏ thao tác này khỏi ô Route.
- `AddressService.checkAddressUpdate(userId, addressId)` và `confirmAddressUpdate(userId, addressId)` đều sai thứ tự và thiếu dữ liệu địa chỉ. Thực tế hai hàm nhận `(addressId, userId, candidate)`.

Bằng chứng: `models/address.model.ts:17`, `models/providerApplication.model.ts:29`, `models/provider.model.ts:69`, `controllers/admin.controller.ts:17`, toàn bộ `routes/address.routes.ts`, `services/address.service.ts:282` và `:320`.

### 3.3 — Service category

- `Service.requiredOptionAction` không tồn tại; thuộc tính thực tế là `requiresOptionSelection`.
- ServiceOptionService không có hai hàm `getOptions()` và `getAdminOptions()`. Cả hai luồng dùng `getOptionsByServiceId(serviceId, includeInactive = false)`; luồng admin bật tùy chọn lấy cả mục ngừng hoạt động.
- Các nhóm Service, Category, ServiceOption và ServiceSuggestion cùng quan hệ chính phù hợp. Nếu cần mô tả cấu hình lựa chọn đầy đủ, có thể bổ sung `Service.optionGroups` và các thuộc tính nhóm của ServiceOption; đây là phần chi tiết đang được lược bỏ.

Bằng chứng: `models/service.model.ts:30`, `services/serviceOption.service.ts:14`, `controllers/service.controller.ts`.

### 3.4 — Booking order

- `Order.pricingSnapshot` không tồn tại; dữ liệu giá nằm ở `pricing: IOrderPricing`.
- `selectAppointmentProvider(orderId, providerId)` thiếu `customerId`. Chữ ký thực tế là `(orderId, customerId, providerId, expectedVersion?)`; tham số customer được dùng để lọc đúng chủ đơn.
- `completeOrder(orderId, providerUserId)` thiếu tham số bắt buộc `completionEvidenceImages`. Chữ ký còn có `completionNote?` và `expectedQuotation?`.
- `cancelOrder(orderId, user, reason)` không phản ánh chữ ký hiện có `(orderId, userId, role, reason, confirmedExpectation?)`.
- `previewCancellation(orderId, user)` thực tế nhận `(orderId, userId, role, scope = "single")`.
- Quan hệ khách hàng, provider được phân công, provider được ưu tiên, dịch vụ và địa chỉ phù hợp. Nếu thể hiện hai quan hệ provider thì nên thêm `preferredProviderId` vào ô Order để dễ đối chiếu.

Bằng chứng: `models/order.model.ts:148`, `services/order.service.ts:604`, `:1064`, `:1255`, `:1281`.

### 3.5 — Payment finance

Đây là trang có nhiều sai lệch về tên và phụ thuộc cần ưu tiên sửa:

- `payoutWebhook` phải là `payosWebhook` ở Route/Controller.
- `handlePayoWebhook` phải là `handlePayosWebhook` ở Service.
- `reconcilePayoPaymentByOrder` phải là `reconcilePayosPaymentByOrder`; `reconcilePayoPaymentForOrder` phải là `reconcilePayosPaymentForOrder(orderId, user)`.
- `retryPayoRefund` phải là `retryPayosRefund` ở Route/Controller. PaymentService không có hàm retry này: Controller gọi `retryPayosRefundByPaymentId` của `orderCancellation.service.ts`. Cần đưa thao tác và mũi tên phụ thuộc về đúng service.
- Controller `createPayment` gọi `PaymentService.createOrderPayment(user, input)`. PaymentService vẫn có `createPayment`, nhưng đó không phải hàm được controller này gọi trực tiếp; nên bổ sung `createOrderPayment` để thể hiện đúng luồng.
- WalletRoute gọi `createMyWalletDeposit`, `cancelMyWalletDeposit`, `syncMyWalletDeposit`; tên đang vẽ ở Route bỏ mất chữ `My` nên không khớp handler. Tên tương ứng ở WalletController đang đúng.
- Model thực tế là `WithdrawRequest`, không phải `WithdrawalRequest`; cần thống nhất ở cả trang 3.5 và 3.8 nếu sơ đồ bám tên code.
- Trong ô Order, `voucherId` không phải thuộc tính cấp gốc. Tham chiếu voucher nằm ở `voucherSnapshot.voucherId`.
- Nếu mục tiêu là liệt kê đầy đủ endpoint đang công khai, hiện còn thiếu lấy QR thanh toán và xem ví theo provider. Nếu là sơ đồ rút gọn thì cần ghi rõ phạm vi này.

Bằng chứng: `routes/payment.routes.ts`, `controllers/payment.controller.ts:35`, `:49`, `:131`, `services/payment.service.ts:1199`, `:1217`, `routes/wallet.routes.ts`, `models/withdrawRequest.model.ts:32`, `models/order.model.ts:150`.

### 3.6 — Feedback communication

- `Provider.totalReviews` phải là `totalFeedbacks`.
- ProviderReply là subdocument nhúng trong Feedback, không phải collection độc lập. Quan hệ chứa đang có là hợp lý về ý nghĩa; nếu chuẩn hóa UML nên dùng composition và bội số `Feedback 1` — `ProviderReply 0..1`.
- Ràng buộc một feedback cho một order được hỗ trợ bởi `orderId` có `unique: true`.
- Nội dung trang chủ yếu mô tả feedback và phản hồi của provider. Nếu tên “communication” có ý bao gồm chat thì chưa có ChatRoute/ChatService/Conversation/Message; cần đổi tên trang cho sát phạm vi hoặc xác định thêm phạm vi chat trước khi bổ sung.

Bằng chứng: `models/provider.model.ts:85`, `models/feedback.model.ts:22`, `:36`, `:43`.

### 3.7 — System notification

- Phần SystemConfig và Notification có các nhóm hàm chính phù hợp.
- SystemConfig thực tế được thao tác qua collection `system_configs` và kiểu `SystemConfigDocument` bên trong service; không có Mongoose model độc lập tên SystemConfig. Ô này có thể giữ ở mức thực thể khái niệm nhưng cần ghi rõ loại thành phần.
- `DashboardData` với các trường `overviewMetrics`, `revenueMetrics`, `orderMetrics`, `providerMetrics`, `earningMetrics` không phải DTO được khai báo trong code hiện có. Đây chỉ có thể coi là mô hình tổng hợp khái niệm; không nên trình bày như kiểu dữ liệu thực tế.
- Phần Dashboard bị lặp với trang 3.8. Để chia module rõ ràng, đề xuất giữ cấu hình/thông báo ở 3.7 và dashboard ở 3.8.
- Nếu vẫn giữ Dashboard ở 3.7, cần bổ sung `getProviderOverview(user, query)` và thống nhất tên thao tác Route: `getOverview`, `getRevenue`... hiện chỉ là tên rút gọn, không phải tên handler.

Bằng chứng: `services/systemConfig.service.ts:16`, `:28`, `services/dashboard.service.ts`, `controllers/dashboard.controller.ts:36`, `routes/dashboard.routes.ts`.

### 3.8 — Dashboard analytics

- Thiếu `DashboardService.getProviderOverview(user, query)`. Controller `getDashboardOverview` phân nhánh ADMIN/PROVIDER; sơ đồ hiện chỉ thể hiện tổng quan admin trong service nên chưa đủ luồng của endpoint `/overview`.
- `WithdrawalRequest` cần đổi thành `WithdrawRequest` nếu dùng tên model thực tế.
- RequestUser và DashboardQuery là các kiểu dữ liệu, nên đánh dấu tương ứng thay vì xem như collection.
- Các model phục vụ thống kê trong sơ đồ phù hợp với import của dashboard service: Provider, Order, Payment, Wallet, WalletTransaction và WithdrawRequest; thông tin User còn được lấy qua truy vấn tổng hợp.
- Các middleware bảo vệ dashboard hiện có gồm `authMiddleware`, `roleMiddleware`, `approvedProviderMiddleware`, `resourceIntensiveRateLimit`. Những tên `authenticate`, `authorize`, `checkApproval`, `checkLimit` trên sơ đồ là tên khái quát, không phải tên hàm trong code.

Bằng chứng: `controllers/dashboard.controller.ts:23`, `:36`, `services/dashboard.service.ts:1`, `:521`, `routes/dashboard.routes.ts:17`.

## Quy ước UML nên thống nhất

- Backend chủ yếu dùng module export hàm, object service và Express Router. Các ô có tên Controller/Service/Route có thể dùng làm cách nhóm trách nhiệm, nhưng không có nghĩa tất cả là TypeScript class. Nên ghi chú đây là sơ đồ thiết kế theo module hoặc thêm stereotype phù hợp.
- Route đang dùng ba kiểu tên: `POST_register`, tên handler, và `GET_dashboardOverview`. Chọn một quy ước chung. Nếu muốn mô tả API, ghi đúng HTTP method và đường dẫn; nếu muốn mô tả implementation, dùng tên handler.
- Nếu muốn sơ đồ khớp implementation, đổi `authenticate()` thành `authMiddleware(req,res,next)`, `authorize(role)` thành `roleMiddleware(...allowedRoles)`, `validateRequest()` thành `validate(schema,source?)`.
- Phân biệt đường dependency từ module tới model với association giữa các thực thể dữ liệu. Không nên hiểu toàn bộ nhãn `manages` là thao tác ghi; một số service chỉ đọc/kiểm tra model đích.
- Bổ sung bội số ở trang còn thiếu khi cần UML chi tiết: User–Session là một–nhiều; User–Wallet là một–tối đa một theo ràng buộc duy nhất trên `Wallet.userId`; Feedback–ProviderReply là một–tùy chọn một và là quan hệ chứa.

## Kết quả đổi màu và kiểm tra file

- Đã đổi 111 đường phân cách `<hr>` dưới tên class từ màu cũ sang `#000000`, giữ độ dày `1px`.
- File kết quả vẫn có đủ 8 trang và 416 ô `mxCell`.
- Đã đối chiếu từng ô trước/sau: chỉ phần mã màu đường phân cách thay đổi; tên lớp, nội dung, hình học, kiểu đường nối và các thuộc tính khác giữ nguyên.
- Đã đọc lại XML thành công. Chưa mở render bằng ứng dụng draw.io; kiểm tra này xác nhận cấu trúc và phạm vi chỉnh sửa, không thay thế đánh giá hiển thị trực tiếp.
- File nguồn trong Downloads được giữ nguyên; mã nguồn backend/frontend/database không thay đổi.
