# Hoàn thiện các luồng AI

Phạm vi: các mục 1, 2, 3, 8, 9, 10, 11, 12 và 13 của đợt rà soát. Không sửa các mục 4–7 về xác minh khách vắng mặt và quyết định hoàn tiền khiếu nại.

| Luồng | Điều kiện và ngoại lệ |
| --- | --- |
| Đọc báo giá | Khấu trừ cọc, khoản đã trả qua hệ thống đúng mã/phiên bản và khoản trực tiếp đã ghi nhận. Đơn đã thanh toán đầy đủ hoặc bị hủy không báo còn nợ. Dữ liệu cũ thiếu giao dịch không làm phát sinh yêu cầu trả thêm khi đơn đã ghi nhận trả đủ. |
| Thanh toán phần còn lại | Chỉ khách sở hữu đơn khảo sát đã hoàn thành, đã trả cọc, có báo giá hiện tại hợp lệ. Chỉ ví/PayOS; bản xác nhận chốt mã, phiên bản và số tiền. Thiếu ví, thay đổi báo giá, đã trả trực tiếp/qua hệ thống, sai chủ đơn hoặc thợ không hợp lệ đều chặn. QR đang chờ được kiểm tra lại; đổi sang ví phải đóng và đối soát QR trước. QR đang xử lý/đã nhận tiền không tạo khoản thu thứ hai. |
| Bổ sung dịch vụ | Không yêu cầu nộp lại giấy tờ đăng ký mới, không tự từ chối vì mô tả/kinh nghiệm tùy chọn bị bỏ trống. Cần hồ sơ thợ đã được duyệt và dịch vụ còn hoạt động. Giữ tiêu chí tùy chỉnh về dịch vụ/chứng chỉ; thiếu căn cứ để đánh giá thì chuyển Admin. |
| Đọc ảnh hồ sơ | Chỉ tải ảnh thuộc phạm vi của người đăng ký hoặc hồ sơ thợ tương ứng. Mọi ảnh giấy tờ/chứng chỉ cần có quan sát rõ, liên quan, nhất quán, không còn điểm chưa chắc chắn để tự duyệt. Hai mặt giấy tờ dùng cùng URL, ảnh sai loại, mờ, lỗi tải, tệp ngoài phạm vi hoặc vượt giới hạn đều chuyển kiểm tra thủ công. PDF/DOC/video chưa được phân tích như ảnh. Không nhận diện khuôn mặt, xác minh danh tính độc lập hay khẳng định giấy tờ thật. |
| Ảnh hiện trạng có nước gần điện | Dấu hiệu nguy hiểm từ bộ đọc ảnh chuyển thẳng sang hướng dẫn an toàn; không tiếp tục tra dịch vụ hoặc tư vấn sửa chữa trong nhánh đó. |
| Xác nhận trên mobile | Hiện ngân hàng, số đã che, chủ tài khoản, số tiền, loại/đối tượng báo cáo, lịch cũ/mới, thông tin báo giá và ảnh đã chọn. Có trạng thái tải/lỗi ảnh và mở ảnh để xem. Không hiển thị mã ngân hàng nội bộ hoặc dấu vân tay tài khoản. |
| Kiểm duyệt nhận xét | Chỉ đọc đúng khách và đơn, có phân trang; phân biệt bản gắn với đánh giá hiện tại và bản gửi cũ/bị chặn. Duyệt nội dung không đồng nghĩa đang hiển thị. Không có bản ghi thì không kết luận bị từ chối. Không trả người duyệt/ghi chú nội bộ, không tự đăng lại hoặc thay đổi đánh giá. |
| Xóa đơn chưa thanh toán | Chỉ đơn đã tạo, chưa trả tiền và chưa đưa vào tìm thợ, khác với bỏ bản nháp hoặc hủy đơn. Có xác nhận riêng, kiểm tra phiên bản trước khi đóng QR và kiểm tra lại trong transaction. Không xóa khi đã nhận tiền hoặc chưa rõ kết quả. Ghi thời điểm xóa để đối soát sau mất phản hồi; phát lại hành động qua ledger không thực hiện lần hai. |

## Vận hành

- Không thay schema, enum hoặc route HTTP. Các công cụ mới vẫn chỉ dành cho CUSTOMER; AI admin vẫn chỉ xét hồ sơ `pending`/`resubmitted`.
- Đọc ảnh cần cấu hình Cloudinary và kết nối AI admin hiện có. Tối đa 8 ảnh và khoảng 14 triệu ký tự base64 trong một lượt; phần chưa đọc được luôn chặn tự duyệt. Hồ sơ vượt giới hạn cần Admin đọc bản gốc.
- Các tác vụ cũ chưa có kết quả đọc ảnh không đủ điều kiện tự duyệt theo kiểm tra mới. Không tự chạy lại hồ sơ đã được duyệt.
- Nguồn kiến thức tĩnh có hiệu lực cùng bản triển khai. Nếu bật Atlas, cần nhập lại nguồn đã được người phụ trách phê duyệt; không mặc định kho dữ liệu tự cập nhật:

```powershell
npm run ai:knowledge -- enqueue-builtins --approved-by="ma-nguoi-duyet-nguon"
npm run ai:knowledge -- worker --watch
npm run ai:knowledge -- status
```

## Kiểm thử

- `tests/ai-business-completion.test.cjs`: kiểm tra nguồn ảnh, giới hạn/phản hồi AI, an toàn ảnh, số tiền, phiên bản, phân quyền, dữ liệu kiểm duyệt, xác nhận và phát lại graph.
- `tests/ai-business-completion.integration.test.cjs`: MongoDB replica tạm và transaction thật; gateway PayOS giả lập để kiểm tra thu tiền đồng thời, đổi/hủy QR, xóa đơn và dữ liệu kiểm duyệt.
- `tests/admin-ai.integration.test.cjs`: tự duyệt ban đầu/bổ sung dịch vụ, hồ sơ ảnh thiếu/mờ/mâu thuẫn/ngoài quyền, thay đổi trạng thái trong lúc AI xử lý.
- Web/mobile kiểm tra nội dung thực sự hiển thị trong bản xác nhận và việc chưa ghi trước khi khách xác nhận.
