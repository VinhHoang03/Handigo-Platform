# Phân tích sản phẩm web Handigo làm tham chiếu cho ứng dụng mobile

Ngày phân tích: 01/10/2026. Phạm vi: mã nguồn `handigo-web/src`, tập trung vào hành vi khách hàng và chuyên gia, có ghi nhận phần quản trị liên quan.

Tài liệu mô tả **sản phẩm và nghiệp vụ**, không kế thừa màu sắc, khoảng cách, kiểu chữ, bố cục hay phong cách component của web. Nền tảng thị giác cho mobile là [nova-mobile.md](nova-mobile.md). Các tên component web dưới đây chỉ xác định trách nhiệm nghiệp vụ, không yêu cầu sao chép giao diện hoặc cách điều hướng desktop.

Phương pháp: đọc route, page, component, hook, kiểu dữ liệu và lời gọi API của web. Chưa chạy ứng dụng, chưa kiểm tra dữ liệu thực tế hoặc implementation backend. “Quan sát” là hành vi thấy trong code; “suy luận” là diễn giải từ nhiều điểm trong code; “chưa xác nhận” là điều frontend không đủ bằng chứng. Trạng thái có trong type không đồng nghĩa mọi chuyển trạng thái đều được frontend thực hiện. Các mã nguồn [S01]–[S40] ở cuối tài liệu liên kết đến file cụ thể; mỗi hàng hoặc nhận định đều có nguồn tương ứng.

## 1. Mục đích sản phẩm

Handigo kết nối người cần dịch vụ tại nhà với người thực hiện: tìm dịch vụ, mô tả nhu cầu, chọn địa điểm và thời gian, thanh toán hoặc đặt cọc, điều phối chuyên gia, theo dõi công việc và đánh giá sau hoàn thành. Đây là một quy trình giao dịch dịch vụ, không chỉ là danh bạ chuyên gia. **Suy luận từ các luồng đã triển khai.** [S01][S03][S05][S08][S17]

Đối với chuyên gia, sản phẩm hỗ trợ đăng ký và xét duyệt năng lực, nhận yêu cầu công việc, quản lý lịch, khảo sát/báo giá, gửi bằng chứng hoàn thành, xem thu nhập và phản hồi đánh giá. [S02][S10][S11][S18][S22]

Phần quản trị vận hành hệ sinh thái: xét duyệt hồ sơ, quản lý danh mục, người dùng, đánh giá, ưu đãi, tiền, hỗ trợ, vi phạm và cấu hình. Việc có các màn hình này trên web không tự động quyết định chúng thuộc phạm vi mobile. [S02]

## 2. Vai trò người dùng

| Vai trò/bối cảnh | Quyền và hành vi quan sát được | Nguồn |
| --- | --- | --- |
| Khách chưa đăng nhập | Có thể vào trang chủ, giới thiệu, tin tức, hỗ trợ công khai, danh sách và chi tiết dịch vụ; đặt đơn được bảo vệ bằng đăng nhập. | [S01][S02] |
| `CUSTOMER` | Đặt và theo dõi đơn, thanh toán, đánh giá, quản lý hồ sơ/địa chỉ, ví, ngân hàng, điểm thưởng, hỗ trợ; có lối đăng ký provider. | [S01][S02] |
| `PROVIDER` | Nhận và thực hiện đơn, xem lịch, quản lý hồ sơ nghề nghiệp, ví/ngân hàng, đánh giá và đề xuất dịch vụ. | [S02][S10] |
| Provider đang onboarding | Là trạng thái của provider, không phải role thứ tư. Guard chuyển người có `providerOnboardingStatus` khác `APPROVED` sang đăng ký provider; hồ sơ có ngoại lệ `allowUnapprovedProvider`. Nếu trường onboarding vắng mặt, guard không chặn bằng điều kiện này. | [S02] |
| `ADMIN` | Khu vực quản trị riêng, route yêu cầu role ADMIN. | [S02] |

Tên “chuyên gia”, “thợ”, “nhà cung cấp” trên web cùng chỉ phía provider. Provider có hồ sơ riêng liên kết user. Có nhãn “Chuyển sang Khách hàng” trỏ về `/`, nhưng các route đặt đơn vẫn chỉ cho `CUSTOMER`; **chưa đủ bằng chứng về khả năng đổi role hoặc đặt đơn bằng tài khoản provider**. [S02][S04]

## 3. Tính năng chính

| Nhóm | Khả năng sản phẩm | Nguồn |
| --- | --- | --- |
| Tài khoản | Đăng nhập, đăng ký qua OTP email, quên mật khẩu; có nút đăng nhập Google/Facebook. Việc nhà cung cấp OAuth hoạt động trong môi trường thực tế chưa được kiểm chứng. | [S21] |
| Khám phá | Danh mục, tìm dịch vụ, chi tiết/tùy chọn dịch vụ, chuyên gia phù hợp gần địa chỉ, hồ sơ chuyên gia và đánh giá. | [S03][S06][S23] |
| Đặt dịch vụ | Giá cố định hoặc khảo sát; đặt ngay, hẹn lịch, định kỳ; địa chỉ người nhận, mô tả và ảnh hiện trạng. | [S04][S05] |
| Vòng đời công việc | Điều phối/nhận đơn, theo dõi, bắt đầu, báo giá, hoàn thành có bằng chứng, hủy và đổi chuyên gia. | [S08][S09][S10][S11] |
| Tài chính | Ví, PayOS, tiền mặt theo điều kiện, mã giảm giá, đặt cọc, tiền thu trực tiếp, hoàn tiền và yêu cầu rút tiền. | [S07][S12][S13][S19] |
| Chất lượng | Đánh giá theo đơn, ảnh đánh giá, phản hồi của chuyên gia, tổng điểm và phân bố sao. | [S17][S18] |
| Liên lạc | Chat theo đơn, gửi ảnh, trạng thái đã đọc, báo cáo chat; thông báo và theo dõi vị trí. | [S15][S16][S24] |
| Nghề nghiệp | Hồ sơ xét duyệt, giấy tờ định danh, chứng chỉ/OCR, khu vực làm việc, trạng thái sẵn sàng, đề xuất dịch vụ. | [S22][S25][S34] |
| Sau bán hàng | Khiếu nại theo đơn, ticket hỗ trợ, báo cáo và bằng chứng. | [S26] |
| Giữ chân khách | Điểm thưởng, đổi voucher, lịch sử tích/đổi và mã sở hữu. | [S27] |
| Trợ lý AI | Widget cho customer/provider đã đăng nhập; mô hình phiên có yêu cầu bổ sung thông tin, xác nhận hành động, trạng thái thanh toán và đối soát kết quả. Đây là luồng riêng với chat người dùng. | [S28] |
| Nội dung/vận hành | Giới thiệu, tin tức, hỗ trợ công khai và các nhóm quản trị. | [S01][S02] |

## 4. Hành trình người dùng cốt lõi

| Hành trình | Các bước và điểm quyết định | Nguồn |
| --- | --- | --- |
| Khách đặt dịch vụ | Khám phá → chi tiết → chọn dịch vụ/tùy chọn hoặc số lượng → địa chỉ, nhu cầu, lịch → kiểm tra chuyên gia → xác nhận giá/voucher/phương thức → tạo đơn và thanh toán → theo dõi đơn. Có thể vào bước đầu từ lịch sử đơn hoặc đi từ chi tiết dịch vụ. | [S01][S03][S05][S07] |
| Khách dùng dịch vụ khảo sát | Đặt và thanh toán cọc → chuyên gia nhận/khảo sát → nhận báo giá → đồng ý hoặc từ chối có lý do → thực hiện → hoàn thành → đánh giá. Phần tiền thu trực tiếp được trình bày riêng với cọc. | [S07][S09][S11][S12][S17] |
| Khách đặt định kỳ | Chọn thời điểm bắt đầu, đơn vị lặp và số buổi → xem các ngày dự kiến → kiểm tra khả năng phục vụ → xem từng đơn trong chuỗi → quản lý/hủy một buổi hoặc chuỗi theo điều kiện. | [S05][S08][S09] |
| Khách xử lý sự cố | Mở đơn → xem trạng thái/lý do → đồng ý tìm thợ khác hoặc từ chối → theo dõi kết quả/hoàn tiền; khiếu nại hoặc gửi hỗ trợ nếu cần. | [S14][S26] |
| Trở thành chuyên gia | Chọn đăng ký provider hoặc vào `/register-provider` → hồ sơ dịch vụ/khu vực → giấy tờ/chứng chỉ → lưu nháp/gửi → chờ duyệt → sửa và gửi lại nếu bị từ chối → vào khu vực công việc khi đủ điều kiện. | [S02][S21][S22] |
| Chuyên gia làm việc | Nhận thông báo/yêu cầu có thời hạn → nhận hoặc từ chối → mở thông tin khách và địa điểm → báo giá nếu cần → bắt đầu → gửi ảnh bằng chứng và hoàn thành → xem thu nhập/phản hồi. | [S10][S11][S18][S25] |
| Tài chính cá nhân | Mở ví → nạp qua cổng thanh toán hoặc gửi yêu cầu rút → quay lại đồng bộ → xem giao dịch và trạng thái xét duyệt. | [S19][S20] |

## 5. Điều hướng và kiến trúc thông tin hiện có

Đây là bản đồ nội dung của web, không phải cấu trúc tab mobile đã được chốt. [S01][S02]

| Khu vực | Route/điểm vào hiện có | Nguồn |
| --- | --- | --- |
| Công khai | `/`, `/gioi-thieu`, `/tin-tuc`, `/tin-tuc/:articleId`, `/ho-tro` | [S01] |
| Xác thực | `/login`, alias `/signin`, `/register`, `/forgot-password`; `/profile` đi qua bộ điều hướng hồ sơ | [S01] |
| Khám phá dịch vụ | `/customer/services`, `/customer/services/:serviceId` không có guard; `/customer/providers/:providerId` yêu cầu CUSTOMER hoặc PROVIDER dù page mang tên `PublicProviderProfilePage` | [S01] |
| Khách hàng | `/customer`, `/customer/profile`, `/customer/bookings`, `/customer/bookings/:bookingId` | [S01] |
| Đặt đơn | `/customer/bookings/new` → `/new/location` → `/new/payment`, dưới cùng tiền tố `/customer/bookings`; kết quả `/customer/bookings/success` | [S01] |
| Tài chính/ưu đãi khách | `/customer/wallet`, `/customer/bank-accounts`, `/customer/rewards` | [S01] |
| Hậu mãi khách | `/customer/support`, `/customer/orders/:orderId/feedback` | [S01] |
| Chuyên gia | `/provider`, `/provider/orders`, `/provider/orders/:orderId`, `/provider/schedule`, `/provider/profile` | [S02] |
| Tài chính/hậu mãi chuyên gia | `/provider/wallet`, `/provider/bank-accounts`, `/provider/feedbacks`, `/provider/service-suggestions`, `/provider/support` | [S02] |
| Onboarding | `/register-provider`, cho CUSTOMER/PROVIDER, cho phép provider chưa duyệt | [S02] |
| Callback ví | `/wallet/deposit/success`, `/wallet/deposit/cancel`; ngoài ra luồng nạp có thể trả thẳng về trang ví theo role | [S02][S19][S20] |
| Quản trị | `/admin` và các nhánh users, provider-applications, categories, service-suggestions, feedbacks, promotions, withdrawals, support, cases, revenue, payments, wallets, notifications, system-configs, news | [S02] |
| Tiện ích xuyên màn hình | Chat qua `MessageCenter`/`OrderChatButton`; chuông thông báo; modal nhận đơn toàn ứng dụng; chatbot. Trong route đã đọc, chỉ ADMIN có route trang thông báo riêng; không suy ra `/customer/notifications` hay `/provider/notifications`. | [S02][S15][S16][S25][S28] |

**Hàm ý cho mobile (suy luận):** bảo toàn các nhóm nội dung và lối mở trực tiếp đến đơn/chat/thanh toán, sau đó tổ chức Tab + Stack theo `nova-mobile.md`. Sidebar, popup chat và bố cục nhiều cột hiện tại không phải yêu cầu sản phẩm. [S01][S02][S15]

## 6. Thực thể quan trọng và quan hệ

| Quan hệ nghiệp vụ | Bằng chứng và giới hạn | Nguồn |
| --- | --- | --- |
| User → địa chỉ | Một user quản lý nhiều địa chỉ, có người nhận và mặc định. Người nhận dịch vụ có thể khác tên tài khoản. | [S04][S29] |
| User → provider profile | Hồ sơ chuyên gia chứa user, dịch vụ, khu vực, định danh, chứng chỉ, uy tín và trạng thái sẵn sàng. | [S23][S34] |
| Danh mục → dịch vụ → tùy chọn | `Service.categoryId`; `ServiceOption.serviceId`; tùy chọn có nhóm, chọn một/nhiều, số lượng. | [S04] |
| Khách + dịch vụ + địa chỉ → đơn | `Order` tham chiếu khách, dịch vụ, địa chỉ, provider có thể chưa được gán; lưu snapshot tùy chọn và giảm giá. | [S04] |
| Đơn → assignment → provider | Yêu cầu nhận việc là thực thể riêng có hạn phản hồi và trạng thái; không đồng nhất với đơn đã nhận. | [S10] |
| Chuỗi định kỳ → các đơn/buổi | Các đơn dùng `recurringGroupId`, `occurrenceNumber`, `totalOccurrences`; UI tải và hiển thị các buổi liên quan. | [S04][S08] |
| Đơn → báo giá → hạng mục | Báo giá có tổng, giảm giá và trạng thái; mỗi hạng mục có loại, số lượng, đơn giá. Web tải báo giá của đơn; không đủ bằng chứng để khẳng định số phiên bản báo giá tối đa ở database. | [S04][S11] |
| Đơn → các payment | Có payment ban đầu/cọc/phần còn lại trong contract; web chi tiết đọc danh sách payment để xác định tiền thực trả. | [S04][S12] |
| Ví → giao dịch/yêu cầu rút → ngân hàng | Giao dịch có chiều vào/ra, số dư sau giao dịch; yêu cầu rút có tài khoản ngân hàng tham chiếu hoặc snapshot. | [S19][S30] |
| Đơn → đánh giá → phản hồi provider | Đánh giá gắn order, customer, provider, service; context trả một feedback cho đơn và quyền `canReview`. Không kết luận unique index từ UI. | [S17][S18] |
| Đơn → conversation → messages | Conversation gắn customer/provider và order; message gắn conversation/sender, văn bản hoặc ảnh. | [S15] |
| User/đơn → khiếu nại, ticket, báo cáo | Khiếu nại gắn đơn và hai phía; ticket có thể không gắn đơn; report có nhiều loại đối tượng, gồm chat/feedback/hệ thống. | [S26] |
| Hồ sơ đăng ký → xét duyệt | Có loại đăng ký ban đầu/bổ sung dịch vụ, tài liệu, lịch sử gửi/duyệt/từ chối và người xét duyệt. | [S22] |
| Khách → điểm → voucher | Số dư điểm, lịch sử tích/đổi và voucher sở hữu; voucher có điều kiện dùng cho đơn. | [S27][S31] |

## 7. Thông tin quan trọng hiển thị theo thực thể

| Thực thể | Thông tin cần bảo toàn trong trải nghiệm mobile | Nguồn |
| --- | --- | --- |
| Dịch vụ | Tên, ảnh, mô tả, danh mục, loại giá; giá cố định/giá từ hoặc thông tin khảo sát; tùy chọn và thành tiền theo số lượng. Không trình bày tiền cọc như toàn bộ giá sửa chữa. | [S03][S04][S07] |
| Chuyên gia công khai | Tên/ảnh, giới thiệu, kinh nghiệm, xác minh, điểm và số đánh giá, số đơn hoàn thành, dịch vụ, khu vực; trong đơn có số điện thoại hoặc giá trị thay thế khi thiếu. | [S23][S32] |
| Địa chỉ | Người nhận, điện thoại, địa chỉ chi tiết, tỉnh/thành, phường/xã, ghi chú, mặc định; tọa độ phục vụ tìm người và bản đồ. Contract cũ còn district nhưng form hiện tại dùng tỉnh/phường. | [S04][S29] |
| Đơn phía khách | Mã, dịch vụ/tùy chọn/số lượng, lịch/loại đặt, địa điểm, mô tả và ảnh, chuyên gia, trạng thái đơn/lịch/tiền, các khoản giá/giảm giá, báo giá, tiến trình và chính sách hủy. | [S04][S08][S09] |
| Đơn phía chuyên gia | Thông tin khách/địa chỉ, công việc và ảnh hiện trạng, thời gian bắt đầu/kết thúc dự kiến, thời lượng/dự phòng, thanh toán/thu nhập, báo giá và bằng chứng hoàn thành. | [S10][S11][S33] |
| Assignment | Đơn liên quan, loại phân công, thời điểm gửi, hạn phản hồi, trạng thái và lý do từ chối. | [S10][S25] |
| Báo giá | Mã/trạng thái, ghi chú khảo sát, đề xuất, từng hạng mục, số lượng × đơn giá, tổng/giảm giá, thời lượng dự kiến, cọc được trừ và số tiền khách trả trực tiếp. | [S11][S12] |
| Ví/giao dịch | Số dư khả dụng/chờ, tổng thu nhập/rút/nạp/chi theo ngữ cảnh; loại giao dịch, chiều tiền, số tiền, số dư sau giao dịch, thời điểm, mã và trạng thái. | [S19] |
| Yêu cầu rút/ngân hàng | Số tiền, trạng thái duyệt, thời gian, ghi chú admin; ngân hàng, mã ngân hàng, số tài khoản/chủ tài khoản, mặc định và active/inactive. | [S19][S30] |
| Đánh giá | Sao, nội dung, ảnh, người đánh giá, đơn/dịch vụ liên quan, thời điểm, phản hồi chuyên gia; tổng điểm/số lượng/phân bố sao ở trang tổng hợp. | [S17][S18] |
| Hội thoại/thông báo | Đối tác, tin cuối, chưa đọc, thời gian; nội dung tin/ảnh; thông báo có nội dung và trạng thái đọc, điều hướng theo tài nguyên nếu có. | [S15][S16] |
| Hồ sơ provider | Dịch vụ, khu vực, mô tả, kinh nghiệm; tài liệu, trạng thái duyệt, lý do từ chối; tài liệu định danh thuộc ngữ cảnh hồ sơ riêng, không tự suy ra được công khai. | [S22][S34] |
| Vụ việc | Loại, tiêu đề, mô tả, đơn/đối tượng, trạng thái, bằng chứng, yêu cầu bổ sung, phản hồi hoặc kết quả xử lý. | [S26] |
| Ưu đãi | Điểm khả dụng/đã tích/đã đổi, điểm cần cho ưu đãi, giá trị đơn tối thiểu, thời hạn voucher, mã và lịch sử. | [S27] |

## 8. Hành động chính và phụ

“Chính/phụ” dưới đây là phân loại theo mục tiêu nghiệp vụ, không theo màu hoặc vị trí nút web.

| Bối cảnh | Hành động chính | Hành động phụ/ngoại lệ | Nguồn |
| --- | --- | --- | --- |
| Khám phá/chi tiết dịch vụ | Chọn và đặt dịch vụ | Tìm/lọc, xem tùy chọn, xem hồ sơ chuyên gia, đổi địa chỉ | [S03][S06][S23] |
| Đặt đơn | Tiếp tục, xác nhận/thanh toán | Sửa bước trước, đổi lịch/số lượng, thêm/xóa ảnh, áp dụng/bỏ voucher | [S05][S07][S31] |
| Đơn đang chờ | Theo dõi điều phối hoặc thanh toán khi đủ điều kiện | Hủy sau xem chính sách; xử lý đổi chuyên gia | [S08][S09][S12][S14] |
| Báo giá phía khách | Đồng ý báo giá | Từ chối kèm lý do; xem chi tiết và cọc đã trả | [S09][S12] |
| Công việc phía provider | Nhận → báo giá/bắt đầu → hoàn thành | Từ chối, chat, hủy có lý do, thêm bằng chứng | [S10][S11] |
| Đơn hoàn thành | Gửi/xem đánh giá | Chỉnh sửa khi `canReview`; xem ảnh hoàn thành/hỗ trợ | [S08][S17] |
| Ví | Nạp/rút tiền | Xem/lọc giao dịch, theo dõi yêu cầu rút, quản lý ngân hàng | [S19][S20][S30] |
| Đánh giá phía provider | Phản hồi | Sửa phản hồi, lọc và xem thống kê | [S18] |
| Chat | Gửi văn bản/ảnh | Sửa/xóa tin của mình theo UI, đánh dấu đã đọc, báo cáo, đóng/thu gọn | [S15] |
| Hồ sơ đăng ký | Gửi/gửi lại hồ sơ | Lưu nháp, sửa dữ liệu gợi ý OCR, xem lý do từ chối | [S22] |
| Điểm thưởng | Xác nhận đổi mã | Lọc đủ điểm, sao chép voucher, xem lịch sử/chính sách | [S27] |

## 9. Component UI đặc thù nghiệp vụ

Các khối này nên được hiểu là hợp đồng nội dung và tương tác để thiết kế lại theo Nova.

| Khối nghiệp vụ | Trách nhiệm | Nguồn |
| --- | --- | --- |
| Bộ chọn dịch vụ/tùy chọn/số lượng | Thể hiện nhóm chọn đơn/đa, tùy chọn bắt buộc và ảnh hưởng giá; vệ sinh điều hòa có nhánh số lượng đồng nhất riêng. | [S04][S05][S07] |
| Bộ chọn địa chỉ/người nhận/vị trí | Địa chỉ đã lưu, địa chỉ mới, mặc định, định vị/bản đồ và lỗi tìm tọa độ. | [S29][S35] |
| Bộ chọn lịch/chuỗi buổi | Ngày, khung giờ, đơn vị lặp, số lần và danh sách ngày dự kiến. | [S05] |
| Bộ chọn/phân phối chuyên gia | Dựa dịch vụ + địa chỉ + thời điểm + chuỗi; trạng thái đang kiểm tra/không phù hợp; lựa chọn ưu tiên khi được phép. | [S06] |
| Tóm tắt giá và phương thức trả | Giá/cọc, phí, giảm giá, số tiền xác nhận, voucher và phương thức khả dụng. | [S07][S31][S36] |
| Thẻ đơn/tiến trình | Mã, dịch vụ, lịch, tiền, trạng thái và hành động theo giai đoạn. | [S08][S10][S33] |
| Bộ đếm điều phối/nhận việc | Hạn phản hồi, chờ kết quả khi hết thời gian; không tự đặt trạng thái backend theo đồng hồ UI. | [S14][S25] |
| Bản đồ theo dõi | Địa điểm dịch vụ, vị trí chuyên gia, tuyến đường và trạng thái theo dõi. | [S24] |
| Trình lập/duyệt báo giá | Hạng mục, thời lượng, tổng, cọc, xác nhận; provider có hỗ trợ quét tài liệu và AI, kiểm tra độ liên quan. | [S11] |
| Hủy/hoàn tiền/đổi chuyên gia | Lý do, phạm vi một buổi/chuỗi, xem trước phí và tiền hoàn, xác nhận lựa chọn. | [S09][S14] |
| Thu thập bằng chứng | Ảnh hiện trạng, ảnh hoàn thành, ảnh đánh giá/vụ việc có giới hạn khác nhau. | [S05][S10][S17][S26] |
| Đánh giá và phản hồi | Sao, ảnh, nội dung, quyền chỉnh sửa, hội thoại phản hồi chuyên gia. | [S17][S18] |
| Chat theo đơn | Đối tác và bối cảnh công việc, tin/ảnh, đã đọc, chỉnh sửa/xóa/báo cáo. | [S15] |
| Hồ sơ xét duyệt | Tài liệu/OCR, chứng chỉ, lý do từ chối, lịch sử xét duyệt. | [S22][S34] |
| Ví và ưu đãi | Giao dịch, rút tiền chờ duyệt, voucher có điều kiện và đổi điểm cần xác nhận. | [S19][S27] |

## 10. Trạng thái và chuyển trạng thái

### 10.1. Các trục trạng thái độc lập

| Trục | Giá trị quan sát trong contract | Ý nghĩa đối với UI | Nguồn |
| --- | --- | --- | --- |
| Đơn `status` | `created`, `accepted`, `in_progress`, `completed`, `cancelled` | Tiến độ công việc chính | [S04][S10][S37] |
| Lịch `bookingStatus` | `not_required`, `awaiting_provider`, `awaiting_payment`, `reserved`, `confirmed`, `rejected`, `expired` | Chờ nhận lịch/tiền, giữ chỗ, xác nhận, từ chối/hết hạn | [S04][S14] |
| Thanh toán trên đơn | `unpaid`, `partially_paid`, `paid`, `refunded` | Tình trạng tổng hợp; cọc khác thanh toán đầy đủ | [S04][S12] |
| Payment riêng | `pending`, `paid`, `failed`, `refunded` | Trạng thái từng lần trả tiền | [S04] |
| Assignment | `pending`, `accepted`, `rejected`, `timeout`, `cancelled` | Phản hồi một yêu cầu nhận việc | [S10] |
| Báo giá | `pending`, `approved`, `rejected`, `expired`, `cancelled` | Chỉ báo giá được chấp thuận mới mở nhánh bắt đầu tương ứng | [S11][S12] |
| Đổi chuyên gia | `awaiting_customer`, `matching`, `matched`, `declined`, `expired`, `failed` | Chờ quyết định, tìm người thay thế và kết quả | [S04][S14] |
| Sẵn sàng provider | `online`, `offline`, `busy` | Khác trạng thái xét duyệt và trạng thái đơn | [S34][S25] |
| Hồ sơ đăng ký | `draft`, `pending`, `resubmitted`, `approved`, `rejected` | Nháp, gửi/chờ, duyệt hoặc sửa gửi lại | [S22] |
| Định danh/chứng chỉ | Định danh: `unsubmitted/pending/verified/rejected`; chứng chỉ: `pending/approved/rejected` | Không gộp thành một cờ “đã xác minh” duy nhất | [S22][S34] |
| Giao dịch ví | `pending`, `success`, `failed`, `cancelled` | Không dùng chung enum Payment | [S19] |
| Rút tiền | `pending`, `approved`, `rejected` | Yêu cầu xét duyệt, không đồng nghĩa thao tác rút tức thời | [S19] |
| Khiếu nại | `pending`, `evidence_requested`, `under_review`, `resolved`, `rejected`, `cancelled` | Cần thể hiện yêu cầu bổ sung bằng chứng | [S26] |
| Ticket hỗ trợ | `open`, `in_progress`, `waiting_user`, `resolved`, `closed`, `cancelled` | Chờ người dùng khác đang xử lý | [S26] |
| Báo cáo | `pending`, `under_review`, `confirmed`, `rejected`, `resolved` | Xác nhận báo cáo khác giải quyết xong | [S26] |

### 10.2. Chuyển trạng thái có bằng chứng hành động

- Luồng công việc thông thường được suy ra là `created → accepted → in_progress → completed`: provider nhận assignment, gọi bắt đầu, rồi gửi bằng chứng hoàn thành. Đây là mô hình khái quát từ handler/UI; server quyết định điều kiện cuối cùng. [S10]
- Customer mở hủy khi đơn `created/accepted`; provider có nút hủy ở `accepted/in_progress`. Hủy provider có thể dẫn tới yêu cầu đổi người phía khách, vì vậy không suy ra mọi thao tác hủy đều đóng đơn ngay. [S09][S10][S14]
- Báo giá `pending` có thao tác đồng ý/từ chối; `approved` + đơn `accepted` mở nút bắt đầu công việc khảo sát. Enum expired/cancelled tồn tại nhưng chưa xác định tác nhân/thời hạn tự động chỉ từ frontend. [S09][S11][S12]
- Lịch có nhánh `reserved` với thông điệp mở thanh toán trước giờ làm 24 giờ, `awaiting_payment` cho thanh toán và `expired` khi quá hạn. **Không đủ cơ sở áp đặt một chuỗi tuyến tính duy nhất**: bước tạo đơn hiện gọi tạo payment ngay, trong khi màn chi tiết vẫn hỗ trợ giữ lịch/trả sau. Cần đối chiếu server trước khi triển khai. [S07][S12][S14]
- Hồ sơ có nháp/gửi, từ chối và gửi lại; dữ liệu lưu lịch sử `submitted/rejected/resubmitted/approved`. [S22]
- Khi hết bộ đếm tìm thợ, UI ghi “hệ thống đang cập nhật kết quả”; phải lấy kết quả mới, không tự biến đồng hồ 0 thành đơn đã hủy. [S14]

## 11. Biểu mẫu và trường bắt buộc

Các điều kiện dưới đây là validation/thuộc tính input quan sát ở web, không thay thế contract validation backend.

| Biểu mẫu | Trường bắt buộc/điều kiện | Tùy chọn và giới hạn đáng chú ý | Nguồn |
| --- | --- | --- | --- |
| Đăng ký | Họ tên, email, mật khẩu và xác nhận; mật khẩu tối thiểu 8 ký tự, hai mật khẩu khớp; bước OTP xác thực email | Điện thoại tùy chọn, nếu nhập phải hợp lệ; lựa chọn đăng ký provider | [S21] |
| Đăng nhập/khôi phục | Đăng nhập bằng email/mật khẩu; khôi phục đi qua email → OTP 6 ký tự → mật khẩu mới tối thiểu 8 ký tự và xác nhận khớp | Gửi lại OTP; hiển thị lỗi API | [S21] |
| Dịch vụ | Có service; khi yêu cầu tùy chọn phải chọn theo quy tắc hiện có | Nhóm chọn một/nhiều và số lượng; nhánh vệ sinh điều hòa dùng `uniformQuantity` | [S05][S07] |
| Địa chỉ | Tên người nhận, điện thoại, dòng địa chỉ, tỉnh và phường; tên chỉ chữ/khoảng trắng, số điện thoại Việt Nam hợp lệ | Ghi chú, mặc định, tọa độ/placeId; địa chỉ đầu tiên mặc định được gợi ý là chính | [S29] |
| Nhu cầu/lịch | Địa chỉ, mô tả ít nhất 10 ký tự, kiểm tra chuyên gia phải trả `available`; đặt hẹn/định kỳ cần ngày và giờ, sớm nhất 08:00 ngày mai | 10 khung giờ 08:00–17:00; dải gợi ý 14 ngày, không coi là giới hạn backend | [S05][S06] |
| Định kỳ | Đơn vị weekly/monthly, số lần hợp lệ với đơn vị | Weekly: 1/2/3/4; monthly: 4/8/12 trong form hiện tại. Preview cộng 7 ngày hoặc từng tháng, kẹp vào ngày cuối tháng khi cần | [S05] |
| Ảnh hiện trạng | Không bắt buộc ảnh để qua validation bước 2 | Tối đa 4 ảnh; ảnh tối đa 5 MB, tối thiểu 320 × 240, phải đọc được nội dung | [S05] |
| Thanh toán/voucher | Có preview giá; có mã đã nhập thì phải áp dụng hợp lệ trước khi xác nhận; ngày hẹn phải ở tương lai | Voucher tùy chọn; không cho cash cho nhánh variable_price ở flow xác nhận | [S07][S31][S36] |
| Hủy/từ chối báo giá | Khách phải có lý do; hủy “Lý do khác” cần bổ sung. Provider chọn lý do; giải thích nếu có phải ít nhất 10 ký tự, bắt buộc cho “Lý do khác” | Xem trước chính sách hoàn tiền cho hủy khách; từ chối assignment có lý do tùy chọn | [S09][S10] |
| Báo giá | Ít nhất một hạng mục hợp lệ; tên và đơn giá dương; validation số lượng/giá; thời lượng input 1–1440 phút | Ghi chú khảo sát/đề xuất tối đa 2000 ký tự; có kiểm tra độ liên quan và xác nhận cảnh báo trước gửi | [S11] |
| Hoàn thành việc | Ít nhất một ảnh bằng chứng | Tối đa 5 ảnh, mỗi ảnh tối đa 5 MB; JPEG/PNG/WebP/GIF/AVIF; ghi chú tùy chọn tối đa 1000 ký tự | [S10] |
| Đánh giá | Chọn số sao trong bộ 1–5; quyền theo `canReview` | Nội dung tùy chọn tối đa 1000 ký tự; tối đa 5 ảnh, mỗi ảnh tối đa 5 MB | [S17] |
| Phản hồi provider | Nội dung không được trống ở trang đánh giá provider | Tối đa 1000 ký tự; có sửa phản hồi cũ | [S18] |
| Hồ sơ đăng ký provider | Dịch vụ, khu vực, mô tả; số giấy tờ và họ tên; CCCD cần ảnh mặt trước, hộ chiếu cần ảnh hộ chiếu ở service validation | Kinh nghiệm có trong payload; chứng chỉ không bắt buộc trong service validation nhưng nếu thêm thì cần tên và ảnh; ngày cấp không tương lai, hết hạn không quá khứ và phải sau ngày cấp. Không tự thêm yêu cầu ảnh mặt sau chỉ vì type có field | [S22] |
| Ngân hàng | Ngân hàng/mã; số tài khoản ít nhất 4 ký tự; chủ tài khoản ít nhất 2 ký tự | Ngân hàng ngoài danh sách có nhập thủ công; mặc định và active/inactive | [S30] |
| Nạp/rút ví | Số tiền tối thiểu 1 ở frontend; rút không vượt số dư khả dụng | Form rút gửi `{ amount }`, không bắt người dùng chọn ngân hàng tại đây dù API type có `bankAccountId?`; cần làm rõ quy tắc tài khoản mặc định phía server | [S19][S30] |
| Vụ việc | Contract tạo complaint: orderId/title/description; ticket: category/subject/description; report: targetType/reportType/title/description | Ticket có order tùy chọn; file/bằng chứng và các tham chiếu đối tượng tùy ngữ cảnh. Đây là yêu cầu kiểu payload, không khẳng định mọi giới hạn form đã được xác minh | [S26] |

## 12. Tìm kiếm, lọc và sắp xếp

| Khu vực | Hành vi quan sát | Nguồn |
| --- | --- | --- |
| Danh sách dịch vụ | Lọc client theo danh mục; tìm trong tên + mô tả dịch vụ + tên danh mục, bỏ dấu và không phân biệt hoa thường, chuẩn hóa khoảng trắng. Không tìm tên tùy chọn trong hook này. | [S03] |
| Sắp xếp dịch vụ | `name`: theo tên tiếng Việt; `price_asc`: giá tăng dần, dịch vụ chỉ báo giá sau khảo sát xuống cuối và nhóm đó sắp tên. Không thấy lựa chọn giá giảm dần hoặc xếp hạng trong hook. | [S03] |
| Chuyên gia phù hợp | Gọi API bằng dịch vụ, địa chỉ, giờ hẹn, chu kỳ/số buổi, orderId và tùy chọn khi có; xóa lựa chọn cũ nếu không còn hợp lệ. Không đủ bằng chứng về công thức xếp hạng/khoảng cách server. | [S06] |
| Lịch sử khách | Tìm kiếm debounce 500 ms; gửi search và status lên API; 10 đơn mỗi lần, có tải thêm. Không suy ra chính xác backend tìm trong trường nào chỉ từ nhãn ô nhập. | [S38] |
| Danh sách công việc | Debounce 500 ms; lọc all/accepted/in_progress/completed/cancelled; 5 đơn/trang, đổi tìm kiếm về trang 1. Assignment chờ nhận là danh sách riêng. | [S10][S38] |
| Lịch chuyên gia | Chọn tháng/ngày, nhóm đơn theo ngày lấy từ `expectedStartAt`, nếu thiếu thì `scheduledAt`, rồi `createdAt`. Không thấy bước sort riêng trong page; thứ tự trong ngày theo dữ liệu tải về. Trang chỉ lấy trang đầu tối đa 100 đơn: chưa thể coi đây là lịch đầy đủ mọi dữ liệu. | [S33] |
| Đánh giá provider | Từ khóa nhận xét, số sao, đã/chưa phản hồi; 10 mỗi trang, đổi lọc về trang 1. | [S18] |
| Ví | Query giao dịch có loại, từ ngày/đến ngày và phân trang; yêu cầu rút lọc trạng thái và phân trang. | [S19] |
| Thông báo | Controller hỗ trợ type, isRead, targetRole và phân trang; các vai trò dùng khác nhau. Không suy ra mọi bộ lọc đều xuất hiện trong chuông của khách. | [S16] |
| Điểm thưởng | Lọc ưu đãi đủ điểm ở client, phân trang lịch sử và mã sở hữu riêng. | [S27] |
| Vụ việc | Contract query có page/limit/status/keyword; nhóm complaint/ticket/report có trạng thái riêng. | [S26] |
| Chat | Tin trong popup được sắp thời gian tăng dần, trùng thời gian thì theo ID; loại bản sao theo ID. API có phân trang nhưng popup đọc trang mặc định, chưa thấy luồng tải toàn bộ lịch sử trong file này. | [S15] |

## 13. Quy trình đặt lịch và thực hiện công việc

### 13.1. Chuẩn bị đơn

1. Chọn danh mục/dịch vụ, tùy chọn và số lượng. State đặt đơn lưu cả chuyên gia được yêu cầu từ ngữ cảnh trước và chuyên gia ưu tiên. Không coi hai field này là bằng chứng provider đã nhận việc. [S04][S05][S06]
2. Chọn địa chỉ có thông tin người nhận; mô tả nhu cầu và ảnh tùy chọn. [S05][S29]
3. Chọn đặt ngay (`normal`), hẹn lịch (`scheduled`) hoặc định kỳ (`recurring`). Contract còn `urgent`, nhưng handler chọn loại ở bước 2 chỉ nhận ba giá trị trên; chưa có bằng chứng cần nút “khẩn cấp” riêng trong mobile. [S04][S05]
4. Kiểm tra chuyên gia phù hợp theo địa điểm/lịch. Bước 2 không bắt buộc chọn đích danh chuyên gia, nhưng bắt buộc trạng thái khả dụng; có các trường hợp lựa chọn ưu tiên. [S05][S06]
5. Lấy preview giá và xem tóm tắt, áp dụng voucher, chọn phương thức thanh toán. Gửi `expectedBookingAmount` khi tạo đơn; không lấy phép cộng client làm nguồn giá cuối cùng. [S07][S36]

### 13.2. Sau tạo đơn

- Lưu ID đơn chờ và fingerprint bản đặt để thử lại có thể dùng cùng đơn; khi giá đơn đã có khác giá preview, chuyển về chi tiết. Đây là bảo vệ trải nghiệm quan sát được, chưa đủ để khẳng định tính idempotent toàn hệ thống. [S07]
- Hiển thị đơn thực trả về, chờ thanh toán/điều phối/xác nhận lịch theo trạng thái. Đơn định kỳ liên kết các buổi, không chỉ là một dòng mô tả chu kỳ. [S08][S14]
- Provider nhận yêu cầu có thời hạn, nhận hoặc từ chối; sau đó mở đơn được giao. Nếu dịch vụ yêu cầu khảo sát, form báo giá phụ thuộc trạng thái đơn và xác nhận lịch. [S10][S11][S25]
- Dịch vụ cố định có nút bắt đầu khi `accepted` và không yêu cầu khảo sát. Dịch vụ khảo sát mở bắt đầu khi báo giá được duyệt. [S10][S11]
- Trong quá trình làm có chat, bản đồ và thông tin thời gian; hoàn thành cần ảnh bằng chứng. [S10][S15][S24][S33]
- Khách xem hoàn thành rồi gửi đánh giá nếu được phép; provider xem/phản hồi. [S17][S18]

### 13.3. Nhánh ngoại lệ

| Tình huống | Hành vi được triển khai | Nguồn |
| --- | --- | --- |
| Không có chuyên gia phù hợp | Chặn tiếp tục ở bước 2; giữ người dùng ở ngữ cảnh địa chỉ/lịch để sửa | [S05][S06] |
| Chuyên gia từ chối lịch | Một số đơn created/rejected có lựa chọn chuyên gia thay thế; nếu có yêu cầu reassignment thì khách chọn phương án xử lý | [S14] |
| Thợ hủy/đổi người | Khách chọn accept/decline; thông điệp UI cho biết từ chối sẽ hủy/hoàn về ví, kết quả thực tế lấy từ API | [S14] |
| Hủy một buổi/chuỗi | Đọc cancellation preview với scope single/series, hiển thị số tiền đã trả/hoàn/phí và lý do; xác nhận có lý do | [S09] |
| Hết thời gian tìm/thanh toán | Phân biệt hết đếm ngược chờ server cập nhật với bookingStatus expired đã được trả về | [S14] |
| Gửi payment lỗi sau tạo đơn | Flow có thể gọi discardUnpaidOrder theo loại đơn; nếu không bỏ được thì giữ ID để thử tiếp | [S07] |

## 14. Quy trình thanh toán

### 14.1. Phương thức và loại tiền

| Trường hợp | Hành vi web | Nguồn |
| --- | --- | --- |
| Giá cố định | Tạo payment loại `FULL`; chọn ví, bank/PayOS hoặc tiền mặt theo flow | [S07] |
| Giá biến đổi/khảo sát | Bank/PayOS hoặc ví với `INSPECTION_DEPOSIT`; nếu state chọn cash thì flow dùng bank thay thế | [S07] |
| Chuyển cổng | Bank ở booking state được gửi thành `PAYOS`, nhận checkoutUrl rồi chuyển ra ngoài; return/cancel URL giữ ngữ cảnh đơn | [S07][S12] |
| Thanh toán tiếp từ chi tiết | Chỉ khi chưa có initial payment đã paid, chưa vào pha báo giá, paymentStatus unpaid, phương thức đơn không cash, status created/accepted và bookingStatus not_required/awaiting_payment | [S12] |
| Báo giá sau khảo sát | Hiển thị cọc đã áp dụng và phần thu trực tiếp từ khách; provider có thể bắt đầu sau khi khách đồng ý báo giá, không phải chờ payment phần còn lại trên nền tảng | [S11][S12] |

Contract Payment còn liệt kê `vnpay`, `remaining`, nhưng không vì vậy mà kết luận có lựa chọn VNPAY hoặc flow trả phần sửa chữa còn lại qua cổng trên màn hình đã phân tích. [S04][S07][S12]

### 14.2. Kết quả và phục hồi

- Flow ví/tiền mặt tạo payment rồi đọc lại order; tạo payment tiền mặt không chứng minh đã thu đủ tiền. Tình trạng cuối cùng nằm trong dữ liệu order/payment. [S07][S04]
- Khi trở về trang booking success từ PayOS, web tìm orderId trong URL/session rồi đọc lại đơn. Trang mang tên success không phải bằng chứng giao dịch đã paid; file này không tự xác minh webhook và khi tải đơn thất bại có thể về trang khách. Mobile cần thể hiện trạng thái thật từ API, đây là hàm ý từ giới hạn hiện tại. [S13]
- Với báo giá sửa chữa, UI ghi cọc thuộc hệ thống; tiền provider thu trực tiếp bằng báo giá trừ cọc đã áp dụng, không nhỏ hơn 0. Helper khấu trừ cọc loại phần phụ phí đặt ngay khỏi số tiền áp dụng khi có dữ liệu giá mới. Phụ phí đặt ngay được chia theo cấu hình và phần provider vào ví khi hoàn thành theo nội dung hiển thị. Không dùng mô tả này để suy ra toàn bộ thuật toán kế toán backend. [S11][S12]
- Hủy đơn phải đọc preview gồm tiền đã trả, tỷ lệ/tiền hoàn, phí hủy, bồi thường provider và lý do chính sách; không hard-code tỷ lệ hoàn từ tài liệu. [S04][S09]

### 14.3. Ví, rút tiền và ưu đãi

- Nạp ví: nhập số tiền → tạo giao dịch/link → lưu mã giao dịch → chuyển cổng → quay về đồng bộ hoặc hủy → làm mới ví. Nếu gateway chưa xác nhận, UI thông báo đang chờ thay vì tự cộng tiền. [S19][S20]
- Rút tiền: nhập số tiền trong số dư → gửi yêu cầu → hiển thị chờ duyệt; xem approved/rejected và ghi chú. Form không thể hiện chuyển khoản tức thời. [S19]
- Voucher: nhập và áp dụng trước khi đặt; snapshot giảm giá thuộc đơn. Điểm thưởng có luồng xác nhận đổi mã riêng, giữ requestId khi thử lại yêu cầu chưa rõ kết quả. [S07][S27][S31]
- Nội dung trang điểm thưởng nêu tích điểm cho đơn giá cố định hoàn thành, trả đủ; tiền mặt sau khi hệ thống xác nhận, không tích cho đơn khảo sát/khoản ngoài nền tảng. Giá trị điểm và thời hạn lấy theo policy; chưa kiểm chứng xử lý cộng điểm backend. [S27]

## 15. Quy trình đánh giá

1. Đơn completed mở khối đánh giá ở chi tiết; lịch sử cũng có CTA đánh giá cho đơn hoàn thành. [S08][S38]
2. Tải `OrderFeedbackContext`, gồm order, feedback hiện có, `canReview` và `reason`. Trạng thái completed là điểm vào, còn quyền tạo/sửa thực tế theo context. [S17]
3. Chọn sao, nhập nhận xét tùy chọn và ảnh tùy chọn; gửi/lưu, báo thành công hoặc lỗi. [S17]
4. Nếu đã có feedback và còn quyền, khách có thể chỉnh sửa. Nếu không, xem đánh giá và lý do không được thao tác. Không có bằng chứng trong file đã đọc về thời hạn chỉnh sửa cố định. [S17]
5. Provider xem tổng hợp điểm, lọc đánh giá, tạo/sửa phản hồi. Feedback có trường hiển thị `isVisible` và web có route quản trị đánh giá; không coi mọi feedback được gửi đều xuất hiện công khai. [S18][S02]

Không thấy luồng provider chấm sao khách tương ứng trong các màn hình đánh giá đã phân tích; mobile không nên tự thêm cơ chế đánh giá hai chiều chỉ từ khái niệm marketplace. [S17][S18]

## 16. Chat và giao tiếp

| Kênh | Luồng/hành vi | Nguồn |
| --- | --- | --- |
| Chat theo đơn | Mở từ đơn hoặc trung tâm tin nhắn → lấy/tạo conversation theo order → tải tin → đánh dấu đã xem → gửi văn bản/ảnh. Context đối tác tùy role. | [S15] |
| Điều kiện điểm vào | Thẻ chuyên gia phía khách chỉ hiện nút chat khi order accepted/in_progress; không kết luận backend cấm đọc hội thoại cũ sau hoàn thành vì MessageCenter là điểm vào khác. | [S32][S15] |
| Realtime chat | Join conversation khi kết nối; nhận message:new, message:updated, message:deleted; hợp nhất theo ID và thứ tự thời gian. | [S15] |
| Quản lý hội thoại | Đánh dấu đọc, báo cáo; sửa/xóa tin qua API và UI tin nhắn; lỗi khi đơn chưa sẵn sàng. Chưa có bằng chứng gọi thoại/video giữa người dùng. | [S15] |
| Liên lạc ngoài chat | Đơn hiển thị điện thoại đối tác khi có. Hiển thị số điện thoại không chứng minh có hệ thống tổng đài hoặc gọi ẩn số. | [S32][S33] |
| Thông báo | Chuông, số chưa đọc, đọc một/tất cả, cập nhật socket và các điều hướng theo sự kiện; yêu cầu đổi thợ có prompt. | [S16] |
| Theo dõi vị trí | Socket theo đơn; provider dùng geolocation watchPosition khi đủ điều kiện, customer nhận vị trí; có lỗi kết nối/GPS. Không suy ra đã hỗ trợ tracking nền trên native. | [S24] |
| Hỗ trợ | Ticket có các phản hồi của USER/ADMIN, attachment và trạng thái chờ người dùng; complaint/report có bằng chứng/kết quả riêng. | [S26] |
| Trợ lý AI | Khác conversation người dùng; có session, bản nháp đặt lịch, yêu cầu xác nhận hành động, payment và trạng thái cần đối soát. Widget bị ẩn khi đang mở popup chat, ở trang auth hoặc không phải customer/provider đã đăng nhập. | [S28] |

## 17. Trạng thái rỗng, đang tải và lỗi

| Ngữ cảnh | Quan sát được hoặc suy luận có căn cứ | Nguồn |
| --- | --- | --- |
| Khởi động/phiên | Đang tải trang, đang khôi phục phiên; chưa đăng nhập chuyển login; sai role về trang theo role, onboarding chưa xong về hồ sơ | [S02] |
| Danh sách dịch vụ | Skeleton/loading, lỗi tải, danh sách không có kết quả; cần phân biệt không có dữ liệu với từ khóa/lọc không khớp | [S03][S39] |
| Tìm provider | idle/loading/available/unavailable/error; chưa chọn đủ đầu vào khác không có thợ; lỗi API hiện có bị quy về thông điệp chưa phù hợp ở validation bước 2 | [S05][S06] |
| Đặt đơn | Thiếu dịch vụ/địa chỉ/tùy chọn, mô tả ngắn, lịch không hợp lệ, chưa có preview giá, voucher chưa áp dụng; nút busy khi gửi | [S05][S07] |
| Upload | Sai loại/kích thước/độ phân giải, ảnh không đọc được; upload từng ảnh có thể thành công một phần, giữ URL thành công và báo ảnh lỗi | [S05] |
| Đơn | Skeleton, không tải được/không tìm thấy, chờ người nhận, đếm ngược, giữ lịch, chờ tiền, hết hạn, yêu cầu đổi người | [S08][S14] |
| Nhận việc | Loading assignments độc lập danh sách đơn; `loadAssignments` bắt lỗi rồi trả mảng rỗng, nên “không có yêu cầu” ở đây chưa chắc đồng nghĩa server thật sự không có | [S38] |
| Lịch provider | Loading/error; ngày không có lịch hiện “Chưa có công việc”; dữ liệu có giới hạn lấy 100 đơn | [S33] |
| Báo giá | Chưa có báo giá, chờ khách trả tiền giữ lịch, chờ khách đồng ý; lỗi kiểm tra/scan và cảnh báo độ liên quan | [S11] |
| Thanh toán | Thiếu checkoutUrl, gateway chưa xác nhận, lỗi gửi; booking success chưa có xử lý lỗi tải chi tiết rõ ngoài fallback về trang khách | [S07][S13][S20] |
| Đánh giá | Chưa có đánh giá, đang tải/lưu, lỗi có thử lại; không được đánh giá hiển thị `reason` | [S17][S18] |
| Chat | Chưa có tin/hội thoại, tải tin, đơn chưa sẵn sàng để chat, lỗi gửi/upload; không nên suy diễn các trạng thái offline/typing chưa thấy trong contract | [S15] |
| GPS/bản đồ | Không xác định được vị trí hoặc lỗi kết nối; cần khả năng dùng địa chỉ/thông tin đơn ngay cả khi thiếu vị trí là hàm ý thiết kế mobile, không phải chứng nhận fallback hoàn chỉnh của web | [S24][S35] |
| Điểm thưởng | Chưa có mã/giao dịch, không đủ điểm, không có ưu đãi phù hợp bộ lọc, lỗi tải có thử lại, kết quả đổi chưa xác định thì thử cùng yêu cầu | [S27] |

Hàm ý thiết kế mobile: cần tách rỗng thật, rỗng do lọc và lỗi tải; giữ lại dữ liệu người dùng khi lỗi gửi; lấy lại dữ liệu server khi trở về từ gateway hoặc kết nối lại. Đây là suy luận từ các nhánh lỗi/khôi phục trên, không khẳng định web đã xử lý toàn bộ. [S05][S07][S15][S20][S38]

## 18. Khác biệt luồng khách hàng và chuyên gia

| Khía cạnh | Khách hàng | Chuyên gia | Nguồn |
| --- | --- | --- | --- |
| Mục tiêu | Tìm người xử lý nhu cầu tại nhà | Nhận và thực hiện việc phù hợp | [S01][S02][S10] |
| Bắt đầu | Khám phá dịch vụ và tạo đơn | Hồ sơ được duyệt, trạng thái sẵn sàng và assignment | [S03][S22][S25] |
| Thời gian | Chọn giờ/ngày, lặp và xem các buổi | Xem lịch công việc/ngày, thời lượng, thời gian dự kiến | [S05][S33] |
| Nhu cầu | Mô tả/ảnh hiện trạng, người nhận và địa chỉ | Đọc nhu cầu, khảo sát, lập báo giá và bằng chứng | [S05][S10][S11] |
| Báo giá | Đồng ý hoặc từ chối | Lập, kiểm tra và gửi; chờ duyệt rồi bắt đầu | [S09][S11] |
| Thanh toán | Trả đủ/cọc, theo dõi tiền hoàn và trả trực tiếp khi sửa chữa | Phân biệt thu trực tiếp, thu nhập ví, phí/phần phân chia | [S07][S11][S19] |
| Tiến độ | Theo dõi trạng thái, chat và vị trí | Nhận, bắt đầu, cập nhật vị trí và hoàn thành | [S08][S10][S24] |
| Hủy/đổi | Xem preview hoàn tiền; có hủy chuỗi; quyết định tìm thợ khác | Từ chối assignment hoặc hủy có lý do; có thể kích hoạt luồng đổi người | [S09][S10][S14] |
| Đánh giá | Chấm sao, ảnh/nhận xét và sửa theo quyền | Xem tổng hợp, phản hồi/sửa phản hồi | [S17][S18] |
| Hồ sơ | Thông tin cá nhân và sổ địa chỉ | Thêm nghề nghiệp, khu vực, giấy tờ, chứng chỉ/xét duyệt | [S22][S29][S34] |
| Ví/ngân hàng | Nạp, thanh toán, hoàn tiền, rút và tài khoản ngân hàng | Thu nhập và các thao tác ví/ngân hàng tương ứng | [S01][S02][S19][S30] |
| Tính năng riêng | Điểm thưởng, đổi voucher | Đề xuất dịch vụ, lịch làm việc | [S27][S33][S40] |

## Các điểm cần xác minh trước khi triển khai mobile

Đây là các giới hạn bằng chứng, không phải đề xuất sửa nghiệp vụ trong đợt phân tích này.

| Điểm chưa chốt | Vì sao cần xác minh | Nguồn |
| --- | --- | --- |
| Thứ tự giữ lịch/thu tiền/nhận lịch | Create flow tạo payment ngay; detail có reserved và trả tiền trước giờ 24 giờ. Cần server xác định trường hợp thực tế | [S07][S12][S14] |
| Quyền đổi vai trò | Nhãn chuyển khách không tương đương route cho provider đặt đơn | [S02] |
| Hoàn tiền và ghi nhận tiền mặt | UI thể hiện chính sách/loại trạng thái; không chứng minh webhook, sổ cái hay cơ chế xác nhận thu tiền | [S04][S09][S19] |
| Dữ liệu lịch/nhắn tin đầy đủ | Lịch chỉ lấy 100 đơn; popup đọc trang tin mặc định; không mang giới hạn này thành yêu cầu sản phẩm | [S15][S33] |
| Thông báo native/tracking nền | Web socket và geolocation chỉ chứng minh hành vi web; chưa có bằng chứng push native hoặc chạy GPS nền | [S16][S24] |
| Dịch vụ khẩn/VNPAY | Có giá trị type nhưng không thấy lựa chọn tương ứng trong flow đã đọc | [S04][S05][S07] |
| Quyền đánh giá/chat | `canReview` do server trả; điểm vào chat và quyền đọc/gửi qua API có thể khác nhau | [S15][S17][S32] |
| Dữ liệu trực tiếp so với nội dung trình diễn | File component/type hoặc câu chữ quảng bá không chứng minh tính năng vận hành; tài liệu ưu tiên route/handler/API đang nối vào luồng | [S01][S02][S03] |

## Danh mục nguồn code

Các liên kết tương đối tính từ file này ở thư mục gốc repository. Mỗi nhóm chỉ đến file/symbol cần đọc để kiểm tra nhận định, không dùng CSS làm bằng chứng nghiệp vụ.

- **[S01] Route công khai/khách:** [public-routes.tsx](handigo-web/src/routes/public-routes.tsx), [customer-routes.tsx](handigo-web/src/routes/customer-routes.tsx).
- **[S02] Vai trò/kiến trúc:** [provider-routes.tsx](handigo-web/src/routes/provider-routes.tsx), [admin-routes.tsx](handigo-web/src/routes/admin-routes.tsx), [RouteGuard](handigo-web/src/components/common/RouteGuard.tsx), [dashboardNavigation](handigo-web/src/components/common/dashboard/dashboardNavigation.ts), [App](handigo-web/src/App.tsx).
- **[S03] Danh mục dịch vụ:** [useServiceCatalog](handigo-web/src/features/customer-service/hooks/useServiceCatalog.ts), [CustomerServiceListPage](handigo-web/src/features/customer-service/pages/CustomerServiceListPage.tsx), [CustomerServiceDetailPage](handigo-web/src/features/customer-service/pages/CustomerServiceDetailPage.tsx), [serviceDisplay](handigo-web/src/features/customer-service/utils/serviceDisplay.ts).
- **[S04] Contract nghiệp vụ chính:** [types/booking.ts](handigo-web/src/types/booking.ts), các interface Category, Service, ServiceOption, Address, Order, Payment, CancellationPreview, BookingState.
- **[S05] Chuẩn bị đơn:** [CreateBookingStep1Page](handigo-web/src/features/booking/pages/CreateBookingStep1Page.tsx), [useCreateBookingStep2Form](handigo-web/src/features/booking/components/useCreateBookingStep2Form.ts), [step2Helpers](handigo-web/src/features/booking/components/step2Helpers.ts), [serviceOptionSelection](handigo-web/src/features/booking/utils/serviceOptionSelection.ts).
- **[S06] Chuyên gia phù hợp:** [useNearbyProviders](handigo-web/src/features/customer-service/components/useNearbyProviders.ts), [NearbyProviderSelector](handigo-web/src/features/customer-service/components/NearbyProviderSelector.tsx), [Step2ProviderFieldset](handigo-web/src/features/booking/components/Step2ProviderFieldset.tsx).
- **[S07] Xác nhận đơn/tiền:** [useConfirmPaymentFlow](handigo-web/src/features/booking/components/useConfirmPaymentFlow.ts), [runConfirmPaymentSubmit](handigo-web/src/features/booking/components/confirmPaymentSubmit.ts).
- **[S08] Chi tiết đơn khách:** [BookingDetailPage](handigo-web/src/features/booking/pages/BookingDetailPage.tsx), [useBookingDetail](handigo-web/src/features/booking/components/detail/useBookingDetail.ts), [BookingRecurringSeriesSection](handigo-web/src/features/booking/components/detail/BookingRecurringSeriesSection.tsx), [BookingServiceSummary](handigo-web/src/features/booking/components/detail/BookingServiceSummary.tsx).
- **[S09] Hủy/duyệt báo giá:** [useBookingCancellationFlow](handigo-web/src/features/booking/components/detail/useBookingCancellationFlow.ts), [BookingRefundPanel](handigo-web/src/features/booking/components/detail/BookingRefundPanel.tsx), [BookingCancellationPreviewCard](handigo-web/src/features/booking/components/detail/BookingCancellationPreviewCard.tsx).
- **[S10] Công việc provider:** [useProviderOrderDetail](handigo-web/src/features/provider/hooks/useProviderOrderDetail.ts), [ProviderOrderDetailPage](handigo-web/src/features/provider/pages/ProviderOrderDetailPage.tsx), [FixedPriceActionForm](handigo-web/src/features/provider/components/FixedPriceActionForm.tsx), [providerOrder.types](handigo-web/src/features/provider/types/providerOrder.types.ts).
- **[S11] Báo giá provider:** [QuotationOrderPanel](handigo-web/src/features/provider/components/orders/QuotationOrderPanel.tsx), [RepairQuotationForm](handigo-web/src/features/provider/components/RepairQuotationForm.tsx), [providerOrder.api](handigo-web/src/features/provider/api/providerOrder.api.ts).
- **[S12] Thanh toán ở chi tiết:** [useBookingPaymentFlow](handigo-web/src/features/booking/components/detail/useBookingPaymentFlow.ts), [useBookingDetail](handigo-web/src/features/booking/components/detail/useBookingDetail.ts), [BookingQuotationPanel](handigo-web/src/features/booking/components/detail/BookingQuotationPanel.tsx), [quotationPayment](handigo-web/src/utils/quotationPayment.ts).
- **[S13] Kết quả đặt đơn:** [BookingSuccessPage](handigo-web/src/features/booking/pages/BookingSuccessPage.tsx).
- **[S14] Điều phối/giữ lịch/đổi người:** [BookingStatusBanners](handigo-web/src/features/booking/components/detail/BookingStatusBanners.tsx), [useBookingReassignmentFlow](handigo-web/src/features/booking/components/detail/useBookingReassignmentFlow.ts), [useMatchingCountdown](handigo-web/src/features/booking/components/detail/useMatchingCountdown.ts).
- **[S15] Chat:** [ChatPopup](handigo-web/src/features/chat/components/ChatPopup.tsx), [MessageCenter](handigo-web/src/features/chat/components/MessageCenter.tsx), [MessageRow](handigo-web/src/features/chat/components/MessageRow.tsx), [MessageComposer](handigo-web/src/features/chat/components/MessageComposer.tsx), [useChatSocket](handigo-web/src/features/chat/hooks/useChatSocket.ts), [chat.types](handigo-web/src/features/chat/types/chat.types.ts), [chat.api](handigo-web/src/features/chat/api/chat.api.ts).
- **[S16] Thông báo:** [NotificationBell](handigo-web/src/components/common/NotificationBell.tsx), [useNotificationSocket](handigo-web/src/components/common/notification-bell/useNotificationSocket.ts), [useReassignmentPrompt](handigo-web/src/components/common/notification-bell/useReassignmentPrompt.ts), [useNotificationsPageController](handigo-web/src/features/notification/components/use-notifications-page.ts).
- **[S17] Đánh giá khách:** [CustomerFeedbackPage](handigo-web/src/features/feedback/pages/CustomerFeedbackPage.tsx), [FeedbackForm](handigo-web/src/features/feedback/components/FeedbackForm.tsx), [feedback.types](handigo-web/src/features/feedback/types/feedback.types.ts), [RatingStars](handigo-web/src/components/common/RatingStars.tsx).
- **[S18] Đánh giá provider:** [ProviderFeedbackPage](handigo-web/src/features/feedback/pages/ProviderFeedbackPage.tsx), [ProviderOrderFeedbackThread](handigo-web/src/features/provider/components/ProviderOrderFeedbackThread.tsx), [feedback.types](handigo-web/src/features/feedback/types/feedback.types.ts).
- **[S19] Ví:** [WalletPage](handigo-web/src/features/wallet/pages/WalletPage.tsx), [useWalletAmountForms](handigo-web/src/features/wallet/components/useWalletAmountForms.ts), [wallet.types](handigo-web/src/features/wallet/types/wallet.types.ts).
- **[S20] Trở về sau nạp ví:** [useWalletDepositReturn](handigo-web/src/features/wallet/components/useWalletDepositReturn.ts), [WalletDepositResultPage](handigo-web/src/features/wallet/pages/WalletDepositResultPage.tsx).
- **[S21] Xác thực:** [RegisterDetailsForm](handigo-web/src/features/auth/components/RegisterDetailsForm.tsx), [RegisterPage](handigo-web/src/features/auth/pages/RegisterPage.tsx), [LoginForm](handigo-web/src/features/auth/components/LoginForm.tsx), [ForgotPasswordPage](handigo-web/src/features/auth/pages/ForgotPasswordPage.tsx), [SocialLoginButtons](handigo-web/src/features/auth/components/SocialLoginButtons.tsx).
- **[S22] Đăng ký chuyên gia:** [providerApplication.service](handigo-web/src/features/provider-application/services/providerApplication.service.ts), [providerApplicationValidation](handigo-web/src/features/provider-application/utils/providerApplicationValidation.ts), [providerApplication.types](handigo-web/src/features/provider-application/types/providerApplication.types.ts), [useProviderApplication](handigo-web/src/features/provider-application/hooks/useProviderApplication.ts).
- **[S23] Hồ sơ chuyên gia cho người xem:** [PublicProviderProfilePage](handigo-web/src/features/customer-service/pages/PublicProviderProfilePage.tsx), [ProviderProfileHeader](handigo-web/src/features/customer-service/components/ProviderProfileHeader.tsx), [ProviderAboutSection](handigo-web/src/features/customer-service/components/ProviderAboutSection.tsx).
- **[S24] Theo dõi:** [OrderTrackingMap](handigo-web/src/features/tracking/components/OrderTrackingMap.tsx), [use-realtime-tracking](handigo-web/src/features/tracking/components/order-tracking-map/use-realtime-tracking.ts), [use-tracking-route](handigo-web/src/features/tracking/components/order-tracking-map/use-tracking-route.ts).
- **[S25] Nhận việc/sẵn sàng:** [ProviderAssignmentModal](handigo-web/src/features/provider/components/ProviderAssignmentModal.tsx), [PendingAssignmentCard](handigo-web/src/features/provider/components/PendingAssignmentCard.tsx), [useProviderAssignmentGate](handigo-web/src/features/provider/components/useProviderAssignmentGate.ts), [useProviderAvailability](handigo-web/src/features/provider/hooks/useProviderAvailability.ts).
- **[S26] Vụ việc:** [caseManagement.types](handigo-web/src/features/case-management/types/caseManagement.types.ts), [CaseManagementPage](handigo-web/src/features/case-management/pages/CaseManagementPage.tsx), [CreateCaseModal](handigo-web/src/features/case-management/components/CreateCaseModal.tsx), [CaseDetailModal](handigo-web/src/features/case-management/components/CaseDetailModal.tsx).
- **[S27] Điểm thưởng:** [CustomerRewardsPage](handigo-web/src/features/rewards/pages/CustomerRewardsPage.tsx), [RewardVoucherCard](handigo-web/src/features/rewards/components/RewardVoucherCard.tsx).
- **[S28] AI:** [ChatbotGate](handigo-web/src/features/chatbot/components/ChatbotGate.tsx), [agent.types](handigo-web/src/features/chatbot/types/agent.types.ts), [AgentConfirmationCard](handigo-web/src/features/chatbot/components/AgentConfirmationCard.tsx), [AgentPaymentCard](handigo-web/src/features/chatbot/components/AgentPaymentCard.tsx).
- **[S29] Địa chỉ:** [addressBookForm.utils](handigo-web/src/features/profile/utils/addressBookForm.utils.ts), [AddressBookManager](handigo-web/src/features/profile/components/AddressBookManager.tsx), [profile.types](handigo-web/src/features/profile/types/profile.types.ts).
- **[S30] Ngân hàng:** [BankAccountFormModal](handigo-web/src/features/bank-account/components/BankAccountFormModal.tsx), [useBankAccountManager](handigo-web/src/features/bank-account/components/useBankAccountManager.ts), [bankAccount.types](handigo-web/src/features/bank-account/types/bankAccount.types.ts).
- **[S31] Voucher:** [useConfirmPaymentVoucher](handigo-web/src/features/booking/components/useConfirmPaymentVoucher.ts), [ConfirmPaymentVoucherPanel](handigo-web/src/features/booking/components/ConfirmPaymentVoucherPanel.tsx).
- **[S32] Đối tác trong đơn khách:** [BookingProviderCard](handigo-web/src/features/booking/components/detail/BookingProviderCard.tsx), [bookingDetailProvider](handigo-web/src/features/booking/components/detail/bookingDetailProvider.ts).
- **[S33] Lịch/thông tin công việc:** [ProviderSchedulePage](handigo-web/src/features/provider/pages/ProviderSchedulePage.tsx), [CustomerInformationCard](handigo-web/src/features/provider/components/orders/CustomerInformationCard.tsx), [OrderScheduleCard](handigo-web/src/features/provider/components/orders/OrderScheduleCard.tsx), [PaymentSummaryCard](handigo-web/src/features/provider/components/orders/PaymentSummaryCard.tsx).
- **[S34] Hồ sơ nghề nghiệp:** [ProviderProfilePage](handigo-web/src/features/provider/pages/ProviderProfilePage.tsx), [provider.types](handigo-web/src/features/provider/types/provider.types.ts).
- **[S35] Định vị địa chỉ:** [AddressPicker](handigo-web/src/features/customer-service/components/AddressPicker.tsx), [useCurrentLocationPicker](handigo-web/src/features/customer-service/components/useCurrentLocationPicker.ts), [useAddressGeocoding](handigo-web/src/features/profile/hooks/useAddressGeocoding.ts).
- **[S36] Giá preview:** [useBookingPreview](handigo-web/src/features/booking/hooks/useBookingPreview.ts), [OrderSummaryPriceDetails](handigo-web/src/features/booking/components/OrderSummaryPriceDetails.tsx).
- **[S37] Nhãn trạng thái:** [orderStatus](handigo-web/src/utils/orderStatus.ts).
- **[S38] Danh sách đơn:** [BookingHistoryPage](handigo-web/src/features/booking/pages/BookingHistoryPage.tsx), [ProviderOrdersPage](handigo-web/src/features/provider/pages/ProviderOrdersPage.tsx).
- **[S39] Trạng thái tải/rỗng:** [AsyncState](handigo-web/src/components/common/AsyncState.tsx), [ServiceListEmpty](handigo-web/src/features/customer-service/components/ServiceListEmpty.tsx), [ServiceListSkeleton](handigo-web/src/features/customer-service/components/ServiceListSkeleton.tsx).
- **[S40] Đề xuất dịch vụ:** [ProviderServiceSuggestionPage](handigo-web/src/features/service-suggestion/pages/ProviderServiceSuggestionPage.tsx), [ProviderServiceSuggestionForm](handigo-web/src/features/service-suggestion/components/ProviderServiceSuggestionForm.tsx).
