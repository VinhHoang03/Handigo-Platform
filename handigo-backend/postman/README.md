# Handigo Postman tests

Import all `*.postman_collection.json` files in this directory.

## Khách hàng hủy đơn sau khi thợ nhận

- Áp dụng cho dịch vụ giá cố định và báo giá, gồm đặt ngay, lịch hẹn và định kỳ.
- Trong vòng 5 phút kể từ lần nhận đơn hiện tại, khách được hủy và hoàn toàn bộ khoản ví/QR đã thanh toán về ví Handigo; tiền mặt chưa thu không phát sinh hoàn tiền. Quy tắc vẫn áp dụng nếu đơn đã chuyển sang đang thực hiện trong khoảng này.
- Sau 5 phút, API hủy từ chối với lỗi 409; API xem trước trả `canCancel: false`. Không cấp voucher cho trường hợp khách tự hủy.
- `GET /orders/:orderId` bổ sung `customerCancellationDeadline` (thời điểm ISO hoặc `null`) để web/app khóa nút hủy đúng hạn. Backend luôn tự kiểm tra lại khi thực hiện hủy.
- Mốc tính lấy từ lịch sử nhận đơn gần nhất, dự phòng bằng `respondedAt` của assignment đã nhận. Không dùng thời gian tạo/cập nhật đơn; đơn cũ thiếu cả hai mốc không tự mở quyền hủy.
- Kiểm thử độc lập, không gọi cổng thanh toán thật: `node --test tests/provider-replacement.test.cjs` trong thư mục backend.

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

Web và agent ưu tiên `PAYOS_RETURN_URL` cho thanh toán thành công; backend giữ URL cấu hình và thêm `orderId`, `payos`. Khi hủy, QR quay thẳng về bước thanh toán đặt dịch vụ hoặc chi tiết đơn theo nơi bắt đầu, không đi qua `PAYOS_CANCEL_URL` để tránh lỗi truy cập callback backend. Origin của URL web gửi được ưu tiên nếu nằm trong danh sách origin được phép; sau đó mới dùng `FRONTEND_URL`. Cách này giữ đúng HTTP/HTTPS và cổng của web đang sử dụng.

- Thành công khi không cấu hình URL: `<frontend>/customer/bookings/result?orderId=<orderId>&payos=success`.
- Hủy từ bước thanh toán đặt dịch vụ: `<frontend>/customer/bookings/new/payment?payos=cancel`.
- Hủy từ chi tiết đơn hoặc trợ lý: `<frontend>/customer/bookings/<orderId>?payos=cancel`.

Luồng agent dùng `FRONTEND_URL` và mặc định local là `https://localhost:5173`. Nạp ví cũng kiểm tra origin như thanh toán đơn, quay về `/customer/wallet` hoặc `/provider/wallet` theo vai trò đã xác thực; không dùng đường dẫn dự phòng HTTP khác với web HTTPS.

Ví dụ local qua backend:

```env
FRONTEND_URL=https://localhost:5173
PAYOS_RETURN_URL=http://localhost:5000/payment/success
PAYOS_CANCEL_URL=http://localhost:5000/payment/cancel
```

Backend vẫn nhận `/payment/success`, `/payment/cancel` cho QR cũ. Thành công chuyển sang trang kết quả; hủy chuyển sang chi tiết đơn nếu có `orderId` hợp lệ. Các ví dụ `PAYOS_CANCEL_URL` dưới đây chỉ còn áp dụng cho QR cũ.

Ví dụ production (thay domain mẫu bằng domain triển khai):

```env
FRONTEND_URL=https://app.example.com
PAYOS_RETURN_URL=https://api.example.com/payment/success
PAYOS_CANCEL_URL=https://api.example.com/payment/cancel
```

Trang kết quả frontend đối soát PayOS qua backend, hiển thị thanh toán thành công, đã hủy, thất bại/hết hạn, đang chờ hoặc đã hoàn tiền. Không dùng tham số URL làm bằng chứng thanh toán. Nếu cần đăng nhập lại, mã đơn và URL callback được giữ để quay lại sau đăng nhập. Khi khách yêu cầu thanh toán lại, QR đơn hàng đang chờ mà thiếu hoặc khác URL hủy hiện tại sẽ được kiểm tra và hủy trên PayOS trước khi tạo QR thay thế. Giao dịch đã nhận tiền hoặc chưa xác minh được kết quả sẽ không bị thay bằng QR mới.

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
