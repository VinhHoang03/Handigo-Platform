# Đề xuất bổ sung phương thức thanh toán cho luồng báo giá

Trạng thái: phương án nghiệp vụ để xem trước, chưa triển khai vào code.

Đề xuất bổ sung hai lựa chọn thanh toán phần báo giá còn lại: **ví Handigo** hoặc **thanh toán trực tiếp cho thợ**. Giai đoạn đầu chỉ mở thanh toán phần còn lại **sau khi đơn đã hoàn thành**, phù hợp với bước xác nhận thanh toán báo giá hiện tại.

## 1. Số tiền khách cần thanh toán

**Tiền còn lại = max(Tổng báo giá − cọc thực trả đã được khấu trừ, 0).**

Ví dụ:

- Tổng báo giá: **500.000đ**.
- Cọc thực trả: **40.000đ**.
- Khách cần thanh toán thêm: **460.000đ**.

Khoản thanh toán thêm phải được ghi riêng với giao dịch cọc, tránh trừ cọc hoặc ghi nhận doanh thu hai lần.

## 2. Các trường hợp thanh toán

| Trường hợp | Cách xử lý đề xuất |
| --- | --- |
| Đơn chưa hoàn thành | Cho xem báo giá và tiền còn lại; chưa mở thanh toán phần còn lại trong giai đoạn đầu. |
| Đơn hoàn thành, chưa trả tiền báo giá | Khách chọn ví Handigo hoặc thanh toán trực tiếp. |
| Khách chọn ví, đủ số dư | Hiển thị xác nhận gồm mã đơn, phiên bản báo giá, cọc đã khấu trừ và số tiền trừ ví. |
| Khách xác nhận trả ví | Trừ ví khách, cộng khoản tương ứng vào ví thợ, ghi giao dịch và đánh dấu báo giá đã thanh toán trong cùng transaction. |
| Ví không đủ | Không trừ tiền, không ghi nhận đã thanh toán; cho nạp ví hoặc chọn trả trực tiếp. |
| Khách trả trực tiếp | Thợ xác nhận đã nhận tiền và chọn tiền mặt hoặc chuyển khoản trực tiếp; hệ thống không cộng khoản đó vào ví thợ. |
| Tiền còn lại bằng 0 | Hiển thị “Không cần thanh toán thêm”, không tạo giao dịch thu tiền. |
| Đã trả bằng ví | Không cho thanh toán lại hoặc xác nhận nhận tiền trực tiếp lần nữa. |
| Thợ đã xác nhận nhận tiền trực tiếp | Không cho khách trả thêm bằng ví; nếu xác nhận nhầm thì đi qua xử lý hỗ trợ. |
| Thanh toán thành công nhưng mất phản hồi | Tra lại giao dịch theo mã yêu cầu; trả kết quả cũ, không trừ hoặc cộng tiền lần hai. |

### Thời điểm tiền vào ví thợ

Vì nhánh này chỉ mở sau khi đơn hoàn thành, tiền được cộng vào ví thợ ngay khi giao dịch trả ví thành công.

Để giữ nghiệp vụ hiện tại, đề xuất **không thu thêm phí nền tảng trên phần sửa chữa này**; cọc vẫn được xử lý theo chính sách hiện có. Nếu muốn thu thêm phí trên báo giá thì cần thống nhất thành một thay đổi riêng.

## 3. Khi khách đổi phương thức

| Tình huống | Cách xử lý đề xuất |
| --- | --- |
| Đã chọn ví nhưng chưa xác nhận | Cho đổi sang trả trực tiếp, chưa phát sinh tiền. |
| Ví không đủ hoặc giao dịch thất bại chắc chắn | Cho chọn lại phương thức. |
| Khách từng chọn trả trực tiếp nhưng thợ chưa xác nhận nhận tiền | Cho đổi sang ví sau khi khách xác nhận. |
| Khách nói đã đưa tiền cho thợ nhưng hệ thống chưa ghi nhận | Yêu cầu đối chiếu trước, không thu thêm qua ví ngay. |
| Một phương thức đã thanh toán thành công | Khóa các phương thức còn lại. |

Trường hợp khách trả ví cùng lúc thợ bấm xác nhận nhận tiền trực tiếp, backend phải kiểm tra và khóa cùng trạng thái thanh toán: chỉ một thao tác được ghi nhận, thao tác còn lại nhận thông báo đã thanh toán. Giao diện không đủ để ngăn tình huống này.

## 4. Khi báo giá thay đổi

- Trước khi thanh toán: tính lại tiền còn lại và yêu cầu khách xác nhận bản mới.
- Khách đang xem bản xác nhận cũ: không trừ ví; yêu cầu xem lại.
- Đã thanh toán: khóa sửa số tiền của báo giá đó. Phát sinh thêm hoặc giảm tiền phải có luồng điều chỉnh riêng, không sửa đè giao dịch đã trả.

## 5. Khi hủy hoặc cần hoàn tiền

- **Hủy trước khi hoàn thành:** giữ chính sách hủy/cọc hiện tại; chưa thu phần báo giá còn lại.
- **Đã hoàn thành và trả báo giá:** không dùng nút hủy đơn thông thường. Nếu có khiếu nại, khoản hoàn đi qua quyết định xử lý riêng.
- **Hoàn phần đã trả bằng ví:** liên kết đúng giao dịch báo giá, hoàn số tiền được duyệt cho khách và xử lý khoản tương ứng phía thợ; chống hoàn trùng.
- **Khoản trả trực tiếp:** không tự cộng tiền từ hệ thống cho khách chỉ dựa vào lời khai, vì hệ thống không trực tiếp thu khoản đó.

## 6. Form “Thanh toán đơn hàng” sau khi bổ sung

Ví dụ khách trả bằng ví:

| Nội dung | Hiển thị |
| --- | --- |
| Giá trị báo giá | 500.000đ |
| Cọc đã khấu trừ | 40.000đ |
| Thanh toán thêm | 460.000đ |
| Trạng thái thanh toán | Đã thanh toán |
| Phương thức thanh toán | Ví Handigo |

Nếu trả trực tiếp thì phương thức hiển thị **“Tiền mặt”** hoặc **“Chuyển khoản trực tiếp cho thợ”**, theo thông tin đã ghi nhận.

Giai đoạn đầu đề xuất thanh toán phần còn lại bằng **một phương thức duy nhất**, chưa chia một phần ví và một phần tiền mặt để tránh phức tạp trong đối soát và hoàn tiền.
