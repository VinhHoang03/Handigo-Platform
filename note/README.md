# Ghi chú và tài liệu tham khảo Handigo

Tập hợp ngày 30/10/2026. Các thư mục con giữ đường dẫn gốc để phân biệt tài liệu cùng tên. Đây là kho tham khảo theo thời điểm; kế hoạch hoặc kết quả kiểm tra cũ không xác nhận trạng thái hiện tại của ứng dụng.

- [Trạng thái triển khai agent đặt dịch vụ](agent-booking.md).
- [Kịch bản demo và bảo vệ](KICH_BAN_DEMO_BAO_VE_25_PHUT.md).
- [Tài liệu nghiệp vụ và rà soát](docs/).
- [Kế hoạch và tài liệu Flutter](handigo-app/).
- [Thiết kế web](handigo-web/DESIGN.md).
- [Ghi chú các lô dữ liệu](handigo-backend/data/): chỉ chuyển tài liệu; script và dữ liệu vẫn ở vị trí ban đầu trong dự án.
- [Báo cáo kiểm thử và sơ đồ](outputs/): các tài liệu liên quan vẫn có thể nằm trong thư mục `outputs` gốc.

Các đường dẫn mã nguồn, lệnh chạy và đường dẫn dữ liệu được viết trong nội dung tài liệu vẫn theo vị trí gốc của dự án. Khi sử dụng lại, đối chiếu mã nguồn và chạy từ thư mục được tài liệu chỉ định. Các liên kết Markdown tương đối đã được điều chỉnh theo vị trí mới; nguồn đã thiếu trước khi dọn có thể vẫn không mở được.

## Tài liệu đã xóa

| Đường dẫn gốc | Lý do |
| --- | --- |
| `DESIGN.md` | Đặc tả Nova dẫn tới hai nguồn không còn tồn tại, mâu thuẫn với nguồn thiết kế provider được kế hoạch mới chỉ định. Giữ các bản thiết kế web và Stitch trong kho tham khảo. |
| `AGENT_FLOW.md` | Hướng dẫn Codex Kit chung; quy tắc làm việc hiện có nằm trong `AGENTS.md`, skill và workflow. |
| `handigo-web/implement_step.md` | Hướng dẫn kiến trúc rời rạc, trùng mục đích với quy tắc dự án và skill frontend. |
| `handigo-backend/GOOGLE_VISION_OCR_SETUP.md` | Hướng dẫn thiết lập OCR riêng, xóa theo yêu cầu dọn các file hướng dẫn. |
| `handigo-backend/postman/README.md` | Hướng dẫn nhập Postman; đã xóa cùng đợt dọn hướng dẫn. |
| `note/handigo-backend/postman/*.postman_collection.json` | Đã xóa cả 7 bộ sưu tập theo yêu cầu bổ sung của người dùng. |
| `handigo-app/ios/Runner/Assets.xcassets/LaunchImage.imageset/README.md` | Hướng dẫn mẫu Flutter về thay ảnh khởi động. |
| `docs/07-ke-hoach-refactor-he-thong.md` | Backlog theo trạng thái 02/07/2026, không còn là căn cứ xác định việc cần làm hiện tại. |
| `docs/08-ghi-chu-phan-chua-trien-khai-report-complaint-violation-support.md` | Ghi chú 01/07/2026 đã bị thay thế bởi luồng gộp khiếu nại vào báo cáo và bản rà soát ngày 30/10/2026. |

## Phạm vi giữ nguyên

Giữ README khởi chạy ở root và ứng dụng, `AGENTS.md`, skill/workflow, giấy phép font, ghi nhận nguồn logo thanh toán và `handigo-backend/src/ai/knowledge/booking-scenarios.md` thuộc nội dung kiến thức AI.

Không thay đổi mã nguồn ứng dụng, API, schema hoặc database. Không đọc cấu hình bí mật hay chạy bộ request Postman.

Danh mục đường dẫn đã chuyển và đã xóa nằm trong [danh-muc.json](danh-muc.json).

## Kiểm tra Graphify

Shell ban đầu chưa nhận đường dẫn Graphify. Sau khi nạp lại `PATH` từ Windows, Graphify `0.9.97` chạy được. Đã dùng truy vấn `documentation Postman plan` trên `graphify-out/graph.json`; kết quả chủ yếu dẫn tới mã lập kế hoạch migration và nhập tin tức, không đủ để kết luận tài liệu còn dùng hay đã cũ. Việc phân loại được đối chiếu trực tiếp với nội dung và mã nguồn.

Không tạo lại graph trong đợt dọn tài liệu này. Graph có thể còn lưu đường dẫn tài liệu cũ nếu các đường dẫn đó từng được đưa vào graph.

Truy vấn bổ sung `complaintToReport --context call --budget 500` xác định liên hệ giữa script chuyển đổi khiếu nại, hàm chuyển đổi và model báo cáo; đã đối chiếu với `handigo-backend/src/services/complaintReportMigration.ts`.

README ở root đã bỏ bảng lệnh npm cũ dành cho package root không còn tồn tại. Giữ hướng dẫn `node dev.mjs` và `node scripts/dev-app.mjs`, đồng thời thêm liên kết tới kho tài liệu này.
