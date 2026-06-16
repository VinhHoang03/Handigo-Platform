# Tài liệu Models

Tài liệu này liệt kê tất cả các collection MongoDB (Mongoose models) trong `handigo-backend/src/models` và mô tả từng field cùng mục đích sử dụng.

---

## AuditLog (collection: `auditlogs`)

- `actorId`: ObjectId (ref `User`, mặc định null) — người dùng đã kích hoạt hành động.
- `actorRole`: enum `customer|provider|admin|system` — vai trò của người thực hiện.
- `action`: string — mã định danh hành động ngắn gọn (ví dụ: `update_user`).
- `targetType`: string — loại/tên tài nguyên bị ảnh hưởng.
- `targetId`: ObjectId | null — id của tài nguyên bị ảnh hưởng.
- `oldValue`: mixed | null — bản chụp trạng thái trước khi thay đổi.
- `newValue`: mixed | null — bản chụp trạng thái sau khi thay đổi.
- `description`: string | null — mô tả dễ đọc cho người dùng.
- Các field cơ bản: `isDeleted`, `deletedAt`, timestamps — xóa mềm và timestamps kiểm toán.
- Indexes: `{ targetType, targetId }`, `{ actorId, createdAt:-1 }`.

---

## Address (collection: `addresses`)

- `userId`: ObjectId (ref `User`) — chủ sở hữu địa chỉ.
- `fullAddress`: string — địa chỉ đầy đủ dạng văn bản.
- `province`: string — tỉnh/thành phố.
- `ward`: string — phường/xã.
- `latitude`: number | undefined — vĩ độ GPS.
- `longitude`: number | undefined — kinh độ GPS.
- `isDefault`: boolean (mặc định false) — đánh dấu địa chỉ mặc định.
- `note`: string | null — ghi chú tùy chọn.
- timestamps: `createdAt`, `updatedAt`.
- Index: `{ userId }`.

---

## BankAccount (collection: `bankaccounts`)

- `userId`: ObjectId (ref `User`) — chủ sở hữu tài khoản ngân hàng.
- `bankName`: string — tên hiển thị của ngân hàng.
- `bankCode`: string — mã nội bộ của ngân hàng.
- `accountNumber`: string — số tài khoản ngân hàng.
- `accountHolderName`: string — tên chủ tài khoản.
- `isDefault`: boolean — tài khoản thanh toán mặc định của người dùng.
- `status`: enum `active|inactive` — trạng thái hiện tại.
- Các field cơ bản & timestamps.
- Unique index trên `{ userId, bankCode, accountNumber }` và unique partial index đảm bảo tối đa một `isDefault: true` mỗi `userId`.

---

## Session (collection: `sessions`)

- `userId`: ObjectId (ref `User`) — chủ phiên đăng nhập.
- `refreshTokenHash`: string — refresh token đã được hash dùng để kiểm tra thu hồi phiên.
- `expiresAt`: Date — thời điểm hết hạn của refresh token.
- `revokedAt`: Date | null — thời điểm phiên bị thu hồi.
- Các field cơ bản & timestamps.
- Indexes: `{ userId }`, `{ expiresAt }`.

---

## ServiceSuggestion (collection: `servicesuggestions`)

- `providerId`: ObjectId (ref `Provider`) — người đề xuất.
- `suggestedServiceName`: string — tên dịch vụ được đề xuất.
- `description`: string | null — chi tiết tùy chọn.
- `status`: enum `pending|approved|rejected` — trạng thái xét duyệt.
- `reviewedBy`: ObjectId | null — admin đã xét duyệt.
- `reviewedAt`: Date | null — thời điểm xét duyệt.
- `adminNote`: string | null — ghi chú của admin.
- `createdServiceId`: ObjectId | null — liên kết đến `Service` đã được tạo nếu được duyệt.
- Các field cơ bản & timestamps.
- Index: `{ providerId, status }`.

---

## ServicePackage (collection: `servicepackages`)

- `providerId`: ObjectId (ref `Provider`) — chủ sở hữu gói dịch vụ.
- `serviceId`: ObjectId (ref `Service`) — dịch vụ cha.
- `name`: string — tên gói dịch vụ.
- `description`: string | null — chi tiết mô tả.
- `optionIds`: ObjectId[] (ref `ServiceOption`) — các tùy chọn được bao gồm.
- `estimatedDurationMinutes`: number | null — ước tính thời gian thực hiện (phút).
- `providerNote`: string | null — ghi chú nội bộ của nhà cung cấp.
- `isActive`: boolean — cờ hiển thị.
- Các field cơ bản & timestamps.
- Index: `{ providerId, serviceId }`.

---

## ServiceOption (collection: `serviceoptions`)

- `serviceId`: ObjectId (ref `Service`) — dịch vụ cha.
- `name`: string — tên tùy chọn.
- `description`: string | null — chi tiết mô tả.
- `optionType`: enum `inspection|cleaning|installation|repair|other` — loại tùy chọn.
- `fixedPrice`: number — giá cố định (Money), tối thiểu 0.
- `isFixedPrice`: boolean — đánh dấu giá có cố định hay không.
- `isActive`: boolean — cờ kích hoạt.
- Các field cơ bản & timestamps.
- Index: `{ serviceId }`.

---

## Service (collection: `services`)

- `categoryId`: ObjectId (ref `Category`) — danh mục dịch vụ.
- `name`: string — tên dịch vụ.
- `slug`: string (chữ thường, đã trim) — định danh slug duy nhất.
- `description`: string | null — mô tả dịch vụ.
- `fixedPrice`: number | null — giá cố định khi `serviceType` là `fixed_price`.
- `depositAmount`: number | null — số tiền đặt cọc yêu cầu.
- `image`: string | null — URL hình ảnh.
- `isActive`: boolean — cờ hiển thị.
- Các field cơ bản & timestamps.
- Indexes: unique `{ categoryId, slug }`, `{ categoryId }`, `{ fixedPrice }`.

---

## Report (collection: `reports`)

- `reporterId`: ObjectId (ref `User`) — người tạo báo cáo.
- `targetType`: enum `user|provider|order|system|app` — loại thực thể được báo cáo.
- `targetUserId`: ObjectId | null — người dùng bị báo cáo (nếu có).
- `orderId`: ObjectId | null — đơn hàng liên quan.
- `reportType`: enum `system_bug|ui_issue|user_behavior|payment_issue|other` — danh mục báo cáo.
- `title`: string — tiêu đề ngắn gọn.
- `description`: string — mô tả chi tiết.
- `evidenceImages`: string[] — URL các hình ảnh bằng chứng.
- `status`: enum `pending|resolved` — trạng thái xử lý.
- `handledBy`: ObjectId | null — người đã xử lý.
- `handledAt`: Date | null — thời điểm xử lý.
- `resolutionNote`: string | null — ghi chú giải quyết.
- Các field cơ bản & timestamps.
- Index: `{ status, createdAt:-1 }`.

---

## ProviderApplication (collection: `providerapplications`)

- `userId`: ObjectId (ref `User`) — người nộp đơn.
- `description`: string — chi tiết đơn đăng ký.
- `experienceYears`: number — số năm kinh nghiệm.
- `serviceCategoryIds`: ObjectId[] (ref `Category`) — các danh mục dịch vụ có thể cung cấp.
- `workingAreas`: string[] — khu vực phục vụ dạng văn bản.
- `status`: enum `pending|approved|rejected` — trạng thái đơn đăng ký.
- `rejectionReason`: string | null — lý do từ chối (nếu có).
- `reviewedBy`: ObjectId | null — người xét duyệt.
- `reviewedAt`: Date | null — thời điểm xét duyệt.
- Các field cơ bản & timestamps.
- Unique partial index ngăn mỗi người dùng có nhiều đơn đang chờ xử lý.

---

## Provider (collection: `providers`)

- `userId`: ObjectId (ref `User`, unique) — tài khoản người dùng được liên kết.
- `description`: string — giới thiệu về nhà cung cấp.
- `experienceYears`: number — số năm kinh nghiệm.
- `activeStatus`: enum `active|inactive` — trạng thái hoạt động.
- `verified`: boolean — cờ xác minh.
- `serviceCategoryIds`: ObjectId[] — các danh mục dịch vụ phục vụ.
- `workingAreas`: string[] — khu vực phục vụ.
- `averageRating`: number (0-5) — điểm đánh giá trung bình.
- `totalFeedbacks`: number — tổng số đánh giá.
- `totalCompletedOrders`: number — tổng số đơn hàng đã hoàn thành.
- Các field cơ bản & timestamps.
- Indexes: `{ serviceCategoryIds }`, `{ activeStatus, verified }`.

---

## Promotion (collection: `promotions`)

- `name`: string — tên chương trình khuyến mãi.
- `description`: string | null — chi tiết mô tả.
- `discountType`: enum `fixed|percentage` — cách áp dụng giảm giá.
- `discountValue`: number — giá trị giảm giá.
- `maxDiscountAmount`: number | null — mức tối đa của giảm giá.
- `minOrderAmount`: number | null — giá trị đơn hàng tối thiểu để áp dụng.
- `startAt`: Date — thời gian bắt đầu.
- `endAt`: Date — thời gian kết thúc.
- `isActive`: boolean — cờ đang sử dụng được.
- Các field cơ bản & timestamps.
- Index: `{ isActive, startAt, endAt }`.

---

## Payment (collection: `payments`)

- `orderId`: ObjectId (ref `Order`) — đơn hàng đang được thanh toán.
- `customerId`: ObjectId (ref `User`) — người thanh toán.
- `amount`: number — số tiền thanh toán.
- `method`: enum `payos|vnpay` — cổng thanh toán.
- `status`: enum `pending|paid|failed|refunded` — trạng thái thanh toán.
- `transactionCode`: string | null — mã giao dịch từ cổng thanh toán.
- `gatewayResponse`: mixed | null — phản hồi thô từ cổng thanh toán.
- `paidAt`: Date | null — thời điểm thanh toán thành công.
- `refundedAt`: Date | null — thời điểm hoàn tiền.
- Các field cơ bản & timestamps.
- Index: `{ orderId }`.

---

## OrderStatus (collection: `orderstatuses`)

- `orderId`: ObjectId (ref `Order`) — đơn hàng được liên kết.
- `status`: enum các trạng thái đơn hàng (`created`,`paid`,`assigned`,`accepted`,`in_progress`,`completed`,`cancelled`) — mục lưu lịch sử trạng thái.
- `changedBy`: ObjectId | null — người dùng đã thay đổi trạng thái.
- `changedByRole`: enum `customer|provider|admin|system` — vai trò của người thay đổi.
- `note`: string | null — ghi chú tùy chọn về sự thay đổi.
- Các field cơ bản & timestamps.
- Index: `{ orderId }`.

---

## Order (collection: `orders`)

- `orderCode`: string (unique) — mã đơn hàng duy nhất dễ đọc.
- `customerId`: ObjectId (ref `User`) — người dùng đặt hàng.
- `providerId`: ObjectId | null — nhà cung cấp được phân công.
- `serviceId`: ObjectId (ref `Service`) — dịch vụ được chọn.
- `servicePackageId`: ObjectId | null — gói dịch vụ tùy chọn.
- `selectedOptionIds`: ObjectId[] — các tùy chọn dịch vụ được chọn.
- `selectedOptionsSnapshot`: bản chụp nhúng của các tùy chọn (id, name, optionType, fixedPrice, isFixedPrice) — ghi lại chi tiết tùy chọn tại thời điểm đặt hàng.
- `addressId`: ObjectId (ref `Address`) — địa điểm thực hiện dịch vụ.
- `locationId`: ObjectId | null (ref `Location`) — mục định vị địa lý.
- `orderType`: enum `normal|urgent|scheduled|recurring` — loại đơn hàng.
- `scheduledAt`: Date | null — thời điểm đã lên lịch.
- `status`: enum trạng thái đơn hàng — trạng thái hiện tại.
- `pricing`: nhúng `OrderPricing` (connectionFee, fixedServiceFee, platformCommissionRate, platformCommissionAmount, providerEarningAmount, promotionDiscountAmount, voucherDiscountAmount, totalPaidAmount, các field sửa chữa tùy chọn) — thông tin chi tiết định giá đầy đủ.
- `promotionSnapshot` / `voucherSnapshot`: bản chụp giảm giá nhúng — ghi lại giảm giá được áp dụng.
- `cancellation`: đối tượng hủy nhúng (cancelledBy, cancelledByRole, reason, cancelledAt) | null — thông tin hủy đơn.
- `confirmation`: timestamps xác nhận nhúng cho khách hàng/nhà cung cấp.
- Các field cơ bản & timestamps.
- Indexes: `{ customerId, createdAt:-1 }`, `{ providerId, createdAt:-1 }`, `{ status }`.

---

## Notification (collection: `notifications`)

- `userId`: ObjectId (ref `User`) — người nhận thông báo.
- `type`: string — danh mục thông báo.
- `title`: string — tiêu đề ngắn gọn.
- `content`: string — nội dung tin nhắn.
- `data`: mixed | null — payload tùy chọn (link id, metadata).
- `isRead`: boolean — cờ đã đọc.
- `readAt`: Date | null — thời điểm đọc thông báo.
- Các field cơ bản & timestamps.
- Index: `{ userId, isRead, createdAt:-1 }`.

---

## Message (collection: `messages`)

- `conversationId`: ObjectId (ref `Conversation`) — luồng hội thoại.
- `senderId`: ObjectId (ref `User`) — người dùng gửi tin.
- `senderRole`: enum `customer|provider|system` — vai trò người gửi.
- `messageType`: enum `text|image|system` — loại tin nhắn.
- `content`: string | null — nội dung văn bản.
- `imageUrl`: string | null — URL hình ảnh cho tin nhắn dạng ảnh.
- `status`: enum `sent|seen` — trạng thái gửi/đã xem.
- `seenAt`: Date | null — thời điểm đã xem.
- Các field cơ bản & timestamps.
- Index: `{ conversationId, createdAt }`.

---

## Feedback (collection: `feedbacks`)

- `orderId`: ObjectId (ref `Order`, unique) — đơn hàng được đánh giá.
- `customerId`: ObjectId (ref `User`) — người viết đánh giá.
- `providerId`: ObjectId (ref `Provider`) — nhà cung cấp được đánh giá.
- `serviceId`: ObjectId (ref `Service`) — dịch vụ được đánh giá.
- `rating`: number (1-5) — điểm đánh giá.
- `comment`: string | null — nhận xét dạng văn bản.
- `images`: string[] — URL các hình ảnh đính kèm.
- `providerReply`: string | null — phản hồi của nhà cung cấp.
- `isVisible`: boolean — cờ hiển thị.
- Các field cơ bản & timestamps.
- Index: `{ providerId, createdAt:-1 }`.

---

## Conversation (collection: `conversations`)

- `orderId`: ObjectId (ref `Order`, unique) — luồng hội thoại liên kết với đơn hàng.
- `customerId`: ObjectId (ref `User`) — khách hàng tham gia hội thoại.
- `providerId`: ObjectId (ref `Provider`) — nhà cung cấp tham gia hội thoại.
- `customerLastSeenAt`: Date | null — thời điểm khách hàng xem hội thoại lần cuối.
- `providerLastSeenAt`: Date | null — thời điểm nhà cung cấp xem hội thoại lần cuối.
- Các field cơ bản & timestamps.

---

## Complaint (collection: `complaints`)

- `orderId`: ObjectId (ref `Order`) — đơn hàng liên quan đến khiếu nại.
- `complainantId`: ObjectId (ref `User`) — người gửi khiếu nại.
- `targetUserId`: ObjectId (ref `User`) — người bị khiếu nại.
- `title`: string — tiêu đề ngắn gọn.
- `description`: string — mô tả chi tiết.
- `evidenceImages`: string[] — URL các hình ảnh bằng chứng.
- `status`: enum `pending|resolved` — trạng thái xử lý.
- `resolvedBy`: ObjectId | null — người giải quyết.
- `resolvedAt`: Date | null — thời điểm giải quyết.
- `resolutionNote`: string | null — ghi chú giải quyết.
- Các field cơ bản & timestamps.
- Indexes: `{ orderId }`, `{ status, createdAt:-1 }`.

---

## Common helpers (`common.ts`)

- `baseFields`: các field xóa mềm dùng chung: `isDeleted: boolean`, `deletedAt: Date | null`.
- `IBaseDocument`: các field `createdAt`, `updatedAt`, `isDeleted`, `deletedAt`.
- Kiểu `Money` là alias của `number`; helper `objectIdRef()` dùng để tạo tham chiếu ObjectId.

---

## Category (collection: `categories`)

- `name`: string — tên hiển thị của danh mục.
- `slug`: string (unique, chữ thường) — định danh slug.
- `description`: string | null — chi tiết mô tả.
- `icon`: string | null — URL hoặc class của icon.
- `isActive`: boolean — trạng thái khả dụng.
- Các field cơ bản & timestamps.

---

## Location (collection: `locations`)

- `userId`: ObjectId (ref `User`) — chủ sở hữu.
- `ownerType`: enum `customer|provider` — loại chủ sở hữu.
- `coordinates`: GeoJSON `Point` (`type: "Point"`, `coordinates: [lng, lat]`) — điểm không gian địa lý; được đánh index `2dsphere`.
- `addressText`: string | null — địa chỉ dạng văn bản.
- `province`: string | null — tỉnh/thành phố.
- `ward`: string | null — phường/xã.
- `isActive`: boolean — mục đang hoạt động.
- `lastUpdatedAt`: Date — thời điểm cập nhật lần cuối (mặc định Date.now).
- Các field cơ bản & timestamps.
- Indexes: `2dsphere` trên `coordinates`, `{ userId, ownerType }`.

---

## User (collection: `users`)

- `email`: string (unique) — email đăng nhập.
- `passwordHash`: string | null — mật khẩu đã được hash; null đối với tài khoản mạng xã hội.
- `googleId` / `facebookId`: string | null — id đăng nhập mạng xã hội.
- `fullName`: string — tên hiển thị.
- `phone`: string (sparse index) — số điện thoại tùy chọn.
- `avatar`: string | null — URL ảnh đại diện.
- `role`: enum `CUSTOMER|PROVIDER|ADMIN` — vai trò tài khoản.
- `status`: enum `active|locked` — trạng thái tài khoản.
- `isEmailVerified`: boolean — cờ xác minh email.
- `registerOtp`, `registerOtpExpire`, `resetPasswordTokenHash`, `resetPasswordExpire`, `resetPasswordOtp`, `resetPasswordOtpExpire` — các field tạm thời dùng cho OTP và đặt lại mật khẩu.
- `isDeleted`, `deletedAt`, timestamps.
- Indexes: `{ phone }`, unique partial indexes cho `googleId` và `facebookId` khi có giá trị.

---

## OrderAssignment (collection: `orderassignments`)

- `orderId`: ObjectId (ref `Order`) — đơn hàng được liên kết.
- `providerId`: ObjectId (ref `Provider`) — nhà cung cấp ứng viên.
- `status`: enum `pending|accepted|rejected|skipped|cancelled` — trạng thái phân công.
- `assignedAt`: Date — thời điểm được phân công (mặc định hiện tại).
- `responseDeadline`: Date — thời hạn nhà cung cấp phải phản hồi.
- `respondedAt`: Date | null — thời điểm nhà cung cấp phản hồi.
- Các field cơ bản & timestamps.
- Indexes: `{ orderId }`, `{ providerId, status }`.

---

## Violation (collection: `violations`)

- `userId`: ObjectId (ref `User`) — người vi phạm.
- `relatedReportId`: ObjectId | null — báo cáo liên quan (nếu có).
- `relatedComplaintId`: ObjectId | null — khiếu nại liên quan.
- `orderId`: ObjectId | null — đơn hàng liên quan.
- `violationType`: string — mã/tên loại vi phạm dạng văn bản.
- `severity`: enum `low|medium|high` — mức độ nghiêm trọng.
- `penaltyType`: enum `warning|account_locked|provider_suspended` — hình thức xử phạt.
- `status`: enum `active|resolved` — trạng thái vi phạm.
- `handledBy`: ObjectId (ref `User`) — admin đã xử lý.
- `note`: string | null — ghi chú nội bộ.
- `startAt`, `endAt`: Date | null — khoảng thời gian áp dụng hình phạt.
- Các field cơ bản & timestamps.
- Index: `{ userId, status }`.

---

## VoucherUsage (collection: `voucherusages`)

- `voucherId`: ObjectId (ref `Voucher`) — voucher được sử dụng.
- `userId`: ObjectId (ref `User`) — người sử dụng voucher.
- `orderId`: ObjectId (ref `Order`) — đơn hàng áp dụng voucher.
- `discountAmount`: number — số tiền được giảm.
- `status`: enum `used|restored|cancelled_not_restored` — vòng đời sử dụng voucher.
- `usedAt`: Date — thời điểm sử dụng (mặc định hiện tại).
- `restoredAt`: Date | null — thời điểm được hoàn trả.
- Các field cơ bản & timestamps.
- Unique index trên `{ voucherId, userId }` để giới hạn theo dõi mức sử dụng theo từng người dùng.

---

## Voucher (collection: `vouchers`)

- `code`: string (unique, chữ hoa) — mã voucher.
- `description`: string | null — chi tiết mô tả.
- `discountType`: enum `fixed|percentage` — cách tính giảm giá.
- `discountValue`: number — giá trị giảm giá.
- `maxDiscountAmount`: number | null — mức tối đa của giảm giá.
- `minOrderAmount`: number | null — giá trị đơn hàng tối thiểu để áp dụng.
- `totalUsageLimit`: number — tổng số lần voucher có thể được sử dụng.
- `usedCount`: number — số lần đã được sử dụng đến thời điểm hiện tại.
- `perUserLimit`: number — giới hạn sử dụng mỗi người dùng.
- `startAt`, `endAt`: Date — khoảng thời gian hiệu lực.
- `status`: enum `active|inactive|expired` — trạng thái.
- Các field cơ bản & timestamps.
- Index: `{ status, startAt, endAt }`.

---

## Wallet (collection: `wallets`)

- `userId`: ObjectId (ref `User`, unique) — ví người dùng được liên kết.
- `balance`: number — số dư khả dụng.
- `pendingBalance`: number — số dư đang chờ xử lý (chưa được giải ngân).
- `currency`: enum `VND` — mã tiền tệ (hiện chỉ hỗ trợ VND).
- Các field cơ bản & timestamps.

---

## WithdrawRequest (collection: `withdrawrequests`)

- `userId`: ObjectId (ref `User`) — người yêu cầu rút tiền.
- `walletId`: ObjectId (ref `Wallet`) — ví nguồn.
- `bankAccountId`: ObjectId (ref `BankAccount`) — tài khoản ngân hàng đích.
- `amount`: number — số tiền yêu cầu rút.
- `status`: enum `pending|approved|rejected` — trạng thái xử lý.
- `adminNote`: string | null — ghi chú của admin.
- `reviewedBy`: ObjectId | null — admin xét duyệt.
- `reviewedAt`: Date | null — thời điểm xét duyệt.
- Các field cơ bản & timestamps.
- Index: `{ status, createdAt:-1 }`.

---

## WalletTransaction (collection: `wallettransactions`)

- `walletId`: ObjectId (ref `Wallet`) — ví bị ảnh hưởng.
- `userId`: ObjectId (ref `User`) — chủ sở hữu ví.
- `relatedOrderId`: ObjectId | null — đơn hàng liên quan (nếu có).
- `relatedPaymentId`: ObjectId | null — thanh toán liên quan (nếu có).
- `relatedWithdrawRequestId`: ObjectId | null — yêu cầu rút tiền liên quan (nếu có).
- `type`: enum loại giao dịch (deposit, payment, refund, provider_earning, platform_fee, withdraw, withdraw_rejected, adjustment) — danh mục giao dịch.
- `direction`: enum `in|out` — chiều luồng tiền.
- `amount`: number — số tiền giao dịch.
- `balanceAfter`: number — số dư ví sau giao dịch.
- `status`: enum `pending|success|failed` — trạng thái giao dịch.
- `description`: string | null — ghi chú mô tả.
- Các field cơ bản & timestamps.
- Index: `{ walletId, createdAt:-1 }`.

---

Nếu bạn muốn mô tả chi tiết hơn (giá trị ví dụ, sơ đồ quan hệ, hoặc tài liệu mẫu), hãy cho biết model nào cần mở rộng và tôi sẽ cập nhật file.

File: [handigo-backend/MODELS_DOCUMENTATION.md](handigo-backend/MODELS_DOCUMENTATION.md)

---

## Payment API Update Notes

### Business flow

- Fixed-price services: customer creates an order, the system matches a provider, provider accepts, then the platform fee is deducted immediately from the provider wallet. Provider must top up wallet before accepting orders.
- Inspection-quote services: customer must pay an inspection deposit by PayOS before matching. The deposit belongs to the platform.
- Inspection-quote services do not deduct platform fee from provider wallet.
- If a customer no-shows on an inspection-quote order, the inspection deposit can be transferred to the provider as compensation.
- If no provider accepts an inspection-quote order, the inspection deposit can be marked as refunded.
- Cash payment does not create provider debt.

### Payment

- `method`: now supports `payos|vnpay|cash`.
- `paymentType`: `full|remaining|inspection_deposit`.
- `gatewayOrderCode`: PayOS orderCode used to find the payment from webhook payload.
- `gatewayPaymentLinkId`: PayOS payment link id for lookup/debugging.
- `gatewayTransactionId`: real gateway/bank transaction reference from PayOS webhook.
- `failedAt`: time when payment failed.
- `failureReason`: reason for payment failure.
- `refundReason`: reason for refund.
- `compensatedToProviderId`: provider receiving the inspection deposit as no-show compensation.
- `compensatedAt`: time when compensation was recorded.
- `metadata`: extra business data.
- New indexes: `{ gatewayOrderCode }`, `{ gatewayPaymentLinkId }`, `{ gatewayTransactionId }`, `{ orderId, paymentType, method, status }`.

### Order

- `depositAmount`: snapshot of the inspection deposit amount for the order. Fixed-price orders use `0`.
- `depositPaidAt`: time when inspection deposit was paid.
- `readyForMatching`: whether the order is eligible for provider matching.
- `platformFeeChargedAt`: time when the fixed-price platform fee was deducted from provider wallet.
- New index: `{ readyForMatching, status }`.

### WalletTransaction

- `transactionCode`: internal transaction code.
- `metadata`: extra transaction data such as `orderCode` or compensation reason.
- `platform_fee`: used when deducting fixed-price platform fee from provider wallet.
- `provider_earning`: used when transferring inspection deposit compensation to provider.
- `refund`: used for customer refund tracking when no provider accepts an inspection-quote order.
- New indexes: `{ transactionCode }`, `{ relatedOrderId, type, status }`.
