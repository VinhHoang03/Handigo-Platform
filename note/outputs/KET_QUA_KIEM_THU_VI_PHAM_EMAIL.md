# Kết quả kiểm thử luồng vi phạm và email

Ngày kiểm tra: 08/11/2026.

## Kết quả thực thi

- Sau đợt sửa nghiệp vụ ADMIN mục 2–8, bộ kiểm thử vi phạm/email này đạt **124/124 mục**, không lỗi, không bỏ qua. Trong đó có **122 ca độc lập và 2 nhóm bao ngoài** được Node.js tính vào tổng. Kết quả nằm trong lần chạy hồi quy tổng hợp 195 mục backend.
- Build backend: **Đạt**, gồm TypeScript và xử lý đường dẫn import.
- Phạm vi: tạo vi phạm từ báo cáo, khiếu nại và yêu cầu hỗ trợ; áp dụng hình phạt; khóa/mở tài khoản; JWT; hàng đợi và worker email.
- MongoDB dùng replica set tạm riêng, có transaction thật; không kết nối database dự án.
- HTTP dùng JWT kiểm thử, middleware xác thực/phân quyền, validation, controller và service thật. Các module không liên quan trong router quản trị được cô lập để không cần cấu hình thanh toán.
- SMTP được giả lập; không gửi email ra ngoài.

Lệnh chạy từ `handigo-backend`:

```powershell
node --test --test-reporter=spec tests/violation-email.test.cjs tests/penalty-policy.test.cjs tests/violation-flow.integration.test.cjs
npm run build
```

## Tình huống ngoài luồng chuẩn và kết quả

| Nhóm tình huống | Kết quả đã kiểm chứng |
|---|---|
| Thiếu JWT, JWT sai/hết hạn, tài khoản không tồn tại hoặc đã xóa, phiên bản token cũ | HTTP 401; không tạo quyết định/email. |
| CUSTOMER, PROVIDER, giả role ADMIN trong JWT | HTTP 403; quyền lấy từ tài khoản trong database. |
| ADMIN bị khóa nhưng JWT còn hạn | HTTP 403. |
| Sai ID, enum, thiếu penalty, lý do rỗng, quyết định quá dài | HTTP 400 trước khi ghi database. |
| Tạm khóa thiếu thời hạn, null, 0, số âm, số thập phân, chuỗi số hoặc quá 3650 ngày | HTTP 400; hai biên hợp lệ 1 và 3650 ngày được kiểm tra thời điểm hết hạn. |
| Query phân trang, trạng thái, mức độ hoặc userId không hợp lệ | HTTP 400. |
| Nguồn hoặc người vi phạm không tồn tại/đã xóa | Service trả lỗi 404; không ghi dữ liệu dở dang. |
| Báo cáo đã hủy/từ chối, thiếu người vi phạm hoặc chọn ADMIN làm người vi phạm | Service trả lỗi 400. |
| Báo cáo khách vắng mặt chưa được xác nhận | Service trả lỗi 409. |
| Khiếu nại không phải báo cáo chất lượng dịch vụ | Service trả lỗi 404; báo cáo đúng loại được xử lý theo luồng REPORT hiện có. |
| Hạn chế tính năng không được hỗ trợ | Service trả lỗi 400; không tạo quyết định/email. |
| Chèn handledBy, status hoặc email vào body | Không ghi đè người xử lý, trạng thái và người nhận; người xử lý lấy từ JWT. |
| Query userId của người khác vào `/violations/me` | Chỉ trả vi phạm của người đang đăng nhập. |
| CUSTOMER đọc chi tiết quản trị | HTTP 403; ADMIN dùng ID sai nhận 400, ID không tồn tại nhận 404. |
| Tạo lại quyết định từ nguồn đã có vi phạm | Bị từ chối; giữ một vi phạm và một email. |
| Thay userId/orderId không khớp nguồn qua HTTP | HTTP 400; không khóa nhầm người hoặc tạo dữ liệu dở dang. |
| Yêu cầu hỗ trợ đã resolved/closed/cancelled | Không tạo vi phạm; cần mở lại theo chuyển trạng thái hợp lệ trước khi xử lý. |
| Hai admin cùng xử lý một REPORT hoặc SUPPORT_TICKET | Một giao dịch thành công, một bị từ chối; không nhân đôi quyết định/email. |
| Lỗi lưu email, thu hồi phiên hoặc cập nhật nguồn trong transaction | Rollback cả quyết định, khóa tài khoản, phiên và email liên quan. |
| Lỗi database qua HTTP | HTTP 500 với thông báo chung; không lộ lỗi nội bộ và không để dữ liệu dở dang. |
| Cảnh cáo | Tài khoản vẫn hoạt động, không thu hồi phiên; email ghi rõ cảnh cáo không khóa tài khoản. |
| Hạn chế chat/voucher/nhận đơn/tính năng chung | Chặn đúng tính năng; không khóa toàn tài khoản hoặc thu hồi phiên; có email. |
| Tạm khóa hết hạn | Tự mở tài khoản, giải quyết vi phạm hết hạn; phiên cũ vẫn bị thu hồi. |
| Nhiều hình phạt tạm khóa chồng nhau | Chỉ mở khi không còn quyết định khóa có hiệu lực. |
| Còn khóa vĩnh viễn, khóa thủ công, chưa hết hạn hoặc dấu nguồn khóa thay đổi | Không tự mở nhầm tài khoản. |
| Mở khóa thủ công | Giải quyết các hình phạt khóa; vẫn giữ hạn chế tính năng khác. |
| Khóa chính ADMIN đang thao tác hoặc ADMIN khác | Bị từ chối với lỗi 400. |
| Đổi về cùng trạng thái | Lỗi 409; không cập nhật lặp. |
| Dùng JWT cũ sau khi tạm khóa rồi hết hạn hoặc khóa/mở thủ công | HTTP 401; JWT mới theo phiên bản hiện tại được chấp nhận. |
| Tài khoản cũ thiếu email | Vẫn áp dụng hình phạt; không tạo email sai người nhận; ghi cảnh báo không chứa địa chỉ email. |
| Email null/rỗng/toàn khoảng trắng | Không tạo công việc gửi thư. |
| Email có khoảng trắng đầu/cuối hoặc thiếu họ tên | Trim người nhận; dùng lời chào mặc định khi thiếu họ tên. |
| Nội dung email chứa HTML nguy hiểm | Escape họ tên, mã tra cứu, nội dung vi phạm, lý do và quyết định; không đưa ghi chú nội bộ vào email. |
| Dữ liệu cũ thiếu lý do/quyết định cảnh cáo | Dùng nội dung thay thế; không hiển thị `null` hoặc `undefined`. |
| Hai worker cùng nhận email | Mỗi công việc được nhận một lần khi lease còn hiệu lực. |
| Công việc pending chưa tới giờ, processing còn lease, sent hoặc failed | Không gửi. |
| Worker dừng giữa lượt và lease hết hạn | Nhận lại bằng lease mới; lease cũ không cập nhật được công việc. |
| Worker dừng ở lần gửi thứ năm | Khi lease hết hạn, chuyển failed; không gửi lần thứ sáu. |
| SMTP lỗi | Sau các lần lỗi đầu, chờ lần lượt 1, 2, 4, 8 phút; lần thứ năm lỗi chuyển failed; không đảo ngược quyết định đã commit. |
| Database lỗi khi nhận công việc | Không gọi SMTP; monitor còn khả năng xử lý ở lượt kế tiếp. |
| Database lỗi khi ghi lịch thử lại | Không ghi nhận gửi thành công; lỗi được truyền ra lượt worker. |
| SMTP thành công nhưng ghi sent thất bại | Giữ processing; sau hết lease có thể gửi lại cùng Message-ID. Đây là khả năng gửi trùng đã tái hiện. |
| Tạo hai công việc cho cùng violationId | Unique index chặn bản ghi thứ hai. |
| Worker còn công việc sau mười email | Dừng lượt hiện tại ở mười email để nhường lượt tiếp theo. |
| Monitor được gọi khởi động lại khi đã chạy | Không chạy chồng lượt xử lý. |
| Dừng monitor khi đang gửi | Chờ lượt đang chạy hoàn tất; không chạy tiếp theo timer đã dừng; có thể khởi động lại. |
| Monitor gặp lỗi ở một lượt | Ghi thông báo chung, không đưa lỗi database/SMTP thô vào log; lượt kế tiếp vẫn chạy. |

## Lỗi phát hiện và đã sửa trong đợt kiểm thử

1. **Dữ liệu cũ thiếu email làm thất bại việc áp dụng khóa:** `save()` trước đây xác thực lại field email bắt buộc dù chỉ đổi trạng thái tài khoản. Đã dùng `validateModifiedOnly: true` trong thao tác áp dụng hình phạt; các field thay đổi vẫn được xác thực, giữ nguyên schema.
2. **JWT cũ dùng lại được sau mở khóa:** trước đây chỉ thu hồi refresh session. Đã tăng `tokenVersion` khi áp dụng hình phạt khóa hoặc khóa thủ công; middleware hiện có từ chối JWT cũ kể cả sau mở khóa.

## Hành vi cần chốt nghiệp vụ và giới hạn

- Đã sửa trường hợp tạo vi phạm từ SUPPORT_TICKET đã kết thúc: `resolved`, `closed`, `cancelled` đều bị chặn. Ticket `resolved` có thể mở lại thành `in_progress` theo quy tắc hiện có, sau đó mới tạo vi phạm. Giao diện ẩn thao tác tạo vi phạm khi ticket đã kết thúc.
- **Có khả năng gửi email trùng nếu SMTP đã nhận thư nhưng ghi trạng thái vào MongoDB thất bại.** Message-ID được giữ nguyên khi thử lại nhưng không bảo đảm hộp thư bên nhận tự loại trùng. Mô phỏng mất ghi trạng thái đã tái hiện hai lần gửi cùng Message-ID.
- Trạng thái `sent` phản ánh lời gọi SMTP thành công trong luồng hiện tại, không chứng minh thư đã vào hộp thư đến hoặc được đọc. Chưa kiểm tra SMTP thật, thư rác, thư bị trả lại hoặc giới hạn Gmail.
- Khôi phục được kiểm tra qua trạng thái lease trong MongoDB; chưa thử tắt tiến trình đột ngột ở mọi thời điểm, mất mạng thật hoặc MongoDB failover.
- Chưa kiểm tra giao diện trình duyệt, tải lớn hoặc mọi tổ hợp dữ liệu lịch sử. Các ca đạt xác nhận những tình huống nêu trên, không phải chứng minh bao phủ tuyệt đối mọi trường hợp.
- Test tích hợp dùng `mongodb-memory-server` từ runtime kiểm thử tạm đã có, theo pattern hiện tại của repository. Không thêm dependency và không đọc `.env`.
- Đã thử `graphify query "violation email worker penalty validation authorization"`; máy không nhận lệnh Graphify, nên phạm vi được xác minh trực tiếp từ mã nguồn.

## File kiểm thử

- `handigo-backend/tests/violation-email.test.cjs`: 27 ca đơn vị và giả lập lỗi email/worker.
- `handigo-backend/tests/penalty-policy.test.cjs`: 11 ca hồi quy chính sách hình phạt.
- `handigo-backend/tests/violation-flow.integration.test.cjs`: 84 ca độc lập và 2 nhóm bao ngoài, dùng MongoDB và HTTP thật trong môi trường kiểm thử cô lập.
