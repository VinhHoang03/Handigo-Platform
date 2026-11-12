# Rà soát riêng AI của ADMIN và kiểm thử ngoài luồng

Ngày kiểm tra: 08/11/2026. Đây là kết quả rà soát trước khi sửa mã nghiệp vụ AI.

Cập nhật 09/11/2026: đã triển khai sửa ba nhóm lỗi bên dưới. Xem [kết quả sửa và kiểm thử AI ADMIN](KET_QUA_SUA_AI_ADMIN.md) để biết kết quả mới nhất và các giới hạn còn lại.

## Kết luận

Chưa thể xác nhận toàn bộ nhánh ngoài luồng hoạt động đúng. Đã tái hiện **3 nhóm lỗi nghiệp vụ**, tương ứng **7 ca kiểm thử thất bại** trong bộ kiểm tra bổ sung.

Không dùng kết quả 195 mục backend và 25 ca frontend của đợt sửa ADMIN mục 2–8 để kết luận về bộ AI: đó là các bộ kiểm thử khác nhau.

## Phạm vi đã đọc và kiểm tra

- Ba chức năng đang dùng: hồ sơ provider, gợi ý dịch vụ và phân tích/phương án khiếu nại.
- Cấu hình nháp, bật/tắt, revision và lịch sử; tạo tác vụ thật/chạy thử; hạn mức, worker, retry và lease.
- Thu thập ngữ cảnh, tiêu chí bằng code, kiểm tra output/bằng chứng/ảnh của mô hình.
- Tự duyệt, tự từ chối hồ sơ thiếu thông tin, tiếp nhận/yêu cầu bổ sung khiếu nại và quyết định của admin.
- Router, validation, quyền ADMIN; modal cấu hình, danh sách kết quả và form xử lý báo cáo.
- Các chức năng đã ngừng: phân loại hỗ trợ, soạn phản hồi và báo cáo vận hành.

## Lỗi 1 — Cao: có thể đi vòng điều kiện quyết định khiếu nại của AI

`admin-ai.complaint-decision.ts` kiểm tra công việc hoàn tất, dữ liệu mới nhất và giao dịch hoàn tiền. Tuy nhiên, endpoint duyệt báo cáo thường gọi `report.service.reviewReport` không có cùng điều kiện. Cả hai đều là đường đi hợp lệ của ADMIN.

Đã tái hiện với cùng báo cáo có phương án yêu cầu hoàn tiền, chưa có khoản hoàn nào được hệ thống xác nhận:

1. Gọi `decideComplaint(..., status: resolved)` bị từ chối với lỗi **422**.
2. Gọi `reviewReport(..., status: resolved)` thành công; báo cáo thành **resolved**, `adminDecision` của kết quả AI vẫn null.

Đây còn là đường đi có thể xảy ra trên UI, không chỉ sửa request bằng tay. Đã mô phỏng component thật: sau khi admin xác nhận một quyết định trung gian `under_review`, kết quả có `adminDecision`; `ReportReviewForm` bỏ nhánh AI và lần xử lý tiếp theo gửi qua API báo cáo thường. Chọn `resolved` được bật mà không yêu cầu kết quả từng công việc. Chuỗi gọi thu được: `ai → normal`.

Vị trí:

- `handigo-backend/src/ai/admin/admin-ai.complaint-decision.ts:34`.
- `handigo-backend/src/services/report.service.ts:415`.
- `handigo-web/src/features/admin/components/cases/ReportReviewForm.tsx:22` và `:52`.

Hướng xử lý: thống nhất điều kiện kết thúc tại service nghiệp vụ báo cáo; tránh để thay endpoint hoặc quyết định trung gian loại bỏ các điều kiện đang còn hiệu lực. Vẫn phải giữ đường xử lý thủ công hợp lệ cho báo cáo không sử dụng AI.

## Lỗi 2 — Cao: tác vụ error không có đường khôi phục phù hợp

Tác vụ thật dùng key cố định theo feature, nguồn, hash và revision. `enqueueAssessment` chỉ dùng `$setOnInsert`; gặp key cũ thì trả nguyên bản ghi, kể cả khi bản ghi đã error. Worker chỉ lấy queued, retry hoặc running hết lease.

Hai ca đã tái hiện:

| Tình huống | Kết quả hiện tại |
|---|---|
| Hết hạn mức ngày | Job thành error. Sau khi làm mới bộ đếm hạn mức, quét tự động và gọi chạy lại vẫn trả đúng job error cũ; worker không xử lý, hồ sơ còn pending. |
| Mô hình lỗi hết ba lượt | Gọi xử lý thật lần nữa trả job cũ với status error, attempts 3; không có tác vụ mới hoặc reset retry. |

Ca hạn mức mô phỏng việc hạn mức được cấp lại bằng cách làm mới collection quota trong database tạm; không chờ sang ngày thật. Điều này kiểm tra đường khôi phục khi hạn mức đã có trở lại.

Vị trí: `handigo-backend/src/ai/admin/admin-ai.service.ts:119`, `:194`, `:239`.

Hướng xử lý: phân biệt lỗi tạm thời/hết hạn mức với lỗi cần xử lý thủ công; có lịch chờ phù hợp hoặc thao tác chạy lại có kiểm soát. Giữ chống trùng và chặn worker cũ bằng lease khi khôi phục.

## Lỗi 3 — Trung bình: kết quả manual/preview không kiểm tra lại nguồn và revision sau khi AI chạy

Nhánh tự duyệt có `guardAndComplete` kiểm tra lại nguồn/cấu hình trong transaction; khiếu nại cũng có bước kiểm tra riêng sau phân tích. Nhưng với hồ sơ provider, nhánh chuyển thủ công và chạy thử đi thẳng tới ghi kết quả.

Đã tái hiện bốn ca:

| Chế độ | Thay đổi trong lúc mô hình chạy | Kết quả hiện tại |
|---|---|---|
| Xử lý thật, AI trả unknown | Mô tả hồ sơ thay đổi | manual, chưa báo stale |
| Xử lý thật, AI trả unknown | Tắt cấu hình, revision tăng | manual, chưa báo stale |
| Chạy thử | Mô tả hồ sơ thay đổi | completed/preview, chưa báo stale |
| Chạy thử | Tắt cấu hình, revision tăng | completed/preview, chưa báo stale |

Không có trường hợp nào trong bốn ca này cấp quyền sai: hồ sơ vẫn pending. Lỗi nằm ở việc lưu/trình bày kết quả phân tích cũ như một kết quả bình thường, có thể làm admin dựa vào nội dung không còn khớp hồ sơ hoặc bộ tiêu chí hiện tại.

Vị trí: `handigo-backend/src/ai/admin/admin-ai.service.ts:161`, `:235`.

Hướng xử lý: kiểm tra lại hash và revision trước khi công bố mọi kết quả, không chỉ nhánh tự áp dụng.

## Các tình huống đã kiểm chứng hoạt động đúng

- Hồ sơ đủ ảnh và đạt tiêu chí được tự duyệt, tạo đúng provider.
- Hồ sơ thiếu ảnh chỉ tự từ chối khi admin đã bật rõ cờ cho phép; khi tắt thì để kiểm tra thủ công.
- Tiêu chí xác minh danh tính độc lập bắt buộc vẫn chặn bật tự duyệt với lỗi 422.
- Dịch vụ đã ngừng không được tự duyệt dù output giả lập báo đạt.
- Lỗi ghi thông báo rollback việc tự duyệt với hồ sơ đủ điều kiện; không để lại quyền/provider cập nhật một phần.
- Hai worker và hai yêu cầu trùng chỉ duyệt một lần với bộ dữ liệu đầy đủ.
- Tác vụ còn lượt thử khôi phục được sau khi lease của worker cũ hết hạn.
- Bộ AI hiện có còn kiểm chứng được các trường hợp: tắt công tắc/đổi nguồn trước tự áp dụng, chủ hồ sơ hoặc admin bị khóa, khiếu nại thiếu bằng chứng, ảnh/tệp chưa phân tích, giao dịch đổi sau phân tích, hoàn tiền pending/failed, sai người nhận/sai payment/sai chiều tiền, quyền ADMIN và đầu vào sai.
- 21 ca frontend về trình bày kết quả/form quyết định đạt, gồm không tự chuyển sang API thường khi chính lời gọi API AI gặp lỗi. Ca này khác với lỗi 1: lỗi 1 xuất hiện sau một quyết định trung gian đã thành công.

## Kết quả thực thi và chất lượng bộ test hiện tại

| Bộ kiểm tra | Kết quả |
|---|---|
| `admin-ai.unit.test.cjs` và `admin-ai.integration.test.cjs` hiện có | 139 mục Node.js: 128 đạt, 11 báo lỗi. Trong 11 có 10 ca độc lập và 1 nhóm bao ngoài báo lỗi theo các ca con. |
| `admin-ai-results.test.cjs` và `report-review-form.test.cjs` | 21/21 ca đạt. |
| Bộ kiểm tra ngoài luồng bổ sung trong thư mục tạm | 15 ca độc lập: 8 đối chứng đạt, 7 ca thất bại tái hiện ba nhóm lỗi nêu trên. Node.js tính thêm nhóm bao ngoài thành 16 mục: 8 đạt, 8 lỗi. |
| Browser test gốc | Không đạt, dừng sớm vì selector/giả định cấu hình mặc định cũ. Chưa kiểm chứng xuyên suốt bằng bộ E2E này. |

Các lỗi của test cũ phải phân biệt với lỗi sản phẩm:

- Fixture provider không có ảnh giấy tờ nhưng kỳ vọng tự duyệt; vì vậy các ca tự duyệt, đồng thời, rollback và khôi phục lease không đi tới nhánh cần kiểm tra. Đã bổ sung đối chứng có đủ ảnh để xác minh các nhánh đó.
- Test bật cấu hình mặc định vẫn kỳ vọng bị chặn bởi `verified_identity`, trong khi mặc định hiện tại dùng kiểm tra có ảnh và đánh giá mô tả. Đã kiểm tra riêng trường hợp thực sự thêm `verified_identity` bắt buộc: vẫn bị chặn đúng.
- Test quét vẫn kỳ vọng bỏ qua hồ sơ tồn, nhưng code hiện chủ đích lấy cả backlog khi bật.
- Hai test unit kỳ vọng ném lỗi khi căn cứ không hợp lệ, trong khi code hiện loại căn cứ đó, đánh dấu thiếu dữ liệu và chuyển admin xác minh.
- Test gửi ảnh provider còn kỳ vọng inlineData; hiện chỉ nhánh khiếu nại gửi ảnh cho mô hình, nhánh provider kiểm tra có ảnh bằng code và phân tích mô tả.
- Browser test vẫn tìm tiêu chí mặc định cũ và nút/phần quyết định khiếu nại cũ. Bản chạy đối chiếu trong bộ nhớ bỏ giả định mặc định cũ đã đi qua phần cấu hình, chạy thử/tự duyệt provider, bật gợi ý dịch vụ và kiểm tra modal màn hình nhỏ; vẫn dừng ở selector khiếu nại cũ. Không sửa file test gốc hoặc tính lần chạy này là E2E đạt.

## Bằng chứng và cách chạy lại

Bộ kiểm tra bổ sung nằm ngoài repository để không đưa test cố ý báo đỏ vào bộ CI khi chưa sửa nghiệp vụ:

- Script: `C:/Users/ASUS/AppData/Local/Temp/handigo-admin-ai-edge-audit.cjs`.
- Log bằng chứng và assertion: `C:/Users/ASUS/AppData/Local/Temp/handigo-admin-ai-edge-audit.log`.
- Log toàn bộ bộ AI cũ: `C:/Users/ASUS/AppData/Local/Temp/handigo-admin-ai-baseline.log`.

Chạy script bổ sung từ `handigo-backend`:

```powershell
node --test --test-reporter=spec "$env:TEMP/handigo-admin-ai-edge-audit.cjs"
```

Script tự đặt toàn bộ khóa giả cần dùng trước khi nạp module. Không đọc `.env`, không gọi Gemini thật, không gửi email hay chuyển tiền. MongoDB dùng replica set tạm riêng và được dừng sau kiểm thử. Không đổi code nghiệp vụ trong đợt rà soát này.

## Giới hạn

- Chưa kiểm tra chất lượng suy luận, độ chính xác ngữ nghĩa hoặc quyền truy cập của Gemini thật; output mô hình được giả lập để kiểm tra luồng nghiệp vụ.
- Chưa chạy thành công một E2E xuyên suốt cho giao diện AI hiện tại; không được suy ra tất cả luồng UI đã đúng từ các test component đã đạt.
- Không khẳng định bao phủ tuyệt đối mọi tổ hợp dữ liệu, tình huống mất mạng/failover hoặc tải thực tế.
- Đã thử `graphify query "admin AI config assessment worker automatic review manual confirmation"`, nhưng máy không nhận lệnh Graphify. Phạm vi được xác minh trực tiếp từ mã nguồn và kiểm thử.
