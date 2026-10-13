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
