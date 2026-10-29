# Kịch bản demo và thuyết trình Handigo trong 25 phút

## 1. Mục tiêu buổi bảo vệ

Sau 25 phút, hội đồng cần nhìn thấy ba giá trị cốt lõi của Handigo:

1. Khách hàng có thể mô tả nhu cầu bằng ngôn ngữ tự nhiên và được hỗ trợ tạo đơn đúng dịch vụ, đúng địa chỉ, lịch, thợ, ưu đãi và phương thức thanh toán.
2. Provider nhận việc theo thời gian thực, di chuyển đến khách, cập nhật tiến độ, báo giá và hoàn tất công việc trên cùng một hệ thống.
3. Handigo không chỉ kết nối hai phía mà còn kiểm soát thanh toán, bằng chứng, tranh chấp và vận hành bằng dashboard quản trị.

Thông điệp xuyên suốt:

> Handigo biến một nhu cầu dịch vụ tại nhà vốn rời rạc và khó kiểm soát thành một quy trình số hóa, có xác minh và có thể truy vết từ lúc khách phát sinh nhu cầu đến khi hoàn tất và hậu kiểm.

## 2. Phạm vi demo

### Luồng chính bắt buộc

- CUSTOMER dùng Trợ lý Handigo để tìm và tạo bản nháp đặt dịch vụ.
- Hệ thống hiển thị bản xem trước, chính sách và yêu cầu khách xác nhận trước khi ghi dữ liệu.
- PROVIDER nhận thông báo phân công realtime, có âm báo và thời gian phản hồi.
- Provider chấp nhận đơn, chia sẻ vị trí; CUSTOMER xem tuyến đường và thời gian dự kiến.
- Provider bắt đầu đơn bằng thao tác trượt, cập nhật tiến độ và hoàn tất kèm bằng chứng.
- ADMIN xem dashboard và một tình huống ngoại lệ có bằng chứng để chứng minh khả năng quản trị thực tế.

### Tính năng chỉ giới thiệu nhanh, không mở rộng demo

- Đăng ký provider và OCR giấy tờ.
- Ví, rút tiền, mã giảm giá, điểm thưởng, tin tức, hỗ trợ và khiếu nại.
- Đổi phương thức giữa PayOS, ví và tiền mặt.
- Chat realtime giữa khách và provider.
- Đặt lại với provider đã từng phục vụ.

Không nên demo đăng ký/OTP, duyệt toàn bộ hồ sơ provider hoặc thanh toán ngân hàng thật trong 25 phút vì các bước này phụ thuộc email, dịch vụ ngoài và thời gian chờ.

## 3. Bố trí trước khi trình bày

### Màn hình và phiên đăng nhập

Chuẩn bị ba cửa sổ, đặt tên và màu nền khác nhau để tránh thao tác nhầm:

| Cửa sổ | Vai trò | Màn hình mở sẵn |
| --- | --- | --- |
| Chrome | CUSTOMER | Ứng dụng Flutter, trang chủ khách hàng |
| Edge | PROVIDER | Ứng dụng Flutter, dashboard provider |
| Cửa sổ web riêng | ADMIN | Dashboard quản trị |

### Dữ liệu demo

Chuẩn bị tối thiểu bốn bản ghi và ghi mã đơn ra giấy:

1. **Đơn A — tạo trực tiếp:** dịch vụ giá cố định, khu vực có provider đang online và lịch trống.
2. **Đơn B — đã được provider chấp nhận:** dùng để demo theo dõi vị trí nếu việc ghép Đơn A chậm.
3. **Đơn C — đang thực hiện:** dùng để demo hoàn tất, ảnh nghiệm thu và đánh giá.
4. **Case D — khách vắng mặt:** đã có dữ liệu đến nơi, liên hệ và ảnh bằng chứng để admin xem xét.

Đầu buổi cần nói rõ:

> Để không dùng thời gian hội đồng chờ lịch hẹn hoặc di chuyển thật, nhóm tạo trực tiếp một đơn ở đầu luồng và chuẩn bị sẵn các đơn khác tại những trạng thái tiếp theo. Tất cả đều đi qua cùng API và quy tắc nghiệp vụ của hệ thống.

### Kiểm tra kỹ thuật trước giờ bảo vệ

- Chạy `node dev.mjs --check` trước buổi bảo vệ.
- Khởi động hệ thống bằng `node dev.mjs` và giữ nguyên terminal để quan sát lỗi.
- Đăng nhập sẵn ba vai trò; không để lộ mật khẩu, token hoặc cấu hình môi trường.
- Kiểm tra CUSTOMER và PROVIDER nằm trong cùng khu vực phục vụ.
- Kiểm tra provider đang online, lịch rảnh và hồ sơ đã được duyệt.
- Cho phép micro và vị trí từ trước; thử âm báo nhận đơn.
- Chuẩn bị sẵn một ảnh hiện trạng và 1–2 ảnh nghiệm thu dung lượng nhỏ.
- Mở sẵn mã đơn B, C và case D trong một tệp ghi chú ngoại tuyến.
- Tắt thông báo cá nhân, đóng tab không liên quan và tăng zoom trình duyệt lên mức dễ đọc.
- Quay sẵn một video dự phòng dài 2–3 phút của toàn bộ luồng chính.

## 4. Timeline chính xác 25 phút

| Thời gian | Nội dung | Kết quả cần đạt |
| --- | --- | --- |
| 00:00–01:30 | Mở bài và bài toán thực tế | Hội đồng hiểu vấn đề và đối tượng sử dụng |
| 01:30–03:00 | Giải pháp và kiến trúc tổng quan | Xác định ba vai trò, web/mobile/backend |
| 03:00–09:00 | Demo CUSTOMER với Trợ lý Handigo | Có bản xem trước và tạo Đơn A |
| 09:00–13:30 | Demo PROVIDER nhận và xử lý đơn | Nhận assignment, chấp nhận, bắt đầu xử lý |
| 13:30–16:30 | Demo realtime phía CUSTOMER | Thấy vị trí/tuyến đường, trạng thái và chat |
| 16:30–19:00 | Demo thanh toán và hoàn tất | Thấy kiểm soát tiền, bằng chứng, nghiệm thu |
| 19:00–21:30 | Demo ADMIN và xử lý ngoại lệ | Thấy dashboard và case khách vắng mặt |
| 21:30–23:30 | Điểm mới, kỹ thuật và an toàn | Làm rõ AI có kiểm soát, authz, idempotency |
| 23:30–25:00 | Kết luận và mời câu hỏi | Chốt giá trị thực tế, không mở thêm màn hình |

## 5. Kịch bản lời nói và thao tác chi tiết

### 00:00–01:30 — Mở bài

**Lời nói đề xuất**

> Khi một thiết bị trong nhà gặp sự cố, khách hàng thường phải tự tìm thợ, hỏi giá qua nhiều kênh, không biết người đến có phù hợp hay không và gần như không có cơ chế theo dõi hay xử lý tranh chấp. Ở chiều ngược lại, provider khó tiếp cận đúng khách, khó quản lý lịch và thu nhập. Handigo giải quyết bài toán đó bằng một nền tảng ba phía: khách hàng, provider và quản trị viên.

> Trong 25 phút, nhóm không trình diễn từng menu. Nhóm sẽ đi theo một tình huống thực tế từ lúc khách phát sinh nhu cầu, hệ thống ghép thợ, thực hiện dịch vụ, thanh toán cho đến khi nền tảng kiểm soát một ngoại lệ.

**Slide:** một sơ đồ duy nhất `Nhu cầu → Đặt lịch → Ghép thợ → Thực hiện → Thanh toán → Hậu kiểm`.

### 01:30–03:00 — Giải pháp và kiến trúc

**Lời nói đề xuất**

> CUSTOMER và PROVIDER sử dụng ứng dụng Flutter; ADMIN dùng web React. Tất cả dùng chung backend Express/TypeScript và MongoDB. Socket.IO đảm nhiệm thông báo, chat và vị trí realtime. PayOS và ví Handigo xử lý thanh toán. Điểm mới nhất là Trợ lý Handigo dùng mô hình ngôn ngữ kết hợp RAG và graph nghiệp vụ, nhưng mọi quyền truy cập, giá, trạng thái và thao tác ghi vẫn do backend xác minh.

**Không đọc tên công nghệ quá lâu.** Chỉ nhấn mạnh “AI đề xuất, backend quyết định”.

### 03:00–09:00 — CUSTOMER đặt dịch vụ bằng AI

**Thao tác**

1. Chuyển sang Chrome — CUSTOMER.
2. Mở **Trợ lý Handigo** và bấm **Tác vụ mới**.
3. Dùng nhập giọng nói hoặc dán câu đã chuẩn bị:

   > Điều hòa phòng ngủ của tôi làm lạnh yếu. Tôi muốn vệ sinh một máy vào 9 giờ sáng mai tại địa chỉ nhà đã lưu. Hãy tìm thợ phù hợp, áp dụng voucher tốt nhất và cho tôi thanh toán bằng PayOS.

4. Nếu trợ lý hỏi lựa chọn, chọn đúng dịch vụ/tùy chọn bằng chip thay vì gõ dài.
5. Đính kèm một ảnh hiện trạng và nói:

   > Gắn ảnh này vào yêu cầu để thợ xem trước, không cần chẩn đoán ảnh.

6. Khi hiện bản xác nhận, chỉ nhanh các trường: dịch vụ, số lượng, lịch, địa chỉ, provider, voucher, giá, thanh toán và ảnh.
7. Cố ý sửa một chi tiết bằng câu:

   > Đổi lịch sang 10 giờ sáng mai, giữ nguyên các thông tin còn lại.

8. Khi bản xem trước mới xuất hiện, tích chấp nhận chính sách rồi bấm **Xác nhận**.

**Lời nói trong lúc chờ AI**

> Đây không phải chatbot chỉ trả lời văn bản. Trợ lý đang gọi các công cụ nghiệp vụ để đọc danh mục, giá, lịch rảnh, địa chỉ và voucher từ dữ liệu hiện tại. Ảnh được chuyển như bằng chứng cho provider, hệ thống không tuyên bố tự chẩn đoán nội dung ảnh.

> Trước mọi thao tác ghi, hệ thống tạo một bản xem trước có thời hạn. Khách có thể sửa, từ chối hoặc xác nhận. Vì vậy mô hình không được tự tạo đơn hay tự quyết định thanh toán.

**Điểm phải chỉ cho hội đồng**

- Trạng thái **Đang xử lý yêu cầu** và lịch sử phiên.
- Các lựa chọn có cấu trúc, không chỉ là đoạn chat.
- Bản xác nhận thay đổi sau khi sửa lịch.
- Checkbox chính sách và nút **Xác nhận**.
- Mã Đơn A sau khi tạo.

**Giới hạn thời gian:** nếu một lượt AI quá 35 giây, chuyển sang phiên/bản nháp đã chuẩn bị sẵn và nói: “Nhóm tiếp tục từ checkpoint đã lưu để không dùng thời gian hội đồng chờ dịch vụ mô hình ngoài”.

### 09:00–13:30 — PROVIDER nhận và xử lý đơn

**Thao tác**

1. Chuyển sang Edge — PROVIDER.
2. Chỉ modal **Bạn có đơn hàng mới**, âm báo, thời gian đếm ngược, dịch vụ, địa chỉ, lịch và giá trị đơn.
3. Bấm **Đồng ý**.
4. Mở chi tiết đơn; chỉ ảnh hiện trạng, thông tin liên hệ và timeline.
5. Mở **Theo dõi đơn hàng**, bấm **Chia sẻ vị trí khi mở màn này**.
6. Quay lại chi tiết và thực hiện **Trượt để bắt đầu xử lý** trên Đơn B hoặc Đơn C đã đủ điều kiện.
7. Nếu là dịch vụ khảo sát, mở báo giá và nói một câu ngắn:

   > Thay hai tụ điện, mỗi tụ 180 nghìn đồng, công thay 100 nghìn đồng.

8. Cho thấy AI điền **bản nháp báo giá**, sau đó provider kiểm tra trước khi gửi.

**Lời nói đề xuất**

> Assignment không được gửi ngẫu nhiên. Backend kiểm tra khu vực phục vụ, lịch làm việc, trạng thái online và điều kiện của provider. Provider có thời hạn phản hồi; nếu từ chối hoặc hết thời gian, hệ thống có thể tiếp tục vòng ghép khác.

> Thao tác trượt giảm việc bấm nhầm khi bắt đầu đơn. Với dịch vụ cần khảo sát, giọng nói chỉ giúp điền bản nháp báo giá; provider vẫn là người kiểm tra và gửi.

**Fallback:** nếu Đơn A chưa phát assignment, mở Đơn B và nói rõ đây là đơn đã chuẩn bị ở trạng thái “đã nhận” để tiếp tục cùng workflow.

### 13:30–16:30 — CUSTOMER theo dõi realtime

**Thao tác**

1. Quay lại Chrome — CUSTOMER, mở chi tiết Đơn A hoặc Đơn B.
2. Mở **Theo dõi đơn hàng**.
3. Chỉ marker provider, địa chỉ dịch vụ, tuyến đường, quãng đường và thời gian dự kiến.
4. Mở chat theo đơn, gửi một tin ngắn: “Anh/chị đến cổng gọi giúp tôi.”
5. Quay lại timeline để cho thấy trạng thái đã đồng bộ.

**Lời nói đề xuất**

> Khách không phải gọi điện liên tục để hỏi thợ đang ở đâu. Vị trí chỉ được chia sẻ trong đơn hợp lệ và khi provider chủ động mở chức năng chia sẻ. Việc join room Socket.IO cũng được kiểm tra quyền theo đơn, không chỉ dựa vào ID client gửi lên.

### 16:30–19:00 — Thanh toán, hoàn tất và nghiệm thu

**Thao tác**

1. Mở thẻ thanh toán của Đơn A hoặc một đơn PayOS đang chờ.
2. Chỉ số tiền do backend tính và nút **Mở PayOS để thanh toán**; không thực hiện chuyển tiền thật.
3. Nói ngắn về khả năng đổi sang ví/tiền mặt: hệ thống phải xác minh QR cũ chưa nhận tiền trước khi tạo phương thức mới.
4. Chuyển sang Đơn C trên PROVIDER, bấm **Hoàn tất & nghiệm thu**.
5. Tải ảnh nghiệm thu và nhập ghi chú ngắn; hoàn tất đơn.
6. Trên CUSTOMER, chỉ màn hình đánh giá hoặc trạng thái hoàn tất.

**Lời nói đề xuất**

> Giá thanh toán không lấy từ câu trả lời của AI hoặc dữ liệu client. Backend tính lại từ dịch vụ, tùy chọn, voucher và chính sách hiện hành. Hệ thống chống tạo thanh toán trùng và không coi lời nói “tôi đã trả” là bằng chứng; trạng thái phải được xác minh từ dữ liệu giao dịch.

> Hoàn tất đơn yêu cầu ảnh nghiệm thu. Đây là dữ liệu quan trọng cho đánh giá, khiếu nại và hậu kiểm.

### 19:00–21:30 — ADMIN quản trị và xử lý ngoại lệ

**Thao tác**

1. Chuyển sang dashboard ADMIN.
2. Chỉ nhanh bốn nhóm thông tin: đơn hàng, doanh thu, provider hoạt động và hàng đợi cần xử lý.
3. Mở **Quản lý vụ việc** và chọn Case D — khách vắng mặt.
4. Chỉ bản tóm tắt xác minh: provider đến đúng vùng, thời gian chờ, cuộc gọi/tin nhắn và ảnh bằng chứng.
5. Chỉ nút xác minh lại hoặc quyết định admin, nhưng không bấm thay đổi dữ liệu nếu case demo cần dùng lại.

**Lời nói đề xuất**

> Một nền tảng thực tế phải xử lý được trường hợp dịch vụ không diễn ra bình thường. Với khách vắng mặt, hệ thống đối chiếu vị trí đến nơi, đủ thời gian chờ, lịch sử liên hệ và ảnh. AI chỉ trích xuất tín hiệu trực tiếp từ bằng chứng; trường hợp không chắc chắn được chuyển cho admin. Khi được chấp thuận, chính sách hiện tại hoàn khoản khách đã trả và Handigo hỗ trợ provider 5.000 đồng, không tự ý thu thêm của khách.

> Dashboard không chỉ để xem số đẹp; hàng đợi giúp admin biết hồ sơ, khiếu nại, đề xuất hoặc yêu cầu rút tiền nào cần xử lý.

### 21:30–23:30 — Điểm mới và chiều sâu kỹ thuật

**Slide:** kiến trúc một trang, tối đa sáu khối.

**Lời nói đề xuất**

> Điểm mới nhất của Handigo là agent nghiệp vụ thay vì chatbot thuần túy. LangGraph điều phối hội thoại và trạng thái; RAG chỉ dùng nguồn kiến thức đã duyệt; dữ liệu giá, lịch, đơn và thanh toán luôn đọc từ service nghiệp vụ hiện tại.

> Hệ thống có ba lớp an toàn. Thứ nhất là authentication, role và ownership ở backend. Thứ hai là preview, consent và validation trước thao tác ghi. Thứ ba là ledger, checkpoint và request idempotency để khi model hoặc mạng timeout, hệ thống có thể tiếp tục mà không tạo lại đơn hoặc trừ tiền hai lần.

> Realtime dùng room theo user, conversation và order. Mỗi lần join đều kiểm tra quyền. Các dữ liệu nhạy cảm như token, mật khẩu và khóa thanh toán không được trả về client.

**Không tuyên bố production-ready tuyệt đối.** Nói rõ:

> Nhóm đã kiểm thử các workflow chính và hồi quy ở backend, web và Flutter. Phần còn cần nghiệm thu trước production là tải đồng thời, failover hạ tầng và giao dịch PayOS trong môi trường tích hợp phù hợp.

### 23:30–25:00 — Kết luận

**Lời nói đề xuất**

> Qua luồng vừa trình bày, Handigo giải quyết đồng thời ba khoảng trống của thị trường dịch vụ tại nhà: khách tìm đúng người và theo dõi được công việc; provider nhận việc, quản lý lịch và thu nhập; nền tảng có dữ liệu để thanh toán, đối soát và giải quyết ngoại lệ.

> Điểm khác biệt của Handigo không nằm ở một màn hình riêng lẻ mà ở quy trình khép kín, có kiểm soát và có khả năng phục hồi. AI giúp giảm thao tác cho người dùng, nhưng quyền quyết định nghiệp vụ vẫn thuộc backend và con người. Nhóm xin kết thúc phần trình bày và sẵn sàng trả lời câu hỏi của hội đồng.

## 6. Bộ slide đề xuất

Chỉ dùng 7 slide để dành phần lớn thời gian cho sản phẩm:

1. **Bài toán thực tế:** khách khó tìm thợ; provider khó tìm khách; nền tảng thiếu minh bạch.
2. **Handigo giải quyết gì:** ba vai trò và vòng đời dịch vụ khép kín.
3. **Kiến trúc hệ thống:** Flutter/React → Express → MongoDB/Socket.IO/PayOS/AI.
4. **Luồng CUSTOMER:** AI tạo bản nháp → preview → consent → booking.
5. **Luồng PROVIDER:** assignment → vị trí → thực hiện → báo giá/hoàn tất.
6. **Quản trị và an toàn:** dashboard, bằng chứng, no-show, quyền và đối soát.
7. **Kết quả và hướng phát triển:** những gì đã kiểm thử, giới hạn và bước tiếp theo.

Mỗi slide chỉ giữ một thông điệp, tối đa ba ý. Không đưa ảnh code lên slide chính; chỉ mở code khi hội đồng hỏi.

## 7. Ba điểm “wow” phải giữ bằng mọi giá

1. **AI tạo bản xác nhận có cấu trúc:** hội đồng phải thấy AI không tự ý tạo đơn và khách có thể sửa dữ liệu trước khi xác nhận.
2. **Hai vai trò thay đổi realtime:** provider nhận assignment hoặc CUSTOMER thấy vị trí/trạng thái thay đổi mà không nhập lại dữ liệu.
3. **Ngoại lệ có bằng chứng:** admin thấy hệ thống đủ sâu để xử lý một ca khách vắng mặt, không chỉ chạy happy path.

Nếu thiếu thời gian, bỏ demo báo giá giọng nói và màn hình đánh giá; không bỏ ba điểm trên.

## 8. Kịch bản dự phòng theo sự cố

| Sự cố | Cách xử lý trong tối đa 20 giây | Câu nói chuyển cảnh |
| --- | --- | --- |
| AI phản hồi chậm | Mở phiên đã có checkpoint/bản nháp | “Trợ lý phụ thuộc dịch vụ mô hình ngoài; nhóm tiếp tục từ checkpoint đã lưu để chứng minh khả năng phục hồi.” |
| Không phát assignment | Mở Đơn B đã được chấp nhận | “Assignment trực tiếp đang chậm; nhóm dùng đơn cùng workflow đã chuẩn bị ở trạng thái kế tiếp.” |
| Socket mất kết nối | Bấm cập nhật hoặc tải lại chi tiết đơn | “Khi realtime gián đoạn, client vẫn đọc lại trạng thái chuẩn từ API; Socket.IO là kênh cập nhật nhanh, không phải nguồn dữ liệu duy nhất.” |
| Bản đồ không tải tile | Chỉ dữ liệu quãng đường/tọa độ và video dự phòng | “Tile bản đồ là nguồn hiển thị ngoài; quyền chia sẻ và dữ liệu tuyến đường vẫn do hệ thống quản lý.” |
| PayOS không mở | Chỉ thẻ payment và ảnh/video sandbox | “Nhóm không thực hiện giao dịch tiền thật trong buổi bảo vệ; backend chỉ công nhận kết quả đã được cổng thanh toán xác minh.” |
| Micro không nhận | Dán câu mẫu đã chuẩn bị | “Giọng nói là phương thức nhập; workflow nghiệp vụ phía sau không thay đổi.” |
| Upload ảnh lỗi | Mở Đơn C đã có ảnh nghiệm thu | “Nhóm chuyển sang đơn đã có bằng chứng để không phụ thuộc đường truyền upload tại hội trường.” |
| Backend hoặc app dừng | Mở video dự phòng và tiếp tục thuyết trình | “Đây là bản ghi cùng phiên bản đang trình bày; sau phần này nhóm có thể mở log để phân tích nguyên nhân.” |

Nguyên tắc: chỉ thử lại một lần. Nếu chưa được, chuyển ngay sang phương án dự phòng; không debug trực tiếp trước hội đồng.

## 9. Câu hỏi hội đồng có khả năng hỏi

### “AI trả lời sai thì sao?”

AI không được trực tiếp ghi database theo nội dung tự sinh. AI chọn công cụ; backend xác thực schema, quyền, ownership và điều kiện nghiệp vụ. Tạo đơn, thanh toán, hủy hoặc khiếu nại đều phải có preview/xác nhận khi cần. Giá và trạng thái được đọc lại từ service nghiệp vụ.

### “Tại sao cần AI, form thường có làm được không?”

Form vẫn tồn tại cho người muốn thao tác truyền thống. AI giảm tải khi người dùng không biết tên dịch vụ, cần mô tả nhiều điều kiện, muốn đặt lại với thợ cũ hoặc cần xử lý yêu cầu xuyên nhiều màn hình. Giá trị của AI là điều phối workflow, không phải thay thế toàn bộ UI.

### “Làm sao tránh tạo hai đơn hoặc trừ tiền hai lần?”

Hệ thống dùng request idempotency, action ledger, checkpoint và đối soát. Khi kết quả thao tác ghi chưa rõ, phiên bị khóa ở trạng thái cần đối soát; hệ thống không tự phát lại thao tác tài chính.

### “Provider có xem được đơn của người khác không?”

Không. Backend lấy user hiện tại từ access token, kiểm tra role, hồ sơ provider đã duyệt, assignment và ownership. Client gửi ID chỉ để định danh tài nguyên, không phải bằng chứng quyền truy cập.

### “Vị trí có xâm phạm riêng tư không?”

Provider phải chủ động bật chia sẻ trên đơn đang được phép theo dõi. Socket room được kiểm tra quyền; việc chia sẻ dừng khi màn hình/app không hoạt động hoặc đơn không còn trạng thái theo dõi.

### “RAG có dùng dữ liệu riêng của khách không?”

Kho kiến thức công khai chỉ chứa tài liệu đã duyệt. Dữ liệu riêng như đơn, địa chỉ, thanh toán được lấy qua công cụ nghiệp vụ có kiểm tra quyền, không đưa vào kho RAG công khai.

### “Hệ thống đã sẵn sàng production chưa?”

Các workflow và kiểm thử trọng yếu đã có, nhưng nhóm không tuyên bố hoàn tất nghiệm thu production. Cần tiếp tục kiểm thử tải, failover, giám sát, chính sách lưu trữ và giao dịch tích hợp trong môi trường phù hợp.

### “Điểm mới nhất có bằng chứng gì?”

Nêu ngắn gọn các thành phần đang có trong codebase: agent CUSTOMER có graph/checkpoint/RAG; preview và consent; cập nhật voucher có revision; assignment realtime; theo dõi vị trí; báo giá giọng nói AI; xác minh khách vắng mặt; payment/wallet có đối soát; dashboard doanh thu và hàng đợi vận hành.

## 10. Tiêu chí buổi demo thành công

- Kết thúc không quá 25 phút; phần demo trực tiếp chiếm khoảng 16–18 phút.
- Hội đồng nhìn thấy ít nhất một thao tác xuyên hai vai trò.
- Có một bản xác nhận trước thao tác ghi và một bằng chứng hậu kiểm.
- Không lộ tài khoản, token, khóa API hoặc cấu hình môi trường.
- Không tuyên bố quá mức về AI, thanh toán thật hoặc mức độ sẵn sàng production.
- Khi có sự cố, chuyển sang fallback trong 20 giây và vẫn giữ được câu chuyện nghiệp vụ.

## 11. Căn cứ trong codebase

- Trạng thái agent CUSTOMER mới nhất: `agent-booking.md`.
- Giao diện Trợ lý Handigo: `handigo-app/lib/features/ai_chat/presentation/ai_chat_sheet.dart`.
- Điều phối hội thoại và công cụ: `handigo-backend/src/ai`.
- Assignment realtime provider: `handigo-app/lib/features/provider/presentation/provider_assignment_gate.dart`.
- Theo dõi vị trí: `handigo-app/lib/features/orders/presentation/tracking_screen.dart` và `handigo-backend/src/sockets/initSocket.ts`.
- Bắt đầu và hoàn tất đơn: `handigo-app/lib/features/provider/presentation/provider_order_detail_screen.dart`.
- Báo giá giọng nói: `handigo-app/lib/features/provider/presentation/quotation_voice_sheet.dart`.
- Xác minh khách vắng mặt: `handigo-backend/src/services/customerNoShowVerification.service.ts`.
- Dashboard và case admin: `handigo-web/src/features/admin`.

