# Đặt nhiều dịch vụ và chỉnh thông tin xác nhận

- Tên và số điện thoại riêng qua `recipientName`/`recipientPhone` chỉ ghi vào `addressSnapshot` của đơn. Không sửa hồ sơ hoặc sổ địa chỉ. `null` bỏ lựa chọn riêng, đơn mới không kế thừa. Đơn đã tạo không chỉnh qua bản nháp.
- `manage_booking_plan` giữ tối đa 10 yêu cầu trong phiên; mỗi việc khác dịch vụ, địa chỉ hoặc lịch được soạn riêng. Số lượng nhiều thiết bị cùng dịch vụ/địa chỉ/lịch có thể dùng một đơn; chưa rõ phải hỏi khách.
- `create` chỉ lập danh sách, không tạo đơn. `update_booking_draft` chỉ sửa việc đang soạn. Mỗi đơn cần nút xác nhận và đồng ý chính sách riêng. Sau khi tạo đơn, khách chọn yêu cầu kế tiếp; không dùng một xác nhận cho nhiều đơn.
- Khi đang soạn một đơn rồi khách muốn thêm việc, `includeCurrentDraft: true` đưa bản nháp hiện có thành mục đầu, giữ cả địa chỉ tạm và thông tin đã chọn. Mục đầu không gửi `seed` thay thế; không âm thầm bỏ bản nháp cũ.
- Dùng `view` lấy ID và phiên bản mới nhất. `append` thêm việc; `edit` chỉ sửa mục chưa bắt đầu/để lại; `pause` giữ cả danh sách; `defer` giữ bản nháp của mục hiện tại và sang việc khác; `resume` phục hồi mục đã giữ; `skip` bỏ mục chưa tạo; `cancel` bỏ các mục chưa tạo, không hủy đơn hoặc giao dịch đã thành công.
- Không tự sao chép ảnh, người nhận, địa chỉ, lịch, mã giảm giá hay thợ giữa các mục. Dữ liệu dùng chung cần khách nêu rõ. Ảnh phải thuộc phiên và xác định đúng công việc; không tự chia ảnh của tin nhắn cho mọi đơn.
- Thiếu dịch vụ, địa chỉ ngoài vùng, hết lịch, thợ không phù hợp, voucher hết hiệu lực hoặc thiếu tiền: giữ việc hiện tại, giải thích và cho sửa/thử lại/để lại/bỏ. Không tự bỏ qua lỗi. Khi kết quả ghi chưa rõ, khóa đổi tiến độ để đối soát, không gọi tạo lại.
- Danh sách giữ mã và trạng thái các đơn đã tạo; trạng thái này chỉ phản ánh kết quả tạo đơn. Thanh toán, phân công thợ và tiến độ thực tế phải tra lại trên từng đơn.
- Các nút web/mobile gửi thao tác có cấu trúc cùng phiên bản bản nháp/danh sách. Form cũ bị vô hiệu; sửa thông tin cần xem và đồng ý chính sách trên form mới. Mobile dùng API địa chỉ/dịch vụ hiện có, xử lý tải, lỗi, rỗng và thử lại; không tạo đơn từ trình chỉnh sửa.

## Kiểm chứng và triển khai

Kiểm thử bao gồm hai đơn qua legacy/graph, xác nhận riêng, phát lại, từ chối, form cũ, mất kết quả và đối soát; phân quyền, ảnh sai phiên, tạm dừng/để lại/bỏ, giới hạn danh sách; thông tin người nhận chỉ ghi vào đơn; tương tác web/mobile.

Kết quả kiểm tra ngày 23/11/2026:

- Backend: 119 kiểm thử nghiệp vụ và 20 kiểm thử tích hợp MongoDB cô lập đều qua; build TypeScript qua.
- Web: 10 kiểm thử agent/chat liên quan qua; kiểm tra tương tác Chrome ở khung 1100×900 và 430×932 qua, gồm sửa tên, số điện thoại, chính sách và danh sách nhiều yêu cầu; TypeScript và ESLint các file liên quan qua.
- Mobile: 25 kiểm thử qua, gồm tải địa chỉ lỗi/rỗng/thử lại, tùy chọn ngừng hoạt động, tên/số sai, bỏ thông tin riêng, lịch, voucher, phương thức thanh toán, form cũ và phát lại request. Phân tích tĩnh không có lỗi; SDK Flutter đang cài báo thông tin deprecated cho import Material.
- Hồi quy web mở rộng còn lỗi ngoài phần agent ở `customer-contact-phone.test.cjs` và `customer-interactions.test.cjs`: fixture thiếu dữ liệu người nhận và bộ nạp test chưa xử lý một số import hiện có. Không thay đổi nghiệp vụ liên hệ/hủy đơn để xử lý các lỗi fixture này.
- Graphify: thử truy vấn `agent multi booking draft recipientName mobile booking confirmation`, nhưng lệnh không khả dụng; phạm vi và phụ thuộc được kiểm tra trực tiếp trong code. Graph chưa được cập nhật bằng công cụ này.

Không đổi schema MongoDB hoặc endpoint. Trạng thái danh sách được lưu cùng dữ liệu phiên hiện có. Sau khi triển khai backend/web/mobile, nhập lại nguồn kiến thức nội bộ bằng `npm run ai:knowledge -- enqueue-builtins`, sau đó chạy worker theo cấu hình triển khai hiện có để nội dung Atlas đồng bộ với nguồn mới. Không chạy nhập dữ liệu hoặc gọi AI/thanh toán thật trong bộ kiểm thử.
