# Kiểm tra các luồng agent booking được bổ sung

Ngày rà soát: 22/10/2026.

## Phạm vi

Triển khai các mục 1, 3, 4, 5 và 8 trong danh sách đã thống nhất. Loại mục 2 khỏi kế hoạch triển khai agent; không thêm chức năng đặt định kỳ.

## Hành vi và các trường hợp kiểm tra

| Phần | Trường hợp | Kết quả cần giữ |
| --- | --- | --- |
| Thanh toán khi thợ đang làm | Đơn giá cố định, đang thực hiện, chưa thanh toán | Có hành động kiểm tra thanh toán; giữ luồng đổi tiền mặt sang ví hoặc PayOS trên cùng đơn. |
| Thanh toán khi thợ đang làm | QR đang chờ, khách yêu cầu hủy | Xem trước và xác nhận; chỉ ẩn QR sau khi xác minh hủy; không hủy đơn, đổi phương thức hoặc tạo giao dịch mới. |
| Thanh toán khi thợ đang làm | Đơn hẹn giá cố định đang thực hiện chưa có giao dịch | Không trả nhầm về bước chờ thợ xác nhận lịch. |
| Thanh toán khi thợ đang làm | Đơn khảo sát đang thực hiện hoặc đơn đã kết thúc | Chặn thao tác không hợp lệ; không thu phần báo giá còn lại qua Handigo. |
| Thanh toán khi thợ đang làm | PayOS lỗi, đang xử lý, nhận một phần tiền hoặc nhận tiền đồng thời | Giữ cơ chế đối soát; không khẳng định hủy thành công hoặc thu thêm tiền. |
| Thợ thực hiện | Đơn đã có thợ được phân công | Đọc thợ thực tế của đúng đơn; không lấy thợ ưu tiên thay thế. |
| Thợ thực hiện | Có số điện thoại, đơn còn hoạt động | Hiển thị gọi điện và mở chat đúng đơn. |
| Thợ thực hiện | Thiếu số điện thoại | Không tạo số điện thoại; vẫn cho phép chat theo quyền của đơn. |
| Thợ thực hiện | Chưa có thợ hoặc hồ sơ thợ không còn khả dụng | Hiển thị trạng thái thiếu thông tin; không giữ thao tác liên hệ cũ. |
| Thợ thực hiện | Chưa chia sẻ vị trí | Nói rõ chưa có vị trí, không suy đoán thời gian đến. |
| Thợ thực hiện | Bản đồ tải lỗi rồi thử lại | Hiện lỗi và cho tải lại; sử dụng bản đồ theo dõi đơn hiện có. |
| Thợ thực hiện | Đơn kết thúc hoặc thợ/trạng thái đã thay đổi | Không cho theo dõi, liên hệ từ trạng thái không còn phù hợp; thẻ cũ được loại khi đối chiếu dữ liệu mới. |
| Thợ và đánh giá | Có nhiều đơn trong ngữ cảnh, khách nói “đơn này” | Hỏi lại đơn cần xử lý, không tự dùng đơn cũ. Các nút giao diện gửi ID có cấu trúc. |
| Đánh giá | Đơn chưa hoàn thành hoặc chưa có thợ | Không tạo đánh giá. |
| Đánh giá | Khách chưa chọn số sao hoặc số sao ngoài 1–5 | Yêu cầu lựa chọn hợp lệ; không tự mặc định 5 sao. |
| Đánh giá | Tạo đánh giá mới | Xem trước số sao, nhận xét, ảnh rồi xác nhận mới gửi. |
| Đánh giá | Đã có đánh giá | Không tự ghi đè; khách phải chọn sửa đánh giá hiện tại. |
| Đánh giá | Sửa số sao mà không đổi ảnh/nhận xét | Giữ ảnh và nhận xét cũ. Danh sách ảnh rỗng hoặc nhận xét rỗng được gửi rõ khi khách yêu cầu bỏ. |
| Đánh giá | Đánh giá đã thay đổi trước khi xác nhận | Kiểm tra lại phiên bản, không dùng bản xem trước cũ. |
| Đánh giá | Từ chối, gửi lại request hoặc lỗi tra cứu điều kiện | Không gửi khi từ chối; không ghi lặp cùng request; có lỗi và thao tác thử lại. |
| Ảnh hỗ trợ/khiếu nại | Tạo hỗ trợ, phản hồi hỗ trợ, tạo khiếu nại hoặc bổ sung bằng chứng | Dùng dịch vụ nghiệp vụ hiện có; ảnh đi vào đúng hồ sơ sau xác nhận. |
| Ảnh hỗ trợ/khiếu nại | Ảnh vừa gửi nhưng model bỏ trường ảnh hoặc gửi danh sách rỗng | Chốt ảnh của yêu cầu hiện tại vào hành động chờ xác nhận. |
| Ảnh hỗ trợ/khiếu nại | Khách bấm xác nhận hoặc bản xác nhận hết hạn | Không mất ảnh vì tin “Xác nhận” không có ảnh; hết hạn phải xem trước và xác nhận lại. |
| Ảnh hỗ trợ/khiếu nại | Ảnh ngoài phiên, URL không hợp lệ, ảnh trùng hoặc quá giới hạn | Chặn trước khi gửi. Chat giữ giới hạn 4 ảnh/lượt, 5 MB/ảnh. |
| Ảnh hỗ trợ/khiếu nại | Khiếu nại đã kết thúc hoặc không có ảnh bổ sung | Không bổ sung bằng chứng không hợp lệ. |
| Ảnh hỗ trợ/khiếu nại | Đang có bản nháp hoặc đã tạo đơn | Ảnh hỗ trợ không sửa ảnh của bản nháp/đơn; vẫn tải ảnh để dùng cho yêu cầu mới được. |
| Địa chỉ một lần | Khách yêu cầu không lưu, kể cả model chưa gửi trường lựa chọn | Giữ lựa chọn không lưu trong bản nháp, bản xác nhận và khi tạo đơn. |
| Địa chỉ một lần | Sửa số lượng hoặc tiếp tục bản nháp | Không mất lựa chọn không lưu. |
| Địa chỉ một lần | Khách đổi ý muốn lưu | Có thể cho phép lưu lại trước khi xác nhận đơn. |
| Địa chỉ một lần | Tạo đơn thành công | Chỉ giữ bản chụp địa chỉ trong đơn; không tạo mục sổ địa chỉ. |
| Địa chỉ một lần | Ghi đơn lỗi hoặc gửi lại cùng xác nhận | Không lưu địa chỉ hoặc tạo đơn trùng. |
| Địa chỉ một lần | Thợ xem đề nghị, nhận đơn và theo dõi | Đề nghị chưa nhận chỉ có khu vực; nhận việc và bản đồ dùng bản chụp địa chỉ, không yêu cầu mục sổ địa chỉ tồn tại. |
| Địa chỉ một lần | Đơn cũ có địa chỉ đã lưu | Tiếp tục đọc và hiển thị như trước; không xóa hay sửa sổ địa chỉ cũ. |
| Tất cả | Không phải CUSTOMER hoặc tài nguyên không thuộc khách | Giữ kiểm tra quyền, quyền sở hữu và validation của service hiện có. |

## Kiểm thử tự động

- Backend: build TypeScript; 20 bộ kiểm thử agent ngoại tuyến; bộ nhận việc `testBuildRegressions --assignments-only`; bộ bản chụp địa chỉ `testTrackingAddressSnapshot`.
- Frontend: build; ESLint các file thay đổi; 10 cấu hình Chrome gồm luồng thường, nghiệp vụ ảnh/voucher, lịch sử đơn/thợ, hủy QR và các phần bổ sung, mỗi nhóm trên màn hình rộng và hẹp.
- Các bộ mới/mở rộng trọng tâm: `testAgentFlowExtensions`, `testAgentPaymentCancellation`, `testAgentDraftAddress`, `testAgentBookingExtras`, `testBuildRegressions`, `testTrackingAddressSnapshot`.
- Kiểm thử giao diện mới: `node tests/agent-booking-web.mjs --flow-extensions`, thêm `--narrow` để kiểm tra màn hình hẹp.
- Database, LLM, PayOS và dữ liệu nghiệp vụ trong các bộ này được giả lập. Chưa chạy hội thoại với model thật hoặc giao dịch thanh toán thật; không đọc cấu hình bí mật để bật chế độ live.

## Tương thích và phạm vi dữ liệu

- Không thêm route thanh toán, trạng thái payment hoặc thay chính sách phí/hoàn tiền.
- Agent bổ sung hành động có cấu trúc cho tra thợ, đánh giá và lựa chọn lưu địa chỉ; request cũ tiếp tục được chấp nhận.
- Đơn dùng địa chỉ mới một lần được phép có `addressId = null` khi có bản chụp địa chỉ hợp lệ. Dữ liệu cũ không bị chuyển đổi. Các phần tạo đơn, đề nghị/nhận việc, hiển thị địa chỉ và tìm thợ thay thế đã được đối chiếu theo trường hợp này.
- API tìm thợ gần cho đơn đã có có thể lấy địa chỉ từ bản chụp của chính đơn đó; vẫn kiểm tra chủ sở hữu và dịch vụ của đơn.
- Audit dependency vẫn báo các vấn đề có sẵn: backend 21, frontend 12. Không thêm dependency hoặc tự cập nhật package trong phạm vi này.
