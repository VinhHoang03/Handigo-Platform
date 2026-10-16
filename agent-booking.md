# AI Agent Booking — Danh sách cải thiện theo thứ tự triển khai

Ngày rà soát: **16/10/2026**.

Phạm vi: **CUSTOMER trên web** và các công cụ/backend phục vụ luồng này. Không mở rộng sang mobile, giao diện ADMIN hoặc nghiệp vụ riêng của PROVIDER.

Tài liệu này tổng hợp đầy đủ 22 mục của đợt rà soát gần nhất, đánh số lại theo thứ tự triển khai. Cột “Mục rà soát cũ” giúp đối chiếu với danh sách đã trao đổi. Trạng thái triển khai được ghi riêng bên dưới; phần mô tả giữ hiện trạng tại thời điểm rà soát để đối chiếu với yêu cầu ban đầu.

## Trạng thái triển khai P1 — 16/10/2026

| Mục | Trạng thái | Kết quả |
| --- | --- | --- |
| 1 | Đã triển khai, có kiểm thử | Sửa số lượng/tùy chọn, địa chỉ, lịch, thanh toán, chọn thợ và tạm dừng/tiếp tục bằng dữ liệu có cấu trúc; kiểm tra phiên bản bản nháp. Đọc báo giá/hoàn tiền trả kết quả trực tiếp, không cần AI diễn giải thành công. |
| 2 | Đã triển khai, có kiểm thử | Sửa prompt/kho kiến thức theo `applicableOrderType`; giữ mặc định mã cá nhân cũ và cách tính giảm/cọc của backend. |
| 3 | Đã triển khai, có kiểm thử | Bản xác nhận chứa phiên bản băm và snapshot chính sách công khai. Backend yêu cầu đồng ý đúng phiên bản, lưu thời điểm/actionId trong hành động của phiên; chính sách/form đổi phải xác nhận lại. |
| 4 | Đã triển khai, có kiểm thử | Đặt lại khi có bản nháp sẽ hỏi giữ/chuyển. Giữ bản dự phòng để khôi phục cả địa chỉ tạm, ảnh và lựa chọn; kiểm tra lại trước khi xác nhận, không quay lại bản nháp sau khi đã tạo đơn. |
| 5 | Đã triển khai, có kiểm thử | Kiểm tra khả dụng theo đúng `preferredProviderId`, thời lượng và địa chỉ; tự lấy thợ đã chọn từ bản nháp nếu công cụ chưa truyền. Giữ nguyên điều kiện trực tuyến hiện có. |
| 6 | Đã triển khai, có kiểm thử | Lưu đơn đang xem riêng với bản nháp; nút ghi rõ mã đơn và dùng đúng ngữ cảnh. Hỏi lại khi “đơn này” có nhiều khả năng. |
| 7 | Đã triển khai, có kiểm thử | Backend tải trạng thái hiện tại thuộc khách để trả khả năng xem báo giá, tra hoàn, kiểm tra thanh toán và đặt lại. Web ẩn thao tác không phù hợp, làm mới sau phản hồi/khôi phục phiên/sự kiện đơn. |
| 8 | Đã triển khai, có kiểm thử | Lưu bước đọc/chuẩn bị bị lỗi và phiên bản dữ liệu để thử lại; không báo lỗi nguồn thành kết quả rỗng. Tiếp tục request đã lưu không sửa bản nháp lần hai; thanh toán chưa rõ vẫn dùng đối soát cũ. |
| 9 | Đã bổ sung bộ chạy; chưa hoàn tất kiểm chứng thực tế | Có bộ hồi quy backend/web, bộ hội thoại chạy với model thật theo cờ `--live`, và bảng tình huống môi trường thật. Chưa chạy model thật/tài khoản CUSTOMER/cổng thanh toán kiểm thử vì chưa có môi trường và phiên truy cập được xác nhận. |

Các mục P2/P3 vẫn chưa triển khai trong đợt này.

### Ảnh hưởng đến module và khả năng tương thích

- Request chat bổ sung tùy chọn `bookingAction` cho các nút; tin nhắn tự do giữ nguyên. Giá trị và quyền sở hữu vẫn do công cụ/backend kiểm tra, không lấy câu văn hiển thị làm dữ liệu thao tác.
- Request xác nhận bổ sung `policyConsent` gồm `accepted: true` và `version`. Chỉ xác nhận tạo đơn cần trường này. Form/phiên cũ được kiểm tra và yêu cầu form mới khi nội dung khác; request thiếu đồng ý không được tạo đơn.
- API chính sách công khai bổ sung `version`. Bản xem trước agent giữ `policyVersion` và `bookingPolicies`; không đổi route hoặc tên trường cũ.
- Kết quả phiên bổ sung `viewedOrder`, `orderActions`, `rebookProposal`, `draftBackup` và `retryableStep`; frontend chat đã đồng bộ. Bản dự phòng đầy đủ, tham số thử lại và thời điểm đồng ý được lưu trong dữ liệu phiên hiện có, không công khai toàn bộ trạng thái nội bộ qua các trường mới.
- Công cụ kiểm tra giờ bổ sung `preferredProviderId` tùy chọn; dữ liệu bản nháp là nguồn mặc định khi cùng dịch vụ. Không thay chính sách thợ ngoại tuyến, trạng thái đơn hoặc cách thu tiền sửa chữa.
- Không thêm dependency, không đổi schema đơn hàng hoặc ví, không có migration và không chạy thao tác ghi dữ liệu thật.

### Kiểm thử và phần còn cần xác minh

- Đã đạt build backend/web và lint các file frontend thay đổi. Đã chạy đạt 11 script backend chọn lọc: P1, khôi phục booking, tìm/thao tác đơn cũ, lịch sử booking, thợ từng đặt, yêu cầu voucher, giá/voucher, booking bổ sung, địa chỉ tạm, PayOS nhúng và mặc định sửa điều hòa.
- Đã đạt kiểm thử Chrome với API giả lập: luồng sửa form/nạp ví, nghiệp vụ/giữ–chuyển–khôi phục bản nháp và tìm đơn/thợ cũ ở 1100×900 lẫn 430×932; cuộn chat ở 430×932. Các kết quả này không thay cho kiểm chứng tài khoản/model thật của mục 9.
- Bộ mới: `handigo-backend/src/scripts/testAgentBookingP1.ts` kiểm tra model lỗi, dữ liệu nút, tab cũ, checkpoint, chính sách/snapshot, bản nháp dự phòng gồm ảnh/địa chỉ tạm, ngữ cảnh đơn và khả năng thao tác.
- Bộ hội thoại: `handigo-backend/src/scripts/testAgentBookingConversations.ts --live`; dùng model của tiến trình kiểm thử cùng dữ liệu nghiệp vụ giả lập, không tự đọc tệp môi trường hoặc ghi đơn/thu tiền. Chưa chạy với model thật.
- Ma trận kiểm tra, điều kiện và trạng thái từng ca nằm trong [booking-scenarios.md](handigo-backend/src/ai/knowledge/booking-scenarios.md#kiểm-tra-p1-với-model-và-môi-trường-thật).
- `npm audit` vẫn báo dependency hiện có: backend 20 cảnh báo (1 critical, 15 high, 3 moderate, 1 low), web 10 cảnh báo (8 high, 2 moderate). Không cập nhật package trong phạm vi P1; kết quả này không được coi là đã đạt kiểm tra bảo mật dependency.

## 1. Hiện trạng và nguyên tắc triển khai

Luồng đã có: tìm dịch vụ, đặt/sửa bản nháp, địa chỉ tạm, chọn thợ và xem hồ sơ, voucher, bản xác nhận, thanh toán, nạp ví quay lại đúng phiên/đơn, tìm đơn cũ, đặt lại, tìm thợ từng phục vụ, đọc/từ chối báo giá, tra hoàn tiền, ảnh hiện trạng và cập nhật tiến độ.

Đã có kiểm tra lại thông tin khi xác nhận, cơ chế chống tạo trùng đơn/giao dịch và đối soát khi kết quả chưa rõ. Cần tiếp tục sử dụng các cơ chế này khi bổ sung chức năng.

Nguyên tắc thực hiện:

- Phân tích và tái sử dụng module hiện có; chỉ sửa trong phạm vi từng mục.
- Giữ các thông tin khách không yêu cầu thay đổi; không tự đổi dịch vụ, thợ, voucher hoặc phương thức để vượt qua lỗi.
- Phân biệt rõ: chọn thông tin, chuẩn bị bản nháp, xác nhận tạo đơn và thanh toán.
- Thao tác liên quan đơn/tiền phải kiểm tra quyền sở hữu, trạng thái và dữ liệu hiện tại trên backend.
- Không tự đổi API contract, schema hoặc nghiệp vụ đã có. Khi một mục cần thay đổi, phải xác định các module bị ảnh hưởng và giữ tương thích dữ liệu cũ.
- Những điểm ghi “Cần chốt” là quyết định nghiệp vụ phải làm rõ trước khi triển khai phần phụ thuộc.
- Kết quả rà soát dựa trên code và kiểm tra giả lập có chọn lọc; chưa kiểm chứng toàn bộ tình huống với tài khoản và model AI thật.

## 2. Thứ tự triển khai tổng thể

- **P1:** ổn định luồng hiện tại, xử lý điểm dễ sai và bổ sung bằng chứng xác nhận.
- **P2:** hoàn thiện nghiệp vụ và các bước xử lý cho khách hàng.
- **P3:** mở rộng sau khi chốt phạm vi, trạng thái và cách xử lý các tình huống phát sinh.

| Thứ tự mới | Mục rà soát cũ | Ưu tiên | Công việc |
| --- | --- | --- | --- |
| 1 | 1 | P1 | Xử lý xác định cho các nút thao tác và trả kết quả khi AI lỗi |
| 2 | 2 | P1 | Đồng bộ quy tắc voucher giữa backend, prompt và kho kiến thức |
| 3 | 3 | P1 | Ghi nhận đồng ý chính sách và phiên bản trên backend |
| 4 | 4 | P1 | Bảo vệ bản nháp đang soạn khi đặt lại từ đơn cũ |
| 5 | 5 | P1 | Kiểm tra lịch riêng của thợ khách đã chọn |
| 6 | 17 | P1 | Tách đơn đang xem khỏi bản nháp đang đặt |
| 7 | 18 | P1 | Hiển thị hành động theo khả năng thực tế của đơn/bản nháp |
| 8 | 21 | P1 | Khôi phục lỗi và thử lại đúng bước |
| 9 | 22 | P1 | Bổ sung kiểm thử hội thoại với model và môi trường thực tế |
| 10 | 6 | P2 | Sửa phân trang và nhóm lịch sử thợ từng phục vụ |
| 11 | 19 | P2 | Hiển thị phần vừa thay đổi, chênh lệch tiền và quay lại |
| 12 | 7 | P2 | Tìm lịch thay thế theo điều kiện của khách |
| 13 | 9 | P2 | Đặt hộ với người nhận riêng cho lần đặt |
| 14 | 10 | P2 | Địa chỉ dùng một lần, không lưu vào sổ |
| 15 | 11 | P2 | Chọn ghim/điểm hẹn trong chat |
| 16 | 8 | P2 | Đặt dịch vụ theo ngân sách |
| 17 | 20 | P2 | Khép kín tình huống chưa tìm được thợ |
| 18 | 13 | P2 | Thống nhất nghiệp vụ chấp nhận báo giá |
| 19 | 12 | P2 | Dời lịch hoặc đổi địa chỉ đơn đã tạo |
| 20 | 14 | P3 | Đặt dịch vụ định kỳ qua agent |
| 21 | 15 | P3 | Đặt nhiều dịch vụ trong một yêu cầu |
| 22 | 16 | P3 | Chăm sóc, đánh giá và hỗ trợ sau hoàn thành |

Thứ tự khởi đầu giữ theo đề xuất đã trao đổi: **1 → 2 → 3 → 4 → 5 → 6 → 7**, tương ứng các mục rà soát cũ **1 → 2 → 3 → 4 → 5 → 17 → 18**.

Mục 9 phải bắt đầu cùng giai đoạn P1 và được bổ sung xuyên suốt các mục sau; không đợi đến cuối mới kiểm thử. Với mục cần quyết định nghiệp vụ như 18–21, có thể làm rõ yêu cầu sớm nhưng chỉ triển khai sau khi đã chốt.

## 3. Giai đoạn P1 — Ổn định luồng hiện tại

### 1. Xử lý xác định cho các nút thao tác và trả kết quả khi AI lỗi

- **Hiện trạng:** một số nút sửa số lượng, địa chỉ, lịch và chọn thợ vẫn gửi câu văn để AI diễn giải. Luồng đọc báo giá/hoàn tiền còn cần AI tạo câu trả lời sau khi lấy dữ liệu. Tìm đơn cũ, thợ từng đặt và một số lệnh voucher đã có nhánh xử lý trực tiếp.
- **Cần làm:** mở rộng cách xử lý trực tiếp cho các thao tác đã có dữ liệu rõ trên giao diện; tránh để một nút cố định phụ thuộc hoàn toàn vào model chọn đúng công cụ hoặc trả JSON đúng định dạng. Khi đã lấy được dữ liệu nghiệp vụ, vẫn hiển thị được kết quả và bước tiếp theo nếu phần diễn giải AI lỗi.
- **Tiêu chí hoàn thành:** giả lập model trả sai định dạng hoặc không phản hồi, các thao tác cố định vẫn xử lý đúng đối tượng; giữ nguyên validation, quyền sử dụng công cụ, bước xác nhận và cơ chế chống thực hiện lặp.

### 2. Đồng bộ quy tắc voucher

- **Hiện trạng:** một số hướng dẫn cho AI vẫn nói mã cá nhân chỉ dùng với đơn giá cố định, trong khi backend kiểm tra theo `applicableOrderType`.
- **Cần làm:** đối chiếu và thống nhất prompt, kho kiến thức, phản hồi tư vấn và kết quả công cụ. Loại mã phải dựa trên điều kiện backend, gồm đơn giá cố định và đơn báo giá/giảm phí cọc.
- **Giữ nghiệp vụ hiện có:** mã cá nhân cũ chưa có loại vẫn tuân theo quy tắc mặc định của backend; không tự đổi toàn bộ mã cũ sang dùng được cho cọc. Một đơn chỉ dùng một voucher; không tự tăng số lượng để đạt mức tối thiểu.
- **Tiêu chí hoàn thành:** kiểm thử mã công khai/cá nhân, giới hạn loại đơn, mức tối thiểu, hết hạn/hết lượt, đang giữ ở đơn khác, bỏ mã và giảm về 0đ; agent không từ chối mã hợp lệ vì kiến thức cũ.

### 3. Ghi nhận đồng ý chính sách trên backend

- **Hiện trạng:** checkbox đồng ý được quản lý trên web; request xác nhận chủ yếu có `actionId` và quyết định. Chưa thể hiện đầy đủ bằng chứng về phiên bản chính sách khách đã đồng ý.
- **Cần làm:** gắn việc đồng ý chính sách với đúng bản xác nhận và phiên bản chính sách trên backend; xác định cách ghi nhận thời điểm đồng ý và xử lý khi chính sách thay đổi.
- **Cần chốt:** dữ liệu nào cần lưu, phiên bản chính sách lấy từ đâu và các trường hợp phải đồng ý lại. Xác định ảnh hưởng đến request, trạng thái phiên và dữ liệu đơn trước khi sửa contract/schema.
- **Tiêu chí hoàn thành:** không thể vượt bước đồng ý chỉ bằng việc bỏ qua checkbox trên frontend; bản xác nhận hoặc chính sách thay đổi phải kiểm tra và yêu cầu đồng ý lại theo quy tắc đã chốt.

### 4. Bảo vệ bản nháp khi đặt lại từ đơn cũ

- **Hiện trạng:** `rebook_booking` tạo bản nháp từ đơn cũ và thay trực tiếp bản nháp đang có. Khách đang soạn đơn A rồi đặt lại đơn B có thể mất phần đang làm.
- **Cần làm:** thông báo rõ việc thay bản nháp; cho khách chọn tiếp tục bản đang soạn hoặc chuyển sang đặt lại. Có khả năng khôi phục bản trước khi khách đổi ý.
- **Giữ nghiệp vụ hiện có:** đặt lại phải chọn lịch mới, kiểm tra giá/voucher/thợ hiện tại; không sao chép giao dịch hoặc tạo đơn ngay.
- **Tiêu chí hoàn thành:** chọn không chuyển thì bản nháp cũ còn nguyên; chuyển và quay lại không mất địa chỉ tạm, số lượng, lịch, phương thức hoặc ảnh của bản nháp trước.

### 5. Kiểm tra lịch riêng của thợ đã chọn

- **Hiện trạng:** công cụ kiểm tra giờ tìm bất kỳ thợ phù hợp, chưa nhận thợ ưu tiên để xác định riêng lịch của người khách đã chọn. Backend vẫn kiểm tra lại thợ khi chuẩn bị/xác nhận đặt đơn.
- **Cần làm:** phân biệt “giờ này có thợ” với “thợ bạn chọn rảnh giờ này”; kiểm tra lịch theo đúng dịch vụ, địa chỉ, số lượng, thời lượng và thợ được yêu cầu.
- **Cần chốt:** thợ đang ngoại tuyến có được nhận lịch tương lai hay không; không tự bỏ điều kiện trực tuyến khi chưa thống nhất nghiệp vụ.
- **Tiêu chí hoàn thành:** khi thợ A bận nhưng thợ B rảnh, agent không báo A rảnh; đưa lựa chọn đổi giờ hoặc đổi thợ và không tự quyết định thay khách.

### 6. Tách đơn đang xem khỏi bản nháp đang đặt

- **Hiện trạng:** phiên có bản nháp/đơn liên quan và dữ liệu thanh toán; thanh hành động chung thường lấy ngữ cảnh từ các dữ liệu này. Khách có thể đang tra đơn B trong khi phiên vẫn giữ đơn A.
- **Cần làm:** xác định riêng đơn đang xem/thao tác và bản nháp đang soạn; hiển thị mã đơn công khai để khách biết thao tác sẽ áp dụng cho đơn nào.
- **Tiêu chí hoàn thành:** xem báo giá, hoàn tiền hoặc thanh toán của B không dùng nhầm A; tra cứu không ghi đè bản nháp; câu “đơn này” phải được làm rõ nếu còn nhiều khả năng.

### 7. Hiển thị hành động theo khả năng thực tế

- **Hiện trạng:** các thẻ tìm đơn đã có điều kiện hiển thị nút, nhưng thanh hành động chung còn có thể hiện “Xem báo giá”, “Tra hoàn tiền” chưa sát trạng thái đơn/dịch vụ.
- **Cần làm:** backend xác định các thao tác đang được phép theo trạng thái đơn, thanh toán, báo giá, bản nháp và tình trạng đối soát; web dùng kết quả đó để hiển thị/khóa thao tác.
- **Tiêu chí hoàn thành:** không gợi ý thao tác không phù hợp; giải thích được lý do chưa thể thực hiện; trạng thái đổi phải làm mới khả năng thao tác. Backend vẫn kiểm tra lại khi thực hiện, không tin riêng trạng thái nút trên web.

### 8. Khôi phục lỗi và thử lại đúng bước

- **Hiện trạng:** đã có giữ request, kết quả công cụ và đối soát; một số lỗi vẫn đưa khách vào thông báo chung hoặc cần AI suy luận lại bước tiếp theo.
- **Cần làm:** phân biệt lỗi AI, tra địa chỉ, tìm thợ, tra voucher và thanh toán. Thử lại đúng bước lỗi, giữ lựa chọn cũ và tận dụng kết quả đã xác minh của các bước trước.
- **Tiêu chí hoàn thành:** lỗi nguồn không bị báo thành địa chỉ thiếu thông tin, không có voucher hoặc chưa có lịch sử; thanh toán chưa rõ kết quả tiếp tục đối soát, không tự tạo giao dịch/đơn mới hoặc tự đổi phương thức.

### 9. Kiểm thử hội thoại với model và môi trường thực tế

- **Hiện trạng:** có các bộ kiểm thử backend/web bằng dữ liệu giả lập; các kiểm thử này chưa chứng minh đầy đủ khả năng hiểu câu của model đang chạy.
- **Cần làm:** lập bộ tình huống thực tế gồm câu không dấu, tên rút gọn, yêu cầu nhiều thay đổi, đổi ý liên tục, nhiều đơn/thợ cùng tên, mở lại phiên, mất mạng và nhiều tab.
- **Phạm vi kiểm thử:** kết hợp kiểm thử logic xác định, kiểm thử giao diện và kiểm thử hội thoại với model thật trong môi trường kiểm thử; thao tác đơn/tiền dùng tài khoản và cơ chế kiểm thử phù hợp.
- **Tiêu chí hoàn thành:** ghi được kết quả mong đợi, kết quả thực tế và bước lỗi của từng tình huống; các lỗi đã sửa được đưa vào bộ hồi quy. Thực hiện mục này xuyên suốt quá trình triển khai.

## 4. Giai đoạn P2 — Hoàn thiện nghiệp vụ và quy trình

### 10. Sửa phân trang và nhóm lịch sử thợ

- **Hiện trạng:** `previousProviders` lọc kết quả thợ sau khi phân trang; hồ sơ thợ không còn tồn tại có thể khiến số thẻ không khớp tổng số. Một thợ có thể xuất hiện nhiều lần từ các đơn khác nhau.
- **Cần làm:** lọc phù hợp trước khi đếm/phân trang; nhóm theo thợ và dịch vụ, vẫn cho xem các lần đã phục vụ. Thể hiện rõ tổng số đang đếm thợ hay lượt phục vụ.
- **Bằng chứng rà soát:** đã tái hiện bằng dữ liệu giả lập trường hợp tổng số là 1 nhưng không có thẻ hiển thị khi tham chiếu hồ sơ thợ không còn tồn tại.
- **Tiêu chí hoàn thành:** số lượng, số trang và thẻ nhất quán; thợ trùng tên không bị gộp nhầm; chọn lịch sử vẫn xác định đúng thợ và kiểm tra khả dụng hiện tại.

### 11. Hiển thị phần vừa thay đổi và khả năng quay lại

- **Hiện trạng:** đã kiểm tra lại và tạo bản xác nhận mới khi thông tin thay đổi, nhưng khách chưa có phần so sánh rõ trước/sau.
- **Cần làm:** sau yêu cầu như “đổi giờ, tăng số lượng, bỏ mã”, chỉ ra trường vừa đổi, tiền tăng/giảm bao nhiêu và phần nào được giữ. Cho quay lại bước trước hoặc khôi phục thay đổi gần nhất khi phù hợp.
- **Phụ thuộc:** dùng cơ chế bảo vệ/khôi phục bản nháp của mục 4; phân biệt hoàn tác bản nháp với sửa hoặc hủy đơn đã tạo.
- **Tiêu chí hoàn thành:** khách hiểu chính xác thay đổi trước khi xác nhận; hoàn tác phải tính lại giá và điều kiện hiện tại, không dùng lại form đã hết hiệu lực.

### 12. Tìm lịch thay thế theo điều kiện

- **Tình huống:** “Mai hết thì tìm sáng Chủ nhật, trước 11h” hoặc “Giữ anh Minh, tìm giờ khác trong tuần”.
- **Hiện trạng:** công cụ hiện kiểm tra tối đa 8 thời điểm được cung cấp; chưa tìm đầy đủ theo khoảng ngày/giờ và thứ tự ưu tiên.
- **Cần làm:** tìm lịch theo khoảng thời gian, thời lượng dịch vụ, khu vực và thợ ưu tiên; trả các lựa chọn gần điều kiện khách mong muốn và lý do khi không có.
- **Phụ thuộc:** mục 5. Không tự đổi lịch hoặc thợ khi khách chưa chọn; kết quả kiểm tra chưa phải giữ chỗ.
- **Tiêu chí hoàn thành:** giữ đúng các ràng buộc “trước 11h”, “chỉ cuối tuần”, “cùng thợ”; không bỏ điều kiện để trả một lịch có vẻ đặt được.

### 13. Đặt hộ với người nhận riêng cho lần đặt

- **Tình huống:** “Đặt cho mẹ, dùng số điện thoại của mẹ nhưng giữ nguyên sổ địa chỉ”.
- **Hiện trạng:** dữ liệu người nhận gắn với địa chỉ; agent chưa có luồng tách thông tin liên hệ riêng cho một lần đặt.
- **Cần làm:** cho khai báo người nhận, số liên hệ và ghi chú của đơn; giữ nguyên hồ sơ tài khoản và địa chỉ đã lưu khi khách chỉ muốn đặt hộ một lần.
- **Cần chốt:** cách lưu thông tin người nhận trên đơn, kiểm tra dữ liệu bắt buộc và cách phân biệt sửa một lần với sửa sổ địa chỉ.
- **Tiêu chí hoàn thành:** bản xác nhận và đơn có đúng người nhận; các lần đặt sau không bị thay thông tin ngoài ý muốn.

### 14. Địa chỉ dùng một lần, không lưu vào sổ

- **Tình huống:** “Đặt ở đây nhưng đừng lưu địa chỉ”.
- **Hiện trạng:** địa chỉ mới được giữ tạm và chỉ lưu cùng giao dịch tạo đơn thành công; chưa có lựa chọn dùng cho đơn nhưng không lưu vào sổ.
- **Cần làm:** hỗ trợ lựa chọn không lưu mà đơn và thợ vẫn nhận được đầy đủ địa chỉ thực hiện.
- **Giữ yêu cầu đã thống nhất:** mặc định hiện có vẫn chỉ lưu địa chỉ mới khi đặt đơn thành công; không quay lại lưu ngay khi khách nhập lệnh hoặc hiện form lưu riêng.
- **Cần chốt:** cách lưu địa chỉ của đơn độc lập với sổ, ảnh hưởng đến tham chiếu địa chỉ và dữ liệu cũ.
- **Tiêu chí hoàn thành:** chọn không lưu thì không tạo mục trong sổ; đơn vẫn có địa chỉ/người nhận đúng và tra cứu được sau này.

### 15. Chọn ghim hoặc điểm hẹn trong chat

- **Hiện trạng:** có thể dùng tọa độ tham chiếu phường/xã và ghi chú mức chính xác; chưa có thao tác chọn ghim trực tiếp trong chat.
- **Cần làm:** cho khách bổ sung ghim hoặc điểm hẹn khi cần; hiển thị rõ vị trí chính xác hay vị trí tham chiếu trước khi dùng để tìm thợ.
- **Cần chốt:** cách xác nhận ghim, đối chiếu với khu vực phục vụ và xử lý khi vị trí khác địa chỉ khách đã nhập.
- **Tiêu chí hoàn thành:** giữ được tên địa điểm/mô tả khách cung cấp; không bắt buộc số nhà, không tạo tọa độ giả và không gọi tọa độ phường/xã là vị trí chính xác của căn nhà.

### 16. Đặt dịch vụ theo ngân sách

- **Tình huống:** “Tôi chỉ có 300.000đ, chọn gói phù hợp”.
- **Hiện trạng:** AI có thể tư vấn bằng hội thoại nhưng bản nháp chưa có ràng buộc ngân sách được backend kiểm tra.
- **Cần làm:** ghi nhận mức tối đa, so với số tiền thực tế và cảnh báo khi đổi gói/số lượng làm vượt mức. Đề xuất phương án để khách chọn, không tự sửa đơn cho vừa ngân sách.
- **Cần chốt:** ngân sách áp dụng cho khoản trả trước, tổng dịch vụ hay chi phí dự kiến. Với sửa chữa, phải phân biệt tiền cọc và báo giá sau khảo sát; không cam kết tổng chi phí khi chưa có báo giá.
- **Tiêu chí hoàn thành:** thay đổi giá, voucher hoặc gói không làm mất giới hạn khách đã nêu; vượt mức phải được thông báo rõ trước khi xác nhận.

### 17. Khép kín tình huống chưa tìm được thợ

- **Hiện trạng:** đã có cập nhật tiến độ và công cụ chọn lại/tìm người thay thế; trải nghiệm vẫn cần hướng dẫn rõ từng lựa chọn thay vì chỉ thông báo chưa có người phù hợp.
- **Cần làm:** theo trạng thái thực tế, đưa các hướng tiếp tục như kiểm tra lại, đổi lịch, chọn thợ khác hoặc hủy theo chính sách. Nêu rõ thời hạn phản hồi nếu hệ thống có dữ liệu.
- **Cần chốt:** bước nào áp dụng cho bản nháp, bước nào áp dụng cho đơn đã tạo; khi nào cần chuyển sang hỗ trợ.
- **Tiêu chí hoàn thành:** khách luôn biết bước tiếp theo; không hứa đã có thợ/đã giữ lịch, không tự hủy hoặc đổi người khi khách chỉ hỏi thông tin.

### 18. Thống nhất nghiệp vụ chấp nhận báo giá

- **Hiện trạng:** agent có đọc và từ chối báo giá; backend còn API xác nhận báo giá để tương thích client cũ, trong khi màn hình khách hàng hiện chủ yếu xem và từ chối.
- **Cần chốt trước:** khách có phải chấp nhận báo giá trên hệ thống hay chỉ thỏa thuận trực tiếp với thợ; quy trình cho các trạng thái `pending`, `saved`, `approved` và khi báo giá thay đổi.
- **Cần làm sau khi chốt:** đồng bộ backend, giao diện, công cụ agent và hướng dẫn; không tự thêm một nút chấp nhận rồi coi đó là nghiệp vụ đã thống nhất.
- **Giữ nghiệp vụ hiện có:** chi phí báo giá sửa chữa thanh toán trực tiếp với thợ; không tự mở thanh toán phần còn lại qua Handigo. Từ chối báo giá có thể dẫn tới hủy đơn và phải thể hiện phí/hoàn đúng bản xác nhận.
- **Tiêu chí hoàn thành:** các kênh cùng một quy trình; không dùng đồng ý với bản báo giá cũ cho bản đã đổi hạng mục/số tiền; giữ tương thích API cũ theo phương án đã thống nhất.

### 19. Dời lịch hoặc đổi địa chỉ đơn đã tạo

- **Tình huống:** “Dời đơn này sang ngày mai” hoặc “Đổi địa chỉ thực hiện sang nhà mẹ”.
- **Hiện trạng:** sửa bản nháp không cập nhật đơn đã tạo; agent chủ yếu hướng khách xem chi tiết đơn hoặc hỗ trợ.
- **Cần chốt:** trạng thái được sửa, khoảng thời gian cho phép, việc thợ xác nhận lại, thay đổi khu vực, chênh lệch giá và xử lý khoản đã thanh toán.
- **Cần làm:** lập bản xem trước thay đổi của đúng đơn, kiểm tra lịch/khu vực/giá, yêu cầu xác nhận và cập nhật thông báo liên quan theo quy tắc đã chốt.
- **Tiêu chí hoàn thành:** không tạo lại đơn để giả lập việc dời lịch; không dùng sửa sổ địa chỉ để thay địa chỉ đơn; thao tác không được phép phải có lý do và hướng tiếp tục.

## 5. Giai đoạn P3 — Mở rộng phạm vi phục vụ

### 20. Đặt dịch vụ định kỳ qua agent

- **Hiện trạng:** backend có nghiệp vụ định kỳ, nhưng schema booking của agent hiện chỉ nhận `normal` và `scheduled`.
- **Cần làm:** cho chọn chu kỳ, số lần, ngày bắt đầu và giờ thực hiện; kiểm tra các lần trùng lịch và thể hiện rõ từng lần đặt.
- **Cần chốt:** dùng cùng thợ hay cho phép thay thợ, thanh toán/voucher theo lần hay chuỗi, cách hủy/sửa một lần hoặc cả chuỗi và trường hợp chỉ một số lần đặt được.
- **Tiêu chí hoàn thành:** khách hiểu số đơn/lần dịch vụ sẽ tạo và số tiền liên quan trước khi xác nhận; không suy ra đặt định kỳ từ câu “như lần trước”.

### 21. Đặt nhiều dịch vụ trong một yêu cầu

- **Tình huống:** “Vệ sinh điều hòa và sửa vòi nước”.
- **Hiện trạng:** phiên hiện giữ một `bookingDraft`; chưa có quy trình quản lý đầy đủ nhiều bản nháp dịch vụ cùng lúc.
- **Cần làm:** quản lý và phân biệt các bản nháp/đơn, lịch, thợ và chi phí của từng dịch vụ; cho khách sửa hoặc bỏ riêng từng phần.
- **Cần chốt:** xác nhận từng đơn hay cả nhóm, thanh toán riêng hay chung và cách xử lý khi chỉ một phần đặt thành công.
- **Tiêu chí hoàn thành:** không ghi đè bản nháp dịch vụ trước; không thu tiền cho phần chưa xác nhận; kết quả phải nói rõ dịch vụ nào thành công, thất bại hoặc còn chờ.

### 22. Chăm sóc, đánh giá và hỗ trợ sau hoàn thành

- **Hiện trạng:** agent đã có công cụ hỗ trợ/khiếu nại, nhưng chưa có luồng đánh giá thợ và hướng dẫn sau dịch vụ liền mạch.
- **Cần làm:** từ đơn đã hoàn thành, hướng khách đánh giá thợ, phản ánh vấn đề hoặc mở hỗ trợ/khiếu nại với dữ liệu đúng đơn; tái sử dụng chức năng hiện có.
- **Cần chốt:** thời điểm gợi ý, phạm vi khách được đánh giá/phản ánh, điều kiện khiếu nại và trường hợp chuyển sang hỗ trợ.
- **Tiêu chí hoàn thành:** đánh giá/phản ánh gắn đúng đơn và đúng thợ thực tế; không yêu cầu khách nhập lại dữ liệu đã có, không tự gửi đánh giá hoặc khiếu nại khi khách chưa yêu cầu/xác nhận.

## 6. Đối chiếu code và kiểm tra khi triển khai

Các vị trí chính đã dùng để rà soát:

| Nhóm | Module tham khảo |
| --- | --- |
| Điều phối, định dạng phản hồi, xử lý trực tiếp | [agent-loop.service.ts](handigo-backend/src/ai/agent/agent-loop.service.ts), [booking-history.ts](handigo-backend/src/ai/agent/booking-history.ts), [AgentBookingActions.tsx](handigo-web/src/features/chatbot/components/AgentBookingActions.tsx) |
| Voucher và kiến thức tư vấn | [voucher.service.ts](handigo-backend/src/services/voucher.service.ts), [agent-prompt.ts](handigo-backend/src/ai/agent/agent-prompt.ts), [customer-knowledge.ts](handigo-backend/src/ai/knowledge/customer-knowledge.ts) |
| Xác nhận và đồng ý chính sách | [ai.routes.ts](handigo-backend/src/ai/ai.routes.ts), [confirmation.service.ts](handigo-backend/src/ai/agent/confirmation.service.ts), [AgentBookingConfirmation.tsx](handigo-web/src/features/chatbot/components/AgentBookingConfirmation.tsx), [useBookingPolicies.ts](handigo-web/src/features/booking/hooks/useBookingPolicies.ts) |
| Bản nháp, đặt lại, lịch sử thợ | [booking-draft.ts](handigo-backend/src/ai/agent/booking-draft.ts), [booking-history.tools.ts](handigo-backend/src/ai/tools/implementations/booking-history.tools.ts), [agentBookingHistory.service.ts](handigo-backend/src/services/agentBookingHistory.service.ts) |
| Lịch và khả dụng của thợ | [booking.schemas.ts](handigo-backend/src/ai/tools/implementations/booking.schemas.ts), [agentBooking.service.ts](handigo-backend/src/services/agentBooking.service.ts), [AgentBookingSchedule.tsx](handigo-web/src/features/chatbot/components/AgentBookingSchedule.tsx) |
| Địa chỉ và tạo đơn | [agentAddress.service.ts](handigo-backend/src/services/agentAddress.service.ts), [order.service.ts](handigo-backend/src/services/order.service.ts) |
| Báo giá, thanh toán, tiến độ | [quotation.tools.ts](handigo-backend/src/ai/tools/implementations/quotation.tools.ts), [agentQuotation.service.ts](handigo-backend/src/services/agentQuotation.service.ts), [assignment.service.ts](handigo-backend/src/services/assignment.service.ts), [agentPayment.service.ts](handigo-backend/src/services/agentPayment.service.ts), [agentOrderProgress.service.ts](handigo-backend/src/services/agentOrderProgress.service.ts) |

Khi triển khai từng mục:

- Xác định hiện trạng trong code tại thời điểm thực hiện, không coi mọi nội dung trong tài liệu là lỗi đã tái hiện trên môi trường thật.
- Chốt phần nghiệp vụ còn mở trước khi đổi hành vi; ghi rõ ảnh hưởng backend, web và dữ liệu.
- Chạy build/lint theo phạm vi thay đổi và các kiểm thử hồi quy phù hợp; bổ sung tình huống mới vào bộ kiểm thử.
- Tận dụng các kiểm thử đã có như `testAgentBookingRecovery.ts`, `testAgentBookingHistory.ts`, `testAgentBookingSearchActions.ts`, `testAgentPreviousProviders.ts`, `testAgentVoucherPricing.ts`, `testAgentDraftAddress.ts` trong `handigo-backend/src/scripts`.
- Kiểm thử web bằng `node tests/agent-booking-web.mjs`, các chế độ `--business`, `--history-actions`, `--scroll` và `--narrow` theo phần thay đổi. Các fixture hiện tại dùng API giả lập; mục 9 bổ sung việc kiểm chứng với model/môi trường thực tế.
- Sau khi hoàn thành một mục, cập nhật trạng thái và kết quả kiểm tra ngay trong tài liệu này để không tiếp tục liệt kê phần đã làm là còn thiếu.
