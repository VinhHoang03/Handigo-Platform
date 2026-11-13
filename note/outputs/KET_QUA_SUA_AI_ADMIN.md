# Kết quả sửa nghiệp vụ AI của ADMIN

Ngày thực hiện: 09/11/2026. Tiếp nối báo cáo `RA_SOAT_AI_ADMIN_NGOAI_LUONG.md`.

## Thay đổi đã triển khai trong mã nguồn

### 1. Quyết định khiếu nại

- Báo cáo đã có phương án AI thật phải đi qua luồng quyết định có kiểm tra bằng chứng, công việc và đối soát hoàn tiền. Gọi endpoint báo cáo thường hoặc endpoint tương thích để kết luận trực tiếp bị chặn 409.
- Chạy thử không khóa luồng thủ công. Nếu AI lỗi trước khi tạo phương án, admin vẫn xử lý thủ công được.
- Sau quyết định trung gian `under_review` hoặc `evidence_requested`, admin tiếp tục được bước tiếp theo qua cùng luồng AI. Không áp dụng lặp cùng quyết định trung gian hoặc áp dụng lại quyết định kết thúc.
- Quyết định, cập nhật báo cáo và dấu vết dữ liệu nguồn được ghi cùng transaction. Thay đổi dữ liệu bên ngoài hoặc quyết định đồng thời làm phương án cũ bị từ chối.
- Giao diện giữ các điều kiện khi chuyển bước; không tự chuyển sang API thường khi API AI lỗi. Xác nhận công việc gắn với phiên bản kết quả, không dùng lại khi phân tích lại cùng mã tác vụ.

### 2. Khôi phục tác vụ AI

- Hết hạn mức ngày chuyển sang chờ thử lại vào 00:00 UTC hôm sau; không tiêu hao lượt thử mô hình khi chưa gọi được mô hình.
- Admin có thể chạy lại tác vụ thật ở trạng thái lỗi hoặc hết hiệu lực. Hai yêu cầu chạy lại đồng thời chỉ khởi động một tác vụ; không đổi lease của tác vụ đang chạy.
- Giữ phương án cũ trong lúc chạy lại để không mở đường đi vòng điều kiện xử lý khiếu nại.
- Giao diện hiển thị thao tác phân tích lại cho kết quả lỗi/hết hiệu lực khi tự động hóa đang bật.

### 3. Kết quả hết hiệu lực

- Kiểm tra lại dữ liệu nguồn, phiên bản/công tắc cấu hình, quyền admin và lease trước khi lưu kết quả, gồm nhánh cần admin xử lý và chạy thử.
- Nếu dữ liệu hoặc cấu hình thay đổi trong khi mô hình chạy, kết quả không được lưu như phương án còn hiệu lực.
- Kiểm tra và ghi kết quả nằm trong transaction, dùng cùng cơ chế bảo vệ với nhánh tự áp dụng.

Không thay đổi schema, route, enum hoặc response shape; không thêm dependency hay migration. Kiểu frontend bổ sung trường tùy chọn `updatedAt` vốn đã có trong dữ liệu backend. Giữ nguyên luồng admin chuyển tiền bên ngoài rồi duyệt rút tiền theo yêu cầu trước đó.

## Kiểm chứng

| Nhóm | Kết quả |
|---|---|
| AI backend: unit và integration | 157/157 đạt |
| Hồi quy backend ADMIN/vi phạm/email/provider/đề xuất/chính sách đơn | 195/195 mục đạt, gồm nhóm bao ngoài của node:test |
| Frontend ADMIN/AI và các form liên quan | 86/86 đạt |
| E2E Chromium trên bản build cuối | 1/1 kịch bản tổng hợp đạt |
| Build backend và frontend | Đạt |
| Lint frontend | Đạt |
| Toàn bộ frontend `tests/*.test.cjs` | 411/433 đạt; 22 thất bại ngoài nhóm ADMIN/AI vừa sửa |
| Kiểm tra dependency production với npm audit | Chưa đạt: backend 20 mục (9 moderate, 10 high, 1 critical); frontend 5 mục (1 moderate, 4 high) |

Các kiểm thử bổ sung bao phủ: đổi dữ liệu/cấu hình giữa lúc gọi mô hình; nhánh thủ công và chạy thử; hết hạn mức rồi chạy sang ngày mới; ba lần lỗi rồi yêu cầu chạy lại đồng thời; worker đồng thời; gọi API thường để đi vòng; quyết định trung gian rồi kết thúc; gửi lặp; thay đổi nguồn sau quyết định; chạy thử và lỗi chưa có phương án vẫn xử lý thủ công được.

E2E bao phủ cấu hình, chạy thử và tự duyệt provider, bật xử lý đề xuất dịch vụ, tải lại cấu hình khi API lỗi, khiếu nại thiếu bằng chứng, xác nhận công việc rồi kết thúc ca, và API báo cáo thường bị chặn 409. Kiểm tra modal ở màn hình máy tính, 768px và 390px. Bộ test dùng một bộ chuyển tiếp request duy nhất để tránh tranh chấp giữa các bộ bắt request khi giả lập lỗi cấu hình; chạy lại trên bản build cuối đã đạt.

Lệnh AI backend, tại `handigo-backend`:

```powershell
node --test --test-reporter=spec tests/admin-ai.unit.test.cjs tests/admin-ai.integration.test.cjs
node --test --test-reporter=spec tests/admin-ai.browser.test.cjs
npm run build
```

Lệnh frontend, tại `handigo-web`:

```powershell
node --test --test-reporter=spec tests/admin-ai-results.test.cjs tests/report-review-form.test.cjs tests/admin-application-query.test.cjs tests/admin-filter-load.test.cjs tests/admin-feedback.test.cjs tests/feedback-moderation.test.cjs tests/support-data-sync.test.cjs tests/support-ticket-sidebar.test.cjs tests/service-suggestion-form.test.cjs
node --test --test-reporter=spec tests/*.test.cjs
npm run build
npm run lint
```

## Các kiểm thử frontend còn thất bại

Đây là kết quả thực chạy trên code hiện tại. Chưa kết luận từng ca là lỗi sản phẩm hay kỳ vọng/mô phỏng của test đã cũ; chưa sửa các module này trong đợt AI.

| File trong `handigo-web/tests` | Số ca | Nội dung |
|---|---:|---|
| `address-pin-confirmation.test.cjs` | 1 | Hiển thị ghim ở bước xác nhận |
| `auth-session.test.cjs` | 1 | Chặn provider chưa được duyệt khi khôi phục phiên |
| `booking-create-once.test.cjs` | 1 | Giờ booking và thời điểm đã qua |
| `customer-chat-feedback-safety.test.cjs` | 2 | Đổi popup/lịch sử, tin đầu tiên/kết nối lại |
| `customer-contact-phone.test.cjs` | 3 | Ưu tiên số điện thoại thợ và dữ liệu dự phòng |
| `customer-interactions.test.cjs` | 4 | Xác nhận tiền hoàn/hủy chuỗi, form thợ hủy, tiến độ hủy |
| `manual-address.test.cjs` | 1 | Bản đồ và quyền vị trí |
| `payment-summary.test.cjs` | 6 | Nội dung tiền mặt, ví, QR, báo giá và trạng thái thanh toán |
| `provider-application-flow.test.cjs` | 1 | Mô phỏng thiếu hàm getNotificationContent khi xử lý thông báo |
| `provider-order-regressions.test.cjs` | 2 | Mở đề nghị từ thông báo và thay thông báo trên cùng trang |

## Giới hạn và kiểm tra công cụ

- MongoDB chạy replica set tạm riêng. Mô hình AI, SMTP và dịch vụ thanh toán được giả lập; không dùng kết quả này để xác nhận Gemini thật, gửi email thật hoặc chuyển tiền thật.
- Đã triển khai vào mã nguồn và build cục bộ; chưa triển khai lên máy chủ production.
- Không tự cập nhật package để xử lý cảnh báo audit. Đây là phần tồn đọng riêng, chưa thể xác nhận toàn dự án đạt kiểm tra bảo mật dependency.
- Build frontend còn cảnh báo dữ liệu Browserslist cũ và thời gian plugin kiểm tra; build vẫn thành công.
- Đã thử `graphify query "admin AI assessment retry quota stale complaint decision"`; máy không nhận lệnh Graphify. Phạm vi và ảnh hưởng được xác minh bằng code thực tế cùng kiểm thử, không dựa vào graph.
