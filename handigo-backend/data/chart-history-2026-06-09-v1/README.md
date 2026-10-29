# Dữ liệu thử nghiệm biểu đồ tháng 6–9/2026

Lô `chart-history-2026-06-09-v1` được tạo trực tiếp trong database development `FixNow` theo yêu cầu. Các đơn có mã `DEMO-HIST-2026MM-NNN` và mô tả ghi rõ dữ liệu mô phỏng.

| Tháng | Hoàn thành | Hủy trước thanh toán | Doanh thu thêm | Phí nền tảng thêm |
| --- | ---: | ---: | ---: | ---: |
| 6/2026 | 8 | 1 | 2.400.000 ₫ | 360.000 ₫ |
| 7/2026 | 13 | 2 | 5.080.000 ₫ | 762.000 ₫ |
| 8/2026 | 10 | 1 | 3.750.000 ₫ | 562.500 ₫ |
| 9/2026 | 17 | 3 | 6.010.000 ₫ | 901.500 ₫ |

Các giá trị trên là phần thêm của lô, không phải toàn bộ dữ liệu cũ của hệ thống.

Lô dùng khách `Payment Test Customer` có sẵn và tạo riêng hồ sơ `Thợ Dữ Liệu Biểu Đồ`, cùng lịch sử phê duyệt và ví mới. Tài khoản thợ không có mật khẩu đăng nhập và không có giấy tờ định danh giả. Hồ sơ thợ để ngoại tuyến.

Giá được tính bằng `buildServicePricingSnapshot` từ dịch vụ/tùy chọn có thật và chỉ dùng tùy chọn đã tồn tại trước ngày đơn. Không tạo khuyến mãi, voucher hay giao dịch cổng thanh toán giả. Đơn hoàn thành thanh toán bằng tiền mặt mô phỏng; việc phân bổ dùng `recordCompletedOrderSettlement` và điểm thưởng dùng `earnOrderRewards` hiện có. Ảnh nghiệm thu SVG ghi rõ là ảnh minh họa dữ liệu thử nghiệm.

Ví mới được ghi một giao dịch điều chỉnh thử nghiệm 2.786.000 ₫. Cặp `provider_earning`/`platform_fee` của mỗi đơn tiền mặt tuân theo quy tắc ví hiện có: doanh thu tiền mặt không cộng vào số dư, phí nền tảng trừ khỏi ví. Sau 48 đơn hoàn thành, phí tổng 2.586.000 ₫ và số dư còn 200.000 ₫. Không sửa sổ ví thợ cũ.

Script mặc định chỉ xem trước, kiểm tra đúng tên database và từ chối môi trường production. Chạy từ thư mục `handigo-backend`:

```powershell
node -r ts-node/register/transpile-only src/scripts/seedAdminMonthlyHistory.ts --database=FixNow
```

Để ghi vào đúng môi trường đã được cho phép, thêm `--apply`. Các mã đơn và ID được cố định theo lô; chạy lại bỏ qua đơn đã tồn tại. Mỗi đơn được ghi trong một transaction cùng thanh toán, trạng thái, phân bổ tiền và điểm thưởng. Không gọi cổng thanh toán hay gửi thông báo bên ngoài.

`before-*.json` lưu số liệu trước lần chạy; `result.json` lưu các ID mới và kết quả đối soát lịch sử trạng thái, sổ ví, thanh toán, điểm thưởng, bộ đếm đơn hoàn thành và chênh lệch dữ liệu biểu đồ.
