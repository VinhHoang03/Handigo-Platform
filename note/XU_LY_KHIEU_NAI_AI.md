# Xử lý khiếu nại với AI

AI lập phương án và hỗ trợ tiếp nhận; Admin quyết định xác nhận, từ chối hoặc kết thúc. Một lượt phân tích thành công không chứng minh khiếu nại đã được giải quyết.

## Phạm vi nghiệp vụ

| Nhánh | Nội dung đối chiếu | Hướng xử lý |
| --- | --- | --- |
| Thanh toán | Đúng đơn, loại khoản trả, phương thức, số tiền và giao dịch | Đối soát chênh lệch; tiền mặt hoặc khoản thu ngoài hệ thống cần chứng từ và xác minh hai bên. |
| Hoàn tiền | Khoản hoàn, trạng thái, kênh nhận và giao dịch ví | Phân biệt chưa có yêu cầu, đang chờ, thất bại, cần kiểm tra và đã hoàn tất. Không tự tạo khoản hoàn. |
| Chất lượng, hư hại, chưa hoàn tất | Phạm vi dịch vụ, ảnh trước/sau và ý kiến các bên | Kiểm tra thực tế và lập việc khắc phục; không bịa chính sách bảo hành hay bồi thường. |
| Sai giá, thu thêm | Báo giá, hạng mục, cọc thực trả, xác nhận các bên | Xác minh khoản chênh và chứng từ trước khi quyết định. |
| Lịch hẹn, không đến | Lịch hẹn, thời điểm đến, lịch sử trạng thái | Xác minh diễn biến; không tự hủy hoặc đổi thợ. Khách vắng mặt dùng quy trình riêng. |
| Hành vi, nội dung, đánh giá | Nội dung phản ánh, hội thoại và đánh giá liên quan | Bảo toàn bằng chứng, xác minh; Admin xét xác nhận và tạo vi phạm bằng chức năng hiện có. |
| Gian lận, đe dọa, an toàn | Dấu hiệu rủi ro và chứng cứ | Ưu tiên Admin can thiệp; không tự kết tội hay khóa tài khoản. |
| Lỗi hệ thống | Thời điểm, bước tái hiện, kết quả mong đợi/thực tế | Giao việc kiểm tra kỹ thuật và kiểm chứng lại sau khắc phục. |
| Chưa xác định | Nội dung cần làm rõ | Đề nghị xác minh/liên hệ; không mặc định từ chối. |

## Trạng thái và hành động

- **Đang chờ → Đang xem xét:** AI được tự tiếp nhận, ghi chú rõ chưa kết luận.
- **Chờ bổ sung bằng chứng:** AI chỉ tự yêu cầu tài liệu cụ thể người gửi có thể cung cấp; không yêu cầu dữ liệu nội bộ hay thông tin nhạy cảm. Ca tranh chấp, khẩn cấp, tài liệu chưa đọc được hoặc dữ liệu thu thập chưa đủ chuyển Admin. Không lặp yêu cầu đang chờ, không tự ghi đè hồ sơ Admin đang xem xét.
- **Xác nhận:** Admin xác nhận phản ánh có căn cứ. Chưa đồng nghĩa đã tạo vi phạm hoặc thực hiện chế tài.
- **Từ chối:** Admin ghi căn cứ và đối chiếu chính sách; không từ chối chỉ vì thiếu ảnh hoặc người gửi chưa phản hồi.
- **Đã giải quyết:** Admin ghi kết luận thực tế và kết quả xác minh từng công việc. Ca thiếu dữ kiện phải bổ sung, phân tích lại. Với nhánh hoàn tiền, hệ thống kiểm tra bản ghi hoàn tất đúng đơn và khoản thanh toán; đang chờ/thất bại chưa được kết thúc.
- **Đã hủy, đã kết thúc, đã có vi phạm hoặc khách vắng mặt:** không tạo tác vụ AI xử lý chung mới.

Mỗi phương án có lời phản ánh chưa xác minh, dữ kiện kèm nguồn, thông tin còn thiếu và người cung cấp, danh sách việc cần làm, người phụ trách, điều kiện hoàn tất và trạng thái đề xuất. Ảnh và lời tố cáo không tự trở thành dữ kiện đã xác minh.

## Thao tác trong giao diện

Nút **Xử lý tự động** ở trang Báo cáo mở cấu hình, chạy thử và kết quả. Trong chi tiết từng báo cáo có phần **Phân tích và phương án xử lý**. Khi tự động hóa tắt, nút phân tích chạy thử, không áp dụng quyết định từ lượt đó. Khi bật, AI có thể tiếp nhận hoặc yêu cầu bằng chứng; phần phương án cho Admin ghi nhận và xác nhận quyết định.

Các công việc chuyển tiền, bảo hành, sửa chữa và chế tài cần thực hiện qua quy trình tương ứng. Với công việc thực tế chưa có bản ghi tự động trong hệ thống, Admin chịu trách nhiệm kiểm tra và ghi bằng chứng hoàn tất; phần AI không tự thực hiện các công việc này.

## Bảo toàn dữ liệu và tương thích

- API bổ sung: `POST /ai/admin/assessments/:id/complaint-decision`, chỉ ADMIN; danh tính người quyết định lấy từ middleware xác thực.
- Đầu vào gồm trạng thái, căn cứ/kết quả và danh sách công việc đã kiểm tra. Không nhận kết quả AI hoặc danh tính người quyết định từ client.
- Kiểm tra lại dữ liệu nguồn trong transaction; hồ sơ, bằng chứng hay giao dịch thay đổi thì từ chối phương án cũ và yêu cầu phân tích lại.
- Quyết định và cập nhật báo cáo ghi trong cùng transaction; chống hai phiên áp dụng cùng phương án và rollback khi lưu lỗi.
- Kết quả cũ vẫn đọc được, nhưng cần phân tích lại trước khi áp dụng nghiệp vụ mới. Lượt chạy thử không được áp dụng.
- Dấu dữ liệu sau cập nhật của AI ngăn bộ quét tự tạo vòng lặp; thay đổi thực tế từ người dùng vẫn được phân tích lại.
- Schema bổ sung trường tùy chọn cho dấu dữ liệu và lịch sử quyết định trên lượt phân tích; không đổi enum trạng thái báo cáo hay chạy migration dữ liệu.
- Dữ liệu tài chính chỉ đọc các trường nghiệp vụ cần thiết, không gửi phản hồi thô của cổng thanh toán, thông tin tài khoản ngân hàng hay số dư ví vào AI.

## Kiểm chứng

Kiểm thử dùng MongoDB replica set cô lập và nhà cung cấp AI giả lập, bao phủ các nhánh nghiệp vụ, dữ liệu thiếu/tranh chấp, bổ sung bằng chứng, trạng thái hoàn tiền, quyền ADMIN, dữ liệu thay đổi, xử lý đồng thời, rollback và chống vòng lặp. Kiểm thử trình duyệt kiểm tra thao tác tại từng hồ sơ, chặn kết thúc khi thiếu bằng chứng hoặc kết quả công việc và bố cục desktop/điện thoại. Không dùng các bài kiểm thử này làm bằng chứng về độ chính xác của mô hình AI trên khiếu nại thực tế.
