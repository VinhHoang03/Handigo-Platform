# Đặc tả thiết kế ứng dụng mobile Handigo

## Nguồn, phạm vi và thứ tự ưu tiên

Nguồn thị giác duy nhất: [nova-mobile.md](nova-mobile.md), gọi tắt **Nova**. Nguồn nghiệp vụ: [mobile-product-analysis.md](mobile-product-analysis.md), gọi tắt **PA**. Khi soạn tài liệu, hai file tồn tại tại thư mục gốc; chưa có `docs/nova-mobile.md` và `docs/mobile-product-analysis.md`. Các tham chiếu “PA §…” bên dưới chỉ đến mục tương ứng và danh mục nguồn code trong bản phân tích này.

Thứ tự ưu tiên:

1. Nova quyết định hướng thị giác, token, primitive, tương tác chạm và thích ứng nền tảng.
2. PA quyết định tính năng, dữ liệu, vai trò, điều kiện hành động và giới hạn bằng chứng.
3. Tài liệu này quyết định cách tổ chức và trình bày các khả năng đã được PA xác nhận trên mobile. Những quyết định về bố cục/navigation là đặc tả thiết kế mới, không phải tuyên bố web đã có chúng.
4. Hành vi nghiệp vụ chưa rõ được ghi **Needs product decision** và không được tự triển khai như hành vi đã xác nhận.

Không dùng `handigo-web/DESIGN.md`, CSS, màu, font, sidebar, bảng desktop hoặc kiểu thẻ của web làm nguồn thị giác. Không thay đổi API, enum hoặc quy tắc tài chính qua các nhãn UI trong tài liệu này. Đây là đặc tả, không phải thay đổi mã ứng dụng.

## Nền tảng Nova — giữ nguyên

### Hướng thị giác

Tối giản, ưu tiên nội dung, cảm giác native mobile; ưu tiên quy ước iOS và tương thích Android. Dễ đọc, thứ bậc rõ, chiều sâu nhẹ, nhịp khoảng cách nhất quán. Light và Dark là hai chế độ được thiết kế ngay từ đầu. Không dùng gradient trang trí, bóng nặng hoặc hiệu ứng gây cạnh tranh với thông tin dịch vụ, lịch và tiền.

### Hệ màu

Giữ nguyên tất cả giá trị Nova; domain component chỉ tham chiếu token, không tạo bảng màu riêng cho khách hoặc chuyên gia.

| Token | Light | Dark | Vai trò |
| --- | --- | --- | --- |
| Primary | `#3B82F6` | `#60A5FA` | Hành động và nhấn mạnh có chọn lọc |
| Background | `#FFFFFF` | `#0B0F14` | Nền màn hình |
| Surface | `#F9FAFB` | `#111827` | Thẻ và bề mặt nhóm nội dung |
| Text Primary | `#111827` | `#F9FAFB` | Nội dung chính |
| Text Secondary | `#6B7280` | `#9CA3AF` | Thông tin hỗ trợ |
| Border | `#E5E7EB` | `#1F2937` | Phân cách nhẹ |
| Success | `#10B981` | `#34D399` | Thành công/xác nhận theo đúng ngữ cảnh |
| Warning | `#F59E0B` | `#FBBF24` | Cần chú ý/chờ thao tác |
| Error | `#EF4444` | `#F87171` | Lỗi/thao tác không thực hiện được |

Dark không dùng đen thuần `#000000` hoặc trắng thuần `#FFFFFF` cho bề mặt/chữ UI. Không tự đổi màu ảnh người dùng để ép vào palette. Primary dùng tiết chế; không tô toàn bộ thẻ đơn theo trạng thái.

Màu trạng thái không thay cho nhãn. Chữ nhỏ trên nền Surface dùng Text Primary/Text Secondary; màu semantic ưu tiên dấu hiệu hỗ trợ, không mặc định dùng Warning/Success làm chữ nhỏ trên nền sáng. Phải kiểm tra độ tương phản của từng cặp chữ/nền thực tế. Nova chưa chỉ định token `on-primary`: chọn foreground từ palette Nova có độ tương phản phù hợp với Primary, không mặc định trắng trên mọi nút. Nếu một tổ hợp không đọc tốt, thay cách phối token hoặc phân cấp, không thay mã màu gốc.

### Typography

| Cấp | Cỡ/độ đậm Nova | Áp dụng |
| --- | --- | --- |
| Large Title | 28 / Bold | Tiêu đề màn gốc |
| Title | 22 / SemiBold | Tiêu đề màn chi tiết/nhóm chính |
| Body | 16 / Regular | Nội dung, trường nhập, thông tin cần quyết định |
| Caption | 13 / Regular | Metadata, thời gian, giải thích ngắn |
| Small | 11 / Medium | Metadata ít quan trọng; không dùng cho giá phải trả, hạn phản hồi hoặc lỗi cần xử lý |

iOS dùng font hệ thống San Francisco; Android dùng Roboto. Line height 1.4–1.6; tránh hơn ba độ đậm trên một màn. Không thu nhỏ chữ để nhét địa chỉ, phí hoặc nút. Cho phép tăng cỡ chữ theo hệ thống; chiều cao component phải nở theo nội dung. Nội dung dự án và nhãn UI dùng tiếng Việt có dấu.

### Khoảng cách, bố cục và bán kính

| Token | Giá trị |
| --- | --- |
| xs | 4 |
| sm | 8 |
| md | 12 |
| lg | 16 |
| xl | 24 |
| xxl | 32 |

Đơn vị cơ sở là 4. Dùng đúng thang Nova; không tạo khoảng cách tùy ý theo màn. Padding màn mặc định 16; nội dung theo chiều rộng mobile, giữ safe area phía trên và vùng cử chỉ phía dưới. Khoảng cách giữa các nhóm 24/32, giữa các trường 12/16, giữa nhãn và nội dung 4/8 là cách áp dụng thang, không phải bộ token mới.

| Primitive | Quy tắc Nova giữ nguyên |
| --- | --- |
| Button | Primary filled, Secondary outlined, Ghost text; cao 44–48, radius 12; Primary dùng màu Primary, disabled giảm opacity |
| Card | Surface, radius 16, padding 16; bóng rất nhẹ hoặc không bóng ở Dark |
| List Item | Cao cơ sở 56–72; icon/avatar trái, chevron hoặc action phải; divider nhẹ |
| Input | Cao cơ sở 44–48, radius 10–12, border 1px; focus bằng Primary |

Các chiều cao cơ sở không phải trần khi chữ lớn hoặc nội dung nhiều dòng. Textarea dùng cùng ngôn ngữ Input và tăng chiều cao; Card không có chiều cao cố định. Vùng chạm Android phải đạt 48dp kể cả khi phần hiển thị thấp hơn. Bán kính của phần mở rộng phải lấy từ các bán kính trên, không tạo hệ radius riêng.

### Elevation, icon và motion

- Light: bóng rất mềm, chỉ để phân biệt lớp khi cần; không bổ sung thang bóng mạnh hơn Nova. Dark: ưu tiên tương phản Surface/Background và Border, tránh bóng và glow.
- Icon: chọn một bộ nhất quán theo Nova, ưu tiên nét viền. Dùng một bộ Lucide cho icon sản phẩm là lựa chọn triển khai của đặc tả; giữ biểu tượng điều hướng hệ thống native khi phù hợp. Cỡ nhỏ 16, thường 20–24, lớn 28–32. Không trộn phong cách icon trang trí.
- Chuyển động nhẹ 150–300ms. iOS dùng chuyển tiếp có cảm giác spring; Android ease-in-out. Không kéo dài loading bằng animation và không dùng chuyển động làm bằng chứng thành công.
- Phản hồi nhấn bằng opacity hoặc scale nhẹ 0.98; không phụ thuộc hover. Giảm/bỏ motion không thiết yếu khi người dùng yêu cầu giảm chuyển động là cách áp dụng nguyên tắc tiếp cận Nova.

### Chạm, tiếp cận và thích ứng nền tảng

- Vùng chạm tối thiểu iOS 44pt, Android 48dp, bao gồm icon đóng, xóa ảnh, sao đánh giá và nút phụ. Khoảng trống giữa các thao tác dùng thang Nova.
- Icon hành động có tên đọc được; tab luôn có icon + nhãn. Badge đọc được cả loại và trạng thái; lỗi không chỉ biểu thị bằng màu.
- Thứ tự đọc theo nội dung và thứ bậc hành động. Label input luôn hiện; trợ giúp/lỗi liên kết với trường. Focus đến lỗi cần sửa hoặc tiêu đề modal, quay lại điểm mở khi đóng.
- Giá, địa chỉ, thời hạn, điều kiện hủy và CTA không bị cắt mất vì font scaling. Nội dung cuộn phải vượt qua được bàn phím và thanh hành động cố định.
- iOS thoáng hơn bằng các mức Nova liền kề, có thể dùng blur/translucency nhẹ nếu vẫn đọc rõ. Android dày hơn vừa phải, giữ Material behaviors và nút Back hệ thống. Không thu nhỏ vùng chạm để tăng mật độ.
- Tab + Stack: bottom tabs tối đa 5 mục; push khi đi sâu; modal cho tác vụ tạm thời. Không sao chép popup desktop thành nhiều cửa sổ nổi trên mobile.

## 1. Bối cảnh sản phẩm

Handigo là quy trình dịch vụ tại nhà: khám phá → chuẩn bị đơn → thanh toán/cọc và điều phối theo điều kiện → thực hiện → hậu mãi. Phía chuyên gia có hồ sơ xét duyệt, nhận việc, lịch làm, báo giá và thu nhập. Nguồn: PA §1, §3, §4.

Hai nhánh cần thấy rõ từ đầu: dịch vụ giá cố định và dịch vụ cần khảo sát/báo giá. Không dùng một từ “Giá” cho cả giá dịch vụ, cọc và tiền sửa chữa còn lại. Định kỳ là nhiều buổi/đơn có liên kết. Nguồn: PA §6, §13, §14.

Đặc tả tập trung CUSTOMER và PROVIDER cùng các điểm vào công khai/xác thực. Phạm vi ADMIN trên mobile: **Needs product decision — D01**. Có AI, điểm thưởng và đề xuất dịch vụ trong PA; việc đưa AI vào bản mobile đầu tiên cần quyết định, còn cấu trúc phải không nhầm AI với chat người dùng.

## 2. Vai trò người dùng

| Vai trò | Ngữ cảnh thiết kế | Ràng buộc |
| --- | --- | --- |
| Khách chưa đăng nhập | Khám phá dịch vụ, nội dung công khai, đăng nhập/đăng ký | Không tạo booking ẩn danh; hồ sơ chuyên gia không mặc định công khai cho khách vãng lai |
| CUSTOMER | Tạo/quản lý đơn, trả tiền, đánh giá, địa chỉ, ví, ưu đãi, hỗ trợ | Chỉ thể hiện các hành động được quyền trong ngữ cảnh đơn |
| PROVIDER đang onboarding | Hoàn thiện/lưu nháp/gửi lại hồ sơ, theo dõi xét duyệt | Không coi trạng thái chờ duyệt là quyền nhận việc |
| PROVIDER đủ điều kiện | Công việc, lịch, khách hàng trong đơn, báo giá, bằng chứng, thu nhập | Profile chuyên gia, availability và trạng thái đơn là ba thông tin riêng |
| ADMIN | Đã có trên web | Không thêm tab hoặc khả năng quản trị vào hai vai trò trên; D01 |

Nguồn: PA §2, §5, §18. Dùng “Chuyên gia” nhất quán trong ngôn ngữ giao diện. Đổi vai trò tức thời hoặc provider đặt đơn khách: **Needs product decision — D02**. Không dùng một công tắc giao diện để giả lập quyền backend.

## 3. Nguyên tắc UX sản phẩm

1. **Hành động theo ngữ cảnh:** một hành động chính tại một thời điểm; các hành động khác có thể ở nội dung hoặc menu có nhãn. Không ép màn nào cũng có CTA nếu đang chờ server. PA §8, §10.
2. **Nêu rõ đang chờ ai:** chuyên gia, khách, thanh toán hay hệ thống. Không dùng một trạng thái “Đang xử lý” cho mọi trục. PA §10, §17.
3. **Minh bạch tiền trước cam kết:** hiện loại khoản tiền, số tiền và điều kiện ngay cạnh CTA; xem trước hậu quả trước hủy. PA §14.
4. **Tin cậy bằng dữ liệu:** xác minh, số đánh giá, kinh nghiệm và bằng chứng là thông tin có nguồn; không thêm bảo đảm hoặc chứng nhận chưa có. PA §7, §15.
5. **Giữ ngữ cảnh khi lỗi:** biểu mẫu, đơn và khoản đang xử lý không biến mất vì tải lỗi; không biến lỗi mạng thành rỗng. Đây là hướng xử lý UX từ PA §17, không cam kết đồng bộ offline.
6. **Tách tiến độ công việc và tiền:** hoàn thành công việc không tự chứng minh đã thu tiền; đồng ý báo giá không đồng nghĩa đã trả phần sửa chữa. PA §10, §14.
7. **Hiện đủ để quyết định, mở rộng khi cần:** tên dịch vụ/lịch/giá ở cấp đầu; hạng mục, lịch sử, bằng chứng ở cấp sau. Không ẩn phí hoặc thời hạn trong phần mở rộng. PA §7.
8. **Không suy diễn tiện ích marketplace:** không tự thêm đấu giá, tip, subscription, theo dõi thợ yêu thích, đổi lịch, gọi video hoặc đánh giá hai chiều. Nguồn chức năng phải có trong PA; các khả năng ngoài nguồn cần quyết định riêng.

## 4. Thứ bậc thông tin

| Bối cảnh | Ưu tiên 1 | Ưu tiên 2 | Ưu tiên 3 |
| --- | --- | --- | --- |
| Khám phá dịch vụ | Tên và loại giá | Giá/cọc đúng nhãn, tùy chọn cần chọn | Mô tả, ảnh, thông tin bổ sung |
| Chọn chuyên gia | Tên và phù hợp với dịch vụ/lịch đang chọn | Xác minh, điểm + số đánh giá, khu vực | Kinh nghiệm, số đơn, giới thiệu |
| Chi tiết đơn khách | Trạng thái cần chú ý và hành động khả dụng | Dịch vụ, lịch, địa chỉ, số tiền đúng loại | Đối tác, tiến trình, ảnh/lịch sử |
| Assignment | Dịch vụ và hạn phản hồi thật | Lịch, địa chỉ, thông tin tiền đã có | Chi tiết nhu cầu |
| Công việc provider | Việc phải làm tiếp và điều kiện chặn | Nhu cầu, địa điểm, lịch | Tiền, ảnh, lịch sử, phản hồi |
| Xác nhận tài chính | Số tiền + mục đích + phương thức | Chi tiết giá/cọc/giảm giá hoặc chính sách hủy | Mã tham chiếu và thông tin phụ |
| Hậu mãi | Kết quả, đánh giá/vụ việc hiện tại | Phản hồi và thao tác hợp lệ | Ảnh, lịch sử |

Nguồn: PA §7–§9. Trong chi tiết đơn, ưu tiên nội dung cần xử lý hơn ảnh trang trí hoặc bản đồ. Khi hủy, tiền hoàn/phí và phạm vi hủy lên trên lịch sử. Không cắt mã đơn cần đối chiếu hoặc địa chỉ trong màn chi tiết; thẻ tóm tắt được rút gọn nhưng mở ra phải đầy đủ.

## 5. Kiến trúc thông tin mobile

Đây là cấu trúc đề xuất cho mobile dựa trên PA §5, không thêm quyền hoặc endpoint.

```text
Ứng dụng
├── Khám phá công khai / nội dung / xác thực
├── Customer Tabs
│   ├── Khám phá → Danh mục → Dịch vụ → Chuẩn bị đơn
│   ├── Đơn của tôi → Chi tiết → Báo giá / Hủy / Đánh giá / Vụ việc
│   ├── Tin nhắn → Hội thoại theo đơn
│   └── Tài khoản → Hồ sơ / Địa chỉ / Ví / Ngân hàng / Ưu đãi / Hỗ trợ
├── Provider Onboarding → Hồ sơ / Tài liệu / Trạng thái xét duyệt
└── Professional Tabs
    ├── Tổng quan → Availability / Tóm tắt công việc và thu nhập
    ├── Công việc → Yêu cầu nhận việc / Đơn → Báo giá / Hoàn thành
    ├── Lịch → Ngày → Chi tiết công việc
    ├── Tin nhắn → Hội thoại theo đơn
    └── Tài khoản → Hồ sơ nghề nghiệp / Ví / Ngân hàng / Đánh giá / Hỗ trợ
```

Thông báo mở từ header qua một màn danh sách trong stack, không thêm tab thứ sáu. Đây là cách trình bày mobile của nguồn thông báo đã có. Provider có Đề xuất dịch vụ trong Tài khoản; khách có Đăng ký chuyên gia ở ngữ cảnh tài khoản. Giới thiệu, tin tức và hỗ trợ công khai nằm trong nhóm thông tin, không trở thành tab công việc.

Các tác vụ chọn lọc, chọn phương thức, lý do hủy và xác nhận dùng modal. Chi tiết đơn, hồ sơ, báo giá nhiều dòng, chat và form dài dùng màn stack. Luồng đặt đơn đi sâu trong stack; kết quả mở đúng đơn đã tạo. Mở thông báo hoặc trở về từ gateway phải kiểm tra phiên/quyền, tải lại tài nguyên rồi mới chọn hành động. Universal link, push và callback native cụ thể: **Needs product decision — D04**.

## 6. Điều hướng khách hàng

| Tab | Nội dung gốc | Màn con/điểm vào |
| --- | --- | --- |
| Khám phá | Tìm kiếm, danh mục và dịch vụ | Chi tiết dịch vụ; hồ sơ chuyên gia theo quyền; các bước đặt |
| Đơn của tôi | Danh sách, trạng thái, tìm kiếm | Chi tiết đơn, từng buổi định kỳ, báo giá, theo dõi, đánh giá, khiếu nại |
| Tin nhắn | Hội thoại và chưa đọc | Chat gắn đơn; menu đọc/báo cáo |
| Tài khoản | Thông tin và tác vụ cá nhân | Hồ sơ, địa chỉ, ví/ngân hàng, điểm/voucher, hỗ trợ, đăng ký provider |

Khách vãng lai có thể khám phá; tab cần tài khoản dẫn đến đăng nhập với lời giải thích đúng tác vụ. Không hiện dữ liệu mẫu như đơn/tin nhắn thật. Khi đăng nhập xong, chỉ tiếp tục tác vụ cũ nếu quyền và đầu vào còn hợp lệ. Đây là bố trí điều hướng trên cơ sở guard và các luồng có trong PA §2, §5.

Thông báo từ header; hỗ trợ đơn từ chi tiết; không bắt người dùng rời đơn để nhập lại mã đơn trong luồng đã có context. Không có nút “Đặt lại” tự sao chép đơn, “Đổi lịch” hay “Yêu thích chuyên gia” khi PA chưa xác nhận hành vi đó.

## 7. Điều hướng chuyên gia

| Tab | Nội dung gốc | Màn con/điểm vào |
| --- | --- | --- |
| Tổng quan | Availability, công việc/lịch và tóm tắt thu nhập có dữ liệu | Chi tiết công việc, ví, hồ sơ nghề nghiệp |
| Công việc | Yêu cầu chờ nhận tách khỏi các đơn đã giao | Assignment → đơn; báo giá; bắt đầu; bằng chứng hoàn thành |
| Lịch | Tháng/ngày và công việc trong ngày | Chi tiết cùng đơn đang quản lý ở Công việc |
| Tin nhắn | Hội thoại liên quan các đơn | Chat và báo cáo |
| Tài khoản | Hồ sơ nghề nghiệp và tài chính | Xác minh/chứng chỉ, khu vực, ví/ngân hàng, đánh giá, đề xuất dịch vụ, hỗ trợ |

Nguồn: PA §4, §5, §18. Onboarding là ngữ cảnh riêng trước quyền nhận việc; có thể xem/sửa hồ sơ theo quyền hiện hữu. Không tạo đường tắt qua tab để bỏ xét duyệt. Availability `online/offline/busy` khác kết nối mạng điện thoại.

Yêu cầu nhận việc có thể hiện modal khi đang dùng app vì PA có modal toàn ứng dụng, nhưng phải hiện đúng hạn từ dữ liệu và không chồng nhiều modal. Chính sách khi có nhiều assignment đồng thời, thông báo ở nền hoặc người dùng đang trong thao tác tài chính: **Needs product decision — D05**. Không tự thêm tự nhận đơn bằng một công tắc mới.

## 8. Component nghiệp vụ

### 8.1. Hợp đồng chung và tái sử dụng Nova

“Bắt buộc” dưới đây là dữ liệu/ngữ cảnh cần cho component thể hiện đúng nội dung và quyền, không đề xuất thêm field API. “Tùy chọn” chỉ hiện khi có dữ liệu hợp lệ. Nếu dữ liệu bắt buộc chưa tải được, dùng trạng thái tải/lỗi; không điền giá hoặc điểm mặc định thành dữ liệu thật. Ưu tiên **P1 → P2 → P3** là thứ tự đọc. Mọi component áp dụng tải/lỗi/disabled/busy chung ở §18 ngoài các trạng thái liệt kê riêng.

```text
Nova Card
  → ServiceCard, ProfessionalCard, BookingCard, JobCard, AssignmentCard
  → QuotationCard, PriceSummaryCard, ReviewCard, VerificationCard
  → WalletSummaryCard, RewardCard, CaseCard
Nova Input
  → SearchInput, AddressInput, ProblemDescriptionInput, MoneyInput
Nova List Item
  → ServiceOptionRow, ConversationRow, NotificationRow
  → WalletTransactionRow, BankAccountRow
Nova Button
  → Các CTA theo trạng thái và role, không tạo kiểu nút riêng cho từng domain
Nova tokens + Caption/Small + icon
  → Badge (mở rộng) → VerifiedBadge, RatingBadge, JobStatusBadge
```

**Badge là phần mở rộng cần thiết:** Nova gốc chưa định nghĩa primitive Badge. Dùng Surface, Border, typography Caption hoặc Small phù hợp, khoảng cách 4/8, radius 10 từ Nova; nhãn rõ, icon tùy chọn. Badge không tương tác không cần giả hình nút; nếu tương tác, vùng chạm vẫn đạt chuẩn. Không thêm màu, glow hay kiểu viên thuốc riêng. Không gọi extension này là primitive đã có sẵn trong Nova.

### 8.2. Khám phá, nhập liệu và chuẩn bị đơn

#### ServiceCard — Nova Card

- **Mục đích:** giúp chọn đúng dịch vụ và hiểu loại giá. **Bắt buộc:** ID, tên, loại giá và giá/cọc khả dụng với nhãn đúng nghĩa. **Tùy chọn:** ảnh, mô tả ngắn, danh mục, giá từ nếu nguồn cung cấp.
- **Ưu tiên:** P1 tên + loại giá; P2 số tiền được gắn nhãn; P3 ảnh/mô tả. **Hành động chính:** xem dịch vụ. **Phụ:** không thêm thao tác yêu thích; chọn tùy chọn/đặt ở chi tiết.
- **Trạng thái:** có giá cố định; cần khảo sát; thiếu giá hợp lệ; tải/lỗi. Thiếu giá không hiển thị 0đ. **Nguồn:** PA §7, §9, §11.

#### ProfessionalCard — Nova Card

- **Mục đích:** hiểu chuyên môn và lựa chọn phù hợp. **Bắt buộc:** ID, tên, ngữ cảnh xem hồ sơ hoặc chọn trong booking. **Tùy chọn:** ảnh, xác minh, điểm kèm số đánh giá, kinh nghiệm, số đơn, khu vực; tính khả dụng khi API đã kiểm tra.
- **Ưu tiên:** P1 tên + phù hợp lịch/dịch vụ; P2 VerifiedBadge/RatingBadge; P3 kinh nghiệm/khu vực. **Chính:** xem hồ sơ; trong bộ chọn được phép thì chọn chuyên gia. **Phụ:** xem hồ sơ từ bộ chọn. Không có chat trước đơn.
- **Trạng thái:** chưa kiểm tra, đang kiểm tra, khả dụng, không khả dụng, đã chọn, lỗi; thiếu ảnh dùng tên/initials. Không tạo thứ hạng “tốt nhất” từ suy đoán. **Nguồn:** PA §7, §12, §13.

#### ServiceOptionRow — Nova List Item + Input/Button

- **Mục đích:** chọn cấu hình và số lượng đúng dịch vụ. **Bắt buộc:** ID/tên tùy chọn, giá, quy tắc nhóm single/multiple và quantity khi áp dụng. **Tùy chọn:** mô tả, ảnh.
- **Ưu tiên:** P1 tên + trạng thái chọn; P2 đơn giá/số lượng/thành tiền; P3 mô tả. **Chính:** chọn/bỏ hoặc đổi số lượng theo quy tắc. **Phụ:** xem mô tả.
- **Trạng thái:** chưa chọn/đã chọn, nhóm bắt buộc còn thiếu, không hợp lệ, đang cập nhật giá. Không áp dụng lựa chọn tùy chọn thông thường thay cho nhánh `uniformQuantity` của vệ sinh điều hòa. **Nguồn:** PA §6, §9, §11.

#### SearchInput — Nova Input

- **Mục đích:** tìm trong đúng phạm vi danh sách. **Bắt buộc:** nhãn phạm vi, giá trị từ khóa, hành vi tìm của màn. **Tùy chọn:** nút xóa khi có nội dung.
- **Ưu tiên:** P1 từ khóa; P2 phạm vi và trạng thái kết quả. **Chính:** nhập/tìm. **Phụ:** xóa từ khóa; bộ lọc là tác vụ riêng.
- **Trạng thái:** trống, có từ khóa, đang tìm, có/không có kết quả, lỗi. Không gợi ý tìm theo tên tùy chọn dịch vụ hoặc sửa chính tả tự động chưa có trong PA. **Nguồn:** PA §12.

#### AddressInput — Nova Input + List Item

- **Mục đích:** chọn/lưu nơi thực hiện và người nhận. **Bắt buộc:** nhãn trường; địa chỉ đã chọn hoặc trạng thái chưa chọn; form gồm người nhận, điện thoại, dòng địa chỉ, tỉnh/phường. **Tùy chọn:** ghi chú, mặc định, tọa độ và placeId.
- **Ưu tiên:** P1 địa chỉ và người nhận; P2 điện thoại; P3 ghi chú/mặc định. **Chính:** chọn hoặc lưu địa chỉ. **Phụ:** sửa, thêm mới, dùng vị trí hiện tại theo quyền.
- **Trạng thái:** chưa chọn, đang tải, đã chọn, lỗi trường, đang định vị, không có quyền/không tìm được vị trí. Địa chỉ mặc định không đồng nghĩa đã được kiểm tra có chuyên gia. **Nguồn:** PA §11, §13, §17.

#### ProblemDescriptionInput — Nova Input nhiều dòng

- **Mục đích:** mô tả nhu cầu để provider hiểu việc. **Bắt buộc:** nội dung, nhãn và kiểm tra tối thiểu 10 ký tự. **Tùy chọn:** phần ảnh hiện trạng qua EvidencePicker.
- **Ưu tiên:** P1 mô tả; P2 hướng dẫn/lỗi; P3 ảnh. **Chính:** nhập/sửa. **Phụ:** đính kèm hoặc bỏ ảnh ở component kế bên.
- **Trạng thái:** trống, quá ngắn, hợp lệ, đang gửi. Không tự thêm giới hạn tối đa khi PA chưa xác nhận. **Nguồn:** PA §11.

#### ScheduleSelector — Nova Card + Input + List Item

- **Mục đích:** chọn đặt ngay/hẹn lịch/định kỳ. **Bắt buộc:** loại đặt; ngày/giờ khi cần; đơn vị và số buổi nếu định kỳ. **Tùy chọn:** danh sách ngày dự kiến và dữ liệu thời lượng khi có.
- **Ưu tiên:** P1 loại đặt + lịch; P2 chu kỳ/số buổi; P3 preview từng ngày. **Chính:** chọn lịch để kiểm tra phù hợp. **Phụ:** đổi loại/chỉnh lịch trước khi tạo đơn.
- **Trạng thái:** thiếu lịch, không hợp lệ, đang kiểm tra chuyên gia, không có người phù hợp, hợp lệ. Không tạo chức năng đổi lịch đơn đã đặt. **Nguồn:** PA §11, §13.

#### EvidencePicker — Nova Card + Button

- **Mục đích:** thu ảnh trong đúng nghiệp vụ. **Bắt buộc:** ngữ cảnh, số lượng ảnh hiện có, giới hạn tương ứng, trạng thái từng ảnh. **Tùy chọn:** ghi chú hoàn thành hoặc ảnh đã lưu được phép xem.
- **Ưu tiên:** P1 yêu cầu ảnh/giới hạn; P2 ảnh và lỗi từng ảnh; P3 ghi chú. **Chính:** chọn ảnh. **Phụ:** bỏ ảnh trước gửi, xem ảnh, thử lại ảnh lỗi khi kết quả đã rõ.
- **Trạng thái:** rỗng tùy chọn/rỗng bắt buộc, đang upload, một phần thành công, đủ giới hạn, lỗi. Hiện trạng: tối đa 4 ảnh, 5 MB, tối thiểu 320 × 240; hoàn thành: 1–5 ảnh, 5 MB; đánh giá: 0–5 ảnh, 5 MB. Không dùng giới hạn này thay cho tài liệu onboarding/vụ việc chưa xác minh. **Nguồn:** PA §11, §17.

### 8.3. Đơn, công việc, tiền và trạng thái

#### BookingCard — Nova Card

- **Mục đích:** tóm tắt đơn cho khách. **Bắt buộc:** ID/mã, dịch vụ, trạng thái đơn, loại đặt/lịch hoặc nhãn đặt ngay, số tiền và loại tiền được xác định. **Tùy chọn:** địa chỉ ngắn, provider đã gán, booking/payment status, buổi thứ mấy.
- **Ưu tiên:** P1 dịch vụ + trạng thái cần chú ý; P2 lịch + số tiền; P3 provider/địa chỉ. **Chính:** xem chi tiết; với completed có thể vào đánh giá rồi kiểm tra `canReview`. **Phụ:** không hủy trực tiếp trên thẻ, mở chi tiết để xem chính sách.
- **Trạng thái:** created/accepted/in_progress/completed/cancelled; chưa gán provider; trạng thái lịch/tiền hiển thị riêng khi cần. **Nguồn:** PA §7, §8, §10.

#### JobCard — Nova Card

- **Mục đích:** tóm tắt công việc đã giao cho chuyên gia. **Bắt buộc:** ID/mã, dịch vụ, trạng thái, lịch và địa điểm từ dữ liệu đơn. **Tùy chọn:** khách, thời lượng/dự phòng, giờ kết thúc dự kiến, thông tin thu nhập/thu trực tiếp có nhãn.
- **Ưu tiên:** P1 việc + trạng thái; P2 thời gian/địa chỉ; P3 khách và tiền. **Chính:** mở chi tiết để thực hiện bước tiếp. **Phụ:** mở chat theo quyền/ngữ cảnh đơn.
- **Trạng thái:** đã nhận, đang làm, hoàn thành, hủy; chưa đủ điều kiện tiếp tục thì hiện lý do trong chi tiết. Không đồng nhất với AssignmentCard. **Nguồn:** PA §7, §13, §18.

#### AssignmentCard — Nova Card + Button

- **Mục đích:** phản hồi yêu cầu nhận việc. **Bắt buộc:** assignment ID, đơn/dịch vụ liên quan, trạng thái, hạn phản hồi. **Tùy chọn:** lịch/địa điểm/nhu cầu/tiền được trả về cho yêu cầu.
- **Ưu tiên:** P1 dịch vụ + hạn; P2 lịch/địa điểm; P3 nhu cầu. **Chính:** nhận khi pending và còn điều kiện. **Phụ:** xem chi tiết, từ chối với lý do tùy chọn.
- **Trạng thái:** pending, đang gửi, accepted, rejected, timeout, cancelled; đồng hồ hết hạn chờ cập nhật kết quả. **Nguồn:** PA §10, §13.

#### QuotationCard / QuotationEditor — Nova Card + List Item + Input

- **Mục đích:** đọc/duyệt hoặc soạn báo giá khảo sát. **Bắt buộc:** order, trạng thái, hạng mục có tên/loại/số lượng/đơn giá, tổng và thời lượng khi soạn. **Tùy chọn:** ghi chú khảo sát, đề xuất, giảm giá theo dữ liệu, cọc đã áp dụng.
- **Ưu tiên:** P1 trạng thái + tổng + số thu trực tiếp; P2 hạng mục và thời lượng; P3 ghi chú. **Chính:** provider gửi báo giá; khách đồng ý khi được phép. **Phụ:** provider thêm/bỏ dòng, xem hỗ trợ scan/AI nếu trong phạm vi; khách từ chối kèm lý do.
- **Trạng thái:** đang soạn, kiểm tra, cảnh báo/blocked độ liên quan, gửi, pending/approved/rejected/expired/cancelled; lịch chưa xác nhận chặn soạn theo điều kiện nguồn. Không cung cấp sửa báo giá đã gửi nếu chưa xác định quyền. **Nguồn:** PA §11, §13–§14; AI/scan native thuộc D11.

#### PriceSummaryCard — Nova Card + List Item

- **Mục đích:** trình bày khoản tiền đúng thời điểm. **Bắt buộc:** ngữ cảnh full/cọc/báo giá/hoàn tiền, số tiền xác nhận từ dữ liệu, các thành phần áp dụng. **Tùy chọn:** voucher/promotion, phụ phí, số đã trả, chính sách hoàn và tham chiếu.
- **Ưu tiên:** P1 số tiền + loại khoản; P2 các dòng cấu thành; P3 giải thích. **Chính:** component thuần hiển thị; CTA xác nhận ở màn chứa. **Phụ:** mở chi tiết giá/chính sách khi có.
- **Trạng thái:** chưa có preview, đang cập nhật, hợp lệ, giá thay đổi, lỗi; không cho xác nhận với giá chưa xác định. **Nguồn:** PA §7, §13–§14.

#### PaymentMethodSelector — Nova List Item + Button

- **Mục đích:** chọn cách trả khoản đang xét. **Bắt buộc:** loại khoản, các phương thức được phép, lựa chọn hiện tại. **Tùy chọn:** số dư ví khi tải được, mô tả phương thức.
- **Ưu tiên:** P1 phương thức và khoản; P2 lý do không khả dụng. **Chính:** chọn phương thức. **Phụ:** đóng/quay lại; không thêm phương thức từ enum chưa có UI.
- **Trạng thái:** chưa chọn/đã chọn, không khả dụng, đang gửi/đợi kết quả. Khảo sát không trình bày cash như lựa chọn hợp lệ cho cọc. **Nguồn:** PA §14.

#### CancellationReview — Nova Card + Input + modal

- **Mục đích:** giúp hiểu hậu quả trước hủy. **Bắt buộc:** đơn, single/series, preview và `canCancel`, lý do. **Tùy chọn:** giải thích thêm, các buổi và chi tiết phân bổ tiền trong preview.
- **Ưu tiên:** P1 phạm vi + tiền hoàn/phí; P2 lý do/chính sách; P3 chi tiết từng buổi. **Chính:** xác nhận hủy khi đủ điều kiện. **Phụ:** quay lại; không tự xác nhận khi preview lỗi.
- **Trạng thái:** đang lấy preview, được/không được hủy, lỗi, đang gửi, kết quả đã xác nhận/chưa rõ. Luồng provider dùng lý do riêng, không dùng preview khách để suy ra bồi thường của provider. **Nguồn:** PA §11, §13–§14.

#### JobStatusBadge — extension Badge

- **Mục đích:** nhận diện tiến độ công việc, không đại diện toàn bộ lịch/tiền. **Bắt buộc:** mã status, nhãn dịch và loại đối tượng. **Tùy chọn:** icon.
- **Ưu tiên:** P1 nhãn; P2 icon semantic. **Chính:** không có. **Phụ:** không có; giải thích dài ở status panel.
- **Trạng thái:** năm status đơn; mã lạ dùng trung tính và thông báo chưa xác định, không tự gán completed/cancelled. **Nguồn:** PA §10.

#### StatusActionPanel — Nova Card + Button

- **Mục đích:** nói đang chờ ai và bước hợp lệ kế tiếp. **Bắt buộc:** ngữ cảnh order/booking/payment/reassignment, trạng thái đã tải và hành động được phép. **Tùy chọn:** hạn, lý do, provider thay thế.
- **Ưu tiên:** P1 lý do cần chú ý + CTA; P2 hạn/hậu quả; P3 giải thích. **Chính:** hành động tương ứng như thanh toán, phản hồi đổi người, hoặc không có khi đang chờ. **Phụ:** mở chi tiết/hỗ trợ theo ngữ cảnh.
- **Trạng thái:** chờ chuyên gia, giữ lịch, chờ tiền, tìm người, chờ khách đổi người, hết hạn, đang cập nhật, lỗi. Không ép các trục thành một timeline. **Nguồn:** PA §10, §13, §17.

### 8.4. Tin cậy, đánh giá, liên lạc và tài khoản

#### VerifiedBadge — extension Badge

- **Mục đích:** thể hiện sự xác minh có bằng chứng. **Bắt buộc:** đúng đối tượng và kết quả xác minh từ dữ liệu được phép xem. **Tùy chọn:** loại xác minh được phép công khai.
- **Ưu tiên:** P1 nhãn xác minh; P2 icon. **Chính/phụ:** không có; hồ sơ riêng xử lý tài liệu.
- **Trạng thái:** verified mới có badge xác minh tương ứng; thiếu dữ liệu không hiện badge. Pending/rejected thuộc hồ sơ riêng, không tự đưa lý do từ chối ra hồ sơ công khai. Không đồng nghĩa bảo hành hay kiểm tra lý lịch. **Nguồn:** PA §2, §7, §10.

#### RatingBadge — extension Badge

- **Mục đích:** tóm tắt uy tín qua đánh giá. **Bắt buộc:** điểm và số đánh giá hoặc dữ liệu xác nhận chưa có đánh giá. **Tùy chọn:** icon sao.
- **Ưu tiên:** P1 điểm + số lượng; P2 nhãn “Chưa có đánh giá” khi đúng dữ liệu. **Chính/phụ:** không có; lối mở đánh giá nằm ở màn chứa.
- **Trạng thái:** có đánh giá, chưa có đánh giá, chưa tải được. Không đổi thiếu dữ liệu thành 0 sao. **Nguồn:** PA §7, §15.

#### ReviewCard / ReviewForm — Nova Card + Input + Button

- **Mục đích:** đọc/viết đánh giá gắn đơn. **Bắt buộc:** context đơn và quyền; khi đọc có số sao/người đánh giá/thời điểm, khi viết có sao 1–5. **Tùy chọn:** nhận xét, ảnh, phản hồi provider.
- **Ưu tiên:** P1 sao + bối cảnh; P2 nhận xét/ảnh; P3 thời gian/phản hồi. **Chính:** khách gửi/sửa khi `canReview`; provider phản hồi/sửa nội dung phản hồi. **Phụ:** xem ảnh, hủy chỉnh sửa; không thêm xóa đánh giá nếu chưa có nguồn.
- **Trạng thái:** chưa có, chỉ đọc, được sửa, không đủ quyền kèm reason, đang lưu/lỗi. Nội dung tối đa 1000 ký tự; ảnh dùng quy tắc review. **Nguồn:** PA §11, §15.

#### ConversationRow / ConversationView — Nova List Item + Input + Button

- **Mục đích:** trao đổi giữa hai phía theo đơn. **Bắt buộc:** conversation/order context, đối tác, message ID/nội dung/loại/thời điểm khi có. **Tùy chọn:** avatar, tin cuối, chưa đọc, sent/seen.
- **Ưu tiên:** P1 đối tác + đơn; P2 tin và trạng thái; P3 thời gian. **Chính:** mở hội thoại/gửi văn bản hoặc ảnh. **Phụ:** sửa/xóa tin của mình theo quyền, đọc, báo cáo.
- **Trạng thái:** rỗng, tải, sẵn sàng, chưa sẵn sàng theo đơn, gửi, lỗi, mất kết nối. Không có typing/online đối tác, gọi thoại hoặc video khi chưa có bằng chứng. **Nguồn:** PA §16–§17.

#### NotificationRow — Nova List Item

- **Mục đích:** đưa người dùng đến sự kiện cần xem. **Bắt buộc:** ID, nội dung, trạng thái đọc; đích đến nếu sự kiện có tài nguyên. **Tùy chọn:** thời gian và loại thông báo.
- **Ưu tiên:** P1 nội dung; P2 đối tượng liên quan/thời gian; P3 chỉ dấu chưa đọc. **Chính:** mở tài nguyên khi có đích hợp lệ. **Phụ:** đánh dấu đọc; đọc tất cả ở màn danh sách.
- **Trạng thái:** đã/chưa đọc, tài nguyên không còn truy cập được, lỗi tải/lỗi đánh dấu. Không giả số chưa đọc khi API chưa tải. **Nguồn:** PA §16.

#### VerificationCard — Nova Card + Input + Button

- **Mục đích:** hoàn thiện hồ sơ nghề nghiệp/tài liệu và theo dõi duyệt. **Bắt buộc:** loại hồ sơ/tài liệu, trạng thái, các trường yêu cầu tương ứng. **Tùy chọn:** gợi ý OCR, chứng chỉ, lịch sử/lý do từ chối.
- **Ưu tiên:** P1 trạng thái + việc cần bổ sung; P2 trường/tài liệu; P3 lịch sử. **Chính:** gửi hoặc gửi lại khi đủ điều kiện. **Phụ:** lưu nháp khi luồng có hỗ trợ, sửa thông tin gợi ý OCR, xem tài liệu.
- **Trạng thái:** draft/pending/resubmitted/approved/rejected; định danh/chứng chỉ giữ trục riêng; upload/OCR lỗi. Không tự biến OCR thành xác minh thành công. **Nguồn:** PA §10–§11.

#### WalletSummaryCard / MoneyInput — Nova Card + Input + Button

- **Mục đích:** xem số dư và nhập khoản nạp/rút. **Bắt buộc:** số dư và loại tác vụ; số tiền khi gửi. **Tùy chọn:** pendingBalance, tổng thu nhập/nạp/chi/rút theo role.
- **Ưu tiên:** P1 số dư khả dụng hoặc số tiền nhập; P2 khoản chờ; P3 thống kê. **Chính:** nạp hoặc gửi yêu cầu rút theo tác vụ đã mở. **Phụ:** xem giao dịch/yêu cầu rút/ngân hàng.
- **Trạng thái:** tải/lỗi, hợp lệ, số tiền nhỏ hơn 1, vượt số dư khi rút, chuyển cổng, chờ xác nhận, đã gửi yêu cầu. Số dư không tự thay đổi trước kết quả. **Nguồn:** PA §11, §14.

#### WalletTransactionRow / BankAccountRow — Nova List Item

- **Mục đích:** tra cứu giao dịch hoặc tài khoản nhận tiền. **Bắt buộc:** với giao dịch: loại/chiều/số tiền/trạng thái/thời gian; với ngân hàng: ngân hàng, số/chủ tài khoản, trạng thái. **Tùy chọn:** mã, mô tả, số dư sau, mặc định.
- **Ưu tiên:** P1 số tiền + trạng thái hoặc ngân hàng + số tài khoản; P2 thời gian/chủ; P3 metadata. **Chính:** giao dịch là thông tin tra cứu; ngân hàng mở sửa. **Phụ:** ngân hàng đặt mặc định/xóa theo luồng hiện có, không có nút hoàn tiền trên từng giao dịch khách.
- **Trạng thái:** enum giao dịch ví; ngân hàng active/inactive, mặc định, đang xử lý. Không nhầm giao dịch ví với Payment. **Nguồn:** PA §6–§7, §14.

#### RewardCard — Nova Card + Button

- **Mục đích:** đổi điểm hoặc dùng mã đã sở hữu. **Bắt buộc:** loại thẻ offer/voucher; điểm cần đổi hoặc mã; điều kiện và thời hạn từ policy. **Tùy chọn:** giá trị ưu đãi, tiến độ đủ điểm.
- **Ưu tiên:** P1 quyền lợi + chi phí điểm; P2 điều kiện/hạn; P3 giải thích. **Chính:** offer mở xác nhận đổi; voucher sao chép mã. **Phụ:** xem chính sách/lịch sử.
- **Trạng thái:** đủ/thiếu điểm, đang đổi, mã hiện có, chưa rõ kết quả/lỗi. Không hứa hoàn điểm khi mã hết hạn; thử lại yêu cầu chưa rõ dùng cùng requestId theo luồng nguồn. **Nguồn:** PA §14, §17.

#### CaseCard / CaseForm — Nova Card + Input + List Item

- **Mục đích:** khiếu nại, hỗ trợ hoặc báo cáo đúng loại. **Bắt buộc:** loại vụ việc, tiêu đề/mô tả, trạng thái nếu đã gửi; complaint cần đơn, ticket cần category, report cần loại đối tượng/loại báo cáo. **Tùy chọn:** file, order đối với ticket, phản hồi/kết quả và yêu cầu bằng chứng.
- **Ưu tiên:** P1 vấn đề + trạng thái; P2 việc người dùng cần làm; P3 lịch sử/file. **Chính:** tạo khi đủ dữ liệu hoặc xem vụ việc. **Phụ:** phản hồi/bổ sung bằng chứng chỉ khi luồng và quyền cho phép.
- **Trạng thái:** dùng đúng enum từng loại ở PA, đang gửi/lỗi; không hứa SLA xử lý hoặc tiền bồi thường. **Nguồn:** PA §6–§7, §10–§11, §16; chi tiết quyền/giới hạn form thuộc D12.

#### LocationPanel — Nova Card + map + List Item

- **Mục đích:** giúp nhận biết nơi thực hiện và vị trí đang theo dõi. **Bắt buộc:** địa chỉ có thể đọc được, vai trò người xem và trạng thái dữ liệu vị trí. **Tùy chọn:** điểm dịch vụ, vị trí provider, tuyến đường khi có dữ liệu.
- **Ưu tiên:** P1 địa chỉ; P2 tình trạng vị trí; P3 bản đồ/tuyến. **Chính:** xem thông tin theo dõi; không có hành động cập nhật đơn trực tiếp trên map. **Phụ:** trở lại chi tiết; tại bước chọn địa chỉ có dùng định vị theo AddressInput.
- **Trạng thái:** tải map, chưa có tọa độ, đang theo dõi, lỗi GPS/kết nối; không mô phỏng di chuyển hoặc ETA thiếu nguồn. **Nguồn:** PA §16–§17; tracking nền thuộc D04.

## 9. Luồng đặt dịch vụ của khách hàng

Nguồn nghiệp vụ: PA §11, §13–§14. Các bước dưới đây nhóm lại thông tin cho mobile, không xác định lại thứ tự nghiệp vụ giữ lịch chưa rõ.

| Bước màn hình | Nội dung/kiểm tra | CTA chính và lối phụ |
| --- | --- | --- |
| 1. Dịch vụ | Chi tiết; loại giá; tùy chọn bắt buộc; số lượng theo dịch vụ | Tiếp tục; quay về khám phá |
| 2. Nhu cầu và lịch | AddressInput, mô tả ≥10 ký tự, ảnh tùy chọn; đặt ngay/hẹn/định kỳ; ngày giờ theo quy tắc | Tiếp tục khi có dữ liệu hợp lệ; sửa bước trước |
| 3. Chuyên gia phù hợp | Kiểm tra theo dịch vụ/địa chỉ/lịch/chuỗi; không bắt chọn đích danh nếu tự điều phối được phép | Tiếp tục khi `available`; sửa địa chỉ/lịch, xem/chọn provider nếu được phép |
| 4. Kiểm tra và xác nhận | Preview giá, voucher đã áp dụng, phương thức; tổng/cọc đúng nhãn, các thông tin đơn | Xác nhận hoặc thanh toán đúng khoản mà flow cho phép; sửa thông tin |
| 5. Kết quả thực tế | Đọc lại order/payment, hiển thị chờ/đang tìm/đã xác nhận theo dữ liệu | Xem đơn hoặc hành động tiếp theo hợp lệ |

Hẹn lịch sớm nhất 08:00 ngày mai theo nguồn; khung giờ hiện có 08:00–17:00. Dải gợi ý 14 ngày không phải giới hạn đặt tối đa. Định kỳ weekly có 1/2/3/4 lần, monthly có 4/8/12 trong form hiện tại; hiện từng ngày để người dùng kiểm tra, không đổi thành gói subscription. Chưa xác định múi giờ nghiệp vụ khi thiết bị ở múi giờ khác: **Needs product decision — D09**.

Không có provider khả dụng thì giữ màn và nêu rõ đổi lịch/địa chỉ; lỗi tìm provider phải nói lỗi kiểm tra, không nói chắc chắn không có thợ. Khi đổi đầu vào làm lựa chọn provider không còn hợp lệ, bỏ lựa chọn và giải thích cần kiểm tra lại.

Tạo đơn và trả tiền là tác vụ có thể cho kết quả chưa rõ. Giữ context ID đơn chờ theo luồng đã có, tránh nút thử lại tạo đơn mới ngay. Không xóa đơn cũ chỉ vì giao diện cần quay lại. **Needs product decision — D03:** thứ tự thu tiền/giữ lịch/nhận lịch cho từng loại đơn. Không khóa thiết kế thành “tất cả hẹn lịch trả ngay” hoặc “tất cả trả trước 24 giờ”.

## 10. Luồng công việc của chuyên gia

Nguồn: PA §11, §13, §18.

| Giai đoạn | Trình bày và hành động |
| --- | --- |
| Onboarding | Hiện trạng thái hồ sơ và việc cần bổ sung; chỉ mở quyền công việc khi đủ điều kiện |
| Nhận yêu cầu | AssignmentCard có hạn và thông tin liên quan; nhận/từ chối; chờ server xác nhận kết quả |
| Đơn đã nhận | Thông tin khách/người nhận, nhu cầu, địa chỉ, lịch; chat theo điều kiện; phân biệt chờ xác nhận lịch với có thể làm |
| Giá cố định | Khi accepted và không yêu cầu khảo sát, hiển thị Bắt đầu thực hiện theo điều kiện nguồn |
| Cần khảo sát | Form báo giá chỉ khi đủ điều kiện; chờ khách đồng ý; approved + accepted mở Bắt đầu làm việc |
| Đang làm | Chi tiết nhu cầu, chat, thông tin thời gian/vị trí; CTA chuẩn bị hoàn thành |
| Hoàn thành | Chọn 1–5 ảnh đúng định dạng/giới hạn, ghi chú tùy chọn ≤1000 ký tự, gửi; chỉ hiển thị completed khi có kết quả |
| Sau công việc | Xem bằng chứng, dữ liệu tiền/thu nhập và đánh giá; phản hồi khách |

Provider hủy ở accepted/in_progress theo điều kiện; lý do bắt buộc, giải thích tối thiểu 10 ký tự nếu nhập và bắt buộc cho “Lý do khác”. Sau gửi phải đọc kết quả; không hiển thị “Khách đã được hoàn tiền” từ việc provider bấm hủy. Không thêm nút “Đã đến nơi” hoặc “Khách xác nhận hoàn thành” vì PA không xác nhận các bước đó.

## 11. Hệ trạng thái công việc

### 11.1. Trạng thái đơn và ngữ nghĩa thị giác

| Mã domain | Nhãn UI | Token hỗ trợ | Hành động điển hình, vẫn cần điều kiện |
| --- | --- | --- | --- |
| `created` | Đang xử lý | Warning | Khách xem chi tiết/thanh toán khi được phép; không coi là đã có thợ |
| `accepted` | Đã chấp nhận | Primary | Provider bắt đầu theo nhánh giá/báo giá; hai bên chat theo ngữ cảnh |
| `in_progress` | Đang thực hiện | Primary | Provider gửi hoàn thành; khách theo dõi |
| `completed` | Đã hoàn thành | Success | Khách đánh giá theo canReview; provider xem/phản hồi |
| `cancelled` | Đã hủy | Text Secondary | Xem lý do/kết quả tiền thật; không gán lỗi thanh toán |

Đây là ánh xạ semantic sang palette Nova, không dùng màu trạng thái web. Cancelled là kết quả nghiệp vụ có thể hợp lệ nên không bắt buộc tô Error; Error dành cho lỗi thao tác. Chữ badge vẫn đọc rõ theo nền và luôn có nhãn.

### 11.2. Các trục bổ sung phải giữ riêng

| Trục | Giá trị theo PA | Cách trình bày |
| --- | --- | --- |
| Giữ lịch | not_required / awaiting_provider / awaiting_payment / reserved / confirmed / rejected / expired | Nhãn lịch và panel chờ/xử lý; not_required không phải cảnh báo |
| Tiền trên đơn | unpaid / partially_paid / paid / refunded | “Chưa thanh toán / Đã thanh toán một phần / Đã thanh toán / Đã hoàn tiền”, ghi rõ khoản nếu có |
| Payment | pending / paid / failed / refunded | Chi tiết từng giao dịch, khác trạng thái tổng trên đơn |
| Assignment | pending / accepted / rejected / timeout / cancelled | Trạng thái yêu cầu nhận việc và hạn phản hồi |
| Báo giá | pending / approved / rejected / expired / cancelled | Nhãn báo giá riêng, không biến approved thành order completed |
| Đổi chuyên gia | awaiting_customer / matching / matched / declined / expired / failed | Nêu ai cần phản hồi và kết quả tìm người |
| Availability | online / offline / busy | Nhãn sẵn sàng chuyên gia; không dùng để suy ra trạng thái kết nối app |

Nguồn: PA §10. Khái quát `created → accepted → in_progress → completed` là tiến độ, không phải state machine đầy đủ được phép thực hiện ở client. Không thêm transition chỉ vì có enum. Lịch reserved/awaiting_payment theo D03; cơ chế hết hạn/tác nhân một số trạng thái theo D10.

Timeline chỉ dùng mốc có dữ liệu hoặc giai đoạn hiện tại; không dựng giờ đã nhận/hoàn thành giả. Đồng hồ 0 chuyển thông điệp “Đang cập nhật kết quả”, không tự hủy đơn. Khi có nhiều cảnh báo, nêu điều kiện đang chặn thao tác, sau đó giữ nhãn của các trục liên quan.

## 12. Tin cậy và xác minh

Nguồn: PA §7, §10–§11. Đặt tên, ảnh, xác minh và điểm/số đánh giá gần nhau ở ProfessionalCard; không để ảnh lớn lấn thông tin năng lực. Chưa có đánh giá hiển thị đúng trạng thái, không tự tạo sao hoặc lời chứng thực.

Hồ sơ đăng ký, định danh và chứng chỉ là các trạng thái độc lập. Màn riêng gồm thông tin nghề nghiệp → dịch vụ/khu vực → định danh/tài liệu → xem lại/gửi. Có nháp và gửi lại hồ sơ bị từ chối; lý do từ chối đặt cạnh phần cần sửa, lịch sử ở cấp sau.

Yêu cầu từ nguồn: có dịch vụ, khu vực, mô tả; giấy tờ có số/họ tên; CCCD cần ảnh mặt trước trong validation đã phân tích, hộ chiếu cần ảnh tương ứng. Chứng chỉ nếu thêm cần tên và ảnh. Không tự bắt selfie, ảnh mặt sau hoặc số lượng chứng chỉ tối thiểu chỉ vì type có field.

OCR là gợi ý cần người dùng kiểm tra. Không dùng OCR thành công để hiển thị VerifiedBadge. Tài liệu định danh và lý do từ chối không đưa lên hồ sơ công khai. Phạm vi chứng chỉ công khai, cách diễn giải cờ verified và tiêu chuẩn xét duyệt: **Needs product decision — D07**.

## 13. Giá và thanh toán

Nguồn: PA §13–§14. Mọi màn phải phân biệt: giá dịch vụ, phụ phí, giảm giá, số trả lúc này, cọc đã trả, tổng báo giá và tiền trả trực tiếp.

| Ngữ cảnh | Thông tin phải thấy trước CTA | Quy tắc |
| --- | --- | --- |
| Giá cố định | Tùy chọn/số lượng, giá và các dòng phí/giảm, số tiền xác nhận | Phương thức ví/bank-PayOS/cash theo flow |
| Khảo sát | Nhãn “Cọc khảo sát”, số tiền và giải thích báo giá sau khảo sát | Không mô tả là giá toàn bộ sửa chữa; không cho cash trả cọc trong flow đã xác nhận |
| Báo giá đã nhận | Tổng hạng mục, cọc áp dụng, tiền thu trực tiếp | Tiền trực tiếp = max(tổng báo giá − cọc áp dụng, 0); không dùng tất cả phụ phí như cọc được trừ |
| Thanh toán tiếp | Khoản thiếu được server xác định và phương thức được phép | Không hiện nút nếu không thỏa các điều kiện payment/booking/order trong PA |
| Hủy | Phạm vi, tiền hoàn, phí và lý do chính sách từ preview | Không hard-code tỷ lệ; không thông báo đã hoàn từ thao tác hủy |
| Rút ví | Số tiền, số dư và thông điệp “yêu cầu chờ duyệt” | Không ghi “Chuyển tiền thành công” ngay sau gửi |

Nút có nhãn theo tác vụ: “Thanh toán cọc”, “Xác nhận đặt dịch vụ”, “Đồng ý báo giá”, “Gửi yêu cầu rút tiền”; chỉ kèm số tiền khi preview đã có và được xác nhận. Không biến đồng ý báo giá thành cam kết thanh toán online phần còn lại. Không thêm thu thẻ trực tiếp, VNPAY, tip hoặc trả góp.

Sau gateway, hiện đang kiểm tra rồi đọc lại kết quả. Return URL hoặc tên màn success không đủ chứng minh paid. Khi kết quả chưa rõ, giữ mã đơn và cho xem trạng thái; không khuyến khích trả lần nữa. Xác nhận thu tiền mặt và xử lý tiền trực tiếp/hoàn tiền: **Needs product decision — D06**.

Ví hiển thị khả dụng/chờ riêng. Nạp tạo link rồi đồng bộ; rút không vượt số dư theo nguồn. Cách chọn ngân hàng nhận rút, mức tối thiểu nghiệp vụ và giới hạn thực tế: D06; không suy ra từ validation frontend “≥1”.

Voucher cần áp dụng hợp lệ; hiện điều kiện và kết quả giảm, không tự áp mã. Điểm thưởng có số dư/lịch sử, lọc đủ điểm và xác nhận đổi; số điểm, hạn mã và điều kiện đọc từ policy. Không đổi điểm thành tiền hoặc hứa hoàn điểm ngoài nguồn.

## 14. Đánh giá và phản hồi

Nguồn: PA §11, §15. Điểm vào từ đơn completed; trước khi cho gửi/sửa phải có context `canReview`. Khi không được phép, hiện reason nếu có; không chỉ ẩn nút khiến người dùng không hiểu.

Form dùng sao 1–5 có vùng chạm chuẩn Nova, nhãn đọc “n trên 5 sao”, nhận xét tùy chọn tối đa 1000 ký tự và tối đa 5 ảnh đúng giới hạn. Không chọn sẵn 5 sao. Ảnh và phản hồi mở trong stack/modal đơn giản, không dùng carousel tự chạy.

Provider xem điểm trung bình, số lượng, phân bố sao và danh sách; lọc từ khóa/sao/đã phản hồi, gửi/sửa phản hồi không rỗng tối đa 1000 ký tự. Không thêm provider chấm sao khách. `isVisible` nghĩa là khả năng xuất hiện công khai không được suy ra từ gửi thành công. Thời hạn sửa, quyền xóa và chính sách ẩn đánh giá: **Needs product decision — D08**.

## 15. Tìm kiếm và bộ lọc

Nguồn: PA §12. SearchInput ở đầu nội dung; bộ lọc mở modal tạm thời, có nhãn bộ lọc đang áp dụng và thao tác bỏ lọc. Không đưa sort/filter chưa có vào giao diện chỉ để đủ mẫu UI.

| Danh sách | Tìm/lọc được hỗ trợ | Sắp xếp và giới hạn |
| --- | --- | --- |
| Dịch vụ | Tên + mô tả + danh mục, bỏ dấu/không phân biệt hoa thường; lọc danh mục | Tên tiếng Việt hoặc giá tăng; nhóm chỉ báo giá sau khảo sát xuống cuối, không dùng cọc làm giá sửa chữa |
| Đơn khách | Search và status gửi API, debounce 500ms | Không hứa tìm theo trường cụ thể ngoài bằng chứng; 10/lần trên web không phải token thiết kế |
| Công việc | Search 500ms; all/accepted/in_progress/completed/cancelled | Assignment riêng; không thêm lọc khoảng cách hoặc thu nhập |
| Đánh giá provider | Từ khóa, sao, đã/chưa phản hồi | Không thêm “hữu ích nhất” |
| Ví/rút | Loại và khoảng ngày của giao dịch; trạng thái yêu cầu rút | Giữ query đúng loại tài nguyên |
| Ưu đãi | Đủ điểm để đổi | Không biến thành lọc mức giảm chưa có |

Đổi tìm/lọc đưa danh sách về đầu kết quả mới. Phân biệt không có dữ liệu với không khớp; trạng thái không khớp có CTA bỏ lọc hoặc sửa từ khóa. Lịch và chat đang có giới hạn tải ở web, không hiển thị “đã xem tất cả” nếu chưa biết dữ liệu đầy đủ. Chiến lược phân trang/lịch sử native: **Needs product decision — D10**.

## 16. Vị trí và địa chỉ

Nguồn: PA §7, §11, §16–§17. Sổ địa chỉ trình bày người nhận và địa điểm rõ, không dùng tên tài khoản thay chắc chắn cho người nhận. Form theo tỉnh/thành và phường/xã đang có; district trong dữ liệu cũ chỉ là thông tin tương thích, không thêm trường bắt buộc mới.

Địa chỉ đã lưu → chọn; địa chỉ mới → form; dùng vị trí hiện tại là lựa chọn theo ngữ cảnh, không là yêu cầu để khám phá ứng dụng. Chỉ xin quyền vị trí khi tác vụ cần đến nó. Nếu từ chối hoặc GPS lỗi, vẫn cho xem/nhập địa chỉ; chỉ chặn bước đặt nếu kiểm tra dịch vụ/chuyên gia chưa hoàn tất, không tuyên bố địa chỉ chắc chắn phục vụ được.

Map là nội dung hỗ trợ; địa chỉ chữ luôn có. Khi không có cập nhật vị trí, hiện tình trạng dữ liệu, không tạo đường đi/chuyển động hoặc ETA suy đoán. Native background tracking và vị trí khi app bị đóng: D04. Thuật toán xếp hạng chuyên gia theo vị trí/phạm vi phục vụ: D10; giữ danh sách do nguồn trả về, không tự gắn “gần nhất”.

## 17. Chat và giao tiếp

Nguồn: PA §16. Tin nhắn là tab nội dung, hội thoại là màn stack với header đối tác + tham chiếu đơn; composer tránh bàn phím/safe area. Không bê popup thu nhỏ desktop lên mobile.

Chat theo đơn hỗ trợ văn bản/ảnh, sent/seen, sửa/xóa tin của mình theo quyền, đánh dấu đọc và báo cáo. Thứ tự theo thời gian, trùng thời gian theo ID; không nhân đôi tin từ API/socket. Nhãn gửi/đã đọc chỉ xuất hiện theo trạng thái được xác nhận; lỗi gửi không trông giống tin đã gửi.

Nút chat trong chi tiết đơn khách theo accepted/in_progress ở nguồn. Đọc/gửi hội thoại sau hoàn thành và thời hạn sửa/xóa: **Needs product decision — D08**; không tự chặn đọc chỉ vì nút chi tiết đã ẩn. Không thêm typing, online đối tác hoặc gọi thoại/video. Điện thoại có thể hiển thị theo dữ liệu nhưng không gọi đó là gọi ẩn số.

Thông báo trong app dùng danh sách và chưa đọc; chỉ điều hướng tới tài nguyên có quyền. Push native/các hành động từ notification hệ điều hành theo D04. Hỗ trợ/khiếu nại/báo cáo mở đúng loại, không nhập chung mọi vấn đề vào chat với provider.

AI nếu đưa vào mobile phải có nhãn “Trợ lý AI” tách khỏi hội thoại người dùng, giữ bản xem trước/xác nhận hành động và trạng thái cần đối soát. Không cho câu trả lời AI thay thế trạng thái thanh toán thật. Phạm vi phiên, voice/scan và cách xuất hiện trên mobile: **Needs product decision — D11**.

## 18. Loading, rỗng, lỗi và offline

### 18.1. Hệ trạng thái giao diện

Đây là quy tắc trình bày mở rộng từ Nova và PA §17. Trạng thái UI như “đang gửi” không thêm giá trị vào enum đơn/payment.

| Trạng thái | Trình bày | Hành động/giới hạn |
| --- | --- | --- |
| Tải lần đầu | Skeleton dùng Surface/Border và bố cục nội dung dự kiến; nhãn tải đọc được | Không dựng giá, sao hoặc số dư giả |
| Làm mới | Giữ nội dung hiện có kèm chỉ dấu đang cập nhật | Không để dữ liệu cũ trông như đã đối soát xong |
| Rỗng thật | Nói rõ chưa có đơn/tin/đánh giá, một CTA đúng ngữ cảnh nếu có | Chưa có đơn có thể tìm dịch vụ; chưa có tin không cho tạo chat không gắn đơn |
| Rỗng do lọc | Nêu không có kết quả phù hợp | Bỏ lọc/sửa từ khóa, không báo hệ thống không có dịch vụ |
| Lỗi trường | Nhãn lỗi sát trường, nêu cách sửa, giữ giá trị nhập | Đưa focus đến trường cần sửa; không chỉ dùng viền đỏ |
| Lỗi tải | Nội dung ngắn và Thử lại | Không thay bằng empty state; tách lỗi assignment và lỗi danh sách đơn |
| Đang gửi | CTA có nhãn tác vụ, khóa gửi trùng trong thao tác đó | Không khóa đọc mọi nội dung; không thông báo thành công sớm |
| Upload một phần | Giữ ảnh đã tải, chỉ rõ ảnh lỗi | Chọn lại/thử lại có kiểm soát, không tải lại toàn bộ không cần thiết |
| Thiếu quyền | Nêu đăng nhập/cần hoàn thiện hồ sơ/không còn quyền tùy dữ liệu | Không giải thích sai là lỗi mạng |
| Kết quả chưa xác định | “Chưa xác định được kết quả” + mã tài nguyên nếu có | Đọc lại trạng thái; không tạo payment/đơn mới chỉ từ nút retry |
| GPS không sẵn sàng | Địa chỉ chữ + trạng thái không có vị trí | Không hiện vị trí cũ như realtime |

### 18.2. Offline — không giả định hỗ trợ đồng bộ

PA chưa chứng minh chế độ offline, cache bền vững hoặc hàng đợi tác vụ. **Needs product decision — D13** cho lưu nháp qua đóng app, cache dữ liệu, gửi lại tự động và đồng bộ nền.

Quy tắc trình bày trong khi chưa có quyết định:

- Khi biết mất kết nối, nói “Mất kết nối” và phân biệt với availability `offline` của provider. Nếu chỉ có request lỗi, nói không tải/gửi được, không khẳng định thiết bị offline.
- Nếu màn còn dữ liệu đã tải trong phiên, có thể giữ để đọc và đánh dấu chưa cập nhật; không hứa mở được dữ liệu đó sau khởi động lại.
- Không mô tả booking/nhận việc/thanh toán/hoàn thành đã được gửi khi chưa có xác nhận; không tự xếp vào hàng đợi gửi nền.
- Giữ nội dung đang nhập trong màn đang mở; khi kết nối lại, tải trạng thái hiện tại trước khi mở lại hành động phụ thuộc hạn hoặc tiền.
- Tin nhắn đang soạn không biến thành sent; hết countdown khi offline không tự biến assignment thành accepted hoặc đơn thành cancelled.

### 18.3. Mẫu lời nhắn

| Ngữ cảnh | Nội dung mẫu |
| --- | --- |
| Lỗi kiểm tra thợ | “Chưa kiểm tra được chuyên gia phù hợp. Vui lòng thử lại.” |
| Không có thợ, đã có kết quả | “Chưa có chuyên gia phù hợp với địa chỉ và thời gian đã chọn.” |
| Chờ kết quả gateway | “Đang kiểm tra kết quả thanh toán.” |
| Kết quả tiền chưa rõ | “Chưa xác định được kết quả thanh toán. Kiểm tra trạng thái đơn trước khi thanh toán lại.” |
| Hết đếm ngược điều phối | “Đã hết thời gian tìm chuyên gia. Hệ thống đang cập nhật kết quả.” |
| Thiếu vị trí realtime | “Chưa có cập nhật vị trí. Bạn vẫn có thể xem thông tin đơn.” |

## 19. Mẫu màn hình theo vai trò

Mọi mẫu dùng nền, typography, khoảng cách và primitive Nova; không có dashboard desktop thu nhỏ. Nguồn nội dung: PA §5, §7–§9, §18.

| Mẫu màn | Cấu trúc từ trên xuống | Vùng hành động |
| --- | --- | --- |
| Khám phá khách | Title → SearchInput → danh mục/lọc → ServiceCard | Mở chi tiết; không CTA thanh toán cố định ở danh sách |
| Chi tiết dịch vụ | Tên/loại giá → thông tin dịch vụ → cấu hình → bước đặt | CTA tiếp tục gắn tóm tắt có dữ liệu; không dùng ảnh hero làm trọng tâm |
| Chuẩn bị đơn | Tiêu đề/bước → trường cùng nhóm → lỗi inline → preview cần thiết | CTA theo bước, không che phần cuối form/bàn phím |
| Chi tiết booking | Mã/dịch vụ → StatusActionPanel → lịch/địa chỉ/tiền → provider/map → báo giá/bằng chứng/hậu mãi | Một CTA hợp lệ nổi bật; hủy ở hành động riêng có hậu quả rõ |
| Tổng quan provider | Availability → việc/lịch cần chú ý → tóm tắt tiền | Mở việc hoặc ví; không đánh đồng doanh thu với số dư |
| Danh sách công việc | Assignment riêng → tìm/lọc → JobCard | Nhận yêu cầu khi hợp lệ; đơn đã nhận mở chi tiết |
| Chi tiết job | StatusActionPanel → nhu cầu/địa chỉ/lịch → tiền/báo giá → bằng chứng | Bắt đầu/gửi báo giá/hoàn thành theo điều kiện |
| Lịch provider | Chọn tháng/ngày → công việc trong ngày | Mở cùng chi tiết job; không có kéo-thả đổi lịch |
| Báo giá | Context đơn → hạng mục → thời lượng/ghi chú → tổng/cọc/tiền trực tiếp | Provider gửi; khách đồng ý/từ chối; không gộp với thanh toán online |
| Hồ sơ onboarding | Trạng thái → phần phải bổ sung → tài liệu/thông tin → xem lại | Lưu nháp/gửi lại theo quyền; không có nút nhận đơn |
| Ví hai vai trò | Khả dụng/chờ → nạp/rút → giao dịch/yêu cầu | Mỗi modal tiền một tác vụ; thống kê khác nhau theo role |
| Đánh giá provider | Điểm/số lượng/phân bố → bộ lọc → ReviewCard | Phản hồi/sửa phản hồi |
| Chat | Đối tác + đơn → tin → composer | Nút gửi có trạng thái; menu phụ không che nội dung đang soạn |
| Hỗ trợ | Loại vụ việc → danh sách/status → chi tiết | Tạo/đọc/phản hồi theo loại và quyền; form chưa rõ theo D12 |

Một màn chỉ dùng thanh CTA cố định khi có hành động rõ; chừa khoảng cuối bằng chiều cao thực tế của thanh cộng safe area để không che nội dung. Khi font lớn, ưu tiên nút xuống dòng/nở chiều cao thay vì ép nhỏ. Đây là quy tắc bố trí từ Nova, không mở thêm hành động nghiệp vụ.

## 20. Quy tắc Nên / Không nên theo sản phẩm

| Nên | Không nên |
| --- | --- |
| Dùng đúng token và primitive Nova cho cả hai role | Sao chép màu, font, bóng, radius, bảng/sidebar hoặc layout của web |
| Gắn nhãn “Cọc khảo sát”, “Tổng báo giá”, “Trả trực tiếp” | Hiển thị một giá duy nhất làm khách tưởng đã trả đủ |
| Đọc trạng thái payment/order sau gateway | Coi redirect về success là paid |
| Phân biệt status đơn, lịch, tiền và assignment | Dựng một chuỗi tuyến tính chứa mọi enum |
| Hiện số đánh giá cạnh điểm và xác minh có nguồn | Tạo badge “đảm bảo”, điểm mẫu hay chuyên gia “tốt nhất” |
| Kiểm tra canReview và quyền gửi/sửa | Tự áp thời hạn đánh giá hoặc thêm chấm sao khách |
| Giữ lỗi tải khác rỗng thật | Nói “Không có yêu cầu nhận việc” khi request thất bại |
| Hiện preview hoàn tiền và phạm vi một buổi/chuỗi | Hứa hoàn 100% hoặc xóa đơn khi chưa có kết quả |
| Dùng địa chỉ người nhận và dữ liệu vị trí thật | Bắt GPS để khám phá hoặc mô phỏng thợ đang di chuyển |
| Mở chat trong context đơn, tách AI | Chat với provider bất kỳ trước đặt hoặc thêm gọi video |
| Thể hiện rút tiền là yêu cầu xét duyệt | Hiển thị đã chuyển tiền ngay khi submit |
| Giữ bước xét duyệt provider | Cho đổi role bằng công tắc UI để vượt quyền |
| Dùng vùng chạm chuẩn, nhãn rõ, font scaling | Dùng hover/long-press làm lối duy nhất đến tác vụ quan trọng |
| Đưa phần chưa rõ vào danh sách quyết định | Tự thêm queue offline, tracking nền, push hoặc tính năng từ enum chưa dùng |

## Danh sách Needs product decision

Danh sách này là phần bắt buộc khi bàn giao; không biến nội dung chưa rõ thành lời hứa trong UI. Các đoạn navigation/component ở trên có thể thiết kế bố cục, nhưng hành vi phụ thuộc quyết định không được giả định đã hoạt động.

| ID | Trạng thái | Câu hỏi phải chốt | Cơ sở |
| --- | --- | --- | --- |
| D01 | Needs product decision | ADMIN có thuộc phạm vi mobile không; điểm vào khi tài khoản ADMIN đăng nhập mobile là gì? | PA §2, §5 |
| D02 | Needs product decision | Một tài khoản có thể đổi customer/provider và đặt đơn khi đang là provider không? | PA §2 và giới hạn cuối tài liệu |
| D03 | Needs product decision | Với từng loại đơn, thu tiền trước hay sau nhận lịch; khi nào reserved/awaiting_payment/confirmed; thời điểm mở trả tiền? | PA §10, §14 |
| D04 | Needs product decision | Callback/deep link native, push, tracking nền và quyền tương ứng; điều gì xảy ra khi app bị đóng? | PA §16 và giới hạn cuối tài liệu |
| D05 | Needs product decision | Xử lý nhiều assignment đồng thời, ưu tiên thông báo khi đang trả tiền và thời hạn do server quy định thế nào? | PA §10, §13 |
| D06 | Needs product decision | Ai xác nhận tiền mặt/thu trực tiếp; điều kiện/thời điểm hoàn; ngân hàng dùng để rút; giới hạn tiền thực tế? | PA §11, §14 |
| D07 | Needs product decision | Verified biểu thị chính xác điều gì; chứng chỉ nào công khai; tiêu chuẩn duyệt và quyền xem tài liệu? | PA §7, §10–§11 |
| D08 | Needs product decision | Thời hạn/quyền chỉnh sửa đánh giá, chính sách hiển thị; đọc/gửi/sửa/xóa chat sau hoàn thành? | PA §15–§16 |
| D09 | Needs product decision | Múi giờ nghiệp vụ và khả năng đặt khi thiết bị ở múi giờ khác; giới hạn tương lai thực tế? | PA §11–§13 |
| D10 | Needs product decision | Phân trang lịch/chat đầy đủ; tác nhân hết hạn; trường search đơn, thứ tự/xếp hạng provider được bảo đảm? | PA §10, §12, giới hạn cuối tài liệu |
| D11 | Needs product decision | Phạm vi AI/scan/OCR/voice trong mobile, tích hợp native và điều kiện hoạt động thực tế của OAuth? | PA §3, §9, §16 |
| D12 | Needs product decision | Validation file/form và quyền phản hồi/bổ sung/hủy của từng loại vụ việc trên mobile? | PA §11 và giới hạn contract vụ việc |
| D13 | Needs product decision | Có lưu nháp/cache qua đóng app, hàng đợi offline, retry tự động hoặc đồng bộ nền không? | PA §17 chưa xác nhận offline |

## Điều kiện nghiệm thu đặc tả khi triển khai

- Light/Dark dùng đúng bảng màu; font hệ thống, scale, spacing, radius và vùng chạm đúng Nova. Kiểm tra tương phản ở tổ hợp thực tế, font lớn, bàn phím và safe area.
- Customer có 4 tab, professional có 5 tab theo đặc tả; các màn sâu có back đúng ngữ cảnh, quyền và onboarding không bị bỏ qua.
- Mỗi component có đủ dữ liệu/placeholder/lỗi phù hợp, một thứ bậc hành động rõ, không dựng giá/điểm/trạng thái chưa có.
- Màn tiền, giữ lịch, báo giá và hủy phân biệt các trục trạng thái; kết quả chưa rõ được thể hiện đúng, không tạo giao dịch trùng từ UI.
- Không gắn hành vi chưa chốt D01–D13 vào CTA như tính năng đã sẵn sàng. Việc đóng một mục quyết định phải cập nhật nguồn nghiệp vụ và đặc tả tương ứng.
- Không mang giới hạn hoặc thiếu sót của web thành quy tắc sản phẩm mới; không sao chép phong cách thị giác web.
