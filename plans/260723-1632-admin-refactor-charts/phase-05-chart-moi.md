# Phase 5 - Chart analytics mới

## Context Links

- Plan: [plan.md](plan.md)
- Phân tích: `plans/reports/analysis-260723-1632-admin-refactor-va-chart.md` mục A4, phần C
- Phụ thuộc: [phase-03](phase-03-nen-chart.md), [phase-04](phase-04-thay-chart-cu.md)

## Overview

- **Priority:** Trung bình - phần "thêm giá trị mới" của đợt
- **Status:** ⬜ Chưa bắt đầu
- Hiển thị phần dữ liệu analytics backend đã trả nhưng UI đang vứt đi. **Không
  cần sửa backend.**

## Key Insights

Kiểm bằng grep trên `.tsx`: **8 trường có trong response nhưng 0 lần hiển thị.**
Đã xác minh dữ liệu tồn tại bằng cách gọi thật 4 endpoint `/dashboard/*` với
token admin.

| Trường | Dùng trong UI | Dùng cho |
|---|---|---|
| `ordersByMonth` | 0 | Chart C2 - xu hướng đơn theo tháng |
| `platformFeeByMonth` | 0 | Đã dùng gián tiếp qua `mergeMonthlyRevenue` ở phase 4 |
| `revenueByWeek` | 0 | Chuyển mức xem tuần/tháng (tuỳ chọn) |
| `cancellationRate` | 0 | Thẻ chỉ số |
| `averageProviderRating` | 0 | Thẻ chỉ số |
| `providerEarnings` | 0 | Thẻ chỉ số |
| `totalDeposits` | 0 | Thẻ chỉ số |

**Tỷ lệ huỷ là chỉ số đáng đưa lên nhất.** Dữ liệu dev cho thấy 42/64 đơn bị huỷ
(66%). Dù đây là dữ liệu dev, `cancellationRate` là thứ người vận hành cần thấy
ngay chứ không phải đi tính từ hai con số khác - hiện `AdminDashboardPage` chỉ
hiện `completionRate` trong một dòng chữ nhỏ.

## Requirements

**Chức năng**
- C2: biểu đồ đường xu hướng đơn theo tháng (`ordersByMonth`).
- C3: biểu đồ cột ngang top provider theo doanh thu (`topProvidersByRevenue`),
  thay danh sách text đánh số.
- Thẻ chỉ số bổ sung: `cancellationRate`, `averageProviderRating`,
  `providerEarnings`, `totalDeposits`.

**Phi chức năng**
- Không thêm endpoint, không sửa backend.
- Mọi chart qua wrapper phase 3, giữ chuẩn a11y và giảm chuyển động.
- Trang không dài thêm quá mức - xem Architecture.

## Architecture

`/admin` sau phase 4 + 5:

```
Header + bộ lọc khoảng ngày
Hàng thẻ chỉ số        (4 thẻ cũ + 4 thẻ mới → cân nhắc 2 hàng 4 cột)
C1 Donut trạng thái     | C4 Bar danh mục        (phase 4)
C2 Line xu hướng đơn theo tháng                  (MỚI, full width)
C3 Bar ngang top provider theo doanh thu | Top provider theo đơn hoàn thành
```

**Cảnh báo mật độ:** thêm 4 thẻ + 2 chart vào một trang vốn đã có 4 thẻ + 4 khối
sẽ làm trang rất dài. Nếu thấy quá tải, ưu tiên: giữ 4 thẻ quan trọng nhất và
đưa phần còn lại thành dòng phụ trong thẻ (kiểu `note` sẵn có của `MetricCard`),
thay vì thêm thẻ mới. **Quyết định lúc dựng, dựa trên màn hình thật.**

## Related Code Files

**Sửa**
- `src/features/admin/pages/AdminDashboardPage.tsx`
- `src/features/admin/types/adminOperations.types.ts` - kiểm `ordersByMonth` đã
  khai báo đúng (đã có, dòng 24)

**Có thể tách mới nếu page phình**
- `src/features/admin/components/dashboard/DashboardMetricGrid.tsx`
- `src/features/admin/components/dashboard/DashboardCharts.tsx`

## Implementation Steps

1. **Xác nhận `ordersByMonth` có dữ liệu thật trong khoảng ngày mặc định.** Gọi
   `/dashboard/orders` và kiểm. Dữ liệu dev chỉ trải trên vài ngày tháng 7/2026
   nên chart đường có thể chỉ có **một điểm** - đó là ca cần xử lý, không phải lỗi.
2. Thẻ chỉ số mới. Cân nhắc mật độ theo cảnh báo ở Architecture trước khi thêm 4 thẻ.
3. C2 `LineChart` xu hướng đơn. Xử lý ca một điểm và ca rỗng.
4. C3 `BarChart` ngang top provider. Tên provider dài - cần cắt bớt hoặc xoay nhãn;
   giữ tên đầy đủ trong tooltip và bảng a11y.
5. Tách `AdminDashboardPage` nếu vượt ngưỡng đọc được.
6. Nghiệm thu trên **fixture** trước (phase 3), rồi mới xem trên dữ liệu thật.

## Todo List

- [ ] Xác nhận `ordersByMonth` có dữ liệu trong khoảng mặc định
- [ ] Thêm thẻ chỉ số (sau khi cân nhắc mật độ)
- [ ] C2 `LineChart` xu hướng đơn theo tháng
- [ ] C3 `BarChart` ngang top provider
- [ ] Xử lý ca một điểm dữ liệu và ca rỗng
- [ ] Tách file nếu page quá dài
- [ ] Nghiệm thu trên fixture rồi trên dữ liệu thật
- [ ] Kiểm ở 360px
- [ ] `npx tsc -b` + `npm run lint` sạch

## Success Criteria

- `ordersByMonth`, `cancellationRate`, `averageProviderRating`,
  `providerEarnings`, `totalDeposits` đều xuất hiện trên UI.
- Chart đường xử lý đúng khi chỉ có 1 điểm và khi rỗng, không vỡ layout.
- Tên provider dài không tràn hoặc chồng nhãn.
- Trang vẫn đọc được ở 360px.
- Không file nào vượt 200 dòng.

## Risk Assessment

| Rủi ro | Giảm thiểu |
|---|---|
| Dữ liệu dev chỉ trải 3 ngày → chart đường một điểm, trông như lỗi | Xử lý ca một điểm ngay từ đầu (hiện điểm + nhãn, không vẽ đường cụt) |
| Thêm 4 thẻ + 2 chart làm trang quá dài | Cảnh báo mật độ ở Architecture; ưu tiên dòng phụ trong thẻ sẵn có |
| Tên provider dài phá bố cục chart cột | Cắt bớt + tooltip đầy đủ; kiểm bằng tên dài nhất trong dữ liệu thật |
| Đánh giá sai thẩm mỹ vì dữ liệu lệch 66% huỷ | Nghiệm thu trên fixture trước - đây là lý do phase 3 dựng fixture |

## Security Considerations

C3 hiển thị tên và doanh thu provider. Dữ liệu này đã có sẵn trên trang (danh
sách text hiện tại), nên **không mở rộng mức lộ**. Không thêm email provider vào
nhãn chart - hiện `topProvidersByRevenue` có `email` và code cũ dùng nó làm
fallback khi thiếu `fullName`; giữ nguyên mức đó, không hiện email khi đã có tên.

## Next Steps

Kết thúc phạm vi đợt này. Việc nối tiếp đã ghi trong `plan.md`: mật độ/bố cục
admin, hợp nhất icon về lucide, chữ trạng thái lệch ở miền khiếu nại và ticket.
