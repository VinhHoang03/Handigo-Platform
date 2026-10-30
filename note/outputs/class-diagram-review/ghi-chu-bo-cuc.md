# Chỉnh màu và bố cục sơ đồ

Đã chỉnh từ file người dùng đang sử dụng: `C:\Users\gamer\Downloads\all_8_class_diagrams.drawio`.

- Đổi đủ 111 đường phân cách giữa tên class và phần thân sang màu đen `#000000`.
- Bố trí lại cả 9 sheet; gom Route, Controller, Service và các thực thể thành các cột, đưa middleware xuống khu vực riêng.
- Mở rộng khoảng trống giữa các ô và cố định các điểm gấp khúc của đường nối theo góc vuông.
- Chia các cổng nối theo từng cạnh, giảm việc nhiều đường đi chung một cổng.
- Giữ nguyên toàn bộ 260 đường quan hệ, tên lớp, thuộc tính, phương thức, nhãn quan hệ và bội số.
- Sửa đầu dây User–Session đang tự do ở sheet Authentication: đầu dây cũ nằm đúng cạnh Session nhưng chưa gắn vào ô; nay được gắn vào Session để đi theo lớp khi thay đổi bố cục.
- Sắp xếp lại Package diagram thành hai vùng web/backend, đặt các file khởi chạy trong vùng src và đưa public/các file cấu hình công cụ ra ngoài vùng src.
- Cấu hình điểm nhảy ở nơi dây giao nhau. Một số giao cắt vẫn cần tồn tại vì giữ đầy đủ các phụ thuộc; không xóa quan hệ để làm sơ đồ trông đơn giản hơn.

## Kiểm tra

XML đọc lại thành công, đủ 9 sheet, không trùng ID và nội dung/đầu mút được đối chiếu trước–sau. Ngoại lệ duy nhất về đầu mút là việc gắn đầu dây tự do User–Session nêu trên.

Đã kiểm tra tọa độ của mọi đoạn dây với các ô lớp/package/file đích: không có dây đi xuyên ô không liên quan. Các hộp nhãn quan hệ và bội số được bố trí không chồng lên ô nội dung hoặc nhãn khác theo kích thước ước lượng.

Đã kiểm tra ảnh xem trước hình học, gồm các sheet nhiều quan hệ. Ảnh `layout-preview-*.png` là bản dựng để kiểm tra vị trí; chúng không phải ảnh xuất trực tiếp từ draw.io. Việc xuống dòng/font trong draw.io có thể khác nhẹ. Báo cáo số liệu nằm trong `layout-validation.json`.

## Tệp

- `all_8_class_diagrams_arranged.drawio`: bản đã chỉnh màu và bố cục.
- `all_8_class_diagrams_before_layout.drawio`: sao lưu nguyên trạng trước lượt sửa này.

Nếu draw.io vẫn đang mở phiên bản cũ trong tab, cần tải lại file đã lưu để thấy thay đổi.
