# Handigo Postman tests

Import all `*.postman_collection.json` files in this directory.

## Required data

- The API is running at `http://localhost:5000`, or update `baseUrl`.
- Customer, provider, and admin accounts are verified and exist.
- `completedOrderId` belongs to the customer and provider used by the collections.
- `chatOrderId` belongs to both chat participants and has status `accepted`,
  `in_progress`, or `completed`.
- At least one active category exists.
- For image upload, select 1-5 local image files in the Postman request. Each
  file must be at most 5 MB.

## Collections

- `handigo-auth`: registration, OTP, login, refresh, profile, password, logout.
- `handigo-feedback`: customer feedback, image upload, provider filters/reply,
  and admin moderation.
- `handigo-provider-admin`: categories, provider application, user management,
  and application review.
- `handigo-chat`: conversation creation, messages, pagination, seen state, and
  authorization/validation failures.

Run login requests first. Requests that create or fetch resources save returned
IDs into collection variables for later requests.

The create-feedback and create-provider-application requests require fresh
business data. Approval, user locking, password changes, and feedback
visibility requests mutate database state, so review those requests before
running an entire collection repeatedly.

## Quản lý gói đổi điểm và mã đã phát hành

### Kiểm tra số tiền đã xác nhận khi đặt đơn

`POST /orders` nhận thêm `expectedFinalAmount` (số nguyên không âm): tổng tiền sau ưu đãi/voucher khách đã xem. Nếu tổng hiện tại khác, trả lỗi 409 trước khi lưu đơn hoặc giữ lượt mã.

`POST /payments/create` nhận thêm `expectedAmount` (số nguyên không âm): khoản thanh toán khách đã xác nhận. Backend kiểm tra lại trước khi thanh toán và bên trong transaction, trước khi trừ ví hoặc tạo giao dịch. Cả hai trường đều tùy chọn để tương thích với client cũ; luồng đặt đơn trên web gửi chúng cho ví, PayOS và tiền mặt, kể cả khi số tiền bằng 0đ.

Nếu đơn có QR PayOS đang chờ và khách chọn ví/tiền mặt, cùng endpoint sẽ đối soát PayOS, xác minh QR đã hủy và chưa nhận tiền rồi mới chuyển phương thức. Ví thiếu tiền sẽ được báo trước khi hủy QR. Nếu PayOS đã nhận tiền, trả về giao dịch PayOS đã thanh toán và không tạo khoản thu mới. Lỗi đối soát/hủy hoặc giao dịch đang xử lý sẽ chặn chuyển phương thức để tránh thanh toán trùng. Tiền cọc đơn báo giá vẫn không hỗ trợ tiền mặt.

### URL trả về của thanh toán PayOS đơn hàng

Web và agent ưu tiên hai biến cấu hình `PAYOS_RETURN_URL`, `PAYOS_CANCEL_URL`. Backend giữ nguyên domain, đường dẫn và tham số có sẵn của URL cấu hình, tự thêm `orderId` và `payos` để gắn đúng đơn. URL client gửi không ghi đè hai biến đã cấu hình.

- Thành công: `<frontend>/customer/bookings/<orderId>?payos=success`.
- Hủy: `<frontend>/customer/bookings/<orderId>?payos=cancel`.

Khi chưa cấu hình hai biến, hệ thống dùng hai đường dẫn chi tiết đơn ở trên, với origin client hoặc `FRONTEND_URL`; local mặc định là `https://localhost:5173`.

Ví dụ local qua backend:

```env
FRONTEND_URL=https://localhost:5173
PAYOS_RETURN_URL=http://localhost:5000/payment/success
PAYOS_CANCEL_URL=http://localhost:5000/payment/cancel
```

Backend nhận hai route `/payment/success`, `/payment/cancel` và chuyển sang cùng route trên frontend theo `FRONTEND_URL`. Có thể cấu hình hai URL trỏ thẳng tới frontend để bỏ qua bước chuyển này.

Ví dụ production (thay domain mẫu bằng domain triển khai):

```env
FRONTEND_URL=https://app.example.com
PAYOS_RETURN_URL=https://api.example.com/payment/success
PAYOS_CANCEL_URL=https://api.example.com/payment/cancel
```

Trang kết quả frontend đối soát PayOS qua backend, hiển thị thanh toán thành công, đã hủy, thất bại/hết hạn, đang chờ hoặc đã hoàn tiền. Không dùng tham số URL làm bằng chứng thanh toán. Nếu cần đăng nhập lại, mã đơn và URL callback được giữ để quay lại sau đăng nhập. QR đã tạo trước thay đổi giữ URL cũ trên PayOS và cần được hủy/tạo mới để dùng đường dẫn mới.

### Quản lý gói và mã

Các API sau yêu cầu đăng nhập với quyền ADMIN:

- `GET /rewards/admin/offers`: lấy tất cả gói đổi điểm, gồm cả gói tạm dừng.
- `PUT /rewards/admin/offers`: thêm hoặc cập nhật gói theo `id`. Body gồm `id`, `name`, `points`, `discountType`, `discountValue`, `minOrderAmount`, `applicableOrderType`, `isActive` và `maxDiscountAmount` nếu có giới hạn.
- `GET /vouchers?source=all|public|reward`: lọc tất cả mã, mã thông thường hoặc mã đổi điểm. Vẫn hỗ trợ `page`, `limit`, `search`, `status`; mặc định không truyền `source` chỉ lấy mã thông thường để tương thích API cũ.

Ví dụ gói giảm phí cọc:

```json
{
  "id": "DEPOSIT100",
  "name": "Giảm 100% phí cọc",
  "points": 500,
  "discountType": "PERCENT",
  "discountValue": 100,
  "maxDiscountAmount": 30000,
  "minOrderAmount": 0,
  "applicableOrderType": "variable_price",
  "isActive": true
}
```

Cấu hình gói được lưu trong `system_configs`, dùng các gói mặc định khi chưa có cấu hình. Gói tạm dừng không xuất hiện trong danh sách đổi của khách. Thử lại yêu cầu đổi đã thành công vẫn trả mã cũ và không trừ điểm thêm, kể cả khi gói đã tạm dừng.

Response mã quản lý bổ sung `ownerId`, `reservedOrderId`, `applicableOrderType`. Mã đổi điểm đã cấp giữ nguyên quyền lợi; không sửa trực tiếp qua `PATCH /vouchers/:id`. ADMIN có thể bật/tắt hoặc xóa bằng API hiện có, nhưng không được tạm dừng/xóa mã đang giữ cho đơn còn hiệu lực, hoặc xóa mã đã sử dụng. Thay đổi trạng thái và cấu hình được ghi nhật ký quản trị.
