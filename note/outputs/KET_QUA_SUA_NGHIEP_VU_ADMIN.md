# Kết quả sửa nghiệp vụ ADMIN mục 2–8

Ngày thực hiện: 08/11/2026.

## Phạm vi đã chốt

Mục 1 được loại khỏi danh sách lỗi: quy trình hiện tại là admin chuyển tiền bên ngoài hệ thống, sau đó duyệt yêu cầu để ghi nhận thành công. Không sửa luồng rút tiền.

Không đổi route, field, enum hoặc response shape. Các yêu cầu sai nghiệp vụ được chặn bằng `AppError` theo cơ chế hiện có. Không đổi schema, không thêm dependency, không chạy migration.

## Các sửa đổi

| Mục | Lỗi | Hành vi sau sửa |
|---|---|---|
| 2 | Client thay người vi phạm hoặc đơn không liên quan | REPORT lấy đối tượng/đơn từ nguồn; nếu client cung cấp giá trị khác thì trả 400. SUPPORT_TICKET chỉ cho chọn người gửi, khách hoặc tài khoản thợ trong đơn liên quan; không nhận đơn tự chèn. Đơn gắn nguồn đã mất/xóa trả 404. |
| 3 | Cấu hình phí nền tảng vượt giới hạn | Tạo/cập nhật chỉ nhận NUMBER hữu hạn từ 0 đến 100, gồm số thập phân. Giá trị cũ sai giới hạn bị chặn khi đọc để tính phí với lỗi 503, cần admin sửa lại cấu hình; không tự thay đổi dữ liệu cũ. |
| 4 | Tạo vi phạm từ ticket đã kết thúc | Chặn `resolved`, `closed`, `cancelled`; UI ẩn nút tạo vi phạm tương ứng. Ticket `resolved` có thể mở lại `in_progress` theo luồng hiện có, sau đó xử lý. Kiểm thử cả hủy ticket đồng thời khi tạo vi phạm. |
| 5 | Đổi quyết định/xóa liên kết đề xuất đã xử lý | Khi đề xuất không còn `pending`, API từ chối đổi trạng thái, danh mục hoặc liên kết dịch vụ/danh mục với lỗi 409. Vẫn cho gửi phản hồi, giữ nguyên người và thời điểm xét duyệt ban đầu. Duyệt/từ chối đồng thời chỉ ghi được một quyết định. |
| 6 | Đóng ticket ghi đè người/ngày giải quyết | Chuyển `resolved → closed` hoặc cập nhật lại trạng thái kết thúc giữ nguyên `resolvedBy` và `resolvedAt`; số liệu hoàn tất hôm nay và thời gian xử lý không tăng sai. Mở lại rồi giải quyết lần nữa ghi nhận lần xử lý mới. |
| 7 | Ghi audit lỗi nhưng cấu hình đã thay đổi | Tạo/cập nhật cấu hình và audit log nằm trong cùng transaction. Lỗi audit rollback cả hai; cập nhật đồng thời lưu giá trị trước/sau theo giao dịch đã commit. |
| 8 | Duyệt provider với dịch vụ đã ngừng/xóa | Kiểm tra lại dịch vụ trong transaction cho cả đăng ký ban đầu, bổ sung dịch vụ và tự duyệt. Ghi phiên bản nội bộ để phát hiện ngừng/xóa đồng thời, giữ nguyên thời điểm cập nhật nội dung dịch vụ. Không hợp lệ thì rollback hồ sơ, profile và thông báo. Từ chối hồ sơ vẫn hoạt động khi dịch vụ đã ngừng. |

## Kiểm chứng

- **195/195 mục kiểm thử backend đạt**, gồm các nhóm bao ngoài do `node:test` tính; không lỗi, không bỏ qua.
- **25/25 ca frontend đạt**, gồm kiểm thử render sidebar ở sáu trạng thái và hồi quy đồng bộ hỗ trợ/form đề xuất.
- Build backend, build frontend và lint frontend: **Đạt**.
- MongoDB dùng replica set tạm riêng; không kết nối database dự án.
- Cập nhật các mô phỏng cũ để truyền session và dùng đích biên dịch phù hợp backend. Hai test phụ thuộc câu chữ thông báo/UI cũ được sửa để kiểm tra kết quả phê duyệt và hành vi khóa kích hoạt hiện tại; không đổi nội dung giao diện ngoài phạm vi ticket.

Lệnh backend, chạy tại `handigo-backend`:

```powershell
node --test --test-reporter=spec tests/admin-workflows.integration.test.cjs tests/violation-email.test.cjs tests/penalty-policy.test.cjs tests/violation-flow.integration.test.cjs tests/service-suggestion-approval.test.cjs tests/provider-application-flow.test.cjs tests/order-operation-policy.test.cjs
npm run build
```

Lệnh frontend, chạy tại `handigo-web`:

```powershell
node --test --test-reporter=spec tests/support-ticket-sidebar.test.cjs tests/support-data-sync.test.cjs tests/service-suggestion-form.test.cjs
npm run build
npm run lint
```

## Giới hạn

- Chưa chạy E2E toàn bộ trang ADMIN trên trình duyệt hoặc môi trường triển khai thật.
- SMTP vẫn được giả lập trong kiểm thử email; giới hạn có thể gửi trùng sau lỗi ghi trạng thái vẫn được nêu trong báo cáo vi phạm/email.
- Build frontend có cảnh báo dữ liệu Browserslist cũ và thời gian plugin kiểm tra; build vẫn thành công. Không cập nhật package hoặc framework.
- Đã thử `graphify query "violation support ticket service suggestion system config provider application review"`, nhưng máy không nhận lệnh Graphify. Đã xác minh phạm vi trực tiếp từ code và test.
