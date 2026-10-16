# Kế hoạch chỉnh trang chi tiết dịch vụ

1. Giữ nút quay lại trên AppBar; bỏ nút trùng trên ảnh. Carousel gồm cover trước, gallery sau, loại ảnh trùng và hiển thị số ảnh hiện tại/tổng số.
2. Bỏ phần chọn gói trong nội dung chi tiết; giữ chọn gói trong luồng đặt lịch. Thanh đặt lịch có giá bên trái, nút căn phải và bố cục thích ứng khi phóng chữ.
3. Đọc `processSteps` từ dữ liệu dịch vụ. Không có bước hợp lệ thì ẩn section. Số bước trắng trên màu chủ đạo, căn cùng đầu khối nội dung.
4. Hiển thị tối đa 4 đánh giá từ 4 sao trở lên, xếp sao giảm dần rồi mới nhất, bằng card có tên, avatar, ngày, sao, nội dung và ảnh thật. Trang xem tất cả dùng danh sách phân trang, tìm kiếm, lọc sao, có ảnh và service option.
5. Bổ sung API đọc `GET /services/:id/feedback` để lọc trên toàn bộ dữ liệu; chỉ trả đánh giá công khai, không bị xóa và thông tin tối thiểu. Giữ nguyên API và schema cũ. Lọc option dựa trên gói đã đặt trong đơn, không dựa trên tên dịch vụ.
6. Đóng gói font Inter cho nội dung và Hanken Grotesk cho tiêu đề theo HTML; áp dụng theme sáng/tối toàn app, không cần tải font khi chạy.

## Kiểm chứng

- Kiểm tra dữ liệu cũ không có quy trình, cover/gallery, thứ tự và giới hạn đánh giá.
- Kiểm tra bộ lọc, phân trang, chuyển trang và trạng thái tải/lỗi/rỗng.
- Chạy kiểm tra Flutter với màn hình nhỏ và chữ phóng lớn; phân tích tĩnh và kiểm tra TypeScript backend.
- Không dùng dữ liệu mẫu của HTML làm nội dung nghiệp vụ; không thêm cam kết hoặc thông tin địa chỉ khách hàng không có trong API.

## Kết quả thực hiện

- Đã thực hiện các bước trên cho Flutter/Riverpod/GoRouter trên iOS và Android, không thêm dependency.
- 28 kiểm tra Flutter trong phạm vi chi tiết, đánh giá và hồi quy danh sách/ảnh đạt; 3 kiểm tra API đánh giá đạt; TypeScript `tsc --noEmit` đạt.
- Chạy toàn bộ Flutter: 42 đạt, 3 kiểm tra `startup_test.dart` lỗi ở bước nhập OTP. Bộ kiểm tra tìm `TextFormField` nhưng giao diện hiện dùng `OtpCodeInput` chứa `TextField`; module OTP không nằm trong phạm vi thay đổi này.
- Đã xem ảnh render với font và icon thật. Ảnh render dùng fixture kiểm tra, chưa thay thế kiểm tra trên thiết bị với dữ liệu API thật.
- Phân tích tĩnh còn thông báo cũ trong router và luồng booking. Mobile audit tổng quát còn báo nhiều cảnh báo tĩnh, gồm nhận diện nhầm Dart là React Native.
- Không đổi schema/index dữ liệu. Khi dữ liệu đánh giá/đơn lớn, cần đo truy vấn và cân nhắc index riêng cho `serviceId` cùng bộ lọc option; chưa có cơ sở dữ liệu để đo trong phiên này.
