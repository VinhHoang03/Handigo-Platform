# Bổ sung mô tả và quy trình dịch vụ

Đã bổ sung mô tả cho 11 danh mục và 33 dịch vụ từ hai bản xuất người dùng cung cấp. Mỗi dịch vụ có 6 bước, viết theo công việc thực tế. Hai file `FixNow.categories.enriched.json` và `FixNow.services.enriched.json` giữ nguyên mọi field ngoài `description` và `processSteps`, bao gồm ID, giá, trạng thái và liên kết hình ảnh. Hai file gốc trong Downloads không bị sửa.

Xem toàn bộ nội dung tại `noi-dung.md`. Cập nhật đủ 33 dịch vụ, gồm cả 19 dịch vụ đã xóa mềm và các dịch vụ đang tạm ngừng hoạt động; giữ nguyên trạng thái hoạt động/xóa hiện có.

## Dán trực tiếp trong MongoDB Shell của giao diện

Shell người dùng đang mở báo `[COMMON-90002] load is not currently implemented for this platform`. Lệnh `load(...)` bị từ chối trước khi chạy script, nên lần đó chưa cập nhật dữ liệu.

Mở file `paste-into-mongosh.js`, nhấn **Ctrl+A**, **Ctrl+C**, chuyển sang shell đang kết nối với cụm chứa `FixNow`, nhấn **Ctrl+V** và **Enter**. Phải dán toàn bộ nội dung JavaScript của file, không dán đường dẫn hoặc lệnh `load`.

Sau lỗi `SyntaxError: Unexpected token ','` có mã biến đổi `await` và ký tự `\uFEFF` trong ảnh, bản dán đã được đổi sang hàm thường, không có cú pháp `async/await` và lưu UTF-8 không BOM. mongosh tự chờ các lệnh database. Hủy dòng nhập cũ bằng Ctrl+C hoặc đóng/mở lại shell, rồi sao chép lại bản file mới; không dùng nội dung cũ trong clipboard. Cú pháp và bốn kiểm thử mô phỏng đã đạt, chưa kiểm tra trực tiếp trên shell Compass của người dùng.

File đã nhúng đủ 11 danh mục và 33 dịch vụ, không dùng `load`, `require` hoặc truy cập file trên máy. Bản sao lưu được lưu trước khi ghi trong collection `FixNow.handigo_content_backups`, mỗi lần chạy lưu một document có ID được hiển thị. Chỉ tạo bản sao lưu khi có nội dung cần thay đổi. Không thay schema/index của category hoặc service. Cập nhật và kiểm tra hai collection trong một giao dịch; nếu giao dịch thất bại thì dữ liệu cũ còn nguyên và bản sao lưu vẫn tồn tại.

Khi thành công: `Đã cập nhật và kiểm tra 44 bản ghi thành công.` Bản ghi đã có nội dung mới được bỏ qua; chạy lại không tạo sao lưu nếu không có thay đổi.

## Chạy bằng load trên shell hỗ trợ đọc file

Chỉ áp dụng khi shell hỗ trợ `load` và đọc file cục bộ. Shell trong ảnh lỗi của người dùng không hỗ trợ cách này; hãy dùng file dán trực tiếp ở trên. Lệnh dành cho shell hỗ trợ đọc file:

```javascript
load("C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/data/service-content-2026-10-06/update-content.mongosh.js")
```

Lệnh dùng kết nối Compass đã đăng nhập, tự chọn database `FixNow`, kiểm tra toàn bộ bản ghi, sao lưu vào file rồi cập nhật trong giao dịch. Không cần nhập lại mật khẩu hoặc chạy Node/PowerShell. Nếu nội dung đã có sẵn thì bỏ qua để chạy lại an toàn. Kết quả lần đầu dự kiến là `Đã cập nhật và kiểm tra 44 bản ghi thành công.`

Script shell kiểm tra trực tiếp các field được phép sửa, giới hạn mô tả/quy trình, ID, tên và trạng thái. Không tải model Mongoose vào shell; dữ liệu đầu vào đã được kiểm tra bằng schema hiện có trong lúc chuẩn bị.

MongoDB hướng dẫn dùng [load để chạy file script](https://www.mongodb.com/docs/mongodb-shell/write-scripts/) và có [shell tích hợp trong Compass](https://www.mongodb.com/docs/compass/embedded-shell/).

## Chạy trên máy

Mở PowerShell và chạy:

```powershell
Set-Location 'C:\FPT Material\2026\SU26-K8\WDP301\handigo\wdp301-rbl-project-group6\handigo-backend'
& '.\data\service-content-2026-10-06\run-update.ps1' -Apply
```

Khi được hỏi, dán chuỗi MongoDB Atlas đã xác thực, thay `username:password` bằng thông tin đăng nhập thực tế. Chuỗi được nhập ẩn, không lưu vào file; script xóa biến môi trường tạm sau khi kết thúc. Không đưa thông tin đăng nhập vào chat. Nếu mật khẩu chứa ký tự đặc biệt trong URI, cần mã hóa thành phần mật khẩu theo định dạng URI.

Muốn chỉ kiểm tra và xem số bản ghi dự kiến, bỏ `-Apply`. Script cũng hỗ trợ chạy trực tiếp bằng `node .\data\service-content-2026-10-06\update-content.cjs --apply` khi đã cấu hình `HANDIGO_MONGO_URI` trong môi trường hiện tại; cách chạy này không tự xóa biến môi trường đã có.

## Điều kiện và kết quả

- Database được chọn cố định là `FixNow`; không tạo bản ghi mới và không thay schema/index.
- Dự kiến cập nhật 11 danh mục và đủ 33 dịch vụ; không bỏ qua bản ghi đã xóa mềm.
- Kiểm tra ID, tên, mô tả/quy trình cũ và validation Mongoose trước khi ghi. Nếu nội dung đã thay đổi so với bản xuất, dừng để tránh ghi đè. Bản ghi đã có nội dung mới được bỏ qua để chạy lại an toàn.
- File dán trực tiếp lưu bản sao vào `FixNow.handigo_content_backups`; hai script Node/load lưu vào `backup-<thời điểm>.json` hoặc `backup-mongosh-<thời điểm>.json` trong thư mục này trước khi ghi.
- Cập nhật hai collection trong một giao dịch Atlas, chỉ ghi mô tả/quy trình và thời điểm cập nhật tự động theo model. Có kiểm tra nội dung sau mỗi lần ghi trong giao dịch.
- Khi thành công, hiển thị số bản ghi đã cập nhật và tên file sao lưu. Khi thất bại trước hoặc trong giao dịch, không có cập nhật một phần được commit. File sao lưu có thể vẫn tồn tại nếu giao dịch thất bại.
- Cần kết nối Atlas được phép từ IP của máy và tài khoản có quyền đọc/ghi database `FixNow`.

Đã kiểm tra 44 bản ghi bằng schema hiện có, giới hạn số bước/độ dài và đối chiếu field ngoài phạm vi. Đã kiểm tra cú pháp Node/PowerShell và script shell. Bốn kiểm thử mô phỏng bản dán trực tiếp đều đạt: cập nhật đủ 44 bản ghi và giữ trạng thái/giá, chạy lại an toàn, chặn nội dung khác bản xuất và hủy toàn bộ cập nhật khi giao dịch lỗi. Bản dán trực tiếp không gọi `load`, `require` hay filesystem. Kiểm thử dùng database giả lập, chưa xác nhận trên Atlas thật. Chưa chạy cập nhật Atlas vì phiên hiện tại chưa có kết nối đã xác thực; kết quả ghi thực tế cần xác nhận qua lần chạy script.
