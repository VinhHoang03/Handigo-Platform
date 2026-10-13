# Kế hoạch chỉnh danh sách dịch vụ khách hàng

## Mục tiêu và phạm vi
Chỉnh màn hình Flutter hiện có theo ảnh tham chiếu: thanh tìm kiếm, danh mục ngang, banner có điều kiện, tiêu đề, bộ sắp xếp và card dịch vụ. Ảnh card luôn có khung 16:9. Không thêm phần cam kết cuối trang; giữ route chi tiết và luồng đặt dịch vụ hiện có.

## Quyết định dựa trên code hiện tại
- App sử dụng Flutter, Riverpod và GoRouter, có cấu hình iOS/Android.
- Tái sử dụng ServiceCoverImage, AppLoading, AppMessage, API client và repository tài khoản.
- Mỗi card hiển thị ảnh phủ khung; widget ảnh dùng ở màn hình khác giữ mặc định hiện có.
- Nhãn danh mục, đánh giá, giá và nội dung ưu đãi lấy từ dữ liệu thật.
- API /vouchers/available đã lọc trạng thái hoạt động, thời gian hiệu lực và lượt dùng ở backend. Banner sử dụng nguồn này và kiểm tra startAt/endAt ở client, tự cập nhật khi hết hạn.
- Giới hạn nguồn ưu đãi: API hiện trả cả mã chung và mã cá nhân, không trả trường phân biệt sự kiện chung. Banner vì vậy thể hiện ưu đãi đang khả dụng với khách hàng; chưa thể phân biệt sự kiện hệ thống chung nếu giữ nguyên API.
- Sắp xếp trên tập dịch vụ hiện đã tải (API hiện lấy tối đa 50 dịch vụ), không đổi pagination hay hợp đồng API.

## Các bước
1. Đối chiếu ảnh/HTML với màn hình và kiểm tra nguồn dịch vụ, ưu đãi.
2. Sắp lại các phần, chỉnh màu/bo góc/khoảng cách, thêm sắp xếp và nối nút lọc.
3. Dùng CustomScrollView/SliverList để dựng card theo vùng cuộn; giữ vùng chạm và bố cục thích ứng cỡ chữ.
4. Nối banner với ưu đãi đang hiệu lực, ẩn khi rỗng/lỗi/thiếu ngày/chưa bắt đầu/hết hạn.
5. Kiểm tra bằng Flutter analyze, widget test cho danh sách, banner, tìm kiếm, sắp xếp, bộ lọc, điều hướng, 16:9, màn hình nhỏ và chữ phóng lớn; chạy lại kiểm tra ảnh và chi tiết dịch vụ hiện có.

## Tiêu chí nghiệm thu
- Danh mục ở trước banner/tiêu đề; hàng sắp xếp ở trên danh sách.
- Ảnh có lề trong card và luôn giữ tỉ lệ 16:9 kể cả thiếu ảnh.
- Không hiển thị banner cố định hoặc nội dung giảm giá giả.
- Nút lọc, tìm kiếm, sắp xếp và đặt ngay có hành động.
- Có loading/error/retry/empty state; không tràn bố cục ở bề rộng 320/360/390 và cỡ chữ 100%/200%.
- Không sửa backend, schema, API contract, dependency hoặc điều hướng chung.