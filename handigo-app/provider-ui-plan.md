# Kế hoạch chỉnh giao diện đối tác Handigo Flutter

## Mục tiêu và phong cách

Giao diện đối tác gọn, phân cấp rõ và phục vụ thao tác nhận việc. Đây là tổng hợp từ yêu cầu đã nêu trong các cuộc trò chuyện về Home mobile và mẫu Stitch hiện có: giảm khoảng trắng thừa; card có nội dung ngắn, dễ quét; nút chính rõ; bottom navigation nền trắng, gọn, có icon và nhãn; giữ đồng nhất design system khi lấy bố cục từ ảnh.

Nguồn chuẩn: `stitch_remix_of_fixnow_home_service_marketplace/fixnow_modern_domestic/DESIGN.md` và `lib/app/theme/app_theme.dart`. Không dùng bảng màu xanh của `nova-mobile.md` cho phần provider.

| Thành phần | Quyết định |
| --- | --- |
| Màu chính | `primary` #1E00A9; `primary-container` #3525CD |
| Nền và card | #FAF8FF; #FFFFFF; vùng thông tin phụ #F2F3FF |
| Nội dung | #131B2E; thông tin phụ #464555; viền #C7C4D8 ở độ trong suốt 30% |
| Font | Hanken Grotesk cho tiêu đề; Inter cho nội dung và nhãn |
| Khoảng cách | Lề màn 16; dùng nhịp 4/8/12/16/24; vùng chạm từ 48 |
| Hình dạng | Card 16, vùng nhập/nút 12, badge dạng pill; dùng theme hiện tại |
| Chiều sâu | Nền phân lớp và viền nhẹ; hạn chế bóng, không thêm hiệu ứng trang trí |
| Ảnh | Đối chiếu `screen.png` và `code.html`; hiển thị ảnh thật từ dữ liệu đã có, không dùng chân dung mẫu làm người dùng thật |

## Phạm vi và đầu vào

Theo bổ sung của người dùng, ưu tiên hoàn thiện UI trước: shell, tổng quan, đơn hàng, lịch hẹn, tài khoản, chi tiết đơn và giao diện form hiện có. Tái sử dụng theme, component ảnh, loading/error, API client và repository. Giữ route, backend, schema, API và quy tắc nghiệp vụ hiện có. Các trường bổ sung ở model Flutter chỉ đọc dữ liệu backend đã cung cấp và có giá trị mặc định tương thích.

Đầu vào đã có: mẫu HTML/PNG của bảng điều khiển thợ, danh sách đơn được giao, chi tiết đơn thợ, lịch làm việc, báo giá vật tư, tài khoản và ví. Bộ mẫu có navigation và dữ liệu minh họa khác nhau; chọn bốn tab đang có của app để giữ luồng sử dụng thống nhất. Không thêm tab thu nhập, chuyển role, chỉ đường, ca làm việc, mục tiêu hay số liệu giả chỉ vì xuất hiện trong ảnh.

Giả định: ưu tiên điện thoại Android/iOS theo cấu trúc Flutter hiện có; không thay đổi cơ chế offline, xác thực hoặc quyền truy cập. Khi mạng lỗi, dùng trạng thái lỗi và thao tác thử lại. Thông báo dùng route hiện có.

## Đối chiếu mẫu và trình tự triển khai

1. **Shell và tổng quan:** dùng mẫu `b_ng_i_u_khi_n_th_handigo_mobile`. Thu gọn navigation; thay khối chào quảng bá lớn bằng thông tin đối tác và trạng thái nhận việc; đưa đơn cần phản hồi lên trước; dùng số liệu tháng/tổng đúng nghĩa dữ liệu; ví liên kết màn hiện có.
2. **Đơn hàng:** dùng mẫu `danh_s_ch_n_c_giao_handigo_mobile`. Hiện nút nhận/từ chối trên card; dùng hạn phản hồi thật; chỉ mở chi tiết sau khi nhận thành công vì API chi tiết chưa cấp quyền cho assignment pending. Phân biệt đơn chờ phản hồi, đã nhận, đang làm và đã kết thúc. Không tự tạo trạng thái di chuyển.
3. **Lịch hẹn:** dùng mẫu `l_ch_l_m_vi_c_l_ch_h_n_handigo_mobile`. Cho chọn ngày và chuyển tuần; lọc lịch đúng ngày, bỏ đơn hủy; tổng số lịch đúng danh sách đang xem; không gọi tổng tiền đơn là thu nhập thợ.
4. **Chi tiết và form hiện có:** dùng mẫu `chi_ti_t_n_h_ng_th_handigo_mobile` và `g_i_b_o_gi_v_t_t_handigo_mobile`. Chia thông tin thành card gọn, giữ CTA trong safe area và làm form dễ đọc, tránh bàn phím che nội dung. Dùng trạng thái/lịch sử thật thay cho các bước khảo sát hoặc xác nhận được đánh dấu giả định. Giữ thao tác bắt đầu, báo giá, cập nhật thời gian và hoàn thành hiện có. Chưa mở rộng chức năng hay tích hợp lại workflow báo giá ở đợt UI này.
5. **Tài khoản:** dùng nhóm menu trong mẫu tài khoản; hiển thị tên/avatar thật, nhóm các route hiện có; đăng xuất dùng màu lỗi. Chỉ chỉnh phần hiển thị ví liên quan, giữ logic ngân hàng/rút tiền.
6. **Kiểm chứng:** chạy static analysis; test các thao tác nhận đơn và trạng thái làm việc, lọc lịch theo ngày, lỗi/rỗng và layout ở màn nhỏ/chữ lớn; dựng ảnh xem trước từ widget test khi công cụ cho phép.

## Điều kiện hoàn thành và rủi ro

- Các màn dùng token theme đã đối chiếu với DESIGN.md, ảnh và cấu trúc HTML có sẵn.
- Không có vùng bấm mở chi tiết pending dẫn đến 403; phản hồi đơn có loading, lỗi và chặn bấm lặp.
- Chọn ngày thay đổi lịch; đơn hủy không xuất hiện; không ghi toàn bộ lịch là “Hôm nay”.
- CTA hiển thị theo trạng thái/dữ liệu backend, không tự chuyển trạng thái khi chưa thành công.
- Các thao tác giữ API và payload hiện tại; lỗi API giữ nguyên thông báo; không bỏ qua xác nhận lịch hoặc điều kiện thanh toán.
- Không overflow trên màn rộng 320/390/430 và khi tăng cỡ chữ; navigation/CTA không che nội dung.
- Static analysis và test trong phạm vi sửa phải đạt; kết quả kiểm tra thiết bị thật được báo riêng nếu chưa có môi trường.

Rủi ro chính: mẫu có thông tin minh họa không nằm trong API; chỉ dùng phần có dữ liệu thật. Danh sách hiện trả tối đa 50 đơn/trang; khi mở rộng cần dùng pagination hiện có để không bỏ sót lịch. Trạng thái thay đổi ở phiên khác: sau thao tác phải tải lại đơn, danh sách và tổng quan; backend tiếp tục quyết định quyền và điều kiện thực hiện.

Các điểm workflow cần xử lý ở đợt riêng: báo giá của đơn khảo sát cần lưu trước khi bắt đầu; trạng thái thanh toán/xác nhận lịch chưa được model Flutter đọc đầy đủ; danh sách/lịch mới lấy trang đầu. Không mở rộng nghiệp vụ này khi người dùng đang yêu cầu ưu tiên UI.

## Kết quả kiểm chứng

- Đã chỉnh shell, tổng quan, danh sách đơn, lịch hẹn, tài khoản, hồ sơ, ví và chi tiết đơn; form báo giá hiện có được bổ sung khoảng cách và vùng cuộn.
- Static analysis trong phạm vi provider, model chi tiết đơn và bài kiểm tra UI: không có lỗi hoặc cảnh báo.
- 16/16 widget test đạt: chuyển tab, lọc đơn, phản hồi assignment, tải lỗi, chọn ngày, CTA theo bốn trạng thái, dark mode, bố cục bảy màn ở ba chiều rộng 320/390/430 và cỡ chữ 1×/2×; form báo giá khi có bàn phím.
- Đã xem ảnh dựng bằng font thật của tổng quan, đơn, lịch, chi tiết, tài khoản, hồ sơ và ví. Ảnh trong `.dart_tool/provider-*.png` dùng dữ liệu kiểm tra, không được đưa vào giao diện sản phẩm.
- Chưa kiểm tra trực tiếp trên điện thoại hoặc emulator; chưa xác nhận API trên phiên provider thực tế. Các giới hạn workflow nêu trên được giữ cho đợt tiếp theo.
