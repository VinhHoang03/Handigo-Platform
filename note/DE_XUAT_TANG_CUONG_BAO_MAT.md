# Đề xuất tăng cường bảo mật Handigo

Ngày ghi nhận: 31/10/2026.

## 1. Mục đích và phạm vi

Tài liệu tổng hợp các hướng tăng cường bảo mật dữ liệu và website Handigo, dựa trên việc kiểm tra sơ bộ một phần mã nguồn backend và frontend. Đây là đề xuất để lập kế hoạch triển khai, chưa phải kết luận kiểm toán bảo mật toàn hệ thống.

Chưa kiểm chứng cấu hình production, quyền truy cập thực tế trên Cloudinary, cấu hình MongoDB, reverse proxy hoặc các lớp bảo vệ bên ngoài ứng dụng. Không đọc thông tin bí mật và không thay đổi code trong quá trình lập tài liệu.

Đã thử truy vấn Graphify `authentication authorization security payment upload`, nhưng lệnh không khả dụng trong môi trường kiểm tra. Các nhận xét dưới đây được xác minh bằng việc đọc trực tiếp các file liên quan; không dựa trên giả định graph đã được cập nhật.

## 2. Các lớp bảo vệ đã ghi nhận

- Mật khẩu được kiểm tra bằng bcrypt.
- Refresh token được lưu dạng hash trong dữ liệu phiên đăng nhập.
- Cookie refresh token có `HttpOnly`; cấu hình production sử dụng `Secure` và `SameSite=None`.
- Access token chủ yếu được giữ trong bộ nhớ frontend; vẫn có luồng lưu tạm vào sessionStorage khi chuyển hướng ra ngoài.
- Middleware xác thực kiểm tra tài khoản, trạng thái khóa và phiên bản token, đồng thời lấy quyền hiệu lực từ dữ liệu người dùng.
- Backend đã có security headers, cấu hình CORS và giới hạn tần suất cho một số nhóm API.
- Luồng upload giấy tờ đăng ký provider có giới hạn kích thước và kiểm tra chữ ký định dạng file.
- Luồng webhook PayOS có gọi hàm xác minh của SDK.

Các cơ chế đã có vẫn cần được kiểm thử trong từng luồng nghiệp vụ; sự hiện diện trong code không chứng minh mọi endpoint đều được bảo vệ đầy đủ.

## 3. Thứ tự ưu tiên

| Ưu tiên | Hạng mục | Mục tiêu |
| --- | --- | --- |
| Cao | Bảo vệ giấy tờ provider | Hạn chế lộ CCCD, hộ chiếu và chứng chỉ qua đường dẫn file |
| Cao | Chống dò mật khẩu và bảo vệ ADMIN | Giảm nguy cơ chiếm tài khoản |
| Cao | Quyền truy cập từng tài nguyên | Ngăn đọc hoặc sửa dữ liệu của người khác qua API và Socket.IO |
| Cao | Bảo vệ MongoDB và bản sao lưu | Giảm nguy cơ lộ, mất hoặc sửa dữ liệu trái phép |
| Trung bình | Security headers frontend và chống CSRF | Tăng bảo vệ trình duyệt và các luồng dùng cookie |
| Trung bình | Mã hóa trường dữ liệu nhạy cảm | Giảm tác động khi dữ liệu lưu trữ bị lộ |
| Trung bình | Nhật ký và cảnh báo bảo mật | Phát hiện, điều tra và xử lý hoạt động bất thường |

## 4. Bảo vệ giấy tờ và file nhạy cảm

### Ghi nhận từ code

File [providerApplicationAssetUpload.middleware.ts](../handigo-backend/src/middlewares/providerApplicationAssetUpload.middleware.ts) upload bằng `resource_type: "auto"` rồi lấy `result.secure_url`. Lời gọi upload này chưa thể hiện cấu hình hạn chế quyền truy cập file.

`secure_url` biểu thị đường dẫn HTTPS, không tự bảo đảm file là riêng tư. Cloudinary mặc định phân phối công khai đối với delivery type `upload`. Cần kiểm chứng cấu hình tài khoản và tài nguyên thực tế trước khi kết luận giấy tờ hiện đang truy cập công khai.

### Hướng tăng cường

- Tách chính sách phân phối giấy tờ nhạy cảm khỏi ảnh dịch vụ hoặc ảnh công khai.
- Sử dụng cơ chế phân phối có xác thực phù hợp của Cloudinary.
- Backend kiểm tra người sở hữu hoặc quyền ADMIN trước khi cấp quyền xem hoặc tải.
- Nếu dùng đường dẫn tạm, chọn cơ chế có hỗ trợ thời hạn và xác minh thời hạn thực tế; không mặc định mọi URL có chữ ký đều tự hết hạn.
- Rà soát và xử lý cả file đã tải lên trước đó, bao gồm đường dẫn công khai cũ và bộ nhớ đệm liên quan nếu có.
- Quy định thời gian lưu giữ, xóa giấy tờ và quyền truy cập đối với hồ sơ bị từ chối hoặc tài khoản đã xóa.
- Duy trì kiểm tra kích thước, định dạng thực tế; cân nhắc quét mã độc cho PDF, DOC và DOCX theo nhu cầu vận hành.

### Tiêu chí kiểm tra

- Người chưa đăng nhập và người dùng khác không thể tải giấy tờ bằng đường dẫn trực tiếp.
- Chủ hồ sơ và ADMIN được phép vẫn xem được tài liệu trong đúng phạm vi.
- Nếu chọn quyền truy cập có thời hạn, quyền đó hết hiệu lực đúng thiết kế.
- Giấy tờ cũ được xử lý cùng chính sách, không chỉ áp dụng cho file mới.

## 5. Chống dò mật khẩu và bảo vệ tài khoản

### Ghi nhận từ code

[auth.routes.ts](../handigo-backend/src/routes/auth.routes.ts) đã áp dụng giới hạn cho OTP và gửi email, nhưng chưa thấy limiter dành cho `/auth/login` trong lớp ứng dụng đã kiểm tra.

[rateLimit.middleware.ts](../handigo-backend/src/middlewares/rateLimit.middleware.ts) lưu bộ đếm bằng `Map` trong bộ nhớ tiến trình. Bộ đếm này không dùng chung giữa nhiều instance và mất khi tiến trình khởi động lại.

### Hướng tăng cường

- Giới hạn đăng nhập theo cả IP và định danh tài khoản, tránh chỉ dựa vào một yếu tố.
- Tăng thời gian chờ khi đăng nhập sai liên tiếp; tránh thiết kế cho phép người lạ khóa tài khoản nạn nhân kéo dài.
- Khi triển khai nhiều instance, dùng kho bộ đếm chung như Redis nếu phù hợp với hạ tầng.
- Kiểm tra cấu hình `trust proxy` để IP dùng cho limiter phản ánh đúng chuỗi proxy thực tế.
- Bổ sung xác thực đa yếu tố cho ADMIN; cân nhắc xác thực bổ sung khi đổi tài khoản ngân hàng hoặc thực hiện thao tác tài chính nhạy cảm.
- Kiểm thử việc thu hồi phiên sau đổi mật khẩu, khóa tài khoản và đăng xuất theo chính sách hệ thống.

### Tiêu chí kiểm tra

- Các lần thử vượt ngưỡng bị chặn hoặc trì hoãn đúng chính sách.
- Nếu chạy nhiều instance, chuyển instance không làm vượt qua giới hạn chung.
- Chính sách không gây khóa hàng loạt người dùng hợp lệ dùng chung IP.
- ADMIN phải hoàn thành bước xác thực bổ sung nếu MFA được triển khai.

## 6. Kiểm soát quyền truy cập dữ liệu

Đây là hạng mục cần rà soát sâu hơn; chưa khẳng định đã phát hiện lỗi truy cập chéo trong các module dưới đây.

### Hướng tăng cường

- Kiểm tra quyền sở hữu ngay tại backend đối với đơn hàng, địa chỉ, hồ sơ, ví, tài khoản ngân hàng, chat và file đính kèm.
- CUSTOMER chỉ truy cập dữ liệu của mình; PROVIDER chỉ xem dữ liệu được phép trong phạm vi hồ sơ và công việc được giao.
- Kiểm tra quyền ADMIN tại backend cho thao tác quản trị.
- Không tin `userId`, `providerId` hoặc `role` do client gửi; đối chiếu với danh tính đã xác thực.
- Áp dụng kiểm tra tương ứng cho việc tham gia phòng và xử lý sự kiện Socket.IO.
- Chỉ trả các trường cần thiết; che bớt thông tin cá nhân và ngân hàng theo vai trò, trạng thái nghiệp vụ.

### Tiêu chí kiểm tra

- Dùng ít nhất hai tài khoản cùng vai trò để thử thay ID tài nguyên trên các thao tác đọc và ghi.
- Thử CUSTOMER truy cập API quản trị và PROVIDER truy cập đơn không được giao.
- Thử tham gia phòng chat hoặc nhận sự kiện của người dùng khác.
- Các yêu cầu trái quyền bị từ chối và không làm lộ nội dung nhạy cảm.

## 7. Bảo vệ MongoDB và bản sao lưu

Chưa kiểm chứng cấu hình hạ tầng thực tế. Cần rà soát các điểm sau khi triển khai:

- Chỉ cho phép kết nối MongoDB từ mạng hoặc máy chủ cần thiết; tránh mở truy cập Internet rộng rãi.
- Sử dụng tài khoản database tối thiểu quyền; tách tài khoản ứng dụng khỏi tài khoản quản trị.
- Bảo vệ kết nối bằng TLS và kiểm tra mã hóa dữ liệu lưu trữ của dịch vụ database.
- Sao lưu tự động, mã hóa bản sao lưu, giới hạn quyền tải và quy định thời gian giữ bản sao.
- Kiểm thử khôi phục định kỳ và xác định mức mất dữ liệu, thời gian khôi phục chấp nhận được.
- Không sao chép dữ liệu cá nhân thật sang môi trường phát triển nếu chưa được ẩn danh phù hợp.

Tiêu chí kiểm tra: nguồn kết nối ngoài danh sách cho phép không truy cập được database; tài khoản ứng dụng không có quyền quản trị ngoài nhu cầu; bản sao lưu khôi phục được và không bị truy cập trái phép.

## 8. Mã hóa dữ liệu nhạy cảm

### Hướng tăng cường

- Lập danh mục dữ liệu cần bảo vệ: số định danh, số tài khoản ngân hàng và các thông tin nhạy cảm khác thực tế đang lưu.
- Cân nhắc mã hóa cấp trường đối với dữ liệu cần đọc lại, sử dụng giải pháp chuẩn và cơ chế quản lý khóa phù hợp.
- Quản lý khóa riêng với database, giới hạn quyền sử dụng khóa và có kế hoạch xoay vòng, sao lưu, phục hồi khóa.
- Giữ cơ chế hash phù hợp cho mật khẩu; không chuyển mật khẩu sang mã hóa có thể giải mã.
- Che bớt dữ liệu khi hiển thị và tránh đưa dữ liệu nhạy cảm vào log, thông báo lỗi hoặc phản hồi API không cần thiết.

### Điều kiện trước khi triển khai

- Đánh giá ảnh hưởng đến tìm kiếm, đối chiếu trùng lặp, index và hiệu năng.
- Có phương án chuyển đổi dữ liệu cũ, phục hồi khi thất bại và tương thích với các module đang sử dụng dữ liệu.
- Không tự thay schema hoặc API contract chỉ để bổ sung mã hóa khi chưa đánh giá đầy đủ phạm vi ảnh hưởng.

## 9. Bảo vệ frontend và các luồng dùng cookie

### Ghi nhận từ code

Backend đã có CSP và các security headers tại [securityHeaders.middleware.ts](../handigo-backend/src/middlewares/securityHeaders.middleware.ts).

[vercel.json](../handigo-web/vercel.json) và [nginx.conf](../handigo-web/nginx.conf) chưa thể hiện khai báo security headers cho frontend. Cần kiểm chứng phản hồi production vì hosting hoặc proxy có thể bổ sung header bên ngoài repository.

CSP trên phản hồi API không thay thế CSP của tài liệu HTML React. Cookie refresh token sử dụng `SameSite=None` trong production nên cần đánh giá riêng biện pháp chống CSRF cho các endpoint dùng cookie; cấu hình này tự nó chưa đủ để kết luận có lỗ hổng.

### Hướng tăng cường

- Thiết lập CSP tại nơi phục vụ HTML frontend; có thể bắt đầu bằng chế độ báo cáo trước khi chặn.
- Giới hạn nguồn script, kết nối, ảnh và nhúng theo nhu cầu thực tế.
- Bổ sung các header phù hợp như `X-Content-Type-Options`, `Referrer-Policy`, bảo vệ chống nhúng và HSTS tại điểm kết thúc HTTPS.
- Đánh giá kiểm tra Origin/Referer, token chống CSRF hoặc cơ chế tương đương cho các thao tác dùng cookie, phù hợp với mô hình triển khai thực tế.
- Không xem CORS hoặc RouteGuard frontend là cơ chế thay thế xác thực và phân quyền backend.

### Tiêu chí kiểm tra

- Kiểm tra header trên phản hồi HTML thực tế của tên miền frontend.
- Google/Facebook login, Cloudinary, Socket.IO và thanh toán vẫn hoạt động với CSP được chọn.
- Các yêu cầu thay đổi trạng thái từ nguồn không được phép không thực hiện được qua luồng dùng cookie.

## 10. Nhật ký, cảnh báo và kiểm tra định kỳ

- Ghi nhật ký thao tác quản trị, truy cập giấy tờ, thay đổi tài khoản ngân hàng và rút tiền với người thực hiện, thời điểm, đối tượng và kết quả.
- Không ghi mật khẩu, token, nội dung giấy tờ hoặc số tài khoản đầy đủ vào nhật ký.
- Giới hạn quyền sửa và xóa nhật ký; quy định thời gian lưu giữ phù hợp.
- Cảnh báo đăng nhập thất bại bất thường, truy cập giấy tờ hàng loạt và hoạt động tài chính bất thường.
- Kiểm tra dependency định kỳ, đánh giá khả năng khai thác trong ứng dụng trước khi lập kế hoạch cập nhật; không nâng cấp hàng loạt thiếu kiểm chứng.
- Với thanh toán, kiểm thử webhook sai chữ ký, webhook lặp và yêu cầu đồng thời để xác minh không cộng tiền hoặc xử lý giao dịch nhiều lần.

## 11. Lộ trình đề xuất

1. Xác minh quyền truy cập thực tế của giấy tờ hiện có và xây dựng phương án bảo vệ cả file cũ lẫn file mới.
2. Bổ sung chống dò đăng nhập, kiểm tra IP qua proxy và lập kế hoạch MFA cho ADMIN.
3. Kiểm thử quyền truy cập chéo trên API và Socket.IO, ưu tiên giấy tờ, ví, ngân hàng và đơn hàng.
4. Kiểm chứng cấu hình MongoDB, sao lưu và khả năng phục hồi.
5. Bổ sung hoặc hiệu chỉnh bảo vệ frontend và các luồng dùng cookie theo hạ tầng thực tế.
6. Lập phương án mã hóa cấp trường, nhật ký và cảnh báo theo dữ liệu đang lưu.

Mỗi hạng mục cần được triển khai riêng theo phạm vi đã thống nhất, tái sử dụng cơ chế hiện có, giữ tương thích và kiểm thử hồi quy trước khi đưa lên production.

## 12. Tài liệu tham khảo

- [Cloudinary — Kiểm soát quyền truy cập tài nguyên](https://cloudinary.com/documentation/control_access_to_media).
- [Express — Thực hành bảo mật khi triển khai production](https://expressjs.com/advanced/best-practice-security/).
- [OWASP — Kiểm soát quyền truy cập](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
- [OWASP — Bảo vệ chức năng upload file](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).
- [OWASP — Mã hóa dữ liệu lưu trữ](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html).
