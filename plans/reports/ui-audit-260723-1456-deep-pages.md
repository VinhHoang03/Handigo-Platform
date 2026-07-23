# Audit UI các trang sâu (sau đăng nhập) - handigo-web

Ngày: 2026-07-23 · Branch: `feat/ui-refactor-landing` · Skill: `design-taste-frontend`

Phạm vi: 42 trang sau đăng nhập, tức toàn bộ phần **chưa** được xử lý bởi 3 đợt
trước (`260722-1248` nợ kỹ thuật toàn nền tảng, `260722-1822` nhóm công khai,
`260722-2235` `/customer/services`).

---

## Design Read

> Đây là **product UI** của một sàn dịch vụ gia đình: luồng đặt đơn 3 bước, ví
> tiền, hồ sơ, bảng điều khiển thợ, và 15 trang quản trị đầy bảng dữ liệu. Đối
> tượng là người đã cam kết dùng sản phẩm, không phải khách đang cân nhắc.

## Ranh giới của skill (đọc trước khi dùng báo cáo này)

Section 13 của `design-taste-frontend` nói rõ skill **không dành cho** dashboard,
bảng dữ liệu, và wizard nhiều bước. Ba thứ đó chiếm phần lớn phạm vi ở đây. Nên:

| Áp dụng | Không áp dụng |
|---|---|
| Trạng thái loading/rỗng/lỗi, tương phản WCAG, vùng chạm, khoá hình dạng, khoá màu, thang chữ, copy, ban em-dash, chuyển động có lý do | Luật hero, ngân sách eyebrow, cấm 3 thẻ đều nhau, cấm zigzag, luật ảnh thật, chọn font display |

15 trang `/admin/*` và mọi `<table>`: chỉ áp cột trái. Đừng "làm đẹp" chúng theo
luật landing page - đó là sai lệch có chủ ý, ghi lại để không ai sửa nhầm.

## Ba dial cho nhóm trang này

| Dial | Hiện tại (đo được) | Đề xuất | Lý do |
|---|---|---|---|
| `DESIGN_VARIANCE` | ~3 | **3** (giữ) | Product UI cần đoán trước được. Bất đối xứng ở đây là lỗi, không phải phong cách. |
| `MOTION_INTENSITY` | **~1** | **3** | Landing đang ở 5. Chênh lệch này là phát hiện lớn nhất về cảm giác, xem T2-1. |
| `VISUAL_DENSITY` | ~5 | 5 (customer) / 7 (admin) | Trang quản trị đang dùng cùng mật độ với trang khách, lãng phí màn hình. |

---

## Những gì KHÔNG cần đụng vào (đợt trước đã làm tốt)

Xác nhận bằng đo đạc, không phải đọc lướt:

- **0 file `.tsx` > 200 dòng** - luật kích thước file vẫn giữ.
- **0 lần `ui-avatars.com`**, 0 `glass-card`.
- Token màu M3 áp dụng nhất quán; `success`/`warning` ngữ nghĩa đã thay bảng màu
  mặc định Tailwind.
- `AsyncState` + `Skeleton` dùng đúng ở hầu hết trang danh sách
  (`BookingHistoryPage`, `NotificationsPage`, `WalletPage`, admin).
- `OrderSummaryCard` đã phân biệt đúng **"Phí cọc"** với **giá** - chính là bài
  học nợ tin cậy từ đợt `/customer/services`, đã lan sang được luồng đặt đơn.
- `DashboardLayout` có bottom-nav mobile với `env(safe-area-inset-bottom)`.
- `MaterialIcon` luôn `aria-hidden` kèm giải thích lý do.

---

## Tầng 0 - Lỗi hệ thống (sửa trước, rẻ, ảnh hưởng toàn cục)

### T0-1. 17 chỗ dùng class typography KHÔNG TỒN TẠI

`text-title-lg` (9 lần), `text-headline-sm` + `font-headline-sm` (6), `text-title-md` (2).
Không có token nào trong `src/index.css`. Tailwind v4 chỉ sinh utility từ
`@theme`, nên các class này **không sinh CSS** - heading render bằng cỡ chữ kế
thừa (16px), phân cấp thị giác gãy im lặng. Build xanh, ESLint 0 lỗi.

Nơi bị: `WalletTransactionsSection.tsx:65`, `WalletWithdrawalsSection.tsx:62`,
`WalletStatsCards.tsx:41`, `NotificationsPage.tsx:66`, `AdminRevenuePage.tsx:79,90`,
`ReconciliationPanel.tsx:21`, `WithdrawalStatsAndFilters.tsx:29`,
`ProviderBankAccountsPage.tsx:77`, `Step2ExecutionInfoSection.tsx:32`,
`Step2ScheduleSection.tsx:53`, `BookingProviderCard.tsx:55`,
`OrderFeedbackSection.tsx:16`, `AddressBookManager.tsx:61`,
`SavedAddressesPanel.tsx:29`, `ProviderCertificatesSection.tsx:37`,
`ProviderIdentityDocumentSection.tsx:45`.

Hai lựa chọn, phải chốt: **(a)** thêm `title-lg`/`title-md`/`headline-sm` vào
`@theme` (đúng thang M3, tốn 3 token), hoặc **(b)** quy về thang sẵn có. Khuyến
nghị (a) - M3 vốn có `title-*`, thiếu chúng là lý do mọi người tự chế.

### T0-2. Thang chữ token bị lấn át bởi Tailwind mặc định

601 lần `text-sm` + 279 `text-xs` so với ~200 lần dùng class token. Hệ typography
thực thi trên trang sâu đang là thang Tailwind mặc định, không phải M3. Hệ quả:
`text-sm` (14px/20px) và `text-label-md` (14px/20px/`+0.01em`/500) trông gần
giống nhau nhưng khác weight và tracking, nên cùng một cấp nội dung hiển thị
khác nhau giữa các trang.

### T0-3. Hai họ icon chạy song song

- `lucide-react`: 48 file - tập trung ở `admin/`, `profile/`, `provider-application/`, `case-management/`
- Material Symbols (glyph qua Google Fonts): 217 chỗ - tập trung ở `booking/`, `customer-service/`, `provider/`, `home/`

Không file nào trộn cả hai (tốt), nhưng **người dùng đi qua nhiều trang thì
thấy**: nét icon, độ dày, bo góc khác nhau giữa trang ví và trang hồ sơ. Skill
3.C: một họ / dự án.

Ghi chú kèm: `index.html:44` vẫn nạp stylesheet từ `fonts.googleapis.com`. Đã
được cắt bằng `icon_names=` (chỉ ~200 icon) nên chi phí không lớn, nhưng vẫn là
render-blocking stylesheet từ host ngoài - mâu thuẫn với mục tiêu "gỡ phụ thuộc
CDN" của plan `260722-1248`. Hợp nhất về `lucide-react` xoá luôn được request này.

### T0-4. Không có dark mode ở bất kỳ đâu

`grep "dark:"` trên toàn bộ trang sâu = **0 file**. Skill 6.C coi đây là bắt buộc
với sản phẩm hướng người dùng cuối. Nhưng đây là quyết định phạm vi lớn (~150
file), **không được âm thầm thêm vào**. Cần user chốt: làm, hay ghi nhận là bỏ
qua có chủ ý.

### T0-5. Chưa khoá bán kính bo góc

7 bậc đang dùng: `xl` 348 · `2xl` 214 · `lg` 186 · `full` 146 · `3xl` 51 · `md` 8 ·
`[2px]` 1. Không có quy tắc thành văn. Skill 4.4 cho phép hệ hỗn hợp **nếu** có
quy tắc và tuân thủ khắp nơi. Đề xuất chốt: thẻ `2xl`, input/nút `xl`, chip/avatar
`full`, xoá `md` và `[2px]`.

### T0-6. 4 chỗ dùng `h-screen`

Skill 3.E: dùng `min-h-[100dvh]`, nếu không thanh địa chỉ Safari iOS làm nhảy layout.

---

## Tầng 1 - Nợ tin cậy (đắt nhất, đúng loại lỗi 2 đợt trước đã tìm ra)

### T1-1. Điểm đánh giá viết cứng trên dashboard thợ

`features/provider/components/home/ProviderHomeStats.tsx:67` - `value="4.9/5"`.
Thợ vừa đăng ký, 0 đơn, vẫn thấy "Đánh giá 4.9/5". Đây **chính xác** là lỗi
`"4.8 (128 đánh giá)"` đã sửa ở `/customer/services`, chỉ đổi vai. Phải nối API
thật hoặc hiện "Chưa có đánh giá".

### T1-2. Em-dash làm placeholder giá trị rỗng

Skill 9.G cấm tuyệt đối ký tự `—`. Đang dùng làm dấu "không có dữ liệu":
`category-table-columns.tsx:31`, `AdminPaymentsPage.tsx:64` (4 lần),
`AdminWalletsPage.tsx:60` (4 lần), `OrderProgressCard.tsx:48`.
Thay bằng `-` hoặc chuỗi rõ nghĩa ("Chưa có").

---

## Tầng 2 - Cảm giác và bố cục

### T2-1. Đăng nhập xong là bước sang một website khác  ← phát hiện chính

Component `Reveal` (chuyển động vào-màn-hình, dựng ở đợt landing) được dùng ở
**1 file** duy nhất, nằm trong `src/pages/`. Toàn bộ 42 trang sâu: **0 lần**.

Landing chạy `MOTION_INTENSITY 5` (reveal khi cuộn, transition CTA), trang sâu
chạy ~1 (chỉ `:hover`). Cộng với T0-3 (icon đổi họ) và T0-1 (phân cấp chữ gãy),
kết quả là hai ngôn ngữ thị giác nối nhau ngay tại thời điểm đăng nhập - đúng lúc
người dùng vừa quyết định tin sản phẩm.

Sửa **không phải** là bê motion của landing vào. Ở product UI, chuyển động phải
có lý do (skill Section 5: hierarchy / storytelling / feedback / state
transition). Mức 3 là đủ: reveal cho thẻ danh sách khi tải xong, transition trạng
thái cho stepper và badge, phản hồi chạm cho nút.

### T2-2. Bề rộng nội dung nhảy giữa các trang cùng một role

`DashboardLayout.tsx` có 3 nhánh max-width (`max-w-none` admin / `1600px` provider
/ `container-max` customer), còn `OrderCreationShell` lại tự đặt
`max-w-container-max` riêng. Khách đi `/customer/bookings` (shell dashboard) sang
`/customer/bookings/new` (shell riêng) thì khung nội dung đổi. Hai shell nên hợp
nhất, hoặc ít nhất dùng chung một thang bề rộng.

Cùng chỗ: cả hai shell hardcode `pt-32` (8rem) - khoảng trống trên cùng cố định
bất kể chiều cao navbar thật.

### T2-3. Đánh số hai lần ở bước 1 đặt đơn

`CreateBookingStep1Page.tsx:93,106` render vòng tròn số "1" và "2" cho hai
section, ngay bên dưới `BookingStepper` vốn đã hiển thị 1-2-3. Hai hệ đánh số
khác nghĩa chồng lên nhau trong cùng một màn hình. Bỏ số ở section - tiêu đề tự
nó đã đủ (skill 9.F cấm eyebrow đánh số).

### T2-4. Mật độ trang quản trị bằng trang khách

15 trang admin dùng cùng `space-y-8` / `gap-gutter` / thẻ bo `3xl` như trang
khách. Với `VISUAL_DENSITY` mục tiêu 7, người quản trị nhìn được ít dữ liệu hơn
mức đáng lẽ trên mỗi màn hình. Đây là chỗ dùng Carbon/Fluent-style density, không
phải luật landing.

---

## Tầng 3 - Luật <200 dòng đang bị lách

9 file có dòng dài > 400 ký tự. Nặng nhất:

| File | Ký tự trên dòng dài nhất |
|---|---|
| `admin/pages/AdminWalletsPage.tsx` | **3.425** |
| `admin/pages/AdminPaymentsPage.tsx` | **2.098** |
| `admin/pages/AdminDashboardPage.tsx` | 1.151 |
| `case-management/components/CaseDetailModal.tsx` | 654 |
| `admin/components/cases/ViolationFormModal.tsx` | 618 |
| `provider/components/orders/CancelOrderDialogs.tsx` | 500 |
| `booking/components/CategoryQuickSelect.tsx` | 480 |
| `admin/components/feedback/AdminFeedbackList.tsx` | 466 |
| `admin/components/services/ServiceListPanel.tsx` | 446 |

Toàn bộ JSX của `AdminWalletsPage` nằm trên một dòng. Đạt "<200 dòng" về con số
nhưng phá đúng mục đích của luật: không đọc được, không review được, không diff
được. Cần tách thật (component con) chứ không xuống dòng cho đẹp.

---

## Đề xuất chia đợt

| # | Đợt | Nội dung | Rủi ro | Giá trị |
|---|---|---|---|---|
| A | Sửa hệ thống | T0-1, T0-2, T0-5, T0-6, T1-2 | Thấp | Cao - sửa lỗi thật, chạm mọi trang |
| B | Nợ tin cậy | T1-1 (nối API đánh giá thợ) | Thấp | Cao - đúng loại lỗi đắt nhất |
| C | Hợp nhất icon | T0-3, quy về `lucide-react`, xoá link Google Fonts | Trung bình - 217 chỗ | Trung bình |
| D | Liền mạch sau đăng nhập | T2-1, T2-2, T2-3 | Trung bình | Cao - phát hiện chính |
| E | Tách file admin | Tầng 3 | Thấp nhưng tốn công | Trung bình - nợ bảo trì |
| F | Mật độ admin | T2-4 | Trung bình | Thấp-trung bình |

Khuyến nghị thứ tự: **A → B → D → C → E → F**. A và B rẻ và sửa lỗi thật; D là
thứ người dùng cảm nhận được; C tốn công cơ học nên để sau khi hệ đã đúng.

---

## Câu hỏi chưa chốt

1. **Dark mode**: làm hay ghi nhận bỏ qua? Ảnh hưởng ~150 file, cần quyết trước đợt A.
2. **T0-1**: thêm 3 token `title-*`/`headline-sm` vào `@theme`, hay quy về thang sẵn có?
3. **T0-3**: hợp nhất về `lucide-react` (48 file giữ nguyên, sửa 217 chỗ) hay về
   Material Symbols (ngược lại, nhưng giữ CDN ngoài)?
4. 15 trang admin có thuộc phạm vi đợt refactor này không, hay tách riêng? Chúng
   nằm ngoài phạm vi skill và chiếm phần lớn khối lượng.
