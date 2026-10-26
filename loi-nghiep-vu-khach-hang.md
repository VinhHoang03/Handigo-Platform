# Lỗi nghiệp vụ khách hàng cần xử lý

## Bảng mô tả ngắn gọn

Phạm vi: luồng khách hàng trên web và backend phục vụ web; chưa rà soát mobile.

**Cập nhật triển khai ngày 26/10/2026:** tạm bỏ giới hạn booking 08:00–21:00 theo yêu cầu để kiểm thử ngoài giờ. Web mở bộ chọn đủ 24 giờ; backend và trợ lý dùng chung chính sách giờ tạm thời. Vẫn kiểm tra thời gian hợp lệ, không sớm hơn phút hiện tại khi tạo lịch mới và lịch trống/ca làm việc của thợ. Đây không phải thay đổi xử lý KH-33. Không sửa mã nguồn mobile.

| Mã lỗi | Mức độ | Mô tả ngắn gọn | Trạng thái |
|---|---|---|---|
| KH-03 | Chưa phân loại | Khách được duyệt thành provider mất quyền thao tác trên các đơn đã đặt. | Tạm hoãn theo yêu cầu |
| KH-33 | P2 | Vẫn cho tiếp tục thanh toán và điều phối lịch hẹn đã qua giờ thực hiện. | Tạm hoãn theo yêu cầu |

## KH-03 — Tạm hoãn: duyệt provider làm mất thao tác khách hàng với đơn đang có

**Trạng thái xử lý:** tạm giữ nghiệp vụ và mô tả hiện tại, để sửa sau theo yêu cầu người dùng ngày 25/10/2026. Không tự triển khai hoặc mở rộng quyền provider trong đợt rà soát bổ sung.

**Luồng:** khách đã đặt dịch vụ → gửi hồ sơ provider → admin duyệt khi đơn chưa kết thúc.

**Bằng chứng:** `reviewApplication` trong [providerApplication.service.ts](handigo-backend/src/services/providerApplication.service.ts) đổi role sang `PROVIDER` mà không kiểm tra nghĩa vụ đơn khách hàng còn tồn tại. [customer-routes.tsx](handigo-web/src/routes/customer-routes.tsx) chặn màn hình đơn khách hàng đối với provider. Các API danh sách đơn, chọn lại thợ, đánh giá và thưởng trong [order.routes.ts](handigo-backend/src/routes/order.routes.ts), [feedback.routes.ts](handigo-backend/src/routes/feedback.routes.ts), [reward.routes.ts](handigo-backend/src/routes/reward.routes.ts) cũng yêu cầu `CUSTOMER`.

**Kịch bản:** khách có đơn hẹn giờ đã trả tiền hoặc đang cần chọn thợ thay thế; hồ sơ provider được duyệt trước khi đơn hoàn tất.

**Thực tế:** chủ tài khoản bị chặn khỏi giao diện/thao tác khách hàng của chính đơn đã đặt. Một số API xem chi tiết có kiểm tra ownership vẫn đọc được; điều đó không khôi phục đầy đủ luồng thao tác trên web.

**Mong đợi:** chuyển role không làm mất khả năng xử lý các giao dịch đã phát sinh. Tài khoản provider truy cập chức năng khách hàng từ trang chủ chính qua menu avatar; kênh provider là khu vực làm việc riêng của thợ.

**Ảnh hưởng:** khách không tiếp tục theo dõi/xử lý đơn qua giao diện bình thường hoặc đánh giá sau hoàn thành được.

**Trạng thái ngày 25/10/2026:** đã thống nhất hướng bố trí hai khu vực giao diện theo yêu cầu người dùng; mới cập nhật mô tả nghiệp vụ, chưa sửa code. Quyền tạo đơn mới và quyền đổi điểm/sử dụng voucher của provider chưa được chốt.

**Nguyên nhân cần xử lý:** hệ thống đang dùng `User.role` cho cả quyền sử dụng khu vực ứng dụng và tư cách tham gia một đơn. Khi người dùng chuyển sang `PROVIDER`, họ vẫn là người đặt các đơn có `order.customerId` trùng ID tài khoản, nhưng một số route chỉ nhận `CUSTOMER`; một số nhánh service lại chọn cách xử lý theo role. Vì vậy, chỉ mở giao diện hoặc thêm `PROVIDER` vào middleware chưa đủ để khôi phục đúng nghiệp vụ.

**Hướng xử lý KH-03: giữ một tài khoản, tách khu vực sử dụng và kiểm tra quyền theo tài nguyên.** Admin duyệt hồ sơ và chuyển tài khoản sang `PROVIDER` theo quy trình hiện có. Người dùng vẫn truy cập chức năng khách hàng từ trang chủ chính, đồng thời sử dụng kênh provider để làm việc với tư cách thợ. Với các đơn đã đặt, quyền xử lý được xác định theo chủ đơn, trạng thái và chính sách hiện có. Di chuyển giữa hai khu vực không đổi `User.role`, không tạo tài khoản mới và không yêu cầu người dùng chuyển role thủ công. Phạm vi quyền tạo đơn mới và đổi điểm/sử dụng voucher được ghi riêng là chưa chốt, không mặc định coi đã được mở hoặc đã bị cấm theo chính sách mới.

Ví dụ: A đặt đơn hẹn giờ và đã cọc, sau đó được duyệt làm provider. Từ trang chủ chính, A mở menu avatar để truy cập đơn đã đặt, xem đơn, chọn thợ thay thế nếu hợp lệ, xử lý báo giá, thanh toán/hủy theo chính sách và đánh giá sau hoàn thành. Những quyền này xuất phát từ việc A là chủ đơn; quyền nhận việc của A vẫn theo hồ sơ provider.

**Bố trí giao diện theo yêu cầu người dùng:** trang chủ chính giữ các chức năng khách hàng trong menu popup khi nhấn avatar, kể cả khi tài khoản đã là provider. Navbar có mục “Kênh của provider” để vào khu vực làm việc của thợ. Bên trong kênh này chỉ hiển thị chức năng provider, không thêm mục đơn đã đặt hoặc chức năng khách hàng. Khi cần sử dụng chức năng khách hàng, thợ quay về trang chủ chính rồi truy cập qua menu avatar. Việc di chuyển giữa hai khu vực không đổi role của tài khoản. Đây là hướng giao diện đã được yêu cầu; quyền tạo đơn mới và quyền dùng điểm/voucher vẫn cần chốt riêng.

**Luồng sử dụng sau khi triển khai:**

1. Người dùng đăng nhập bằng tài khoản đã được duyệt làm provider và truy cập trang chủ chính.
2. Tại trang chủ chính, nhấn avatar để mở menu chức năng khách hàng. Khi vào đơn đã đặt, người dùng xem lịch sử, theo dõi và thực hiện các thao tác hợp lệ trên đơn của mình trong giao diện khách hàng.
3. Khi muốn làm việc với tư cách thợ, người dùng chọn “Kênh của provider” trên navbar để vào khu vực provider, xem và xử lý các công việc được phân công.
4. Menu/sidebar trong kênh provider chỉ phục vụ công việc của thợ; không đặt mục đơn đã đặt, đánh giá với tư cách khách hàng hoặc các chức năng khách hàng tại đây.
5. Khi muốn quay lại chức năng khách hàng, người dùng chọn lối về trang chủ chính rồi mở menu avatar. Các trang khách hàng không tự chuyển về kênh provider chỉ vì tài khoản mang role `PROVIDER`.
6. Backend vẫn kiểm tra quyền trên từng tài nguyên khi gọi API hoặc kết nối realtime, kể cả khi người dùng truy cập bằng liên kết trực tiếp. Việc ẩn hoặc hiện menu không thay thế kiểm tra quyền.

**Quy tắc quyền đề xuất:**

| Nhóm thao tác | Sau khi chuyển sang provider |
|---|---|
| Xem danh sách, chi tiết, lịch sử và theo dõi đơn đã đặt | Cho phép; truy vấn theo `customerId` của tài khoản đang đăng nhập. Danh sách này tách khỏi danh sách việc nhận làm thợ. |
| Chọn thợ, phản hồi đổi thợ, chấp nhận/từ chối báo giá, hủy hoặc bỏ đơn chưa thanh toán | Cho phép trên đơn sở hữu khi trạng thái và điều kiện hiện có cho phép; không bỏ qua chính sách hủy, phí hoặc thời hạn. |
| Thanh toán, đối soát thanh toán, xem kết quả và hoàn tiền | Giữ luồng của người đặt đơn; không chuyển sang nhánh thu nhập của provider chỉ vì role hiện tại là `PROVIDER`. |
| Tạo/sửa/xem đánh giá của mình | Giữ điều kiện hoàn thành, thời hạn và giới hạn sửa hiện có. Quyền trả lời với tư cách thợ vẫn kiểm tra provider của đơn. |
| Chat, theo dõi realtime, thông báo và hỗ trợ liên quan | Cho phép theo quan hệ với đơn/hội thoại/yêu cầu; xác minh người tham gia hiện tại ở backend và socket. |
| Lịch sử điểm, voucher đã có | Đề xuất giữ quyền xem tài sản/lịch sử của chính tài khoản. Quyền đổi điểm hoặc sử dụng voucher sau chuyển role cần chốt riêng trước triển khai. |
| Tạo đơn dịch vụ mới | Chưa chốt quyền của provider. Trong khi mới cập nhật mô tả, giữ nguyên hành vi hiện có; trước triển khai cần xác nhận riêng quyền này. |
| Thao tác trên đơn của người khác | Từ chối nếu không có quyền hợp lệ khác theo cơ chế hiện có. |

**Phạm vi triển khai dự kiến theo hướng trên:**

1. **Backend — kiểm tra quyền ở từng hành động:** lập danh sách route phục vụ đơn đã đặt trong `order.routes.ts`, `feedback.routes.ts` và các route thanh toán, hỗ trợ, chat liên quan. Chỉ mở cho `PROVIDER` ở những hành động đã xác minh cần thiết; service phải kiểm tra ownership bằng ID từ middleware xác thực. Không đổi toàn bộ middleware `CUSTOMER` thành cho phép cả hai role, vì có thể mở cả chức năng tạo đơn hoặc chức năng ngoài phạm vi.
2. **Backend — xác định tư cách theo tài nguyên:** rà soát các nhánh đang dựa vào `user.role`, nhất là hủy đơn, thanh toán, lịch sử giao dịch và realtime. Với thao tác của người đặt đơn, kiểm tra `order.customerId` trước khi chọn nhánh xử lý; với thao tác của thợ, kiểm tra provider được phân công. Không nhận `customerId`, role hoặc tư cách thực hiện do client tự khai. Provider không được nhận chính đơn mình đã đặt; cần xác minh và kiểm thử điều kiện loại trừ này trong luồng tìm/chọn/nhận thợ.
3. **Frontend — tách khu vực theo mục đích sử dụng:** giữ lối truy cập các chức năng khách hàng ở menu avatar của trang chủ chính cho tài khoản provider; navbar giữ mục “Kênh của provider” để vào khu vực làm việc của thợ. Không đưa chức năng khách hàng vào menu/sidebar của kênh provider; cung cấp lối về trang chủ chính để truy cập lại menu khách hàng. Mở đúng các trang lịch sử, chi tiết, kết quả thanh toán, đánh giá/hỗ trợ cần dùng theo ownership. Rà soát nút thao tác và đường dẫn quay về để các trang khách hàng vẫn nằm trong khu vực giao diện khách hàng, không tự chuyển sang kênh provider chỉ vì role hiện tại. Giữ màn hình tạo đơn mới theo quyền hiện tại cho đến khi chốt quyền này. Chỉ thay `RouteGuard` mà không rà soát các nút bên trong trang sẽ chưa đủ.
4. **Dữ liệu và tương thích:** tái sử dụng `customerId`, `providerId` và các quan hệ hiện có; không đổi chủ đơn, chuyển dữ liệu sang tài khoản mới hoặc thêm schema nhiều role. Quyền dựa trên sở hữu cũng cần áp dụng cho tài khoản đã được chuyển sang provider trước khi sửa, không chỉ các lần duyệt mới. Chưa đề xuất migration hoặc field thời điểm chuyển role; nếu muốn giới hạn đơn theo thời điểm, phải xác minh dữ liệu lịch sử đủ tin cậy trước.
5. **Duyệt hồ sơ và phiên đăng nhập:** giữ phân biệt duyệt hồ sơ lần đầu với duyệt bổ sung dịch vụ. Kiểm tra lại luồng đăng nhập/cập nhật quyền sau duyệt, tải lại trang và kết nối socket để tài khoản có role mới vẫn truy cập được các giao dịch sở hữu. Không sửa cơ chế token trong phạm vi tài liệu này.

**Các điểm cần chốt trước khi sửa code:** provider có được tạo đơn dịch vụ mới hay chỉ xử lý đơn đã đặt; có được đổi điểm/sử dụng voucher như khách hàng hay chỉ xem tài sản và lịch sử đã có. Hướng giao diện đã được xác định là truy cập chức năng khách hàng từ trang chủ chính, tách khỏi kênh làm việc của provider. Không bổ sung cơ chế chặn duyệt provider trong phạm vi mô tả này.

**Tiêu chí nghiệm thu dự kiến:**

| Tình huống | Kết quả cần đạt |
|---|---|
| Duyệt hồ sơ khi có đơn chờ thanh toán, chờ/chọn lại thợ, đã cọc, đang thực hiện hoặc chờ xác nhận báo giá | Đăng nhập lại bằng role provider vẫn truy cập và thực hiện đúng các hành động hợp lệ của người đặt đơn; không mở thêm hành động bị cấm theo trạng thái. |
| Đơn đã hoàn thành nhưng chưa đánh giá; đơn đã hủy còn hoàn tiền/hỗ trợ đang xử lý | Giữ quyền đánh giá trong điều kiện hiện có, xem đối soát/hoàn tiền và tiếp tục yêu cầu hỗ trợ của mình. |
| Tài khoản vừa có đơn đã đặt, vừa nhận việc cho khách khác | Đơn đã đặt được truy cập từ menu avatar ở trang chủ chính; công việc nhận làm được truy cập trong kênh provider. Kênh provider không hiển thị chức năng khách hàng; có lối về trang chủ chính. Thanh toán, hủy, phí và thông báo không bị áp dụng nhầm tư cách. |
| Đổi ID trên URL hoặc gọi trực tiếp API bằng ID đơn/đánh giá/hội thoại của người khác | Backend từ chối; không phụ thuộc việc giao diện có ẩn nút hay không. |
| Provider tìm hoặc nhận chính đơn mình đã đặt | Bị từ chối; kiểm tra ở backend, không chỉ ẩn trên giao diện. |
| Provider tạo đơn mới hoặc đổi điểm/sử dụng voucher | Chỉ xác định kết quả mong đợi sau khi chốt các quyền này; chưa coi là tiêu chí đã được thống nhất. |
| Tài khoản đã chuyển sang provider từ trước; mở lại liên kết thanh toán, tải lại trang hoặc kết nối lại socket | Vẫn truy cập đúng giao dịch sở hữu; không cần đổi lại role hay sửa dữ liệu đơn thủ công. |
| Khách hàng chưa chuyển role và provider chỉ có công việc nhận làm | Các luồng hiện tại tiếp tục hoạt động; không mở quyền quản trị hoặc quyền thao tác tài nguyên người khác. |

Chỉ coi KH-03 hoàn tất sau khi kiểm thử cả backend, giao diện và realtime của các nhánh bị ảnh hưởng; tại thời điểm cập nhật tài liệu này, lỗi vẫn nằm trong danh sách cần xử lý.

## Rà soát bổ sung luồng booking ngày 26/10/2026

**Phạm vi:** chọn dịch vụ/tùy chọn, địa chỉ và lịch thực hiện; tạo đơn, thanh toán và khôi phục sau lỗi; điều phối/chọn lại thợ; báo giá, hoàn thành, hủy và theo dõi đơn. Chỉ rà soát luồng khách hàng trên web và các xử lý backend phục vụ những luồng này; ứng dụng di động nằm ngoài phạm vi. Giữ nguyên KH-03 đang tạm hoãn; không sửa code, API hoặc dữ liệu trong đợt này.

**Mức độ kiểm chứng:** KH-33 được xác định từ nhánh xử lý cụ thể trong code và đã tái hiện cô lập bằng mã hiện tại với phụ thuộc giả lập; chưa kiểm thử toàn trình trên MongoDB hoặc PayOS thật.

## KH-33 — P2: có thể tiếp tục thanh toán và điều phối đơn hẹn giờ đã qua thời điểm thực hiện

**Trạng thái:** tạm hoãn theo yêu cầu người dùng ngày 26/10/2026; chưa triển khai xử lý lịch hẹn hết hiệu lực khi tiếp tục thanh toán.

**Luồng:** tạo đơn hẹn giờ hợp lệ → chưa hoàn tất thanh toán → qua giờ hẹn → mở chi tiết đơn và tiếp tục thanh toán.

**Bằng chứng:** [payment.service.ts:182](handigo-backend/src/services/payment.service.ts#L182), `assertAppointmentPaymentReady` trả về ngay khi đơn `created` chưa có `providerId`, không so sánh `scheduledAt` với hiện tại. Đơn mới có `bookingStatus = not_required`, `paymentDueAt = null` tại [order.service.ts:418](handigo-backend/src/services/order.service.ts#L418), nên không thuộc nhánh quét hết hạn thanh toán ở [dispatch.service.ts:683](handigo-backend/src/services/dispatch.service.ts#L683). Điều kiện `canMakeInitialPayment` tại [useBookingDetail.ts:77](handigo-web/src/features/booking/components/detail/useBookingDetail.ts#L77) không kiểm tra giờ hẹn đã qua. Sau ghi nhận tiền, hệ thống bật điều phối và dùng lại `scheduledAt` cũ; kiểm tra lịch làm việc trong [providerSchedule.ts:16](handigo-backend/src/utils/providerSchedule.ts#L16) chỉ xét khung giờ/ngày nghỉ, không chặn khoảng thời gian trong quá khứ.

**Kịch bản:** tạo đơn hẹn 10:00 nhưng chưa thanh toán; 10:10 mở lại chi tiết để trả tiền. Chọn thời lượng 60 phút và thợ phù hợp, không có lịch xung đột để loại trừ các nguyên nhân từ chối khác.

**Thực tế và ảnh hưởng:** backend vẫn cho qua điều kiện thanh toán của đơn hẹn đã trễ; có thể thu tiền và gửi đề nghị nhận một khung giờ bắt đầu trong quá khứ. Điều này bỏ qua ràng buộc không đặt lịch trong quá khứ vốn được kiểm tra lúc tạo đơn. Tái hiện cô lập xác nhận guard thanh toán chấp nhận đơn `created` chưa có thợ với ngày hẹn đã qua; kiểm tra khung làm việc cũng trả `true` cho khoảng quá khứ hợp lệ trong ngày.

**Mong đợi/hướng xử lý:** kiểm tra lại tính hợp lệ của giờ hẹn tại bước tiếp tục thanh toán/điều phối; lịch hết hiệu lực phải yêu cầu khách chọn lại hoặc xử lý hết hạn theo chính sách được chốt. Với QR đã phát hành và tiền đến muộn, cần đối soát rồi xử lý khoản tiền theo chính sách, không chỉ từ chối cập nhật giao dịch.

**Kiểm thử cần bổ sung:** tạo trước giờ hẹn, chuyển đồng hồ qua giờ hẹn rồi thử ví, tiền mặt và PayOS; bao phủ cả QR cũ nhận tiền muộn. Không xác nhận/điều phối lịch quá khứ mà chưa xử lý lại lịch và khoản tiền.
