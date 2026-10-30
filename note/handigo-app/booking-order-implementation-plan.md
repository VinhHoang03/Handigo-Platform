# Kế hoạch hoàn thiện luồng đặt đơn và xử lý đơn Handigo App

Ngày đối chiếu: 20/10/2026. Phạm vi: mã nguồn Flutter, luồng web đang được gọi thực tế và API backend tương ứng. Áp dụng skill `planning` và `mobile-design`.

## Cập nhật triển khai

Đã triển khai mã nguồn cho các nhóm luồng chính sau, giữ nguyên backend và schema:

- Báo giá khảo sát trước khi bắt đầu; nhiều hạng mục, thời lượng, giảm giá, chỉnh sửa theo revision và đọc hạng mục từ ảnh OCR có bước rà soát.
- Nghiệm thu 1–5 ảnh, giữ ảnh đã upload khi lỗi; gửi kỳ vọng phiên bản báo giá; xác nhận thu tiền trực tiếp sau khi hoàn thành.
- Đặt ngay/hẹn giờ/định kỳ, số lượng dịch vụ phù hợp, kiểm tra/chọn thợ, định vị địa chỉ, chính sách và xác nhận số tiền từ preview.
- Trả cọc đúng phương thức; tiếp tục/đổi phương thức, đối soát PayOS khi quay lại; lưu mã đơn chờ và bản nháp theo tài khoản; không tự retry tạo đơn khi kết quả chưa rõ.
- Chi tiết đơn, phân trang/tìm kiếm từ server, lý do từ chối nhận việc, hủy có kỳ vọng tiền hoàn, điều phối/chọn thợ thay thế và xem/hủy chuỗi lịch. Lịch PROVIDER tải các trang còn lại thay vì chỉ nhìn 50 đơn đầu.
- Socket.IO theo phiên đăng nhập, đồng bộ khi resumed/reconnect, chat và điều hướng thông báo theo role; bản đồ OpenStreetMap cùng nguồn web, đọc đúng tuyến đường và chia sẻ vị trí khi người dùng bật trên màn tracking.
- Đánh giá có ảnh, chỉnh sửa đánh giá, phản hồi của thợ và báo cáo vấn đề có sẵn orderId.

Đã thêm các màn/khối theo feature thay vì viết lại danh mục, giao diện tài khoản hoặc backend. Phần booking cũ vẫn giữ route và điểm vào tương thích; chưa thực hiện refactor toàn bộ file catalog chỉ vì kích thước tệp.

Kết quả kiểm tra đợt triển khai: toàn bộ **90 test Flutter đạt**; `flutter analyze --no-pub --no-fatal-infos` không có error/warning, còn 156 góp ý mức info. Hot restart qua phiên debug trên `emulator-5554` thành công với mã trả về 0; đã kiểm tra ảnh màn hình xác nhận ứng dụng khôi phục phiên và hiển thị dashboard PROVIDER.

Giới hạn kiểm chứng: chưa thực hiện giao dịch PayOS thật, thử đủ hai tài khoản trên backend có dữ liệu thật hoặc kiểm chứng iOS. App Links/Universal Links, push nền và GPS khi ứng dụng đóng vẫn nằm ngoài đợt triển khai. Bộ quét mobile theo mẫu báo 433 issues/123 warnings trên thư mục lib, có nhiều kết quả không phù hợp Flutter (nhận kích thước icon thành vùng chạm, yêu cầu Jest); không dùng số đếm đó làm số lỗi UX đã xác nhận. Kiểm tra vùng chạm và chữ lớn bằng widget test, đặc biệt tăng vùng xóa ảnh và sửa tràn phần phân trang.

## 1. Kết luận và phạm vi

App đã có khung đặt dịch vụ, tính giá từ backend, chọn địa chỉ/lịch, voucher, ảnh sự cố, tạo đơn, thanh toán, nhận/từ chối việc, bắt đầu và gửi ảnh hoàn thành. Tuy nhiên, các nhánh chưa nối thành quy trình trọn vẹn như web. Cần ưu tiên gỡ luồng đơn khảo sát, khôi phục thanh toán và đưa người dùng vào đúng màn chi tiết trước khi bổ sung giao diện phụ.

Mục tiêu hoàn thành: CUSTOMER đặt và theo dõi đơn; PROVIDER nhận việc, khảo sát/báo giá nếu cần, bắt đầu, hoàn thành và xác nhận thu tiền đúng điều kiện backend; hai phía thấy cùng trạng thái khi trở lại ứng dụng.

Bao gồm cả dịch vụ giá cố định và dịch vụ khảo sát/báo giá, đơn đặt ngay và hẹn giờ, cùng quản lý đơn định kỳ app đã hỗ trợ tạo. Giữ Flutter, Riverpod, GoRouter, Dio, cơ chế refresh phiên và design system hiện có.

Ngoài phạm vi: giao diện ADMIN, đổi framework, viết lại auth, đổi schema/enum/contract, triển khai hệ thống push mới, AI đặt đơn và AI hỗ trợ báo giá bằng giọng nói. OCR báo giá là phần mở rộng sau luồng nhập tay. Không tự triển khai thêm thanh toán chi phí sửa chữa qua Handigo.

Đây là đánh giá tĩnh theo code, chưa chạy end-to-end với hai tài khoản và backend. Phát hiện về điều kiện luồng có căn cứ từ code; chưa khẳng định lỗi đã được tái hiện trên emulator.

## 2. Những điểm cần hiểu đúng trước khi triển khai

1. **Báo giá hiện tại khác tài liệu cũ:** web dùng báo giá `saved`, cho thợ lưu/chỉnh sửa trước khi bắt đầu. Khách xem báo giá và số tiền còn thanh toán trực tiếp. Endpoint khách xác nhận vẫn phục vụ tương thích dữ liệu cũ; không dùng làm bước bắt buộc cho báo giá mới.
2. **Thứ tự thu tiền sửa chữa:** thu cọc qua Handigo → lưu báo giá → bắt đầu → hoàn thành có bằng chứng → thợ xác nhận đã nhận tiền trực tiếp. Backend yêu cầu đơn `completed` khi xác nhận tiền báo giá. Không chuyển bước xác nhận tiền lên trước hoàn thành.
3. **Không kết luận app thu toàn bộ tiền sửa chữa chỉ vì gửi `FULL`:** backend hiện tự suy ra `inspection_deposit` khi `inspectionRequired`. App vẫn cần truyền đúng loại và diễn đạt đúng tiền cọc; vấn đề rõ ràng hơn là app đang cho chọn CASH cho nhánh backend không cho phép.
4. **Định kỳ không phải tính năng hoàn toàn thiếu trên app:** app có tạo `recurring`; web còn phần đọc/hủy chuỗi nhưng form tạo hiện chuyển `recurring` về `scheduled`. Cần giữ tương thích đơn hiện có, không tự bỏ chức năng app và không coi tạo định kỳ là tính năng web đang mở đầy đủ.
5. **Nguồn trạng thái:** dùng kết hợp `status`, `bookingStatus`, `paymentStatus`, `inspectionRequired`, báo giá và điều phối; không suy toàn bộ bước tiếp theo chỉ từ `status`.

## 3. Ma trận đối chiếu app với web

| Hạng mục | App hiện có | Phần thiếu hoặc khác so với web | Ưu tiên |
|---|---|---|---|
| Gói dịch vụ và số lượng | Chọn nhóm option, số lượng từng option | Chưa có `uniformQuantity` cho trường hợp vệ sinh máy lạnh không có option như web | P1 |
| Thời gian đặt | Hẹn giờ và định kỳ | Chưa có lựa chọn `normal`/đặt ngay trên form; bộ chọn giờ cho tới 21:59, web chặn sau 21:00; chưa kiểm tra lại lịch tại lúc gửi | P1 |
| Địa chỉ | Chọn/thêm địa chỉ thủ công | Form thêm trong booking chưa có tọa độ/chọn vị trí; chưa liên kết việc đổi địa chỉ với kiểm tra thợ phù hợp | P1 |
| Thợ phù hợp trước đặt | Chưa có trong draft/repository booking | Thiếu kiểm tra khả dụng và chọn thợ ưu tiên qua `/providers/nearby`; web vẫn hỗ trợ tự điều phối, không bắt buộc luôn chọn đích danh | P1 |
| Ghi chú, ảnh sự cố | Có ghi chú, tải/xóa/xem tối đa 4 ảnh từ thư viện | Chưa kiểm tra mô tả tối thiểu như web; upload chưa truyền `purpose=order_problem`; chưa có lựa chọn chụp ảnh | P1 |
| Chính sách và xác nhận | Hai bước form và xem tiền | Thiếu tải chính sách, đồng ý chính sách, rà soát địa chỉ/người nhận/option/ảnh; CTA còn nằm cuối nội dung dài | P1 |
| Voucher | Nhập mã, preview giảm giá; có API áp dụng/gỡ | Kho voucher “Dùng ngay” chỉ hiện thông báo; chưa chọn vào booking, chưa áp dụng/gỡ và preview lại trên đơn chờ | P1/P2 |
| Tạo đơn và thanh toán | Tạo đơn rồi gọi payment; PayOS mở trình duyệt; nút reconcile | Chưa phân nhánh cọc/giá cố định, giới hạn CASH, truyền kỳ vọng giá; chưa có tiếp tục/đổi phương thức từ chi tiết; lỗi payment sau tạo đơn bị đẩy sang màn chờ và reset draft | P0/P1 |
| Kết quả thanh toán | Hiện theo `payment.status`; orderId và checkoutUrl qua `extra` | Thiếu phân biệt tiền mặt, đã trả cọc, thanh toán chậm/thất bại/hủy; khôi phục sau app bị đóng và tải đơn bằng ID; thiếu CTA xem đơn | P0 |
| Danh sách đơn CUSTOMER | Trang đầu 20 đơn, bộ lọc cục bộ | Thiếu phân trang/tìm kiếm/lọc từ server; thẻ chỉ có chat và tracking, chưa có lối rõ ràng tới chi tiết | P0/P1 |
| Chi tiết CUSTOMER | Thông tin cơ bản, lịch sử status, hủy, xem báo giá | Thiếu snapshot dịch vụ/địa chỉ, bookingStatus, thời hạn tìm thợ/thanh toán, lịch sử tiền/cọc/hoàn, chứng cứ hoàn thành và CTA đúng từng nhánh | P0/P1 |
| Theo dõi | Gọi tracking-route, icon bản đồ, tỷ lệ tiến trình cố định | API trả geometry/distanceMeters/durationSeconds, UI lại tìm status/providerLocation/destination/estimatedMinutes; thiếu socket vị trí, bản đồ và timeline dữ liệu thực | P0/P2 |
| Nhận/từ chối việc | Có assignment và nút xử lý, trường responseDeadline | Thiếu đồng bộ assignment mới/đã đóng/hết hạn, lý do từ chối nhập thật và xử lý dữ liệu cũ khi hai thiết bị thao tác | P1 |
| Chi tiết PROVIDER | Bắt đầu, cập nhật kết thúc, tạo báo giá, gửi 1 ảnh hoàn thành | Chưa chặn theo bookingStatus/thanh toán/khảo sát; chưa có chat theo đơn, hủy sau nhận việc, xem ảnh sự cố/ảnh hoàn thành | P0/P1 |
| Báo giá PROVIDER | Dialog 1 vật tư khi `in_progress` | Thiếu lập báo giá ngay khi `accepted`, nhiều hạng mục/loại, thời lượng, giảm giá, xem/sửa báo giá và revision. Backend yêu cầu báo giá trước start nên có nguy cơ kẹt nhánh khảo sát | P0 |
| Báo giá CUSTOMER | Sheet tổng tiền, nút đồng ý/từ chối khi pending | Thiếu trình bày trạng thái `saved`, tiền cọc áp dụng, còn trả trực tiếp, thời lượng/khuyến nghị; lý do từ chối đang cố định | P0/P1 |
| Hoàn thành và tiền trực tiếp | Upload 1 ảnh, ghi chú, gọi complete | Thiếu chọn/xem/xóa nhiều ảnh, giữ ảnh khi retry, gửi phiên bản báo giá đã xem; chưa có xác nhận thu trực tiếp sau `completed` | P0/P1 |
| Hủy, hoàn, điều phối lại | Hủy một đơn với preview số tiền | Chưa gửi `confirmedExpectation`, chưa có chấp nhận/từ chối điều phối lại, chọn lại thợ, hủy chuỗi, lịch sử hoàn tiền; điều kiện hủy phải đối chiếu chính sách backend | P1/P2 |
| Chat/thông báo | Chat REST, danh sách thông báo đánh dấu đã đọc | Chưa có socket; thông báo chưa dẫn đúng chi tiết đơn theo role; PROVIDER chưa có lối chat từ chi tiết và router chat riêng phù hợp | P1/P2 |
| Hậu mãi | Danh sách đánh giá; form khiếu nại nhập mã đơn thủ công | Thiếu tạo/sửa đánh giá từ đơn, context canReview, phản hồi của thợ; thiếu báo cáo vấn đề có orderId điền sẵn như web | P2 |

P0: có thể chặn hoặc làm hiểu sai luồng chính. P1: cần cho quy trình sử dụng đầy đủ. P2: hoàn thiện ngang web và trải nghiệm sau xử lý; không có nghĩa được phép phát hành chức năng liên quan khi chưa hoàn thiện.

## 4. Thiết kế luồng mobile

### Khung áp dụng

- Flutter hiện tại; ưu tiên kiểm chứng trên điện thoại Android theo môi trường emulator đang dùng. Giữ thiết kế tương thích iOS; bản phát hành iOS cần kiểm chứng riêng trên macOS/thiết bị iOS. Tablet chỉ bảo đảm bố cục không tràn, chưa thiết kế luồng hai cột riêng.
- Giữ các tab đang có của CUSTOMER/PROVIDER. Đặt đơn và chỉnh báo giá đi theo stack để Back có thể quay lại dữ liệu đã nhập. Sheet dùng cho lựa chọn ngắn; form báo giá nhiều dòng dùng màn riêng.
- Riverpod giữ trạng thái phiên đặt đơn; thêm lưu bền phần nháp và mã đơn chờ theo tài khoản bằng lưu trữ đã có khi phù hợp. Không lưu token vào draft; xóa draft khi đổi tài khoản/đăng xuất.
- Mất mạng: giữ form và dữ liệu gần nhất trong phiên, báo dữ liệu có thể cũ, cho thử lại. Tạo đơn/thanh toán/nhận việc/hủy/hoàn thành cần online; không xếp hàng tự chạy các thao tác này khi mạng trở lại.
- Ba nguyên tắc: CTA chính trong vùng ngón cái và SafeArea; hiển thị bước tiếp theo từ dữ liệu server; giữ công việc đang nhập khi bị gián đoạn. Tránh sao chép bảng desktop sang màn nhỏ và tránh bắt đầu nghiệp vụ tiền chỉ từ phản hồi redirect.
- Vùng chạm tối thiểu 48 logical pixel trên Android, 44 trên iOS; cách nhau ít nhất 8; nút xóa ảnh 28×28 hiện tại cần tăng hit area. Hỗ trợ text scale 200%, TalkBack/VoiceOver, bàn phím và nút Back hệ thống.
- Danh sách dài dùng builder/separated, tải trang tiếp có retry riêng; giới hạn kích thước ảnh giải mã. Đồng bộ khi màn hiện/ứng dụng resumed; dọn listener/timer khi logout hoặc màn không hoạt động.

### Các màn hình và khối giao diện cần có

| Màn hình/khối | Nội dung và thao tác chính | Dạng mobile |
|---|---|---|
| Đặt dịch vụ | Gói/số lượng → địa chỉ, thời gian, mô tả, ảnh | Tái sử dụng form hiện có, chia khối rõ, CTA Tiếp tục cố định dưới |
| Chọn địa chỉ và thợ | Địa chỉ có vị trí; kiểm tra thợ theo dịch vụ/lịch; tự điều phối hoặc thợ ưu tiên | Màn địa chỉ dùng lại; sheet thợ có danh sách cuộn và trạng thái không tìm thấy |
| Xác nhận đặt đơn | Rà soát thông tin; chính sách; voucher; số tiền phải trả lúc này; phương thức hợp lệ | Màn đầy đủ, CTA theo CASH/đặt cọc/thanh toán, cho sửa từng phần |
| Thanh toán và kết quả | Chờ, mở PayOS, kiểm tra, thử lại/đổi phương thức khi được phép, xem đơn | Định danh bằng orderId; tái tải server khi mở lại, không phụ thuộc `extra` |
| Chi tiết đơn CUSTOMER | Trạng thái thực, bước tiếp theo, dịch vụ/địa chỉ/ảnh, thợ, timeline, thanh toán | Một màn làm trung tâm; mở tracking/chat/báo giá/hủy từ đây |
| Báo giá CUSTOMER | Các hạng mục, cọc đã trả, còn trả trực tiếp, trạng thái thu tiền | Màn cuộn cho báo giá dài; tương thích pending cũ khi server cho phép |
| Yêu cầu nhận việc | Lịch, khu vực, nội dung, hạn phản hồi, nhận/từ chối | Card có trạng thái hết hạn; mở chi tiết được nếu backend cho phép |
| Chi tiết công việc PROVIDER | Khách/địa chỉ, ảnh sự cố, thanh toán, lịch, tiến độ, chat, hành động hợp lệ | CTA cố định theo trạng thái; hủy ở nhóm phụ, cần xác nhận |
| Lập/chỉnh báo giá | Nhiều dòng vật tư/công/linh kiện/khác, thời lượng, giảm giá, ghi chú | Màn riêng; thêm/sửa từng dòng bằng form ngắn; giữ bản đang nhập khi lỗi |
| Hoàn thành | 1–5 ảnh camera/thư viện, xem/xóa, ghi chú, rà soát báo giá | Màn riêng, tiến độ upload từng ảnh và CTA gửi một lần |
| Xác nhận thu tiền trực tiếp | Báo giá hiện hành, cọc áp dụng, số tiền thu; xác nhận sau completed | Dialog xác nhận số tiền từ bản báo giá đã xem; cập nhật khi revision đổi |
| Điều phối lại/hủy/chuỗi | Quyết định thay thợ, chọn lại thợ, preview hoàn/hủy, xem các buổi | Sheet quyết định ngắn; màn chuỗi cho nhiều buổi; tiền thay đổi phải xác nhận lại |
| Theo dõi và hậu mãi | Bản đồ thực/thiếu GPS; đánh giá, phản hồi, báo cáo vấn đề | Có trạng thái thay thế khi bản đồ lỗi; form gắn orderId từ chi tiết |

## 5. Trình tự triển khai

### Giai đoạn 1 — Gỡ chỗ kẹt đơn khảo sát và đường vào chi tiết (P0)

**Tệp chính:** `features/orders/domain/order_summary.dart`, `features/orders/presentation/order_screens.dart`, `features/provider/data/provider_repository.dart`, `features/provider/presentation/provider_order_detail_screen.dart`, `features/service_catalog/domain/*`, `app/routing/app_router.dart`.

1. Bổ sung model đọc `serviceType`, `inspectionRequired`, `bookingStatus`, các trường tiền/cọc, snapshot địa chỉ, schedule, bằng chứng, revision và trạng thái thanh toán trực tiếp. Giữ nguyên tên field server; hỗ trợ quan hệ populate hoặc ID và dữ liệu thiếu ở đơn cũ.
2. Tách trạng thái hiển thị và điều kiện thao tác thành phần dùng chung trong feature; bổ sung các nhánh như đang tìm thợ, chờ giữ lịch, đã xác nhận, chờ thu tiền. Không gắn nhãn mọi `created` thành cùng một bước chờ.
3. Thẻ đơn mở chi tiết khi chạm; thêm CTA Xem đơn sau đặt hàng. Tracking chỉ xuất hiện khi hợp lệ; chưa có thợ/đơn kết thúc không tạo dead end.
4. Lập/xem/sửa báo giá từ `accepted` khi lịch và cọc đủ điều kiện, trước nút Bắt đầu. Không cho tạo báo giá trên mọi đơn giá cố định.
5. Gửi `estimatedDurationMinutes` cho trường hợp có schedule; thêm loại hạng mục, nhiều dòng, giảm giá, ghi chú. PATCH bản hiện tại với `quotationId` và `expectedRevision`; lỗi 409 yêu cầu tải và rà soát bản mới.
6. Gửi cặp phiên bản báo giá khi hoàn thành. Bổ sung xác nhận thu tiền trực tiếp chỉ sau completed, gọi endpoint hiện có với revision. Hiển thị báo giá saved cho CUSTOMER thay vì chỉ dựa vào pending.

**Nghiệm thu:** đơn khảo sát đi được từ accepted → lưu báo giá → start → complete → xác nhận thu trực tiếp. Giá cố định không bị ép tạo báo giá. Không xác nhận tiền trên báo giá đã thay đổi; đơn từ lịch sử và kết quả đều mở được chi tiết.

### Giai đoạn 2 — Hoàn thiện tạo đơn và khôi phục thanh toán (P0/P1)

**Tệp chính:** `features/booking/domain/booking_models.dart`, `features/booking/presentation/booking_provider.dart`, phần booking đang nằm trong `features/service_catalog/presentation/service_catalog_screens.dart`, repository tương ứng, `booking_schedule_selector.dart`, `booking_note_input.dart`, `features/account/*`, router.

1. Tách phần booking đang tập trung trong file catalog sang feature booking theo từng màn/controller; giữ route hiện có và tái sử dụng option selector, note input, widget trạng thái. Không refactor phần catalog ngoài nhu cầu này.
2. Bổ sung đặt ngay; kiểm tra giờ và lịch lúc chuyển bước lẫn lúc submit. Gửi recurrence chỉ khi recurring, tránh dữ liệu lịch cũ còn sót khi đổi loại. Bổ sung `uniformQuantity` đúng trường hợp web đang áp dụng.
3. Tái sử dụng sổ địa chỉ; hỗ trợ tọa độ/reverse geocode bằng API hiện có. Đổi địa chỉ/lịch/option phải kiểm tra lại `/providers/nearby`; mặc định tự điều phối, có thể chọn thợ ưu tiên và gửi `preferredProviderId`.
4. Tải `/orders/booking-policies`, hiển thị và yêu cầu đồng ý; rà soát đủ địa chỉ/người nhận, option/số lượng, lịch, ảnh và tiền trước gửi. Lỗi từng field có chỉ dẫn sửa; chọn lại/chụp ảnh, truyền purpose ảnh sự cố.
5. Kết nối kho voucher vào draft; dùng preview mới nhất. Gửi `expectedBookingAmount`, `expectedFinalAmount` khi tạo và `expectedAmount` khi trả tiền. Giá/voucher đổi phải hiện giá mới để khách xác nhận lại.
6. Phân nhánh payment từ service/order: khảo sát chỉ PAYOS/WALLET cho cọc; giá cố định theo điều kiện hiện tại. Dùng `INSPECTION_DEPOSIT` hoặc `FULL` tương ứng. CASH có nhãn thanh toán trực tiếp, không hiện như PayOS chưa hoàn tất.
7. Đưa submit vào controller có khóa chống bấm lặp. Lưu orderId ngay khi nhận create thành công, giữ trạng thái chưa trả tiền nếu payment lỗi, cho tiếp tục bằng chính đơn đó từ chi tiết. Màn kết quả lấy đơn/payment từ server, phân biệt trả cọc, đã trả, tiền mặt, chờ và lỗi.
8. PayOS tiếp tục mở ngoài app bằng url_launcher. Khi resumed, đối soát và tải lại đơn; giới hạn số lần polling, dừng khi background/đã kết thúc. Có nút kiểm tra thủ công và tạo lại liên kết theo endpoint hiện có khi đủ điều kiện.
9. Dùng ID trong route cho đơn/kết quả để tái dựng màn sau app khởi động lại. Duy trì bản nháp tối thiểu và con trỏ đơn chờ theo user. Khi đã thanh toán thì không tạo hoặc thu lại.
10. Khi timeout create mà chưa biết orderId: hiện trạng thái chưa xác định, làm mới lịch sử và yêu cầu kiểm tra trước khi đặt lại. Không tự retry POST; khóa ở client không bảo đảm chống trùng trên server. Không tự thêm idempotency contract trong phạm vi kế hoạch này.

**Nghiệm thu:** đặt ngay và hẹn giờ đi được với giá cố định; khảo sát không cho chọn CASH để trả cọc. Mở PayOS → background → quay lại hoặc khởi động lại app tìm được đơn, không thu lại đơn đã trả. Tạo đơn thành công nhưng payment lỗi vẫn tiếp tục được; preview đổi giá không thu theo số tiền khách chưa xác nhận.

### Giai đoạn 3 — Điều phối, hủy và hoàn thiện xử lý việc (P1)

**Tệp chính:** `features/orders/*`, `features/provider/*`, `features/chat/*`, `features/account/*`, router; tạo widget/controller trong feature hiện có khi cần.

1. Danh sách CUSTOMER/PROVIDER hỗ trợ page/status/search từ API, không lọc riêng trang đầu. Giữ dữ liệu khi tải thêm thất bại; không trình bày số đếm trang hiện tại như tổng tất cả đơn. Lịch PROVIDER phải cho thấy dữ liệu ngoài 50 đơn đầu khi tra cứu lịch có liên quan.
2. Assignment hiện hạn theo responseDeadline, vô hiệu thao tác hết hạn, cho nhập lý do từ chối; 409 hoặc việc đã bị nhận thì tải lại. Khi nhận thành công có thể mở ngay công việc.
3. Chi tiết PROVIDER bổ sung chat đúng role, hủy nhận đơn theo quyền backend, ảnh sự cố, snapshot option và thông tin người nhận; nút start giải thích rõ nếu thiếu cọc/lịch xác nhận/báo giá.
4. Màn hoàn thành hỗ trợ camera/thư viện 1–5 ảnh, xem/xóa trước gửi, giới hạn ghi chú và định dạng/dung lượng theo backend/web. Giữ URL upload thành công để retry không tải lại toàn bộ; không gửi complete nếu upload chưa xong.
5. Chi tiết CUSTOMER bổ sung lịch sử `/payments/order/:id`, cọc, giảm giá, phí, tiền hoàn, bằng chứng hoàn thành và thao tác thanh toán/đổi phương thức đúng điều kiện web/backend. Phân biệt tổng theo báo giá với `pricing.totalPaidAmount`, không gắn nhãn mọi giá trị là đã thực thu.
6. Khi hủy, lấy cancellation-preview mới nhất và gửi `confirmedExpectation` đủ trường như web. Nếu server báo tiền đổi, hiển thị lại preview; không tự xác nhận số tiền mới. Lý do có validation và nút gửi có busy.
7. Bổ sung `reassignment-response`, chọn lại `appointment-provider`, trạng thái chờ khách quyết định và hết hạn. Không chỉ hiển thị hủy chung khi server đang chờ quyết định điều phối lại.

**Nghiệm thu:** có trên 20/50 đơn vẫn xem và tìm được đơn cần xử lý; nhận việc hết hạn được xử lý rõ; ảnh/note còn khi lỗi; hai phía thấy đúng cọc và tiền trực tiếp; hủy không dùng kỳ vọng tiền cũ.

### Giai đoạn 4 — Đồng bộ trong phiên, thông báo và tracking thật (P1/P2)

**Tệp chính:** `core/network/api_client.dart`, phần kết nối realtime mới trong `core`, `features/orders/presentation/tracking_screen.dart`, `features/provider/*`, `features/chat/*`, `features/notifications/*`, router.

1. Thêm Socket.IO client khi đã kiểm tra tương thích với backend và xác nhận dependency thực sự cần; tái sử dụng access token trong bộ nhớ/refresh hiện có qua giao diện nội bộ tối thiểu. Không lấy refresh cookie làm token socket, không ghi token vào log hoặc storage mới.
2. Một kết nối theo phiên; theo dõi các event mà server hiện phát, bao gồm order:updated, quotation:updated, assignment đóng/mới, chat và notification sau khi đối chiếu chính xác tên/payload. Event là tín hiệu tải lại dữ liệu có thẩm quyền, không cập nhật mù toàn bộ model từ payload rút gọn.
3. Khi resumed/reconnect, tải lại assignment, đơn và payment đang mở. Có polling dự phòng giới hạn cho màn đang chờ khi socket mất; ngừng khi background/logout. Token hết hạn chỉ refresh có kiểm soát, tránh vòng reconnect vô hạn.
4. Thông báo dùng orderId trong payload mở màn CUSTOMER/PROVIDER phù hợp, kể cả thông báo đã đọc; chưa đăng nhập thì lưu đích đến và điều hướng sau auth. PROVIDER dùng route chat hợp lệ thay vì rơi vào redirect của `/customer`.
5. Tracking lấy status từ order detail. Socket `order:tracking:join` cung cấp customer/provider; `order:location:update` gửi tọa độ và `order:location` cập nhật vị trí. REST tracking-route chỉ đọc geometry, distanceMeters, durationSeconds; kiểm tra [longitude, latitude] trước render.
6. Sử dụng một thư viện bản đồ Flutter phù hợp nhà cung cấp/tile đang được dự án cho phép; không thêm mặc định một dịch vụ cần API key. Chốt thư viện, nguồn tile, attribution và cách phân phối trước khi viết màn bản đồ; đây là cổng quyết định của riêng hạng mục bản đồ.
7. Thay icon bản đồ bằng marker/tuyến đường thực; bỏ tỷ lệ 45%/70% cố định. Hiện thời điểm cập nhật cuối, thiếu GPS/quyền bị từ chối, chưa có thợ, chưa đủ tuyến hoặc đơn kết thúc. Timeline từ lịch sử đơn, không mô phỏng vị trí.
8. Gửi vị trí PROVIDER khi có quyền, đang có đơn hợp lệ và app ở foreground; giới hạn tần suất/khoảng cách, dừng khi kết thúc. Background tracking và push nền cần thiết kế riêng, không cam kết socket luôn chạy khi app bị đóng.

**Nghiệm thu:** CUSTOMER thấy thợ nhận/start/complete và báo giá cập nhật khi mở app; PROVIDER thấy assignment đóng, không nhân đôi listener sau reconnect. Tracking không coi route geometry là trạng thái đơn; thiếu GPS vẫn mở được chi tiết. Mở thông báo vào đúng role và đúng đơn.

### Giai đoạn 5 — Chuỗi định kỳ và hậu mãi (P2)

1. Đọc `/orders/:id/series`, hiển thị từng buổi với tiền/lịch/trạng thái riêng; hủy một buổi hoặc từ buổi đó về sau qua preview scope và cancel-series, gửi kỳ vọng từng buổi. Kiểm tra lại nhánh tạo recurring đang có của app; không mở rộng urgent hoặc đổi cách web tạo recurring.
2. Từ chi tiết completed, gọi feedback context và feedback theo đơn; hiển thị lý do chưa đủ điều kiện, tạo/sửa đánh giá, ảnh và phản hồi PROVIDER. Bổ sung trả lời từ đơn cho PROVIDER theo API hiện có.
3. Báo cáo vấn đề từ chi tiết mang orderId thật và mã đơn để người dùng nhận biết, không yêu cầu nhập MongoDB ID. Đối chiếu luồng support/report web đang dùng trước khi tái sử dụng form complaint cũ; chọn đúng endpoint đang được backend hỗ trợ, không đổi taxonomy hay tự tạo quy trình xử lý mới.
4. Sau khi luồng nhập tay báo giá đạt, bổ sung OCR bảng báo giá theo endpoint scan-image hiện có. Kết quả OCR là bản nháp cần thợ rà soát, không tự lưu thành báo giá.

**Nghiệm thu:** đơn định kỳ app tạo có thể theo dõi và hủy đúng phạm vi; người dùng đánh giá/báo cáo từ đơn mà không nhập ID; không thao tác đánh giá khi backend context không cho phép.

## 6. Thứ tự phụ thuộc và quyết định kỹ thuật

- Đường găng: model/điều kiện trạng thái → báo giá trước start → complete/thu tiền → tạo đơn và phục hồi thanh toán → xử lý các nhánh còn lại → kiểm chứng end-to-end.
- Realtime triển khai sau khi model rõ và trước nghiệm thu hai phía; không dùng socket để che lỗi model hoặc thay validation server. Tracking bản đồ phụ thuộc kết nối realtime và quyết định nguồn bản đồ, không chặn sửa đặt đơn/báo giá.
- Không thêm deep link scheme tùy ý vào returnUrl PayOS: code redirect backend hiện kiểm tra HTTP/HTTPS và origin cho phép. Giai đoạn đầu dùng resumed + reconcile; App Links/Universal Links tự quay về app là phần tích hợp riêng khi có domain/cấu hình Android/iOS được xác nhận.
- Không cần migration hay endpoint mới cho phần lớn khoảng trống trên. Chỉ mở thay đổi backend riêng nếu kiểm chứng chỉ ra API hiện có thực sự thiếu; không đổi contract chỉ để đơn giản hóa app.
- Có thể chia phần UI CUSTOMER/PROVIDER khi model chung đã thống nhất; bản kế hoạch này không yêu cầu tạo agent hoặc triển khai song song.
- Mỗi giai đoạn có thể phát triển và kiểm chứng riêng. Chỉ coi một nhánh sẵn sàng phát hành khi cả hành động, khôi phục lỗi và trạng thái sau cùng của nhánh đó đạt; không phát hành chỉ vì có đủ màn.

## 7. Kiểm chứng và tiêu chí hoàn tất

### Kiểm thử tập trung khi triển khai

| Tầng | Tình huống phải kiểm chứng |
|---|---|
| Model và repository | Đơn giá cố định/khảo sát; populate/ID; saved/pending cũ; bookingStatus; expected amount/revision; route geometry; dữ liệu thiếu ở đơn cũ |
| Controller đặt đơn | Hai lần bấm chỉ gửi một request; đổi địa chỉ/lịch bỏ kết quả thợ cũ; preview cũ không ghi đè mới; payment lỗi vẫn giữ orderId; không retry create khi timeout chưa rõ |
| Widget | CTA đúng trạng thái; từ danh sách mở chi tiết; form lỗi giữ dữ liệu; báo giá nhiều dòng; ảnh 1–5; sheet cuộn; SafeArea, text scale, Back và bàn phím |
| Tích hợp hai tài khoản | Tạo → thanh toán/tiền mặt → dispatch → nhận → báo giá nếu cần → start → complete → thu trực tiếp nếu khảo sát → feedback; refresh cả hai phía |
| Gián đoạn | PayOS trả chậm/hủy; app background/killed; mạng rớt sau create/payment/complete; 401 refresh, 403 quyền, 409 revision/assignment đổi, GPS từ chối |
| Hủy/chuỗi | Cọc chưa có thợ/có thợ; tiền preview đổi; không đủ điều kiện hủy; hủy một buổi và các buổi sau; điều phối lại chấp nhận/từ chối/hết hạn |

Lệnh dự kiến trong thư mục app sau từng thay đổi: `flutter analyze`, `flutter test` các test feature liên quan; chạy toàn bộ `flutter test` ở cuối đợt triển khai. Không viết test chỉ chụp lại cấu trúc UI; tập trung điều kiện nghiệp vụ, khôi phục và contract. Kiểm chứng thật PayOS bằng môi trường thử nghiệm được dự án cung cấp, không tự tạo credential hoặc giao dịch thật.

Android cần emulator và ít nhất một thiết bị/môi trường cấu hình thấp để kiểm tra cuộn/ảnh trong profile. iOS cần môi trường riêng để xác nhận quyền camera/GPS, mở URL, quay lại app và điều hướng Back. Flutter web preview không thay thế kiểm chứng Android/iOS.

### Những gì đã kiểm tra cho bản kế hoạch

- Đọc router, model, repository và UI booking/orders/provider/chat/notification/account Flutter; đối chiếu các trang, hook, API web và validation/service/routes backend liên quan.
- Chạy `mobile_audit.py handigo-app`: công cụ báo FAIL, 459 issues và 131 warnings trên 91 tệp. Công cụ quét cả tệp sinh tự động và có cảnh báo không phù hợp Flutter như “không có Jest”; không coi các con số này là lỗi UX đã xác minh. Điểm có bằng chứng trực tiếp là nút xóa ảnh 28×28 dùng shrinkWrap; cần kiểm tra vùng chạm thực tế của các nút nhỏ còn lại.
- Chưa chạy app/emulator, analyzer, test hoặc giao dịch. Không có thay đổi mã nguồn ứng dụng trong công việc lập kế hoạch này.

## 8. Rủi ro và điểm cần chốt đúng lúc

| Rủi ro | Cách xử lý |
|---|---|
| Mang luồng khách duyệt báo giá trong plan cũ sang luồng mới | Bám service backend và web đang dùng; giữ pending cũ như nhánh tương thích |
| Mất mạng gây tạo đơn hoặc thu tiền lặp | Lưu orderId đã nhận, đối soát trước thử lại; trạng thái chưa rõ không tự retry; ghi rõ giới hạn nếu chưa có idempotency phía server |
| Giá/cọc/hoàn tiền hoặc báo giá đổi khi người dùng đang xem | Gửi expected amount/confirmedExpectation/revision; tải mới và xác nhận lại khi xung đột |
| Redirect PayOS mở web thay vì app | Bảo đảm resumed/manual reconcile trước; App Links cần domain được xác nhận, không tự đổi backend origin policy |
| Background làm mất socket và vị trí | Đồng bộ lại khi resumed, báo thời điểm cập nhật; không hứa realtime khi app đóng; push/background là dự án tích hợp riêng |
| Tọa độ thiếu, quyền GPS từ chối hoặc nguồn bản đồ chưa chốt | Chi tiết vẫn dùng được, hiển thị địa chỉ/dữ liệu thiếu trung thực; chốt nguồn bản đồ trước hạng mục render map |
| API/test data cũ không cùng phiên bản hiện tại | Fixture theo response thực và kiểm tra pending cũ; backend là nguồn quyết định nghiệp vụ, web là tham chiếu hành vi |

Giả định phục vụ kế hoạch: ưu tiên điện thoại Android, giữ khả năng iOS; dùng backend hiện tại với tài khoản CUSTOMER và PROVIDER đã duyệt và dữ liệu dịch vụ cả hai loại. Chưa cần câu trả lời để bắt đầu giai đoạn 1. Trước bản đồ cần chốt nhà cung cấp; trước phát hành iOS cần môi trường và cấu hình liên quan; trước tự mở app từ PayOS cần domain App Links/Universal Links. Các đầu vào này không chặn phân tích hoặc hoàn thiện luồng chính.

## 9. Mốc mã nguồn đối chiếu

Các đường dẫn dưới đây tính từ gốc repository, dùng để người triển khai tìm đúng nhánh trước khi sửa:

- App: `handigo-app/lib/features/service_catalog/presentation/service_catalog_screens.dart`, `_loadPreview`, `_submitOrder`, `_BookingForm`, `_BookingReview`, `BookingSuccessScreen`.
- App: `handigo-app/lib/features/orders/presentation/order_screens.dart`, `OrderSummaryCard`, `OrderDetailScreen`; `features/orders/presentation/tracking_screen.dart` và model `order_summary.dart`.
- App: `handigo-app/lib/features/provider/presentation/provider_order_detail_screen.dart`, `_quotation`, `_complete`; repository `provider_repository.dart` và `provider_screens.dart`.
- Web đặt đơn: `handigo-web/src/features/booking/components/useCreateBookingStep2Form.ts`, `useConfirmPaymentFlow.ts`, `confirmPaymentSubmit.ts`, `pendingBookingRecovery.ts` và `features/booking/api/booking.api.ts`.
- Web xử lý đơn: `handigo-web/src/features/booking/components/detail/useBookingDetail.ts`, `useBookingDetailData.ts`, `useBookingPaymentFlow.ts`, `BookingQuotationDetails.tsx`, `BookingRefundPanel.tsx`.
- Web PROVIDER: `handigo-web/src/features/provider/components/orders/QuotationOrderPanel.tsx`, `components/FixedPriceActionForm.tsx`, `hooks/useProviderOrderDetail.ts`, `api/providerOrder.api.ts`.
- Tracking và realtime: `handigo-web/src/features/tracking/api/tracking.api.ts`, `handigo-backend/src/services/orderTracking.service.ts`, `handigo-backend/src/sockets/initSocket.ts`.
- Nghiệp vụ: `handigo-backend/src/services/order.service.ts` (startOrder/completeOrder), `assignment.service.ts` (confirmQuotationPayment/confirmRepairQuotation), `payment.service.ts` (getPaymentType), `validations/order.validator.ts`, `utils/paymentRedirect.ts`.

Khi nội dung tài liệu cũ `handigo-app/plan.md` khác các nhánh đang dùng, xem tài liệu cũ là bối cảnh, không làm đặc tả ghi đè hành vi hiện tại.
