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
| “Tôi muốn áp mã giảm giá” nhưng chưa nhập mã | `voucherPreference: choose`; kiểm tra lại mã khả dụng và cho chọn, kể cả trước đó không dùng mã. Không tự áp mã giảm nhiều nhất. |
| Không có mã dùng được | Nêu `voucherFeedback`: chưa có mã còn hiệu lực/còn lượt, sai loại đơn hoặc chưa đạt mức tối thiểu. Cho tiếp tục với giá chưa giảm; không bịa mã. |
| Mã chỉ áp dụng một loại đơn | Phân biệt đơn giá cố định và đơn báo giá/giảm phí cọc; không nhầm với đặt ngay/lịch hẹn. Chỉ hiển thị mã dùng được cho đơn đang đặt. |
| “Dùng hai mã này” | Giải thích mỗi đơn chỉ có một voucher và hỏi chọn một mã. |
| Mã hết hạn, hết lượt, thuộc người khác hoặc đang giữ cho đơn khác | Không áp dụng; đưa mã còn phù hợp hoặc lựa chọn bỏ mã. |
| Khách sửa giá/gói/số lượng | Kiểm tra lại mã đã chọn; nếu đang yêu cầu mã tốt nhất thì tính lại theo yêu cầu đó. |
| Mã không đủ điều kiện đơn tối thiểu | Giải thích dựa trên công cụ; không tự tăng số lượng hoặc thêm dịch vụ. |
| Mã giảm hết số tiền phải trả | Hệ thống ghi nhận thanh toán 0đ sau xác nhận; không yêu cầu chuyển khoản hoặc trừ tiền ví. |
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
| Khách nhập tên trường/tòa nhà hoặc chỉ phường/xã, tỉnh/thành phố | Gửi `addressText` cho `save_booking_address`; hệ thống tự xác thực khu vực, không yêu cầu số nhà/tên đường. Địa chỉ mới chỉ được giữ tạm cho bản nháp, chỉ hiện form xác nhận đơn hàng có địa chỉ mới. Lưu địa chỉ và đơn trong cùng giao dịch sau xác nhận; lỗi hoặc từ chối đặt thì không lưu địa chỉ mới. |
| Đổi địa chỉ khi đang có form đặt đơn | Vô hiệu form cũ, giữ dịch vụ/số lượng/lịch/thanh toán/voucher/yêu cầu thợ; kiểm tra lại rồi gửi form đặt đơn mới. Không có bước xác nhận lưu địa chỉ riêng. |
| Tra tọa độ không chính xác | Ưu tiên vị trí tham chiếu phường/xã và ghi rõ. Khu vực hợp lệ vẫn được giữ tạm cho bản nháp nếu chưa có tọa độ; tra lại/chọn ghim trước khi tìm thợ, không lưu tọa độ giả. |
| “Đặt ở đây nhưng giữ mặc định cũ” | Chọn địa chỉ cho bản nháp, giữ mặc định cũ. |
| “Bỏ bản nháp/xóa địa chỉ vừa thêm” | Phân biệt hai thao tác; bỏ bản nháp bỏ địa chỉ tạm, không xóa địa chỉ có sẵn trong sổ. Chưa có công cụ xóa địa chỉ, hướng dẫn Hồ sơ. |
| Sửa sổ địa chỉ khi đã có đơn | Không dùng thao tác sửa sổ để đổi nơi thực hiện của đơn; ưu tiên thêm địa chỉ mới. Không cam kết thông tin đơn cũ không bị ảnh hưởng; hướng dẫn kiểm tra chi tiết đơn hoặc hỗ trợ. |

## Nhiều yêu cầu trong cùng lượt

- “Dùng mã tốt nhất, chuyển sang nhà mẹ, thợ Minh lúc 9 giờ”: lưu đủ các yêu cầu, chỉ hỏi thông tin chưa xác định.
- Khi khách đổi ý, giữ các trường không đổi; lựa chọn từ danh sách cũ phải kiểm tra lại.
- “Đồng ý” hoặc “như cũ” khi có nhiều form/lựa chọn cần làm rõ; không thay thế nút xác nhận.
- Một công cụ lỗi không được làm mất thông tin khách vừa sửa hoặc âm thầm đổi mã/thợ/địa chỉ.

## Kiểm tra

Chạy `npx ts-node src/scripts/testAgentBookingExtras.ts` và `npx ts-node src/scripts/testAgentBookingVoucher.ts` tại `handigo-backend`. Các kiểm thử dùng dữ liệu giả lập; cần kiểm tra thêm hội thoại thật với LLM để đánh giá việc ánh xạ lời khách sang công cụ.

## Kiểm tra P1 với model và môi trường thật

`npx ts-node src/scripts/testAgentBookingP1.ts` kiểm tra các nút có dữ liệu cấu trúc khi model cố tình lỗi, đồng ý chính sách, giữ/khôi phục bản nháp, bước lỗi và hành động theo đúng đơn.

`npx ts-node src/scripts/testAgentBookingConversations.ts --live` dùng model theo cấu hình tiến trình kiểm thử hiện có. Có thể thêm `--case=khong-dau` để chạy riêng một tình huống. Bộ chạy không tự tải tệp môi trường, không in khóa API và chỉ dùng dữ liệu nghiệp vụ giả lập; không kết nối database, tạo đơn hoặc thanh toán thật. Kết quả là từng dòng JSON gồm mã tình huống, kết quả, thời lượng và bước công cụ cuối khi lỗi. Lệnh thiếu `--live` báo chưa chạy và trả mã thoát khác 0 để phân biệt với đạt kiểm thử.

Bộ hội thoại gồm câu không dấu, tên rút gọn, sửa nhiều trường, đổi ý liên tục, hai thợ trùng tên, đồng ý bằng lời và mở lại trạng thái đã lưu. Chạy bộ này chưa thay thế kiểm tra tài khoản CUSTOMER và các tích hợp thật bên dưới.

| Mã | Tình huống trên môi trường kiểm thử | Kết quả cần đạt | Trạng thái ngày 16/10/2026 |
| --- | --- | --- | --- |
| P1-01 | Bấm sửa số lượng/địa chỉ/lịch/thanh toán/thợ khi model trả sai JSON | Đúng giá trị đã chọn, đúng thợ dù trùng tên; không tạo đơn | Đã kiểm tra bằng backend và trình duyệt giả lập |
| P1-02 | Xem báo giá hoặc hoàn tiền khi AI không diễn giải được | Có kết quả nghiệp vụ, giữ nguyên bản nháp, không cộng khoản hoàn hai lần | Đã kiểm tra bằng giả lập |
| P1-03 | Voucher cá nhân có loại giảm phí cọc; mã cũ thiếu loại | Theo loại backend, mã cũ vẫn theo mặc định; không trừ giảm hai lần | Đã kiểm tra logic backend; cần đối chiếu model thật |
| P1-04 | Bỏ checkbox, gửi thiếu đồng ý hoặc dùng phiên bản cũ | Backend chặn; thay đổi chính sách/form yêu cầu xác nhận mới | Đã kiểm tra bằng giả lập |
| P1-05 | Đặt lại đơn B khi đang soạn A, chọn giữ/chuyển/quay lại | Không mất địa chỉ tạm, ảnh, lịch, số lượng, thanh toán; chưa tạo đơn | Đã kiểm tra logic backend; cần đối chiếu dữ liệu thật |
| P1-06 | Thợ A bận, thợ B rảnh cùng giờ | Không báo A rảnh; không tự thay người; chưa giữ chỗ | Đã kiểm tra bộ lọc thợ/thời lượng bằng giả lập; cần lịch thật |
| P1-07 | Đang xem B trong khi phiên giữ bản nháp/đơn A | Nút ghi rõ mã B, đúng thao tác theo trạng thái mới; câu mơ hồ phải hỏi lại | Đã kiểm tra logic và giao diện giả lập |
| P1-08 | Ngắt kết nối sau checkpoint, gửi lại đúng request | Tiếp tục từ kết quả đã lưu, không sửa/tạo đơn hoặc thu tiền lặp | Đã kiểm tra logic khôi phục và thử lại trên trình duyệt |
| P1-09 | Mở hai tab, sửa bản nháp ở tab A rồi gửi lựa chọn cũ từ B | Từ chối phiên bản cũ, không ghi đè thay đổi ở A | Đã kiểm tra phiên bản trên backend; cần đối chiếu hai tab thật |
| P1-10 | Mất mạng khi thanh toán PayOS/ví, sau đó mở lại chat | Đối soát đúng đơn, không tự chạy lại giao dịch hoặc đổi phương thức | Đã kiểm tra bằng giả lập; chưa chạy cổng thanh toán kiểm thử |
| P1-11 | Chạy hội thoại bằng model thật với các cách diễn đạt | Đối chiếu giá trị bản nháp, bước công cụ và điều kiện không ghi/thu tiền | Chưa chạy; cần cấu hình model của tiến trình kiểm thử |
| P1-12 | Mở lại phiên thật, thay trạng thái đơn qua thợ và nhận realtime | Nút hành động được tải lại từ backend, không dựa vào thẻ lịch sử cũ | Chưa chạy; cần môi trường và tài khoản kiểm thử |

Khi thực hiện P1-11/P1-12, ghi thêm môi trường, model, mã tình huống, kết quả mong đợi/thực tế và bước lỗi. Không đưa mật khẩu, token, khóa API hoặc dữ liệu khách thật vào báo cáo.
