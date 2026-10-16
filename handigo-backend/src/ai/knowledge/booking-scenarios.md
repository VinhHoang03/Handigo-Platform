# Tình huống tương tác của agent đặt dịch vụ

Tài liệu đối chiếu với bản nháp, công cụ voucher, địa chỉ và ghép thợ hiện có. Kiến thức tĩnh giải thích cách dùng; số tiền, mã khả dụng và thợ phù hợp phải lấy lại từ công cụ nghiệp vụ.

## Voucher

| Lời khách hoặc tình huống | Cách xử lý |
| --- | --- |
| “Tôi có mã nào dùng được?” | Kiểm tra giá/gói và danh sách mã; nêu tiền giảm thực tế, để khách chọn. |
| “Mã nào tốt hơn?” | So tiền giảm sau giới hạn giảm; chỉ tư vấn, chưa chọn thay khách. |
| “Dùng mã giảm nhiều nhất giúp tôi” | `voucherPreference: best`; ưu tiên mã hết hạn sớm nếu giảm bằng nhau, hiển thị mã và tổng tiền trong form. |
| “Không dùng mã” rồi đổi gói/dịch vụ | Giữ quyết định từ chối trong cùng bản nháp. |
| “Cho chọn lại mã” | `voucherPreference: choose`; mở lại các lựa chọn hiện tại. |
| “Dùng hai mã này” | Giải thích mỗi đơn chỉ có một voucher và hỏi chọn một mã. |
| Mã hết hạn, hết lượt, thuộc người khác hoặc đang giữ cho đơn khác | Không áp dụng; đưa mã còn phù hợp hoặc lựa chọn bỏ mã. |
| Khách sửa giá/gói/số lượng | Kiểm tra lại mã đã chọn; nếu đang yêu cầu mã tốt nhất thì tính lại theo yêu cầu đó. |
| Mã không đủ điều kiện đơn tối thiểu | Giải thích dựa trên công cụ; không tự tăng số lượng hoặc thêm dịch vụ. |
| Mã giảm hết số tiền phải trả | Nêu giới hạn hiện tại: thanh toán qua agent yêu cầu số tiền lớn hơn 0. |
| Khách muốn đổi mã trên đơn đã tạo hoặc đã có giao dịch | Không sửa bản nháp cũ hoặc tạo lại đơn; hướng dẫn xem chức năng khả dụng trong chi tiết đơn. |
| Khách hỏi hủy đơn có lấy lại mã không | Không bảo đảm; kiểm tra danh sách mã hiện tại và điều kiện còn hạn/còn lượt. |
| Tra cứu mã lỗi | Giữ yêu cầu và thông tin vừa sửa; đưa nút kiểm tra lại hoặc không dùng voucher. Khách đã từ chối mã thì không chặn đặt đơn vì lỗi tra mã. |

## Chọn thợ

| Lời khách hoặc tình huống | Cách xử lý |
| --- | --- |
| “Đặt thợ Hùng” | Tìm tên; khớp duy nhất và đủ điều kiện thì hiển thị trong form; trùng tên phải chọn rõ. |
| “Cho tôi xem danh sách thợ” | `providerCriteria: choose`; đưa tên, điểm đánh giá, số đơn và khoảng cách nếu có dữ liệu. |
| “Chọn thợ gần nhất” | So khoảng cách có dữ liệu trong danh sách đang phù hợp; không suy ra giờ đến. |
| “Thợ đánh giá cao nhất/nhiều đơn nhất” | So đúng tiêu chí đã yêu cầu; không gọi là tốt nhất toàn hệ thống hoặc suy ra số năm kinh nghiệm. |
| “Thợ tốt nhất” | Hỏi khách ưu tiên đánh giá hay khoảng cách trước khi chọn. |
| Không có dữ liệu cho tiêu chí | Nói rõ, để khách chọn trực tiếp; không tạo số liệu. |
| Thợ vừa ngoại tuyến/bận hoặc lịch không còn phù hợp | Giữ yêu cầu đích danh; báo lý do và để khách đổi thợ, lịch/địa chỉ hoặc tạm dừng. |
| Đã chọn theo tiêu chí rồi sửa lịch/gói | Kiểm tra lại người đã chọn, không tự đổi sang người khác theo tiêu chí cũ. |
| “Lấy người thứ hai/anh Minh đó” | Đối chiếu danh sách mới nhất, chỉ ánh xạ ID khi xác định duy nhất. |
| “Thợ lần trước” | Chỉ dùng ID từ dữ liệu công cụ hỗ trợ; chưa xác định được thì hỏi tên hoặc hướng dẫn xem đơn cũ. |
| Chọn theo tuổi, giới tính, chứng chỉ hoặc giá riêng | Nêu chưa có bộ lọc tương ứng, không bịa danh sách. |
| Không có thợ phù hợp hoặc tra cứu lỗi | Không cam kết đã giữ chỗ; giữ bản nháp và đưa hướng xử lý tiếp. |
| Thợ đã chọn từ chối đơn đã tạo | Thông báo chủ động trong chat kèm lựa chọn; đọc `get_order_provider_options`, chọn người mới qua `select_order_provider`, xác nhận rồi chờ thợ phản hồi. |
| Thợ đã nhận yêu cầu người thay thế | Đọc lý do/thời hạn; cho chọn đích danh hoặc xác nhận `respond_provider_reassignment: accept` để hệ thống tìm. |
| Khách không muốn tìm người thay thế | `decline` sẽ hủy đơn; phải xác nhận phí hủy/hoàn tiền. Đóng form hoặc từ chối một thợ cụ thể không phải đồng ý hủy. |
| Hết hạn, thợ vừa ngoại tuyến hoặc đơn đã có người nhận | Không dùng bản xác nhận cũ; kiểm tra trạng thái và danh sách mới, không tạo thêm đơn/thanh toán. |

## Địa chỉ và người nhận

| Lời khách hoặc tình huống | Cách xử lý |
| --- | --- |
| Khách nêu địa chỉ khớp duy nhất trong sổ | Tái sử dụng ID; không tạo bản ghi trùng. |
| Hai địa chỉ cùng số nhà/đường khác tỉnh/phường | Hỏi chọn địa chỉ đủ rõ; không dùng mặc định để đoán. |
| “Ở nhà/ở công ty/nhà mẹ” | Đối chiếu địa chỉ và ghi chú; hỏi nếu chưa xác định. |
| Địa chỉ mới thiếu thông tin | Hỏi gộp phần thiếu; giữ dịch vụ, số lượng, lịch, voucher và thợ đã nêu. |
| “Đặt cho mẹ” | Xác định địa chỉ, người nhận và điện thoại; không sửa hồ sơ của khách. |
| “Đổi số điện thoại người nhận lần này” | Nêu rõ công cụ hiện sửa bản ghi trong sổ; không hứa thay tạm cho một lần. |
| “Dùng địa chỉ khác” | Chọn/thêm địa chỉ mới; không sửa đè địa chỉ cũ nếu khách chưa yêu cầu. |
| “Đừng lưu địa chỉ mới” | Giải thích luồng đặt hiện cần địa chỉ lưu; không tự lưu trái ý khách. |
| “Đặt tại vị trí hiện tại” hoặc gửi ảnh địa chỉ | Không tự lấy vị trí hoặc suy ra tọa độ từ ảnh; hướng dẫn chọn/ghim trong Hồ sơ. |
| Tra tọa độ không chính xác | Yêu cầu bổ sung địa chỉ hoặc ghim bản đồ, không lưu tọa độ giả. |
| “Đặt ở đây nhưng giữ mặc định cũ” | Chọn địa chỉ cho bản nháp, giữ mặc định cũ. |
| “Bỏ bản nháp/xóa địa chỉ vừa thêm” | Phân biệt hai thao tác; bỏ bản nháp không xóa địa chỉ. Chưa có công cụ xóa địa chỉ, hướng dẫn Hồ sơ. |
| Sửa sổ địa chỉ khi đã có đơn | Không dùng thao tác sửa sổ để đổi nơi thực hiện của đơn; ưu tiên thêm địa chỉ mới. Không cam kết thông tin đơn cũ không bị ảnh hưởng; hướng dẫn kiểm tra chi tiết đơn hoặc hỗ trợ. |

## Nhiều yêu cầu trong cùng lượt

- “Dùng mã tốt nhất, chuyển sang nhà mẹ, thợ Minh lúc 9 giờ”: lưu đủ các yêu cầu, chỉ hỏi thông tin chưa xác định.
- Khi khách đổi ý, giữ các trường không đổi; lựa chọn từ danh sách cũ phải kiểm tra lại.
- “Đồng ý” hoặc “như cũ” khi có nhiều form/lựa chọn cần làm rõ; không thay thế nút xác nhận.
- Một công cụ lỗi không được làm mất thông tin khách vừa sửa hoặc âm thầm đổi mã/thợ/địa chỉ.

## Kiểm tra

Chạy `npx ts-node src/scripts/testAgentBookingExtras.ts` và `npx ts-node src/scripts/testAgentBookingVoucher.ts` tại `handigo-backend`. Các kiểm thử dùng dữ liệu giả lập; cần kiểm tra thêm hội thoại thật với LLM để đánh giá việc ánh xạ lời khách sang công cụ.
