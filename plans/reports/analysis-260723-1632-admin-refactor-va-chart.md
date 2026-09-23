# Phân tích hướng refactor UI admin + thêm chart analytics

Ngày: 2026-07-23 · Branch: `feat/ui-refactor-landing`
Tiếp nối: `ui-audit-260723-1456-deep-pages.md` (admin lúc đó bị loại, nay đưa vào)

Toàn bộ số liệu dưới đây đo trực tiếp trên code và trên API đang chạy thật
(backend `:5000`, đã gọi 4 endpoint `/dashboard/*` bằng token admin), không suy
từ tên file.

---

## Phần A - Hiện trạng admin

### A1. Đang có BỐN hệ biểu đồ tự dựng, không cái nào là chart thật

| Nơi | Cách dựng | Vấn đề |
|---|---|---|
| `AdminDashboardPage.BarList` (dòng 19-22) | `<div>` + `width: %` | Không trục, không tooltip, không lưới |
| `admin/components/revenue/MonthlyChart` | 3 thanh ngang chồng nhau | Ba series xếp dọc, mắt không so sánh được |
| `admin/components/revenue/CollectionChart` | `<div>` + `height: px` | `height: (amount/max)*160` **cứng theo px**, không co theo container |
| `provider/components/home/ProviderRevenueChart` | `<div>` + `maxRevenue` thủ công | Ngoài admin, nhưng cùng bệnh |

Đây là lý do thật sự cần thư viện: không phải "cho đẹp", mà vì bốn chỗ đang tự
tính lại `Math.max(...)`, tự quy đổi phần trăm, và không chỗ nào có trục hay
tooltip đúng nghĩa. `CollectionChart` còn không responsive.

**Hệ quả cho quyết định:** nếu thêm lib mà không thay bốn cái này, dự án sẽ có
**năm** hệ biểu đồ. Phải thay hết trong cùng đợt, giống bài học hai họ icon.

### A2. Đã có `DataTable` dùng chung tốt, nhưng ba trang bỏ qua nó

`components/common/dashboard/DataTable.tsx` viết chuẩn: có JSDoc, xử lý cuộn
ngang trong khung riêng, empty state, gợi ý `tabular-nums`. **16 nơi đang dùng.**

Ba nơi tự viết `<table>` thô: `AdminPaymentsPage`, `AdminWalletsPage`,
`components/users/UserTable`. Và đúng ba file này là ba file có dòng dài nhất dự
án (3.425 / 2.098 ký tự). Chuyển chúng về `DataTable` giải quyết **một lúc ba
việc**: DRY, độ dài dòng không đọc nổi, và nhất quán bảng biểu.

(Ngoài admin còn `WalletTransactionTable`, `WalletWithdrawalTable`,
`BankAccountTable` cũng viết `<table>` thô - cùng cách xử lý, nhưng thuộc đợt khác.)

### A3. Lỗi hiển thị cụ thể trong admin

1. **`AdminDashboardPage:58` render enum tiếng Anh thô cho admin người Việt.**
   `label: item.status` → biểu đồ hiện "accepted", "cancelled", "in_progress",
   "created", "completed". Đã xác nhận trên API thật.
2. **Nhãn trạng thái đơn bị nhân bản ở 7+ nơi** (`case-status.constants.ts`,
   `support.constants.ts`, `caseStatusLabels.constants.ts`,
   `bookingDetailFormatters.ts`, `BookingHistoryPage.tsx:76`,
   `providerHome.utils.ts`, `supportData.ts`). Trái ngược với `utils/statusTone.ts`
   - file đó đã gom **màu** trạng thái về một chỗ rất gọn, nhưng **chữ** thì chưa.
   Chart sắp thêm cần đúng cặp nhãn + tông này, nên phải gom trước.
3. 4 chỗ dùng class typography không tồn tại (`text-title-lg`, `text-title-md`).
4. 16 em-dash `—` làm placeholder ô trống.
5. Thang chữ dùng `text-lg` / `text-2xl` / `text-sm` thay vì token M3.

### A4. Backend đã trả dữ liệu mà UI đang vứt đi

Kiểm bằng grep trên `.tsx`: **8 trường có trong response nhưng 0 lần hiển thị.**

| Trường | Dùng trong UI | Dùng được cho |
|---|---|---|
| `ordersByMonth` | 0 | Biểu đồ đường xu hướng đơn |
| `platformFeeByMonth` | 0 | Series trong chart doanh thu |
| `revenueByWeek` | 0 | Chuyển mức xem tuần/tháng |
| `cancellationRate` | 0 | Chỉ số cảnh báo |
| `averageProviderRating` | 0 | Thẻ chỉ số |
| `providerEarnings` | 0 | Thẻ chỉ số |
| `totalDeposits` | 0 | Thẻ chỉ số |
| `totalWithdrawals` | 1 | - |

**Không cần viết endpoint nào.** Toàn bộ chart đề xuất ở Phần C chạy trên dữ
liệu đang có.

---

## Phần B - Chọn thư viện chart

### Ràng buộc thực tế của dự án

1. React **19.2.6** - loại mọi lib chưa hỗ trợ React 19.
2. Màu phải lấy từ **CSS variable M3** (`--color-primary`...), không hardcode hex.
3. Commit gần nhất `6e0d24f` vừa **cắt 1.2 MB** khỏi mỗi lần tải trang. Không
   được phá thành quả đó.
4. Cần đúng ba loại: tròn, đường, cột.

### Điểm gỡ bỏ rào cản bundle

**Cả 17 trang admin đều đã lazy-load** (`routes/admin-lazy-pages.tsx` có 17 lần
`lazy(`), provider cũng vậy (9). Nghĩa là thư viện chart chỉ nằm trong chunk
admin/provider, **không vào first load của khách**. Đây là dữ kiện quyết định:
bundle không còn là rào cản, miễn là không import chart ở tầng dùng chung.

### So sánh

| Lib | Phiên bản | React 19 | Nhận CSS var | Nhận xét |
|---|---|---|---|---|
| **Recharts** | 3.10.0 | ✅ peer `^19.0.0` | ✅ SVG | Khai báo, có sẵn Pie/Line/Bar |
| Chart.js + react-chartjs-2 | 4.5.1 / 5.3.1 | ✅ | ❌ canvas | Nhẹ hơn ~30KB nhưng phải đọc `getComputedStyle` để lấy token; canvas kém a11y |
| ECharts | 6.x | ✅ | ❌ canvas | Mạnh nhất, nặng nhất, thừa nhu cầu |
| uPlot | 1.6.32 | n/a | ❌ | Nhẹ nhất nhưng **không có biểu đồ tròn**, quá low-level |
| visx | - | ✅ | ✅ SVG | Modular nhưng phải tự dựng trục/tooltip → lại thành hand-rolled |

### Khuyến nghị: **Recharts 3.10.0**

Lý do quyết định là **điểm 2**, không phải độ phổ biến. Recharts render SVG, nên
màu series viết thẳng `fill="var(--color-primary)"` - biểu đồ tự động ăn theo
token M3 và mọi thay đổi token về sau. Chart.js dùng canvas: phải đọc computed
style ra hex rồi truyền vào, tức là dựng một cầu nối thủ công giữa hai hệ màu -
đúng loại nợ mà `utils/statusTone.ts` vừa dọn xong.

Chart.js nhẹ hơn khoảng 30KB gzip, nhưng vì đã lazy-load nên khoản đó không rơi
vào người dùng thường.

### Điều kiện kèm theo (nếu không làm thì đừng thêm lib)

1. **Một wrapper dùng chung** `components/common/chart/` giữ theme, màu series
   theo `StatusTone`, format tiền VND, tooltip, empty state. Mọi chart đi qua đó.
   Không cho gọi thẳng Recharts trong page.
2. **Thay cả bốn chart tự dựng** ở A1, gồm `ProviderRevenueChart` ngoài admin.
3. **A11y:** Recharts ra SVG trần. Mỗi chart cần `role="img"` + `aria-label` tóm
   tắt số liệu, kèm bảng dữ liệu ẩn cho screen reader. Biểu đồ không đọc được là
   biểu đồ loại trừ người dùng.
4. **`prefers-reduced-motion`:** Recharts mặc định bật animation. Phải tắt qua
   `isAnimationActive={false}` khi người dùng yêu cầu giảm chuyển động.

---

## Phần C - Các chart đề xuất

Tất cả chạy trên dữ liệu **đã xác minh có thật** qua API.

### Trang `/admin` (dashboard)

| # | Chart | Nguồn | Thay cho |
|---|---|---|---|
| C1 | Donut - đơn theo trạng thái | `ordersByStatus` | `BarList` (kèm sửa lỗi nhãn tiếng Anh A3-1) |
| C2 | Đường - xu hướng đơn theo tháng | `ordersByMonth` | *(mới, dữ liệu đang bị vứt)* |
| C3 | Cột ngang - top provider theo doanh thu | `topProvidersByRevenue` | Danh sách text đánh số |
| C4 | Donut - đơn theo danh mục dịch vụ | `ordersByServiceCategory` | `BarList` |

Bổ sung thẻ chỉ số từ dữ liệu đang bỏ phí: `cancellationRate`,
`averageProviderRating`, `providerEarnings`, `totalDeposits`.

### Trang `/admin/revenue`

| # | Chart | Nguồn | Thay cho |
|---|---|---|---|
| C5 | Đường nhiều series - GMV / phí nền tảng / thu nhập provider theo tháng | `mergeMonthlyRevenue` + `platformFeeByMonth` | `MonthlyChart` (3 thanh chồng, không so sánh được) |
| C6 | Cột - dòng tiền thu theo ngày | `collectedPaymentByDay` | `CollectionChart` (height px cứng) |

### Cảnh báo khi nghiệm thu

Dữ liệu dev đang lệch nặng: **64 đơn thì 42 đã huỷ (66%)**, 5 hoàn thành, điểm
provider trung bình 1.48. Donut C1 sẽ gần như một màu "đã huỷ", C3 sẽ có một cột
áp đảo. Đây là dữ liệu thật của môi trường dev, không phải lỗi render - nhưng
**không dùng màn hình này để duyệt thẩm mỹ chart**. Cần seed một bộ dữ liệu cân
đối hơn, hoặc duyệt trên Storybook-style fixture.

---

## Phần D - Đề xuất chia phase

| Phase | Nội dung | Phụ thuộc | Ghi chú |
|---|---|---|---|
| 0 | Gom nhãn trạng thái về một module dùng chung (A3-2), ghép với `statusTone` sẵn có | - | Chart cần cặp nhãn+tông này |
| 1 | Sửa cơ học: token typography, em-dash, thang chữ (A3-3/4/5) | - | Rẻ, chạm nhiều file |
| 2 | Ba trang `<table>` thô → `DataTable` (A2) | - | Xử lý luôn 3 file dòng dài nhất |
| 3 | Cài Recharts + dựng wrapper `common/chart/` (B, điều kiện 1-4) | 0 | Không đụng page nào ở phase này |
| 4 | Thay 4 chart tự dựng bằng wrapper (A1) | 3 | Giữ nguyên dữ liệu, chỉ đổi cách vẽ |
| 5 | Thêm chart mới C2, C3 + thẻ chỉ số từ dữ liệu bỏ phí (A4) | 3, 4 | Phần "bổ sung analytics" |
| 6 | Bố cục + mật độ trang admin (VISUAL_DENSITY 5→7) | 1-5 | Phần thẩm mỹ, làm sau khi hệ đã đúng |

Thứ tự này đặt việc **sửa đúng** trước việc **thêm mới**: phase 0-2 không cần
lib, phase 3-4 thay nền chart mà không đổi nội dung, phase 5-6 mới thêm giá trị
mới. Có thể dừng sau bất kỳ phase nào mà dự án vẫn ở trạng thái nhất quán.

---

## Câu hỏi chưa chốt

1. **Chốt Recharts?** Nếu ưu tiên bundle tuyệt đối hơn tính nhất quán màu thì
   Chart.js là lựa chọn thay thế - nhưng phải chấp nhận cầu nối token→hex thủ công.
2. **`ProviderRevenueChart` (ngoài admin) có nằm trong đợt này không?** Khuyến
   nghị có, nếu không sẽ còn lại một hệ chart tự dựng thứ năm.
3. **Có seed dữ liệu dev cân đối hơn để nghiệm thu chart không?** Dữ liệu hiện
   tại 66% đơn huỷ khiến không đánh giá được chart.
4. Phase 6 (mật độ/bố cục admin) làm luôn trong đợt này hay tách? Nó là phần duy
   nhất mang tính thẩm mỹ thuần, các phase khác đều là sửa lỗi hoặc thêm chức năng.
