# Kết quả thiết kế lại giao diện AI quản trị

Ngày kiểm tra: 31/10/2026. Trang: `/admin/ai`.

## Cấu trúc mới

- Danh sách sáu chức năng bên trái trên máy tính; ô chọn chức năng trên màn hình nhỏ.
- Mỗi chức năng có bốn mục: **Tổng quan**, **Thiết lập**, **Chạy thử**, **Kết quả**.
- Tổng quan giới thiệu công việc, hướng dẫn bắt đầu và nút bật/tắt tự động hóa.
- Thiết lập thu gọn từng tiêu chí, mã tham chiếu và thông số nâng cao. Nội dung chưa lưu được giữ khi chuyển chức năng trong trang, không lưu qua tải lại hoặc rời trang.
- Chạy thử đặt phân tích thử làm thao tác chính. Xử lý tự động dữ liệu đã chọn nằm trong phần mở rộng và chỉ dùng được khi đã bật tự động hóa.
- Kết quả hiển thị danh sách tóm tắt; mở từng dòng để xem chi tiết, bằng chứng hoặc chỉnh sửa phân loại.
- Bộ tiêu chí bắt buộc xác minh danh tính độc lập có giải thích rõ lý do chưa thể bật tự động.

## Kiểm chứng

| Kiểm tra | Kết quả |
|---|---|
| `npm run build` tại `handigo-web` | Đạt |
| `npm run lint` tại `handigo-web` | Đạt |
| `node --test tests/admin-ai.browser.test.cjs` tại `handigo-backend` | Đạt, 1 kịch bản tổng hợp |
| Chuyển qua sáu chức năng | Đạt |
| Giữ tiêu chí chưa lưu khi chuyển chức năng, chặn bật với thay đổi chưa lưu | Đạt |
| Lưu tiêu chí, bật tự động, phân tích thử không tạo provider | Đạt |
| Xem kết quả, quay lại giữ tài nguyên đã chọn, xử lý tự động tạo provider | Đạt |
| Bốn mục ở màn hình 390px và 768px | Không tràn ngang |
| Bộ chọn ngày báo cáo trên điện thoại | Không tràn ngang |
| Lỗi JavaScript trên trình duyệt | Không phát hiện |

Kiểm thử dùng Chromium, API admin thật và MongoDB replica set tạm. Phản hồi AI, xác thực khởi tạo giao diện và các API ngoài phạm vi được giả lập; không gọi Gemini thật hoặc thay đổi dữ liệu vận hành. Không thay đổi API, database hay logic phê duyệt backend trong lần thiết kế lại này.

`npm audit` còn 26 cảnh báo dependency hiện có của frontend: 15 trung bình và 11 cao. Không thêm hoặc cập nhật dependency. Cảnh báo Mongoose về `new: true` vẫn xuất hiện từ backend hiện có trong kiểm thử.

Graphify: đã thử `graphify query "AdminAIPage PolicyEditor RunAssessment"`; CLI không khả dụng. Đã kiểm tra trực tiếp code liên quan.

## Bằng chứng

- [Tổng quan](ADMIN_AI_REDESIGN_OVERVIEW.png)
- [Thiết lập](ADMIN_AI_REDESIGN_SETUP.png)
- [Chạy thử](ADMIN_AI_REDESIGN_TEST.png)
- [Kết quả](ADMIN_AI_REDESIGN_RESULTS.png)
- [Điện thoại](ADMIN_AI_REDESIGN_MOBILE.png)
- [Log kiểm thử trình duyệt](ADMIN_AI_REDESIGN_BROWSER_TEST.txt)
- [Log build](ADMIN_AI_REDESIGN_BUILD.txt)
- [Log lint](ADMIN_AI_REDESIGN_LINT.txt)
- [Audit dependency](ADMIN_AI_REDESIGN_AUDIT.json)
