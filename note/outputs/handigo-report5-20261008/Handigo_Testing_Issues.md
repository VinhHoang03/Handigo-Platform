# Handigo — ghi chú kiểm thử và vấn đề cần xử lý

Ngày lập: **08/10/2026**. Phạm vi: **backend và web**, đủ CUSTOMER, PROVIDER, ADMIN. Build, người tạo và người kiểm thử: **Chưa xác định**.

## Báo cáo và cách hiểu kết quả

Hai file mới được dựng theo hai mẫu Report5 và các hướng dẫn Blackbox/Whitebox đã cung cấp. 64 use case được giữ đúng thứ tự của danh sách yêu cầu.

- Unit Test: **122 đơn vị**, **620 ca**; **93 Đạt**, **0 Không đạt**, **527 chưa chạy**.
- Test Report: **379 ca chức năng/tích hợp**, chia 8 nhóm; toàn bộ **Chưa chạy** do chưa có môi trường UI/API thật.
- Đơn vị unit gồm hàm, logic hook React và schema validation thực trong code. Không tạo hàm giả cho use case còn thiếu.
- Có kiểm thử logic dùng bởi giao diện web, nhưng chưa có kết quả kiểm thử thao tác trên trình duyệt/DOM thật.
- Một ca của bộ test có sẵn có thể gồm nhiều lời gọi/assertion; báo cáo giữ nguyên ca theo `node:test`, không tính mỗi assertion thành một ca mới.
- Ma trận dùng `O` để đánh dấu dữ liệu/điều kiện/kết quả áp dụng. Giá trị nhánh chỉ được gắn vào ca khi bộ dữ liệu thiết kế có ánh xạ đầy đủ; các ca chưa có ánh xạ cần bổ sung khi triển khai runner.
- Tỷ lệ ca đã chạy là 93/620 = **15,0%**. Chưa đo statement/branch coverage, chưa khẳng định độ phủ mã nguồn hoặc hoàn tất nghiệm thu.
- Các ca thiết kế chưa chạy mô tả hành vi hiện có hoặc yêu cầu cần triển khai; ca về phần thiếu được ghi rõ “Chờ triển khai/chốt nghiệp vụ”. Các ca mô tả hành vi code hiện tại không có nghĩa là đã chấp thuận nghiệp vụ đó.

## Các quyết định đã được người dùng xác nhận

| Nội dung | Cách ghi trong tài liệu |
| --- | --- |
| Phạm vi nền tảng/vai trò | Backend + web; CUSTOMER, PROVIDER, ADMIN; không kiểm thử Flutter. |
| Lịch và ngày chạy | Ngày dự kiến từ 25/09/2026 đến 08/10/2026, tăng dần giữa các sheet, giữ một ngày trong từng sheet. Ngày thực thi chỉ ghi theo bằng chứng. |
| Môi trường UI/API | Chưa có URL/môi trường riêng với dữ liệu thử; ghi ca UI/API thật là Chưa chạy. |
| Người kiểm thử và build | Chưa xác định; không suy đoán tên người hoặc phiên bản. |
| Request A Refund / Response Refund Request | Ghi nhận thiếu luồng yêu cầu hoàn độc lập để xử lý sau; không thay bằng hủy đơn hoặc retry hoàn tiền. |
| Duyệt rút tiền | Chưa chốt chuyển khoản thủ công hay payout tự động; ghi vấn đề để xử lý sau, không xác nhận tiền đã tới ngân hàng. |
| Update System Content | Gồm Tin tức, Giới thiệu và FAQ. Code hiện có quản trị tin tức, Giới thiệu/FAQ còn tĩnh. |

## Bằng chứng đã chạy

Thực thi độc lập ngày **08/10/2026**, bằng **Node.js 22.22.1**; dùng dữ liệu tổng hợp, fixture và mocks. Không gọi MongoDB, email OTP, OAuth, Cloudinary, Google Vision, PayOS hoặc ngân hàng thật. Không đọc `.env`/credential; không sửa logic ứng dụng.

| Bộ kiểm thử | Kết quả | Bằng chứng |
| --- | --- | --- |
| Các hàm tiện ích/chính sách lấy trực tiếp từ source | 72/72 Đạt | [targeted-unit-results.json](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/outputs/handigo-report5-20261008/internal/targeted-unit-results.json>); [run_targeted_units.cjs](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/outputs/handigo-report5-20261008/internal/run_targeted_units.cjs>) |
| Provider application backend và thông báo model/service | 7/7 Đạt | [backend-provider-test.tap](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/outputs/handigo-report5-20261008/internal/backend-provider-test.tap>); [Bộ test backend](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/tests/provider-application-flow.test.cjs>) |
| Provider application, đồng bộ nháp và notification hook web | 11/11 Đạt | [web-provider-test.tap](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/outputs/handigo-report5-20261008/internal/web-provider-test.tap>); [Bộ test web](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/tests/provider-application-flow.test.cjs>) |
| Đánh giá dịch vụ công khai và validation query | 3/3 Đạt | [backend-feedback-test.tap](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/outputs/handigo-report5-20261008/internal/backend-feedback-test.tap>); [Bộ test feedback](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/tests/service-feedback.test.cjs>) |

72 ca bổ sung kiểm tra 11 hàm: `calculateRefundPolicy`, `normalizePersonName`, `isValidPersonName`, `isValidVietnamesePhone`, `toDateInput`, `maskEmail`, `toggleServiceOption`, `isRequiredOptionSelectionMissing`, `isValidCoordinate`, `canShareLiveLocation`, `formatDistance`. Chính sách hủy/hoàn đã kiểm tra các mốc 24/6/2/0 giờ và lân cận, chưa gán kết quả đó cho luồng yêu cầu hoàn tiền độc lập.

Các bộ test hiện có nạp source TypeScript với phụ thuộc giả lập; hook được chạy bằng mô phỏng React. Kết quả Đạt xác nhận assertion trong phạm vi test, chưa xác nhận tương tác UI, route/middleware toàn hệ thống, commit MongoDB thật hoặc hiệu ứng dịch vụ ngoài.

## Vấn đề từ phân tích code

Danh sách có **46 mã ghi nhận**. “Lỗi có căn cứ” là phát hiện từ control flow/query/luồng UI; “Thiếu chức năng” là khoảng trống triển khai; “Cần xác minh” là nghiệp vụ hoặc điều kiện vận hành chưa được xác nhận. **Chưa ghi các mục này thành Fail của ca UI/API**. Mức độ là ưu tiên đề xuất từ phân tích, cần hiệu chỉnh theo tác động thực tế.

FIN-07 và COM-10 cùng liên quan múi giờ nhưng nằm ở hai phạm vi báo cáo; giữ cả hai ID để truy vết, không tính là hai lỗi runtime đã tái hiện.

| ID | Mức độ | Phân loại | Vấn đề | Use case liên quan |
| --- | --- | --- | --- | --- |
| [AUTH-01](#auth-01) | Trung bình | Thiếu chức năng | Bước xác nhận OTP khôi phục mật khẩu chỉ kiểm tra độ dài trên web. | UC005 |
| [AUTH-02](#auth-02) | Cao | Cần xác minh | Thu hồi session hiện chỉ chặn refresh token, chưa vô hiệu hóa ngay access token đang còn hạn. | UC004, UC005, UC006 |
| [AUTH-03](#auth-03) | Trung bình | Lỗi có căn cứ | Endpoint /auth/me không sử dụng bộ loại trừ trường nhạy cảm đầy đủ. | UC011 |
| [AUTH-04](#auth-04) | Trung bình | Lỗi có căn cứ | Trang quản lý người dùng thiếu bắt lỗi khi thao tác khóa/mở khóa thất bại. | UC042 |
| [AUTH-05](#auth-05) | Trung bình | Cần xác minh | Thông báo khôi phục mật khẩu cho phép phân biệt email có tài khoản. | UC005 |
| [AUTH-06](#auth-06) | Trung bình | Cần xác minh | Chính sách đổi mật khẩu tài khoản Facebook chưa đồng nhất với tài khoản Google. | UC003 |
| [BOOK-01](#book-01) | Cao | Lỗi có căn cứ | API urgent thiếu giờ tạo danh sách đơn rỗng | UC013 |
| [BOOK-02](#book-02) | Trung bình | Cần xác minh | Mô tả tối thiểu 10 ký tự ở web nhưng tùy chọn ở API | UC013 |
| [BOOK-03](#book-03) | Trung bình | Cần xác minh | URL ảnh trong tạo đơn không được ràng buộc với lượt tải đã kiểm tra | UC014 |
| [BOOK-04](#book-04) | Thấp | Thiếu chức năng | Problem Media chỉ có ảnh; chưa thấy video hoặc âm thanh | UC014 |
| [BOOK-05](#book-05) | Cao | Cần xác minh | Nhận appointment chưa dùng khóa lịch và kiểm tra toàn bộ khoảng thời gian | UC016 |
| [BOOK-06](#book-06) | Cao | Thiếu chức năng | Chưa thấy danh sách toàn bộ đơn dành ADMIN | UC049 |
| [BOOK-07](#book-07) | Trung bình | Lỗi có căn cứ | Socket chuyển null hoặc chuỗi rỗng thành tọa độ 0 | UC026 |
| [BOOK-08](#book-08) | Cao | Lỗi có căn cứ | Tracking không chọn addressSnapshot nên có thể dùng địa chỉ đã sửa | UC027 |
| [BOOK-09](#book-09) | Trung bình | Lỗi có căn cứ | Danh sách đơn provider và recent thiếu lọc soft delete | UC049 |
| [FIN-01](#fin-01) | Trung bình | Lỗi có căn cứ | Lọc voucher theo trạng thái mà không nhập tìm kiếm tạo $or rỗng | UC053 |
| [FIN-02](#fin-02) | Cao | Cần xác minh | Duyệt rút tiền ghi thành công nhưng chưa thấy chuyển khoản hoặc bằng chứng chi tiền | UC051 |
| [FIN-03](#fin-03) | Trung bình | Cần xác minh | API rút tiền chấp nhận số tiền có phần thập phân | UC034 |
| [FIN-04](#fin-04) | Trung bình | Lỗi có căn cứ | Lịch sử và danh sách payment theo đơn chưa lọc dữ liệu xóa mềm | UC019 |
| [FIN-05](#fin-05) | Trung bình | Lỗi có căn cứ | Báo cáo dòng tiền qua hệ thống bao gồm payment tiền mặt | UC062 |
| [FIN-06](#fin-06) | Trung bình | Thiếu chức năng | Chưa thấy yêu cầu hoàn tiền độc lập và màn hình admin phản hồi yêu cầu hoàn | UC057, UC058 |
| [FIN-07](#fin-07) | Thấp | Cần xác minh | Nhóm ngày/tháng doanh thu dùng UTC, khoảng lọc ngày dựa múi giờ server | UC032, UC062 |
| [FIN-08](#fin-08) | Thấp | Cần xác minh | Từ chối rút tiền cập nhật ví nhưng không tạo bản ghi withdraw_rejected | UC056 |
| [FIN-09](#fin-09) | Trung bình | Lỗi có căn cứ | Không áp lại cùng voucher trên cùng đơn sau khi gỡ | UC018 |
| [CAT-01](#cat-01) | Cao | Lỗi có căn cứ | Có thể kích hoạt dịch vụ giá linh hoạt khi chưa có tiền đặt cọc | UC039 |
| [CAT-02](#cat-02) | Cao | Lỗi có căn cứ | Danh sách customer bỏ sót dịch vụ sau 100 bản ghi đầu | UC009 |
| [CAT-03](#cat-03) | Trung bình | Cần xác minh | Danh mục tạm ngừng nhưng dịch vụ con active vẫn xuất hiện ở danh sách customer | UC009, UC010, UC046 |
| [CAT-04](#cat-04) | Trung bình | Lỗi có căn cứ | Xóa dịch vụ và tắt tùy chọn không được ghi nguyên tử | UC040 |
| [CAT-05](#cat-05) | Trung bình | Lỗi có căn cứ | Duyệt đề xuất có thể tạo tài nguyên catalog nhưng không lưu được liên kết đề xuất | UC050 |
| [CAT-06](#cat-06) | Trung bình | Lỗi có căn cứ | Màn hình admin đề xuất chỉ xem được 100 bản ghi đầu | UC050 |
| [CAT-07](#cat-07) | Trung bình | Lỗi có căn cứ | Nút Lưu ghi chú đổi trạng thái đề xuất đã duyệt hoặc từ chối về pending | UC050 |
| [CAT-08](#cat-08) | Thấp | Cần xác minh | Gợi ý danh mục mới trên web chỉ tạo đề xuất loại service | UC037 |
| [COM-01](#com-01) | Trung bình | Lỗi có căn cứ | Nhóm nhận ALL gửi cho ADMIN dù nhãn chỉ nêu khách hàng và nhà cung cấp | UC025 |
| [COM-02](#com-02) | Trung bình | Lỗi có căn cứ | Mở thông báo của người khác trong lịch sử quản trị gọi API đánh dấu đã đọc của chính ADMIN | UC063 |
| [COM-03](#com-03) | Cao | Lỗi có căn cứ | Thay đổi cấu hình đã được ghi trước khi audit log thành công | UC060 |
| [COM-04](#com-04) | Trung bình | Lỗi có căn cứ | Cấu hình ngoài danh mục cố định bị ẩn khỏi trang quản trị | UC059 |
| [COM-05](#com-05) | Trung bình | Thiếu chức năng | Một số cấu hình lưu được nhưng chưa được nối vào hành vi hệ thống | UC060 |
| [COM-06](#com-06) | Trung bình | Thiếu chức năng | Chưa có quản trị nội dung Giới thiệu và FAQ theo phạm vi người dùng xác nhận | UC048 |
| [COM-07](#com-07) | Cao | Lỗi có căn cứ | Kiểm tra khiếu nại trùng và tạo mới không bảo vệ yêu cầu đồng thời | UC022 |
| [COM-08](#com-08) | Trung bình | Lỗi có căn cứ | Một bản ghi thông báo có thể phát notification:new hai lần | UC064 |
| [COM-09](#com-09) | Trung bình | Lỗi có căn cứ | Danh sách đơn chọn khi tạo khiếu nại chỉ tải tối đa 50 đơn đầu | UC022 |
| [COM-10](#com-10) | Trung bình | Cần xác minh | Dashboard chuẩn hóa ngày theo múi giờ host thay vì múi giờ nghiệp vụ cố định | UC061 |
| [COM-20](#com-20) | Trung bình | Lỗi có căn cứ | Modal phản hồi ở trang danh sách provider không bắt và hiển thị lỗi gửi | UC031 |
| [COM-21](#com-21) | Trung bình | Lỗi có căn cứ | FeedbackCard bỏ qua ảnh phản hồi của provider | UC012, UC031 |
| [COM-22](#com-22) | Thấp | Cần xác minh | Quy tắc sửa phản hồi chưa nhất quán giữa hai màn hình provider | UC031 |
| [COM-23](#com-23) | Cao | Lỗi có căn cứ | Tạo hoặc cập nhật đánh giá lưu trước khi tính lại điểm provider | UC020, UC030 |

### Xác thực và tài khoản

<a id="auth-01"></a>
#### AUTH-01 — Bước xác nhận OTP khôi phục mật khẩu chỉ kiểm tra độ dài trên web.

**Trung bình; Thiếu chức năng; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** OTP sai đủ 6 chữ số vẫn đưa người dùng tới form mật khẩu; backend chỉ từ chối ở bước đặt lại, không phải vượt qua xác thực backend.

**Cách kiểm tra dự kiến:** Yêu cầu OTP rồi nhập 6 chữ số khác OTP được gửi; bấm Tiếp tục.

**Hướng xử lý đề xuất:** Kết nối bước xác nhận với endpoint verify-reset-password-otp; chỉ chuyển bước khi API xác nhận hợp lệ.

**Nguồn:** [handigo-web/src/features/auth/pages/ForgotPasswordPage.tsx:51 · handleConfirmOtp](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/auth/pages/ForgotPasswordPage.tsx:51>); [handigo-backend/src/routes/auth.routes.ts:67 · /verify-reset-password-otp](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/routes/auth.routes.ts:67>).

**Truy vết:** UC005 Forgot Password. Ca chức năng: BB-UC005-03.

<a id="auth-02"></a>
#### AUTH-02 — Thu hồi session hiện chỉ chặn refresh token, chưa vô hiệu hóa ngay access token đang còn hạn.

**Cao; Cần xác minh; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Nếu yêu cầu nghiệp vụ là kết thúc quyền truy cập ngay sau đăng xuất/đổi/reset mật khẩu, access token cũ vẫn có thể gọi API tới khi hết hạn; khóa tài khoản vẫn bị authMiddleware chặn.

**Cách kiểm tra dự kiến:** Trong môi trường test, giữ access token A; đăng xuất/đổi/reset mật khẩu; gọi GET /users/me bằng A trước khi hết hạn.

**Hướng xử lý đề xuất:** Xác nhận chính sách access token và thời hạn được chấp nhận; nếu cần thu hồi ngay, gắn session/version vào access token và kiểm tra trong middleware.

**Nguồn:** [handigo-backend/src/middlewares/auth.middleware.ts:35 · authMiddleware](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/middlewares/auth.middleware.ts:35>); [handigo-backend/src/services/auth.service.ts:717 · logout](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/auth.service.ts:717>); [handigo-backend/src/services/auth.service.ts:769 · changePassword](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/auth.service.ts:769>); [handigo-backend/src/services/auth.service.ts:651 · resetPassword](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/auth.service.ts:651>).

**Truy vết:** UC004 Sign out; UC005 Forgot Password; UC006 Change Password. Ca chức năng: BB-UC004-05, BB-UC005-07, BB-UC006-07.

<a id="auth-03"></a>
#### AUTH-03 — Endpoint /auth/me không sử dụng bộ loại trừ trường nhạy cảm đầy đủ.

**Trung bình; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** googleId/facebookId, thời hạn OTP và resetPasswordTokenHash cũ nếu tồn tại trong document có thể xuất hiện trong response /auth/me, khác /users/me.

**Cách kiểm tra dự kiến:** Tạo fixture người dùng có googleId/facebookId và trường resetPasswordTokenHash giả lập; gọi /auth/me và /users/me bằng cùng tài khoản, so sánh trường response.

**Hướng xử lý đề xuất:** Dùng projection an toàn chung và DTO cho response /auth/me; thêm kiểm thử danh sách trường cấm.

**Nguồn:** [handigo-backend/src/services/auth.service.ts:778 · getCurrentUser](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/auth.service.ts:778>); [handigo-backend/src/services/user.service.ts:19 · SAFE_USER_PROJECTION](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/user.service.ts:19>); [handigo-backend/src/controllers/auth.controller.ts:307 · getProfile](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/controllers/auth.controller.ts:307>).

**Truy vết:** UC011 View Profile. Ca chức năng: BB-UC011-05.

<a id="auth-04"></a>
#### AUTH-04 — Trang quản lý người dùng thiếu bắt lỗi khi thao tác khóa/mở khóa thất bại.

**Trung bình; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** API lỗi mạng/400/403 có thể tạo promise bị từ chối mà không có thông báo tại màn hình; hộp thoại không giải thích nguyên nhân.

**Cách kiểm tra dự kiến:** Giả lập PATCH /admin/users/:id/status trả 500 hoặc 400 rồi xác nhận khóa/mở khóa.

**Hướng xử lý đề xuất:** Bắt lỗi, hiển thị thông báo phù hợp và giữ dữ liệu hiện tại để người dùng thử lại.

**Nguồn:** [handigo-web/src/features/admin/pages/AdminUsersPage.tsx:21 · update](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/admin/pages/AdminUsersPage.tsx:21>); [handigo-web/src/features/admin/pages/AdminUsersPage.tsx:31 · finally](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/admin/pages/AdminUsersPage.tsx:31>).

**Truy vết:** UC042 Lock/Unlock Account. Ca chức năng: BB-UC042-06. Sheet unit: UT092.

<a id="auth-05"></a>
#### AUTH-05 — Thông báo khôi phục mật khẩu cho phép phân biệt email có tài khoản.

**Trung bình; Cần xác minh; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Backend trả 404 khi không tồn tại; UI nói 'Nếu email tồn tại' nhưng lỗi API vẫn hiển thị, cho phép dò email. Chính sách sản phẩm chưa được cung cấp.

**Cách kiểm tra dự kiến:** Gửi forgot-password với hai email, một đã đăng ký và một chưa đăng ký, so sánh status và thông báo.

**Hướng xử lý đề xuất:** Xác nhận yêu cầu chống dò tài khoản; cân nhắc phản hồi trung lập thống nhất cùng rate limit.

**Nguồn:** [handigo-backend/src/services/auth.service.ts:608 · forgotPassword](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/auth.service.ts:608>); [handigo-web/src/features/auth/pages/ForgotPasswordPage.tsx:33 · requestOtp](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/auth/pages/ForgotPasswordPage.tsx:33>).

**Truy vết:** UC005 Forgot Password. Ca chức năng: BB-UC005-02. Sheet unit: UT013.

<a id="auth-06"></a>
#### AUTH-06 — Chính sách đổi mật khẩu tài khoản Facebook chưa đồng nhất với tài khoản Google.

**Trung bình; Cần xác minh; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Google bị chặn đổi mật khẩu, Facebook không bị chặn nhưng tài khoản mới có mật khẩu ngẫu nhiên nên không thể biết currentPassword; cần xác nhận luồng thiết lập mật khẩu mong muốn.

**Cách kiểm tra dự kiến:** Đăng nhập Facebook tạo tài khoản mới; mở đổi mật khẩu rồi gửi currentPassword bất kỳ; đối chiếu luồng quên mật khẩu.

**Hướng xử lý đề xuất:** Làm rõ tài khoản social có được tạo mật khẩu nội bộ qua khôi phục hay không và biểu diễn trạng thái tương ứng trên UI.

**Nguồn:** [handigo-backend/src/services/auth.service.ts:746 · changePassword](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/auth.service.ts:746>); [handigo-backend/src/services/auth.service.ts:558 · facebookLogin](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/auth.service.ts:558>).

**Truy vết:** UC003 Social Sign in.


### Đặt đơn và định vị

<a id="book-01"></a>
#### BOOK-01 — API urgent thiếu giờ tạo danh sách đơn rỗng

**Cao; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Validation cho phép urgent không scheduledAt; occurrenceDates rỗng; service trả undefined; controller có thể trả 201 thiếu data đơn.

**Cách kiểm tra dự kiến:** POST /orders bằng CUSTOMER hợp lệ với orderType=urgent, không scheduledAt; mock provider phù hợp; kiểm tra response và DB test.

**Hướng xử lý đề xuất:** Chốt hỗ trợ urgent; tạo một đơn như normal hoặc chặn tại validation; thêm ca hồi quy.

**Nguồn:** [handigo-backend/src/validations/order.validator.ts:35](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/validations/order.validator.ts:35>); [handigo-backend/src/services/order.service.ts:405](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/order.service.ts:405>); [handigo-backend/src/services/order.service.ts:482](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/order.service.ts:482>).

**Truy vết:** UC013 Booking Order. Ca chức năng: BB-UC013-08. Sheet unit: UT030.

<a id="book-02"></a>
#### BOOK-02 — Mô tả tối thiểu 10 ký tự ở web nhưng tùy chọn ở API

**Trung bình; Cần xác minh; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** API có thể tạo đơn với mô tả trống/ngắn trong khi web chặn.

**Cách kiểm tra dự kiến:** Dùng payload hợp lệ, bỏ problemDescription hoặc gửi abc; so sánh validation web.

**Hướng xử lý đề xuất:** Xác nhận quy tắc tối thiểu 10 ký tự có thuộc nghiệp vụ; đồng bộ backend/web nếu bắt buộc.

**Nguồn:** [handigo-web/src/features/booking/components/step2Helpers.ts:9](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/booking/components/step2Helpers.ts:9>); [handigo-web/src/features/booking/components/useCreateBookingStep2Form.ts:172](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/booking/components/useCreateBookingStep2Form.ts:172>); [handigo-backend/src/validations/order.validator.ts:43](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/validations/order.validator.ts:43>).

**Truy vết:** UC013 Booking Order.

<a id="book-03"></a>
#### BOOK-03 — URL ảnh trong tạo đơn không được ràng buộc với lượt tải đã kiểm tra

**Trung bình; Cần xác minh; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Có thể gửi URL bất kỳ đúng cú pháp, bỏ qua phân tích ảnh; purpose tùy chọn vì dùng chung tải ảnh nghiệm thu.

**Cách kiểm tra dự kiến:** POST /orders với URL ngoài hệ thống hoặc upload không purpose; dùng asset thử nghiệm.

**Hướng xử lý đề xuất:** Chốt bộ lọc ảnh sự cố có bắt buộc; nếu có, lưu asset ID/ownership và purpose thay vì tin URL.

**Nguồn:** [handigo-backend/src/validations/order.validator.ts:44](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/validations/order.validator.ts:44>); [handigo-backend/src/services/order.service.ts:453](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/order.service.ts:453>); [handigo-backend/src/middlewares/orderAttachmentUpload.middleware.ts:40](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/middlewares/orderAttachmentUpload.middleware.ts:40>).

**Truy vết:** UC014 Upload Problem Media. Ca chức năng: BB-UC014-06.

<a id="book-04"></a>
#### BOOK-04 — Problem Media chỉ có ảnh; chưa thấy video hoặc âm thanh

**Thấp; Thiếu chức năng; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Tên Media có thể bao hàm loại tệp chưa triển khai.

**Cách kiểm tra dự kiến:** Chọn video/mp4 hoặc audio vào luồng sự cố: bị từ chối.

**Hướng xử lý đề xuất:** Xác nhận phạm vi Media chỉ gồm ảnh; nếu cần video/audio phải bổ sung luồng trước nghiệm thu.

**Nguồn:** [handigo-backend/src/middlewares/orderAttachmentUpload.middleware.ts:12](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/middlewares/orderAttachmentUpload.middleware.ts:12>); [handigo-web/src/features/booking/components/step2Helpers.ts:110](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/booking/components/step2Helpers.ts:110>).

**Truy vết:** UC014 Upload Problem Media.

<a id="book-05"></a>
#### BOOK-05 — Nhận appointment chưa dùng khóa lịch và kiểm tra toàn bộ khoảng thời gian

**Cao; Cần xác minh; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Nhánh appointment kiểm tra scheduledAt ±60 phút, rồi cập nhật assignment/order tách biệt; nhánh dispatch mới dùng transaction/lockProviderSchedule/assertProviderSchedule. Rủi ro nhận 2 lịch đồng thời hoặc chồng thời lượng dài dù giờ bắt đầu cách >60 phút.

**Cách kiểm tra dự kiến:** DB test: hai appointment gửi cùng provider song song; hoặc lịch 09:00 kéo dài 180 phút và lịch 11:00. Kiểm tra assertProviderSchedule/khóa lịch có bảo vệ ở nơi khác trước khi kết luận lỗi runtime.

**Hướng xử lý đề xuất:** Chạy test cạnh tranh và lịch dài; nếu tái hiện, dùng cùng transaction và assertProviderSchedule ở appointment; xác minh buffer/travel/working calendar.

**Nguồn:** [handigo-backend/src/services/assignment.service.ts:336](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/assignment.service.ts:336>); [handigo-backend/src/services/assignment.service.ts:355](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/assignment.service.ts:355>); [handigo-backend/src/services/assignment.service.ts:468](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/assignment.service.ts:468>); [handigo-backend/src/services/assignment.service.ts:496](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/assignment.service.ts:496>).

**Truy vết:** UC016 Response Order Assigned. Ca chức năng: BB-UC016-06.

<a id="book-06"></a>
#### BOOK-06 — Chưa thấy danh sách toàn bộ đơn dành ADMIN

**Cao; Thiếu chức năng; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Use case ADMIN View Orders List chưa có UI/API liệt kê toàn bộ đơn được tìm thấy. GET /orders là CUSTOMER, /orders/provider là PROVIDER; /dashboard/orders trả thống kê tổng hợp.

**Cách kiểm tra dự kiến:** Đọc AdminRoutes và order.routes; đối chiếu getAdminOrders trả ordersByStatus/ordersByServiceCategory/ordersByMonth/totals, không trả danh sách đơn.

**Hướng xử lý đề xuất:** Chốt contract và yêu cầu ADMIN list (phân trang/lọc/search/quyền dữ liệu); bổ sung triển khai rồi mới thực thi 4 ca ADMIN đề xuất. Không thay bằng danh sách cá nhân.

**Nguồn:** [handigo-web/src/routes/admin-routes.tsx:26](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/routes/admin-routes.tsx:26>); [handigo-backend/src/routes/order.routes.ts:99](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/routes/order.routes.ts:99>); [handigo-backend/src/services/dashboard.service.ts:324](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/dashboard.service.ts:324>).

**Truy vết:** UC049 View Orders List. Ca chức năng: BB-UC049-01, BB-UC049-02, BB-UC049-03, BB-UC049-04.

<a id="book-07"></a>
#### BOOK-07 — Socket chuyển null hoặc chuỗi rỗng thành tọa độ 0

**Trung bình; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Number(null) và Number('') bằng 0; validation miền chấp nhận (0,0), GPS không có dữ liệu có thể đẩy marker tới tọa độ sai.

**Cách kiểm tra dự kiến:** Socket authenticated của provider đã gán đơn accepted; emit order:location:update với latitude=null,longitude=null; kiểm tra location DB test và ack.

**Hướng xử lý đề xuất:** Xác nhận kiểu và sự hiện diện tọa độ trước Number; thêm ca null/rỗng/NaN trong integration socket.

**Nguồn:** [handigo-backend/src/sockets/initSocket.ts:186](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/sockets/initSocket.ts:186>); [handigo-backend/src/services/orderTracking.service.ts:230](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/orderTracking.service.ts:230>).

**Truy vết:** UC026 Track Provider Location. Ca chức năng: BB-UC026-06.

<a id="book-08"></a>
#### BOOK-08 — Tracking không chọn addressSnapshot nên có thể dùng địa chỉ đã sửa

**Cao; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Order có snapshot địa chỉ lúc đặt nhưng getTrackingParticipants projection loại bỏ field này; route fallback đọc Address hiện tại. Chi tiết đơn/map và lộ trình API có thể khác điểm đến, ảnh hưởng di chuyển.

**Cách kiểm tra dự kiến:** Tạo đơn accepted có snapshot A; cập nhật Address sang B; GET tracking-route và đối chiếu điểm đến với snapshot A trong chi tiết.

**Hướng xử lý đề xuất:** Chọn addressSnapshot trong projection và dùng nhất quán cho tracking state/route; thêm ca địa chỉ sửa/xóa sau đặt.

**Nguồn:** [handigo-backend/src/services/orderTracking.service.ts:63](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/orderTracking.service.ts:63>); [handigo-backend/src/services/orderTracking.service.ts:131](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/orderTracking.service.ts:131>); [handigo-backend/src/services/orderTracking.service.ts:174](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/orderTracking.service.ts:174>); [handigo-backend/src/utils/orderAddress.ts:4](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/utils/orderAddress.ts:4>).

**Truy vết:** UC027 View Provider Location. Ca chức năng: BB-UC027-05. Sheet unit: UT067.

<a id="book-09"></a>
#### BOOK-09 — Danh sách đơn provider và recent thiếu lọc soft delete

**Trung bình; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Order isDeleted=true vẫn có thể được trả ở danh sách provider/recent, trong khi detail chỉ lấy isDeleted=false và trả 404.

**Cách kiểm tra dự kiến:** DB test thêm order providerId=P1/isDeleted=true; GET /orders/provider và /orders/provider/recent bằng P1; kiểm tra item/count.

**Hướng xử lý đề xuất:** Đồng bộ isDeleted=false trong query list/count/recent và pending assignment tham chiếu; thêm ca soft delete.

**Nguồn:** [handigo-backend/src/services/order.service.ts:800](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/order.service.ts:800>); [handigo-backend/src/services/order.service.ts:832](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/order.service.ts:832>); [handigo-backend/src/services/order.service.ts:894](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/order.service.ts:894>).

**Truy vết:** UC049 View Orders List. Ca chức năng: BB-UC049-06. Sheet unit: UT103.


### Thanh toán, ví và hoàn tiền

<a id="fin-01"></a>
#### FIN-01 — Lọc voucher theo trạng thái mà không nhập tìm kiếm tạo $or rỗng

**Trung bình; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** MongoDB từ chối điều kiện $or: []; bộ lọc ACTIVE/INACTIVE/EXPIRED trên trang voucher có thể trả lỗi thay vì danh sách.

**Cách kiểm tra dự kiến:** ADMIN gọi GET /vouchers?status=ACTIVE&page=1&limit=10 và không gửi search. getAdminVouchers gán filter.$or=[] rồi truyền vào Voucher.find và Promotion.find.

**Hướng xử lý đề xuất:** Chỉ giữ $or khi có ít nhất một điều kiện tìm kiếm; bổ sung kiểm thử tích hợp filter chỉ có status.

**Nguồn:** [handigo-backend/src/services/voucher.service.ts:627](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/voucher.service.ts:627>); [handigo-backend/src/services/voucherStore.service.ts:19](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/voucherStore.service.ts:19>).

**Truy vết:** UC053 View Vouchers. Ca chức năng: BB-UC053-03. Sheet unit: UT108.

<a id="fin-02"></a>
#### FIN-02 — Duyệt rút tiền ghi thành công nhưng chưa thấy chuyển khoản hoặc bằng chứng chi tiền

**Cao; Cần xác minh; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** approveWithdrawal trừ pendingBalance và ghi giao dịch withdraw success, trong khi không gọi cổng chuyển tiền. Nếu không có quy trình chuyển khoản thủ công, người dùng bị ghi đã rút mà ngân hàng chưa nhận.

**Cách kiểm tra dự kiến:** Tạo yêu cầu 100.000 VND, ADMIN duyệt; kiểm tra ngân hàng sandbox và trace service: chỉ có cập nhật MongoDB và thông báo.

**Hướng xử lý đề xuất:** Xác nhận admin chuyển khoản thủ công trước khi duyệt hay phải tích hợp payout. Nếu thủ công, cần lưu bằng chứng/mã đối soát và quy trình xử lý lỗi.

**Nguồn:** [handigo-backend/src/services/withdrawal.service.ts:212](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/withdrawal.service.ts:212>); [handigo-backend/src/services/withdrawal.service.ts:260](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/withdrawal.service.ts:260>).

**Truy vết:** UC051 Approve Withdrawals. Ca chức năng: BB-UC051-01. Sheet unit: UT105.

**Đã thống nhất với người dùng:** giữ vấn đề chuyển khoản/chi tiền để xử lý sau. Không tự chọn thủ công hay tự động.

<a id="fin-03"></a>
#### FIN-03 — API rút tiền chấp nhận số tiền có phần thập phân

**Trung bình; Cần xác minh; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** amount chỉ phải dương; khi cấu hình MIN_WITHDRAW_AMOUNT=0, 1.5 VND có thể được trừ/giữ và ghi yêu cầu. UI loại ký tự không phải chữ số, nên API và UI khác nhau.

**Cách kiểm tra dự kiến:** Trong DB test, cấu hình min=0, max=50.000.000; ví 1.000 VND, ngân hàng active; POST /withdrawals {amount:1.5}.

**Hướng xử lý đề xuất:** Xác nhận quy tắc đơn vị VND; nếu yêu cầu số nguyên thì thêm .int() và kiểm thử biên cho API.

**Nguồn:** [handigo-backend/src/validations/withdrawal.validator.ts:13](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/validations/withdrawal.validator.ts:13>); [handigo-backend/src/models/withdrawRequest.model.ts:20](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/models/withdrawRequest.model.ts:20>).

**Truy vết:** UC034 Request Withdraw. Ca chức năng: BB-UC034-05.

<a id="fin-04"></a>
#### FIN-04 — Lịch sử và danh sách payment theo đơn chưa lọc dữ liệu xóa mềm

**Trung bình; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Payment isDeleted=true vẫn có thể xuất hiện ở /payments/history và /payments/order/:id, không nhất quán với getPaymentById và báo cáo doanh thu.

**Cách kiểm tra dự kiến:** DB test có payment cùng customer/order với isDeleted=true. Gọi history hoặc danh sách theo đơn và quan sát điều kiện query không có isDeleted:false.

**Hướng xử lý đề xuất:** Bổ sung điều kiện xóa mềm cho các truy vấn Payment và kiểm thử không lộ bản ghi đã xóa.

**Nguồn:** [handigo-backend/src/services/payment.service.ts:1165](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/payment.service.ts:1165>); [handigo-backend/src/services/payment.service.ts:1179](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/payment.service.ts:1179>).

**Truy vết:** UC019 View Payment History. Ca chức năng: BB-UC019-05. Sheet unit: UT048.

<a id="fin-05"></a>
#### FIN-05 — Báo cáo dòng tiền qua hệ thống bao gồm payment tiền mặt

**Trung bình; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** UI mô tả dòng tiền không bao gồm tiền mặt, nhưng collectedPaymentMatch không lọc method; cash hoàn tất được đánh paid và cộng vào collectedPaymentRevenue/collectedPaymentByDay.

**Cách kiểm tra dự kiến:** Một payment cash paid 200.000 và một payos paid 300.000 trong kỳ. Báo cáo hiện cộng collected=500.000 mặc dù nhãn dòng tiền qua hệ thống chỉ nên là 300.000 nếu giữ định nghĩa trên UI.

**Hướng xử lý đề xuất:** Thống nhất định nghĩa khoản thu: lọc cash khỏi nhóm dòng tiền online hoặc đổi nhãn. Tách GMV tiền mặt khỏi dòng tiền cổng/ví.

**Nguồn:** [handigo-backend/src/services/dashboard.service.ts:238](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/dashboard.service.ts:238>); [handigo-backend/src/services/dashboard.service.ts:288](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/dashboard.service.ts:288>); [handigo-backend/src/services/order.service.ts:1148](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/order.service.ts:1148>); [handigo-web/src/features/admin/pages/AdminRevenuePage.tsx:91](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/admin/pages/AdminRevenuePage.tsx:91>).

**Truy vết:** UC062 View Revenue Reports. Ca chức năng: BB-UC062-04. Sheet unit: UT117.

<a id="fin-06"></a>
#### FIN-06 — Chưa thấy yêu cầu hoàn tiền độc lập và màn hình admin phản hồi yêu cầu hoàn

**Trung bình; Thiếu chức năng; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Hai use case Request A Refund/Response Refund Request chỉ có thể ánh xạ một phần sang hủy đơn và retry hoàn PayOS. Chưa có route/UI gửi yêu cầu hoàn độc lập, duyệt/từ chối theo request.

**Cách kiểm tra dự kiến:** Đối chiếu toàn bộ routes payment/order, web booking/admin payments: có cancellation-preview/cancel và refund/retry; không tìm thấy submit/approve/reject refund request.

**Hướng xử lý đề xuất:** Xác nhận tài liệu use case có coi hủy đơn là yêu cầu hoàn hay cần chức năng riêng; ghi trạng thái một phần cho đến khi thống nhất.

**Nguồn:** [handigo-backend/src/routes/order.routes.ts:183](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/routes/order.routes.ts:183>); [handigo-backend/src/routes/payment.routes.ts:37](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/routes/payment.routes.ts:37>); [handigo-backend/src/services/orderCancellation.service.ts:1695](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/orderCancellation.service.ts:1695>).

**Truy vết:** UC057 Request A Refund; UC058 Response Refund Request. Ca chức năng: BB-UC057-01, BB-UC057-02, BB-UC057-03, BB-UC057-04, BB-UC058-01, BB-UC058-02, BB-UC058-03, BB-UC058-04.

**Đã thống nhất với người dùng:** hai use case yêu cầu hoàn tiền và phản hồi yêu cầu hoàn tiền được ghi để xử lý sau. Luồng hủy đơn/hoàn tiền hiện tại chỉ được dùng làm nguồn tham chiếu.

<a id="fin-07"></a>
#### FIN-07 — Nhóm ngày/tháng doanh thu dùng UTC, khoảng lọc ngày dựa múi giờ server

**Thấp; Cần xác minh; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** $dateToString không có timezone mặc định nhóm theo UTC, trong khi web dùng ngày local và validator setHours theo múi giờ runtime. Khoản thu lúc 00:30 Asia/Ho_Chi_Minh có thể hiển thị ngày trước.

**Cách kiểm tra dự kiến:** Fixture giao dịch createdAt=2026-10-08T00:30:00+07:00; GET /dashboards/earnings kỳ 08/10; so sánh day=2026-10-07 khi nhóm UTC với ngày 08/10 mong muốn cho người dùng VN.

**Hướng xử lý đề xuất:** Chốt múi giờ nghiệp vụ; áp dụng timezone nhất quán khi parse ngày và aggregate.

**Nguồn:** [handigo-backend/src/services/dashboard.service.ts:45](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/dashboard.service.ts:45>); [handigo-backend/src/validations/dashboard.validator.ts:7](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/validations/dashboard.validator.ts:7>); [handigo-web/src/features/provider/components/home/providerHome.utils.ts:11](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/provider/components/home/providerHome.utils.ts:11>).

**Truy vết:** UC032 View Revenue Analytics; UC062 View Revenue Reports. Ca chức năng: BB-UC032-05.

<a id="fin-08"></a>
#### FIN-08 — Từ chối rút tiền cập nhật ví nhưng không tạo bản ghi withdraw_rejected

**Thấp; Cần xác minh; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** balance được phục hồi từ pending, request ghi rejected, nhưng lịch sử WalletTransaction không có sự kiện hoàn rút dù UI/types có withdraw_rejected. Chưa rõ đây là yêu cầu sổ cái hay chỉ theo dõi request.

**Cách kiểm tra dự kiến:** Ví sau đặt rút balance=400.000, pending=100.000; admin reject; ví thành 500.000/0, request rejected nhưng không thêm WalletTransaction.

**Hướng xử lý đề xuất:** Thống nhất yêu cầu audit/sổ cái. Nếu cần, thêm bản ghi giải phóng khoản giữ phù hợp mà không đếm hai lần số dư.

**Nguồn:** [handigo-backend/src/services/withdrawal.service.ts:301](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/withdrawal.service.ts:301>); [handigo-web/src/features/wallet/components/wallet-formatters.ts:30](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/wallet/components/wallet-formatters.ts:30>).

**Truy vết:** UC056 Reject Withdrawals. Ca chức năng: BB-UC056-01. Sheet unit: UT111.

<a id="fin-09"></a>
#### FIN-09 — Không áp lại cùng voucher trên cùng đơn sau khi gỡ

**Trung bình; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Gỡ mã đổi VoucherUsage thành restored nhưng giữ document có unique(voucherId,orderId). Áp lại tạo document mới cùng cặp, gặp duplicate key11000 và trả409 mặc dù voucher còn lượt.

**Cách kiểm tra dự kiến:** Đơn created/unpaid chưa có payment: apply HANDIGO10 thành công, remove, rồi apply lại HANDIGO10 trên cùng orderId. Bản ghi restored cũ vẫn tồn tại và vi phạm unique index ở create.

**Hướng xử lý đề xuất:** Tái sử dụng/đổi trạng thái bản ghi restored một cách nguyên tử thay vì tạo cặp trùng; kiểm thử apply→remove→apply và không giữ lượt thừa.

**Nguồn:** [handigo-backend/src/services/voucher.service.ts:199](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/voucher.service.ts:199>); [handigo-backend/src/services/voucher.service.ts:192](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/voucher.service.ts:192>); [handigo-backend/src/models/voucherUsage.model.ts:33](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/models/voucherUsage.model.ts:33>).

**Truy vết:** UC018 Apply Promote. Ca chức năng: BB-UC018-09.


### Dịch vụ, danh mục và đề xuất

<a id="cat-01"></a>
#### CAT-01 — Có thể kích hoạt dịch vụ giá linh hoạt khi chưa có tiền đặt cọc

**Cao; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Dịch vụ do duyệt đề xuất tạo inactive với depositAmount=null có thể được kích hoạt qua API, trái quy tắc được áp dụng khi tạo/đổi giá và có thể gây lỗi ở luồng đặt dịch vụ.

**Cách kiểm tra dự kiến:** Fixture service variable_price,isActive=false,depositAmount=null thuộc category active; ADMIN PATCH /services/{id} với {isActive:true}. Hàm update chỉ gọi normalizeAndValidatePricing nếu field giá thay đổi nên save active+cọc null.

**Hướng xử lý đề xuất:** Kiểm tra pricing trên nextData khi thay đổi trạng thái active và bổ sung test chuyển trạng thái. Chưa chạy API/database thực; finding dựa trên nhánh code.

**Nguồn:** [handigo-backend/src/services/service.service.ts:330](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/service.service.ts:330>); [handigo-backend/src/validations/service.validator.ts:58](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/validations/service.validator.ts:58>); [handigo-backend/src/services/serviceSuggestion.service.ts:204](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/serviceSuggestion.service.ts:204>).

**Truy vết:** UC039 Update Service. Ca chức năng: BB-UC039-05. Sheet unit: UT087.

<a id="cat-02"></a>
#### CAT-02 — Danh sách customer bỏ sót dịch vụ sau 100 bản ghi đầu

**Cao; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Tìm/lọc trên trang danh sách không tìm được service active ở các trang sau, dù tổng dữ liệu API lớn hơn100. Số lượng dịch vụ và bộ đếm theo category cũng thiếu.

**Cách kiểm tra dự kiến:** Fixture101 service active; target tên duy nhất ở trang2 theo createdAt; mở customer/services và tìm target. Hook chỉ setServices(serviceData.items) của page1.

**Hướng xử lý đề xuất:** Dùng phân trang/tìm kiếm phía server hoặc tải đầy đủ các trang theo contract hiện có; thêm dataset>100 trong nghiệm thu.

**Nguồn:** [handigo-web/src/features/customer-service/api/serviceCatalog.api.ts:22](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/customer-service/api/serviceCatalog.api.ts:22>); [handigo-web/src/features/customer-service/hooks/useServiceCatalog.ts:64](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/customer-service/hooks/useServiceCatalog.ts:64>); [handigo-web/src/features/customer-service/hooks/useServiceCatalog.ts:90](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/customer-service/hooks/useServiceCatalog.ts:90>).

**Truy vết:** UC009 Search Service. Ca chức năng: BB-UC009-05.

<a id="cat-03"></a>
#### CAT-03 — Danh mục tạm ngừng nhưng dịch vụ con active vẫn xuất hiện ở danh sách customer

**Trung bình; Cần xác minh; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** UI category filter không có category tạm ngừng nhưng services vẫn có thể hiển thị; /active-with-services và danh sách customer áp dụng quy tắc khác nhau.

**Cách kiểm tra dự kiến:** ADMIN PATCH category {isActive:false} đang chứa service active; tải /categories/active và /services?isActive=true rồi mở danh sách customer; category biến mất nhưng service không bị lọc theo trạng thái category.

**Hướng xử lý đề xuất:** Xác nhận yêu cầu: tạm ngừng category có cần ẩn/chặn đặt toàn bộ service con hay không. Nếu có, đồng bộ filter ở service list/search hoặc quy trình cập nhật trạng thái. Hiện trạng quan sát qua code, chưa chạy UI.

**Nguồn:** [handigo-backend/src/services/category.service.ts:155](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/category.service.ts:155>); [handigo-backend/src/services/service.service.ts:140](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/service.service.ts:140>); [handigo-web/src/features/customer-service/hooks/useServiceCatalog.ts:93](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/customer-service/hooks/useServiceCatalog.ts:93>); [handigo-web/src/features/customer-service/api/serviceCatalog.api.ts:22](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/customer-service/api/serviceCatalog.api.ts:22>).

**Truy vết:** UC009 Search Service; UC010 Filter Service; UC046 Update Service Category. Ca chức năng: BB-UC010-05, BB-UC046-05. Sheet unit: UT023, UT099.

<a id="cat-04"></a>
#### CAT-04 — Xóa dịch vụ và tắt tùy chọn không được ghi nguyên tử

**Trung bình; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Khi ServiceOption.updateMany lỗi sau service.save, API báo lỗi nhưng service đã xóa mềm; tùy chọn có thể vẫn active trong database. Lặp lại DELETE trả404 nên không tự hoàn thành bước thứ hai.

**Cách kiểm tra dự kiến:** Unit/integration fixture: doc.save resolve; ServiceOption.updateMany reject. Kiểm tra service đã isDeleted=true và options chưa cập nhật.

**Hướng xử lý đề xuất:** Dùng transaction phù hợp hoặc cơ chế xử lý lại idempotent để hoàn tất tắt options; thêm test lỗi ở bước ghi thứ hai.

**Nguồn:** [handigo-backend/src/services/service.service.ts:357](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/service.service.ts:357>); [handigo-backend/src/services/service.service.ts:358](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/service.service.ts:358>).

**Truy vết:** UC040 Delete Service. Ca chức năng: BB-UC040-05. Sheet unit: UT088.

<a id="cat-05"></a>
#### CAT-05 — Duyệt đề xuất có thể tạo tài nguyên catalog nhưng không lưu được liên kết đề xuất

**Trung bình; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Nếu ghi suggestion lỗi sau createService/createCategory, tài nguyên mới còn tồn tại nhưng suggestion chưa approved hoặc chưa gắn ID. Duyệt lại có thể gặp slug409 hoặc tạo tình trạng xử lý dở.

**Cách kiểm tra dự kiến:** Mock catalog create thành công, ServiceSuggestion.findByIdAndUpdate().lean() reject. Kiểm tra tài nguyên mới chưa có tham chiếu trong suggestion.

**Hướng xử lý đề xuất:** Bảo đảm chuỗi auto-create+update được transaction/khôi phục có kiểm soát; test nhánh fail giữa các bước. Chưa thực hiện fail database thật.

**Nguồn:** [handigo-backend/src/services/serviceSuggestion.service.ts:204](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/serviceSuggestion.service.ts:204>); [handigo-backend/src/services/serviceSuggestion.service.ts:223](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/serviceSuggestion.service.ts:223>); [handigo-backend/src/services/serviceSuggestion.service.ts:233](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/serviceSuggestion.service.ts:233>).

**Truy vết:** UC050 Review Service Suggestion. Ca chức năng: BB-UC050-08. Sheet unit: UT104.

<a id="cat-06"></a>
#### CAT-06 — Màn hình admin đề xuất chỉ xem được 100 bản ghi đầu

**Trung bình; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Admin không thể xem/xử lý các đề xuất khớp filter ở trang2 qua màn hình hiện tại; selector category dùng limit200 nhưng backend clamp100 cũng có thể thiếu category để duyệt.

**Cách kiểm tra dự kiến:** Tạo101 suggestions pending; mở trang pending; target cũ nhất chỉ tồn tại trong API page2 nhưng UI không có điều khiển pagination.

**Hướng xử lý đề xuất:** Dùng pagination từ total/page/limit của serviceSuggestionApi và tải selector category đủ trang; thêm dữ liệu>100 cho test UI.

**Nguồn:** [handigo-web/src/features/service-suggestion/pages/AdminServiceSuggestionsPage.tsx:40](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/service-suggestion/pages/AdminServiceSuggestionsPage.tsx:40>); [handigo-web/src/features/service-suggestion/pages/AdminServiceSuggestionsPage.tsx:146](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/service-suggestion/pages/AdminServiceSuggestionsPage.tsx:146>).

**Truy vết:** UC050 Review Service Suggestion. Ca chức năng: BB-UC050-06.

<a id="cat-07"></a>
#### CAT-07 — Nút Lưu ghi chú đổi trạng thái đề xuất đã duyệt hoặc từ chối về pending

**Trung bình; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Chỉ chỉnh ghi chú có thể khiến đề xuất approved/rejected quay về hàng chờ xử lý, trong khi linked service/category vẫn được giữ.

**Cách kiểm tra dự kiến:** Lọc approved, mở xử lý một đề xuất đã duyệt, sửa ghi chú và bấm Lưu ghi chú. Modal gọi onSubmit('pending'); payload status pending được backend chấp nhận.

**Hướng xử lý đề xuất:** Giữ status hiện tại khi chỉ lưu note hoặc bỏ field status cho thao tác lưu ghi chú; tách test thay đổi status khỏi test sửa note.

**Nguồn:** [handigo-web/src/features/service-suggestion/components/ServiceSuggestionReviewModal.tsx:111](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/service-suggestion/components/ServiceSuggestionReviewModal.tsx:111>); [handigo-web/src/features/service-suggestion/pages/AdminServiceSuggestionsPage.tsx:88](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/service-suggestion/pages/AdminServiceSuggestionsPage.tsx:88>); [handigo-backend/src/services/serviceSuggestion.service.ts:132](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/serviceSuggestion.service.ts:132>).

**Truy vết:** UC050 Review Service Suggestion. Ca chức năng: BB-UC050-07.

<a id="cat-08"></a>
#### CAT-08 — Gợi ý danh mục mới trên web chỉ tạo đề xuất loại service

**Thấp; Cần xác minh; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Tên category mới được lưu suggestedCategoryName nhưng approve service vẫn yêu cầu category có sẵn. Chưa có luồng tự tạo category từ field này trong xử lý service suggestion; admin có thể cần tạo category thủ công trước.

**Cách kiểm tra dự kiến:** PROVIDER chọn 'Gợi ý danh mục mới', nhập categoryName và serviceName rồi gửi; ADMIN approve khi categoryId chưa có nhận400.

**Hướng xử lý đề xuất:** Xác nhận workflow mong muốn: admin tự tạo category rồi gán, hay tạo đề xuất category riêng. Tài liệu cần ghi rõ thao tác hiện có, không giả định hệ thống tự tạo cả category và service.

**Nguồn:** [handigo-web/src/features/service-suggestion/pages/ProviderServiceSuggestionPage.tsx:75](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/service-suggestion/pages/ProviderServiceSuggestionPage.tsx:75>); [handigo-backend/src/services/serviceSuggestion.service.ts:200](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/serviceSuggestion.service.ts:200>); [handigo-web/src/features/service-suggestion/components/ServiceSuggestionReviewModal.tsx:58](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/service-suggestion/components/ServiceSuggestionReviewModal.tsx:58>).

**Truy vết:** UC037 Suggest New Service. Ca chức năng: BB-UC037-05.


### Trao đổi, hệ thống và phân tích

<a id="com-01"></a>
#### COM-01 — Nhóm nhận ALL gửi cho ADMIN dù nhãn chỉ nêu khách hàng và nhà cung cấp

**Trung bình; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Quản trị viên cũng nhận thông báo của nhóm ALL; sentCount lớn hơn số khách hàng và provider mà giao diện mô tả.

**Cách kiểm tra dự kiến:** Tạo 1 CUSTOMER, 1 PROVIDER, 1 ADMIN đều isDeleted=false; ADMIN gửi targetRole=ALL. Service chỉ lọc isDeleted=false nên tạo 3 thông báo.

**Hướng xử lý đề xuất:** Xác nhận phạm vi ALL với chủ nghiệp vụ, sau đó đồng bộ nhãn hoặc bộ lọc role. Báo cáo kiểm thử hiện ghi hành vi code là bao gồm ADMIN.

**Nguồn:** [handigo-backend/src/services/notification.service.ts:243](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/notification.service.ts:243>); [handigo-web/src/features/notification/components/SendNotificationModal.tsx:46](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/notification/components/SendNotificationModal.tsx:46>).

**Truy vết:** UC025 Send System Notifications. Ca chức năng: BB-UC025-02. Sheet unit: UT063.

<a id="com-02"></a>
#### COM-02 — Mở thông báo của người khác trong lịch sử quản trị gọi API đánh dấu đã đọc của chính ADMIN

**Trung bình; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** ADMIN bấm một thông báo chưa đọc của CUSTOMER/PROVIDER nhận lỗi 404 dù bản ghi tồn tại; thông báo lỗi gây hiểu nhầm khi xem lịch sử.

**Cách kiểm tra dự kiến:** ADMIN mở /admin/notifications, bấm bản ghi chưa đọc có userId khác ADMIN. openNotification luôn await markOne; backend chỉ tìm _id kết hợp userId của người gọi.

**Hướng xử lý đề xuất:** Ở màn hình lịch sử ADMIN, điều hướng hoặc xem nội dung mà không gọi thao tác đánh dấu đọc của người nhận khác. Không nới ownership của API cá nhân.

**Nguồn:** [handigo-web/src/features/notification/pages/NotificationsPage.tsx:50](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/notification/pages/NotificationsPage.tsx:50>); [handigo-web/src/features/notification/components/use-notifications-page.ts:85](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/notification/components/use-notifications-page.ts:85>); [handigo-backend/src/services/notification.service.ts:197](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/notification.service.ts:197>).

**Truy vết:** UC063 View Notification History. Ca chức năng: BB-UC063-05.

<a id="com-03"></a>
#### COM-03 — Thay đổi cấu hình đã được ghi trước khi audit log thành công

**Cao; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** AuditLog.create thất bại làm API báo lỗi nhưng cấu hình đã thay đổi; người dùng có thể thử lại và không có dấu vết kiểm toán đầy đủ.

**Cách kiểm tra dự kiến:** Mock collection.updateOne thành công và AuditLog.create reject. Gọi updateConfig: promise reject, dữ liệu mới đã ở collection; luồng create có cùng thứ tự.

**Hướng xử lý đề xuất:** Dùng giao dịch phù hợp hoặc cơ chế ghi audit đáng tin cậy có xử lý kết quả rõ ràng để tránh lỗi trả về che một thay đổi đã lưu.

**Nguồn:** [handigo-backend/src/services/systemConfig.service.ts:254](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/systemConfig.service.ts:254>); [handigo-backend/src/services/systemConfig.service.ts:263](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/systemConfig.service.ts:263>); [handigo-backend/src/services/systemConfig.service.ts:206](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/systemConfig.service.ts:206>); [handigo-backend/src/services/systemConfig.service.ts:213](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/systemConfig.service.ts:213>).

**Truy vết:** UC060 Update System Configuration. Ca chức năng: BB-UC060-06. Sheet unit: UT114.

<a id="com-04"></a>
#### COM-04 — Cấu hình ngoài danh mục cố định bị ẩn khỏi trang quản trị

**Trung bình; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** API cho tạo key hợp lệ tùy ý nhưng UI chỉ map configDefinitions; quản trị viên không thấy hoặc sửa được key mới qua màn hình.

**Cách kiểm tra dự kiến:** Qua API ADMIN tạo TEST_CUSTOM_KEY, type=STRING, value='Giá trị kiểm thử'; GET /system-configs trả key này, trang /admin/system-configs không hiện.

**Hướng xử lý đề xuất:** Hiển thị thêm các key chưa có định nghĩa hoặc giới hạn rõ danh mục key được hỗ trợ nếu đó là quyết định nghiệp vụ.

**Nguồn:** [handigo-web/src/features/admin/components/system-configs/system-config-format.ts:58](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/admin/components/system-configs/system-config-format.ts:58>); [handigo-web/src/features/admin/pages/AdminSystemConfigsPage.tsx:45](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/admin/pages/AdminSystemConfigsPage.tsx:45>); [handigo-backend/src/validations/systemConfig.validator.ts:23](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/validations/systemConfig.validator.ts:23>).

**Truy vết:** UC059 View System Configurations. Ca chức năng: BB-UC059-05. Sheet unit: UT113.

<a id="com-05"></a>
#### COM-05 — Một số cấu hình lưu được nhưng chưa được nối vào hành vi hệ thống

**Trung bình; Thiếu chức năng; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** MAINTENANCE_MODE và NOTIFICATION_DEFAULT_DATA được đánh dấu isEffective=false; HOTLINE_PHONE/SUPPORT_EMAIL cũng chưa được web đọc nên thay đổi cấu hình chưa thay đổi màn hình hỗ trợ.

**Cách kiểm tra dự kiến:** Lưu MAINTENANCE_MODE=true hoặc đổi HOTLINE_PHONE; UI cấu hình báo lưu thành công, chưa có middleware bảo trì và SupportChannels vẫn dùng supportData tĩnh.

**Hướng xử lý đề xuất:** Hoàn thiện các điểm tiêu thụ cấu hình theo phạm vi sản phẩm, hoặc mô tả trạng thái chưa hoạt động rõ ràng trong kiểm thử và vận hành.

**Nguồn:** [handigo-web/src/features/admin/components/system-configs/config-catalog.ts:192](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/admin/components/system-configs/config-catalog.ts:192>); [handigo-web/src/features/admin/components/system-configs/config-catalog.ts:205](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/admin/components/system-configs/config-catalog.ts:205>); [handigo-web/src/features/content/data/supportData.ts:33](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/content/data/supportData.ts:33>).

**Truy vết:** UC060 Update System Configuration. Ca chức năng: BB-UC060-07.

<a id="com-06"></a>
#### COM-06 — Chưa có quản trị nội dung Giới thiệu và FAQ theo phạm vi người dùng xác nhận

**Trung bình; Thiếu chức năng; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Use case được người dùng xác nhận gồm Tin tức, Giới thiệu và FAQ; code mới có CMS tin tức, About/FAQ vẫn tĩnh nên chưa hoàn thành toàn bộ phạm vi.

**Cách kiểm tra dự kiến:** Xem admin routes và AdminNewsPage: chỉ quản lý tin tức; About/FAQ đọc các mảng dữ liệu tĩnh.

**Hướng xử lý đề xuất:** Bổ sung quản trị và API cho Giới thiệu/FAQ theo yêu cầu đã xác nhận; giữ kiểm thử tin tức riêng và ghi hai phần còn thiếu chưa kiểm thử chức năng.

**Nguồn:** [handigo-web/src/features/admin/pages/AdminNewsPage.tsx:21](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/admin/pages/AdminNewsPage.tsx:21>); [handigo-web/src/features/content/data/aboutData.ts:2](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/content/data/aboutData.ts:2>); [handigo-web/src/features/content/data/support-faq.ts:1](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/content/data/support-faq.ts:1>).

**Truy vết:** UC048 Update System Content. Ca chức năng: BB-UC048-06.

**Đã thống nhất với người dùng:** quản trị cả Tin tức, Giới thiệu và FAQ. Kiểm thử tin tức không đại diện cho toàn bộ use case.

<a id="com-07"></a>
#### COM-07 — Kiểm tra khiếu nại trùng và tạo mới không bảo vệ yêu cầu đồng thời

**Cao; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Hai yêu cầu tạo khiếu nại cho cùng orderId và complainantId có thể cùng vượt findOne rồi tạo hai bản ghi, trái với thông báo chỉ một khiếu nại mỗi đơn.

**Cách kiểm tra dự kiến:** Gửi đồng thời hai POST /complaints giống nhau với đơn completed trong hạn. Cho cả hai findOne trả null trước Complaint.create; index hiện tại không unique.

**Hướng xử lý đề xuất:** Thêm cơ chế đồng thời phù hợp và ràng buộc duy nhất với soft delete, kiểm tra dữ liệu trùng trước khi triển khai migration/index.

**Nguồn:** [handigo-backend/src/services/complaint.service.ts:135](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/complaint.service.ts:135>); [handigo-backend/src/services/complaint.service.ts:159](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/complaint.service.ts:159>); [handigo-backend/src/models/complaint.model.ts:61](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/models/complaint.model.ts:61>).

**Truy vết:** UC022 Complaint. Ca chức năng: BB-UC022-05.

<a id="com-08"></a>
#### COM-08 — Một bản ghi thông báo có thể phát notification:new hai lần

**Trung bình; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** createNotificationRecord với emitRealtime=true và deferRealtime không bật phát một lần trong post-save, thêm một lần sau create. Badge chưa đọc tăng theo mỗi event nên có thể cao hơn số bản ghi.

**Cách kiểm tra dự kiến:** Theo dõi socket của người nhận, gọi createNotificationRecord(input,{emitRealtime:true}) hoặc luồng thông báo đơn quá hạn; so sánh 1 bản ghi DB với 2 notification:new.

**Hướng xử lý đề xuất:** Chọn một nơi phát realtime cho mỗi cách tạo bản ghi; UI nên chống trùng theo id trước khi tăng số chưa đọc.

**Nguồn:** [handigo-backend/src/services/notification.service.ts:96](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/notification.service.ts:96>); [handigo-backend/src/models/notification.model.ts:56](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/models/notification.model.ts:56>); [handigo-backend/src/services/dispatch.service.ts:723](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/dispatch.service.ts:723>); [handigo-web/src/components/common/notification-bell/useNotificationFeed.ts:94](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/components/common/notification-bell/useNotificationFeed.ts:94>).

**Truy vết:** UC064 Review Personal Notifications. Ca chức năng: BB-UC064-06.

<a id="com-09"></a>
#### COM-09 — Danh sách đơn chọn khi tạo khiếu nại chỉ tải tối đa 50 đơn đầu

**Trung bình; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Đơn completed còn trong hạn có thể không hiện nếu bị đẩy ra ngoài 50 đơn đầu; provider không có nhánh tải requestedOrderId bổ sung giống customer.

**Cách kiểm tra dự kiến:** Tài khoản có hơn 50 đơn, đơn completed cần khiếu nại không trong trang đầu; mở Trung tâm hỗ trợ → Tạo khiếu nại, kiểm tra lựa chọn đơn.

**Hướng xử lý đề xuất:** Có tìm kiếm/phân trang đơn đủ điều kiện, hoặc tải đầy đủ đơn được chọn bằng deep link cho cả hai role.

**Nguồn:** [handigo-web/src/features/case-management/pages/CaseManagementPage.tsx:82](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/case-management/pages/CaseManagementPage.tsx:82>); [handigo-web/src/features/case-management/components/CreateCaseModal.tsx:59](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/case-management/components/CreateCaseModal.tsx:59>).

**Truy vết:** UC022 Complaint. Ca chức năng: BB-UC022-08.

<a id="com-10"></a>
#### COM-10 — Dashboard chuẩn hóa ngày theo múi giờ host thay vì múi giờ nghiệp vụ cố định

**Trung bình; Cần xác minh; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** new Date chuỗi ngày kết hợp setHours và $dateToString không timezone có thể làm dữ liệu biên ngày khác nhau giữa host UTC và Asia/Saigon.

**Cách kiểm tra dự kiến:** Chuẩn bị bản ghi lúc 2026-10-07T17:30:00Z (00:30 ngày 08/10 tại Việt Nam); so sánh lọc 2026-10-08 và nhóm ngày trên hai môi trường TZ khác nhau.

**Hướng xử lý đề xuất:** Chốt múi giờ nghiệp vụ và chuẩn hóa cả lọc ngày lẫn grouping; chưa khẳng định môi trường triển khai hiện tại sai khi chưa xác minh TZ.

**Nguồn:** [handigo-backend/src/validations/dashboard.validator.ts:7](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/validations/dashboard.validator.ts:7>); [handigo-backend/src/validations/dashboard.validator.ts:13](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/validations/dashboard.validator.ts:13>); [handigo-backend/src/services/dashboard.service.ts:45](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/dashboard.service.ts:45>).

**Truy vết:** UC061 View System Dashboard. Ca chức năng: BB-UC061-02.

<a id="com-20"></a>
#### COM-20 — Modal phản hồi ở trang danh sách provider không bắt và hiển thị lỗi gửi

**Trung bình; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Nếu feedbackService.reply reject, submitReply chỉ finally nên lỗi không được đưa vào thông báo UI; người dùng không biết lý do lưu thất bại.

**Cách kiểm tra dự kiến:** Mock feedbackService.reply trả promise reject; mở modal phản hồi, nhập nội dung và bấm Lưu. Saving trở false nhưng không có thông báo lỗi thao tác.

**Hướng xử lý đề xuất:** Bổ sung catch và state lỗi riêng cho modal; giữ nội dung để người dùng thử lại. ProviderOrderFeedbackThread đã có xử lý lỗi có thể tái sử dụng pattern.

**Nguồn:** [handigo-web/src/features/feedback/pages/ProviderFeedbackPage.tsx:26](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/feedback/pages/ProviderFeedbackPage.tsx:26>); [handigo-web/src/features/feedback/pages/ProviderFeedbackPage.tsx:143](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/feedback/pages/ProviderFeedbackPage.tsx:143>).

**Truy vết:** UC031 Reply Feedback. Ca chức năng: BB-UC031-05.

<a id="com-21"></a>
#### COM-21 — FeedbackCard bỏ qua ảnh phản hồi của provider

**Trung bình; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** API lưu providerReply.images và màn hình chi tiết provider render chúng, nhưng FeedbackCard dùng ở trang đánh giá customer/provider chỉ hiển thị content phản hồi; customer không thấy ảnh trả lời tại màn hình này.

**Cách kiểm tra dự kiến:** Tạo phản hồi có images qua chi tiết đơn provider hoặc API; mở CustomerFeedbackPage/OrderFeedbackSection dùng FeedbackCard; chỉ thấy text, không thấy ảnh providerReply.

**Hướng xử lý đề xuất:** Render gallery ảnh providerReply theo cùng pattern ảnh đánh giá, kiểm tra cả customer và provider.

**Nguồn:** [handigo-web/src/features/feedback/components/FeedbackCard.tsx:52](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/feedback/components/FeedbackCard.tsx:52>); [handigo-web/src/features/provider/components/ProviderOrderFeedbackThread.tsx:163](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/provider/components/ProviderOrderFeedbackThread.tsx:163>); [handigo-backend/src/services/feedback.service.ts:567](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/feedback.service.ts:567>).

**Truy vết:** UC012 View Feedback; UC031 Reply Feedback. Ca chức năng: BB-UC012-06, BB-UC031-06.

<a id="com-22"></a>
#### COM-22 — Quy tắc sửa phản hồi chưa nhất quán giữa hai màn hình provider

**Thấp; Cần xác minh; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Trang chi tiết đơn chỉ cho gửi khi chưa có providerReply, trong khi trang danh sách có Sửa phản hồi và API upsert cho cập nhật. Cần chốt đây là chủ ý UX hay thiếu chức năng trên màn chi tiết.

**Cách kiểm tra dự kiến:** Sau khi gửi phản hồi ở chi tiết đơn, không còn form sửa; cùng bản ghi ở ProviderFeedbackPage có Sửa phản hồi và PUT /feedback/:id/reply nhận cập nhật.

**Hướng xử lý đề xuất:** Xác nhận quy tắc được sửa hay một lần; đồng bộ API và hai màn hình theo nghiệp vụ đã chốt.

**Nguồn:** [handigo-web/src/features/provider/components/ProviderOrderFeedbackThread.tsx:79](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/provider/components/ProviderOrderFeedbackThread.tsx:79>); [handigo-web/src/features/feedback/pages/ProviderFeedbackPage.tsx:123](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-web/src/features/feedback/pages/ProviderFeedbackPage.tsx:123>); [handigo-backend/src/services/feedback.service.ts:535](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/feedback.service.ts:535>).

**Truy vết:** UC031 Reply Feedback. Ca chức năng: BB-UC031-02.

<a id="com-23"></a>
#### COM-23 — Tạo hoặc cập nhật đánh giá lưu trước khi tính lại điểm provider

**Cao; Lỗi có căn cứ; trạng thái: chưa sửa, chưa xác nhận trên môi trường UI/API thật.**

**Ảnh hưởng:** Nếu aggregate/Provider.findByIdAndUpdate lỗi, request báo lỗi nhưng feedback đã được tạo/sửa; điểm tổng provider còn cũ và thử lại tạo mới có thể bị 'đã được đánh giá'.

**Cách kiểm tra dự kiến:** Mock Feedback.create/save thành công, Feedback.aggregate hoặc Provider.findByIdAndUpdate reject. Gọi createFeedback/updateMyFeedback rồi đọc lại feedback và điểm provider.

**Hướng xử lý đề xuất:** Đảm bảo tính nhất quán qua giao dịch hoặc cơ chế tính lại điểm có retry/reconciliation đáng tin cậy; báo rõ trạng thái đã lưu thay vì để người dùng hiểu là chưa ghi.

**Nguồn:** [handigo-backend/src/services/feedback.service.ts:118](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/feedback.service.ts:118>); [handigo-backend/src/services/feedback.service.ts:128](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/feedback.service.ts:128>); [handigo-backend/src/services/feedback.service.ts:163](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/feedback.service.ts:163>); [handigo-backend/src/services/feedback.service.ts:164](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/handigo-backend/src/services/feedback.service.ts:164>).

**Truy vết:** UC020 Feedback Provider; UC030 Update Feedback. Ca chức năng: BB-UC020-06, BB-UC030-06. Sheet unit: UT074.

## Các nội dung cần chốt khi triển khai tiếp

Các mục dưới đây được ghi để xử lý sau; không chặn việc tạo báo cáo hiện tại. Quyết định mới cần cập nhật expected result và ca hồi quy tương ứng.

- Refund: tiêu chí yêu cầu hoàn độc lập, thời hạn, bằng chứng, trạng thái, người duyệt, phần tiền hoàn và khả năng retry/đối soát; xem FIN-06.
- Withdrawal: quy trình chuyển khoản, đối soát, bằng chứng ngân hàng và xử lý chuyển khoản thất bại; xem FIN-02. Chốt số tiền VND nguyên và lịch sử hoàn ví khi từ chối; xem FIN-03/FIN-08.
- Token và social: thời điểm thu hồi quyền truy cập, chính sách email khôi phục và thiết lập/đổi mật khẩu tài khoản social; xem AUTH-02/AUTH-05/AUTH-06.
- Booking: hỗ trợ urgent, quy tắc mô tả, phạm vi media và asset ownership, xung đột lịch provider; xem BOOK-01 đến BOOK-05.
- Catalog: danh mục dừng hoạt động có ẩn dịch vụ con hay không; đề xuất loại category có cần màn riêng; xem CAT-03/CAT-08.
- Notification và dashboard: nhóm ALL có gồm ADMIN; timezone nghiệp vụ; ý nghĩa “dòng tiền qua hệ thống” khi có tiền mặt; xem COM-01/COM-10/FIN-05/FIN-07.
- Feedback: quyền sửa phản hồi provider và hành vi thống nhất giữa các màn; xem COM-22.

## Điều kiện để chạy các ca còn lại

Chuẩn bị môi trường thử riêng, URL web/API, dữ liệu tổng hợp cho ba vai trò và MongoDB hỗ trợ transaction. Dịch vụ ngoài cần sandbox hoặc mock được kiểm soát. Xác nhận permission định vị, socket, callback OAuth, webhook thanh toán, email OTP, tải tệp/OCR và cấu hình timezone trong môi trường đó.

Chạy thêm kiểm thử route/middleware/phân quyền/ownership, tích hợp DB, socket realtime, UI với loading/error/empty state, các tình huống đồng thời và xử lý lỗi giữa nhiều lần ghi. Những chức năng thiếu phải triển khai/chốt nghiệp vụ trước khi chạy ca acceptance. Bổ sung test runner/coverage cho các ma trận thiết kế chưa tự động hóa.

Khi chạy: giữ ngày dự kiến, ghi ngày thực thi thực tế và người kiểm thử; thêm actual result/bằng chứng khi có sai khác; chỉ đổi sang Đạt/Không đạt sau kiểm tra. Các phát hiện do đọc code được giữ ở mục vấn đề phân tích đến khi có bằng chứng tái hiện.

## Đối chiếu 64 use case với báo cáo

Các tên use case dưới đây được giữ theo danh sách yêu cầu. Mã sheet UT tham chiếu đơn vị hiện có; với phần thiếu, đó có thể là hàm liên quan và không xác nhận đã có đủ luồng.

| Use case | Nhóm/sheet chức năng | Triển khai được nhận diện | Ca Blackbox | Sheet Unit | Ngày dự kiến chức năng |
| --- | --- | --- | --- | --- | --- |
| UC001: Sign up | Xác thực / Xac thuc | Đã có | BB-UC001-01–BB-UC001-08 (8) | UT001, UT002, UT003, UT004, UT005, UT006 | 25/09/2026 |
| UC002: Sign in | Xác thực / Xac thuc | Đã có | BB-UC002-01–BB-UC002-06 (6) | UT007, UT008 | 25/09/2026 |
| UC003: Social Sign in | Xác thực / Xac thuc | Đã có | BB-UC003-01–BB-UC003-07 (7) | UT009, UT010 | 25/09/2026 |
| UC004: Sign out | Xác thực / Xac thuc | Đã có | BB-UC004-01–BB-UC004-05 (5) | UT011, UT012 | 25/09/2026 |
| UC005: Forgot Password | Xác thực / Xac thuc | Đã có | BB-UC005-01–BB-UC005-07 (7) | UT013, UT014 | 25/09/2026 |
| UC006: Change Password | Xác thực / Xac thuc | Đã có | BB-UC006-01–BB-UC006-07 (7) | UT015, UT016 | 25/09/2026 |
| UC007: Update Profile | Quản lý tài khoản / Tai khoan | Đã có | BB-UC007-01–BB-UC007-06 (6) | UT003, UT004, UT005, UT017, UT018, UT019 | 26/09/2026 |
| UC008: Update Address | Quản lý tài khoản / Tai khoan | Đã có | BB-UC008-01–BB-UC008-07 (7) | UT005, UT020, UT021 | 26/09/2026 |
| UC009: Search Service | Dịch vụ và danh mục / Dich vu danh muc | Đã có | BB-UC009-01–BB-UC009-06 (6) | UT022, UT023 | 28/09/2026 |
| UC010: Filter Service | Dịch vụ và danh mục / Dich vu danh muc | Đã có | BB-UC010-01–BB-UC010-05 (5) | UT023, UT024 | 28/09/2026 |
| UC011: View Profile | Quản lý tài khoản / Tai khoan | Đã có | BB-UC011-01–BB-UC011-06 (6) | UT019, UT025, UT026, UT027 | 26/09/2026 |
| UC012: View Feedback | Đánh giá và trao đổi / Danh gia trao doi | Đã có | BB-UC012-01–BB-UC012-06 (6) | UT028, UT029 | 04/10/2026 |
| UC013: Booking Order | Đặt và thực hiện đơn / Don dich vu | Đã có | BB-UC013-01–BB-UC013-08 (8) | UT030, UT031, UT032, UT033, UT034, UT035 | 30/09/2026 |
| UC014: Upload Problem Media | Đặt và thực hiện đơn / Don dich vu | Một phần | BB-UC014-01–BB-UC014-06 (6) | UT036, UT037 | 30/09/2026 |
| UC015: View Order Status | Đặt và thực hiện đơn / Don dich vu | Đã có | BB-UC015-01–BB-UC015-05 (5) | UT038, UT039 | 30/09/2026 |
| UC016: Response Order Assigned | Đặt và thực hiện đơn / Don dich vu | Đã có | BB-UC016-01–BB-UC016-06 (6) | UT040, UT041 | 30/09/2026 |
| UC017: Payment | Thanh toán và tài chính / Thanh toan | Đã có | BB-UC017-01–BB-UC017-07 (7) | UT031, UT042, UT043, UT044 | 02/10/2026 |
| UC018: Apply Promote | Thanh toán và tài chính / Thanh toan | Đã có | BB-UC018-01–BB-UC018-09 (9) | UT045, UT046, UT047 | 02/10/2026 |
| UC019: View Payment History | Thanh toán và tài chính / Thanh toan | Đã có | BB-UC019-01–BB-UC019-05 (5) | UT048 | 02/10/2026 |
| UC020: Feedback Provider | Đánh giá và trao đổi / Danh gia trao doi | Đã có | BB-UC020-01–BB-UC020-06 (6) | UT049 | 04/10/2026 |
| UC021: Chat Real Time | Đánh giá và trao đổi / Danh gia trao doi | Đã có | BB-UC021-01–BB-UC021-07 (7) | UT050, UT051 | 04/10/2026 |
| UC022: Complaint | Đánh giá và trao đổi / Danh gia trao doi | Đã có | BB-UC022-01–BB-UC022-08 (8) | UT052, UT053 | 04/10/2026 |
| UC023: Register As Provider | Quản lý tài khoản / Tai khoan | Đã có | BB-UC023-01–BB-UC023-07 (7) | UT054, UT055, UT056, UT057, UT058, UT059 | 26/09/2026 |
| UC024: Change Active Status | Quản lý tài khoản / Tai khoan | Đã có | BB-UC024-01–BB-UC024-06 (6) | UT060, UT061 | 26/09/2026 |
| UC025: Send System Notifications | Hệ thống và thông báo / He thong | Đã có | BB-UC025-01–BB-UC025-06 (6) | UT062, UT063 | 06/10/2026 |
| UC026: Track Provider Location | Đặt và thực hiện đơn / Don dich vu | Đã có | BB-UC026-01–BB-UC026-06 (6) | UT064, UT065, UT066 | 30/09/2026 |
| UC027: View Provider Location | Đặt và thực hiện đơn / Don dich vu | Đã có | BB-UC027-01–BB-UC027-05 (5) | UT066, UT067, UT068 | 30/09/2026 |
| UC028: View Nearby Provider | Đặt và thực hiện đơn / Don dich vu | Đã có | BB-UC028-01–BB-UC028-06 (6) | UT069, UT070 | 30/09/2026 |
| UC029: Update Service Progress | Đặt và thực hiện đơn / Don dich vu | Đã có | BB-UC029-01–BB-UC029-07 (7) | UT071, UT072, UT073 | 30/09/2026 |
| UC030: Update Feedback | Đánh giá và trao đổi / Danh gia trao doi | Đã có | BB-UC030-01–BB-UC030-06 (6) | UT074 | 04/10/2026 |
| UC031: Reply Feedback | Đánh giá và trao đổi / Danh gia trao doi | Đã có | BB-UC031-01–BB-UC031-06 (6) | UT075 | 04/10/2026 |
| UC032: View Revenue Analytics | Dashboard và phân tích / Phan tich | Đã có | BB-UC032-01–BB-UC032-05 (5) | UT076, UT077 | 08/10/2026 |
| UC033: View Wallet Balance | Thanh toán và tài chính / Thanh toan | Đã có | BB-UC033-01–BB-UC033-05 (5) | UT078, UT079 | 02/10/2026 |
| UC034: Request Withdraw | Thanh toán và tài chính / Thanh toan | Đã có | BB-UC034-01–BB-UC034-06 (6) | UT080, UT081 | 02/10/2026 |
| UC035: View Withdrawal History | Thanh toán và tài chính / Thanh toan | Đã có | BB-UC035-01–BB-UC035-05 (5) | UT082 | 02/10/2026 |
| UC036: View Personal Dashboard | Dashboard và phân tích / Phan tich | Đã có | BB-UC036-01–BB-UC036-04 (4) | UT083 | 08/10/2026 |
| UC037: Suggest New Service | Dịch vụ và danh mục / Dich vu danh muc | Đã có | BB-UC037-01–BB-UC037-06 (6) | UT084 | 28/09/2026 |
| UC038: Create Service | Dịch vụ và danh mục / Dich vu danh muc | Đã có | BB-UC038-01–BB-UC038-07 (7) | UT085, UT086 | 28/09/2026 |
| UC039: Update Service | Dịch vụ và danh mục / Dich vu danh muc | Đã có | BB-UC039-01–BB-UC039-06 (6) | UT087 | 28/09/2026 |
| UC040: Delete Service | Dịch vụ và danh mục / Dich vu danh muc | Đã có | BB-UC040-01–BB-UC040-05 (5) | UT088 | 28/09/2026 |
| UC041: View User List | Quản lý tài khoản / Tai khoan | Đã có | BB-UC041-01–BB-UC041-06 (6) | UT089, UT090 | 26/09/2026 |
| UC042: Lock/Unlock Account | Quản lý tài khoản / Tai khoan | Đã có | BB-UC042-01–BB-UC042-06 (6) | UT091, UT092 | 26/09/2026 |
| UC043: Response Provider Application | Quản lý tài khoản / Tai khoan | Đã có | BB-UC043-01–BB-UC043-07 (7) | UT093, UT094 | 26/09/2026 |
| UC044: Create Service Category | Dịch vụ và danh mục / Dich vu danh muc | Đã có | BB-UC044-01–BB-UC044-06 (6) | UT095 | 28/09/2026 |
| UC045: View Service Category | Dịch vụ và danh mục / Dich vu danh muc | Đã có | BB-UC045-01–BB-UC045-05 (5) | UT096, UT097, UT098 | 28/09/2026 |
| UC046: Update Service Category | Dịch vụ và danh mục / Dich vu danh muc | Đã có | BB-UC046-01–BB-UC046-05 (5) | UT099 | 28/09/2026 |
| UC047: Delete Service Category | Dịch vụ và danh mục / Dich vu danh muc | Đã có | BB-UC047-01–BB-UC047-04 (4) | UT100 | 28/09/2026 |
| UC048: Update System Content | Hệ thống và thông báo / He thong | Một phần | BB-UC048-01–BB-UC048-06 (6) | UT101 | 06/10/2026 |
| UC049: View Orders List | Đặt và thực hiện đơn / Don dich vu | Chưa thấy | BB-UC049-01–BB-UC049-06 (6) | UT102, UT103 | 30/09/2026 |
| UC050: Review Service Suggestion | Dịch vụ và danh mục / Dich vu danh muc | Đã có | BB-UC050-01–BB-UC050-08 (8) | UT104 | 28/09/2026 |
| UC051: Approve Withdrawals | Thanh toán và tài chính / Thanh toan | Đã có | BB-UC051-01–BB-UC051-05 (5) | UT105 | 02/10/2026 |
| UC052: Create Vouchers | Thanh toán và tài chính / Thanh toan | Đã có | BB-UC052-01–BB-UC052-05 (5) | UT106, UT107 | 02/10/2026 |
| UC053: View Vouchers | Thanh toán và tài chính / Thanh toan | Đã có | BB-UC053-01–BB-UC053-05 (5) | UT108 | 02/10/2026 |
| UC054: Update Vouchers | Thanh toán và tài chính / Thanh toan | Đã có | BB-UC054-01–BB-UC054-04 (4) | UT109 | 02/10/2026 |
| UC055: Delete Voucher | Thanh toán và tài chính / Thanh toan | Đã có | BB-UC055-01–BB-UC055-04 (4) | UT110 | 02/10/2026 |
| UC056: Reject Withdrawals | Thanh toán và tài chính / Thanh toan | Đã có | BB-UC056-01–BB-UC056-05 (5) | UT111 | 02/10/2026 |
| UC057: Request A Refund | Thanh toán và tài chính / Thanh toan | Chưa thấy | BB-UC057-01–BB-UC057-04 (4) | Chưa có đơn vị riêng | 02/10/2026 |
| UC058: Response Refund Request | Thanh toán và tài chính / Thanh toan | Chưa thấy | BB-UC058-01–BB-UC058-04 (4) | Chưa có đơn vị riêng | 02/10/2026 |
| UC059: View System Configurations | Hệ thống và thông báo / He thong | Đã có | BB-UC059-01–BB-UC059-06 (6) | UT112, UT113 | 06/10/2026 |
| UC060: Update System Configuration | Hệ thống và thông báo / He thong | Một phần | BB-UC060-01–BB-UC060-07 (7) | UT114, UT115 | 06/10/2026 |
| UC061: View System Dashboard | Hệ thống và thông báo / He thong | Đã có | BB-UC061-01–BB-UC061-06 (6) | UT116 | 06/10/2026 |
| UC062: View Revenue Reports | Dashboard và phân tích / Phan tich | Đã có | BB-UC062-01–BB-UC062-05 (5) | UT117, UT118 | 08/10/2026 |
| UC063: View Notification History | Hệ thống và thông báo / He thong | Đã có | BB-UC063-01–BB-UC063-06 (6) | UT119 | 06/10/2026 |
| UC064: Review Personal Notifications | Hệ thống và thông báo / He thong | Đã có | BB-UC064-01–BB-UC064-07 (7) | UT120, UT121, UT122 | 06/10/2026 |

## Kiểm tra tính nhất quán của tài liệu

Đã kiểm tra nguồn tham chiếu tồn tại, 64 use case không trùng/thiếu, ngày dự kiến theo thứ tự tăng dần và tách ngày thực thi. Các công thức thống kê lấy trực tiếp dòng kết quả, gồm ca chưa chạy trong mẫu số. Không dùng định mức 100 ca/KLOC của ví dụ làm yêu cầu cho Handigo khi chưa có định mức được xác nhận.

Đã mở hai file bằng Microsoft Excel ở chế độ ẩn, chỉ đọc, tính lại công thức và xác nhận số sheet/tổng thống kê khớp; không có ô công thức lỗi. Kiểm tra đổi trạng thái một ca trên bản nạp trong bộ nhớ cũng cập nhật đúng tổng Đạt/Không đạt/Chưa chạy. Bản cuối vẫn giữ đúng kết quả thực thi ban đầu. Bằng chứng: [native-excel-validation.json](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/outputs/handigo-report5-20261008/internal/native-excel-validation.json>); [formula-edit-check.json](<C:/FPT Material/2026/SU26-K8/WDP301/handigo/wdp301-rbl-project-group6/outputs/handigo-report5-20261008/internal/formula-edit-check.json>).

Tài liệu dùng code tại thời điểm phân tích, chưa có mã build/commit do không được yêu cầu sử dụng Git. Khi code hoặc nghiệp vụ đổi, cần cập nhật các ca và vị trí nguồn tương ứng.
