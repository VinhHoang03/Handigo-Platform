# Phase 4 - Thay bốn chart tự dựng

## Context Links

- Plan: [plan.md](plan.md)
- Phân tích: `plans/reports/analysis-260723-1632-admin-refactor-va-chart.md` mục A1
- Phụ thuộc: [phase-03](phase-03-nen-chart.md)

## Overview

- **Priority:** Cao
- **Status:** ⬜ Chưa bắt đầu
- Thay bốn nơi vẽ biểu đồ bằng `<div>` + tính phần trăm tay bằng wrapper ở phase 3.
  **Giữ nguyên dữ liệu và ý nghĩa**, chỉ đổi cách vẽ.

## Key Insights

Bốn nơi, đã xác minh trong code:

| Nơi | Cách dựng hiện tại | Khiếm khuyết cụ thể |
|---|---|---|
| `AdminDashboardPage.BarList` (dòng 19-22) | `<div>` + `width: %` | Không trục, không tooltip. Nhãn là enum tiếng Anh (phase 0 sửa) |
| `revenue/MonthlyChart` | 3 thanh ngang xếp chồng dọc | Ba series xếp dọc nhau, mắt không so sánh được giữa các tháng |
| `revenue/CollectionChart` | `<div>` + `height` px | `height: (amount/max)*160` **cứng theo px** - không co theo container |
| `provider/home/ProviderRevenueChart` | `<div>` + `maxRevenue` tay | Ngoài admin. Consumer thứ hai để kiểm tra wrapper |

Cả bốn đều tự tính lại `Math.max(...)` và tự quy đổi phần trăm - cùng một đoạn
logic viết bốn lần.

**`MonthlyChart` là nơi đổi kiểu chart mang lại nhiều nhất.** Ba thanh ngang xếp
chồng cho mỗi tháng khiến không so sánh được xu hướng. Chuyển sang **biểu đồ
đường ba series** là thay đổi có lý do rõ ràng, không phải thay cho đẹp.

**`ProviderRevenueChart` là phép thử wrapper.** Nó ở ngữ cảnh khác admin: có bộ
lọc tuần/tháng riêng, hiển thị trên cột hẹp hơn, mật độ khác. Nếu wrapper phải
sửa chữ ký để nhận nó - **đó là kết quả tốt**, đúng mục đích của quyết định 2.

## Requirements

**Chức năng**
- Bốn nơi dùng wrapper `components/common/chart/`.
- Dữ liệu hiển thị **không đổi**: cùng nguồn, cùng phép tính, cùng đơn vị.
- `MonthlyChart` đổi từ thanh chồng sang đường ba series.

**Phi chức năng**
- Xoá hết code tính `Math.max` / quy đổi phần trăm thủ công ở bốn nơi.
- Không nơi nào còn đặt `height`/`width` bằng px hoặc % tính tay cho phần tử vẽ.

## Architecture

```
AdminDashboardPage
    BarList (XOÁ) → DonutChart (trạng thái) + BarChart (danh mục)

revenue/MonthlyChart      → LineChart 3 series (GMV / provider / phí nền tảng)
revenue/CollectionChart   → BarChart theo ngày

provider/home/ProviderRevenueChart → BarChart, giữ nguyên bộ lọc tuần/tháng
```

Giữ nguyên tên file các component ở `revenue/` để không phá đường dẫn import;
chỉ thay ruột.

## Related Code Files

**Sửa**
- `src/features/admin/pages/AdminDashboardPage.tsx` - xoá `BarList`
- `src/features/admin/components/revenue/MonthlyChart.tsx`
- `src/features/admin/components/revenue/CollectionChart.tsx`
- `src/features/provider/components/home/ProviderRevenueChart.tsx`

**Có thể gọn lại sau khi thay**
- `src/features/provider/components/home/useProviderHomeData.ts` - phần tính
  `maxRevenue`, `revenueChart` có thể không còn cần

**Đọc**
- `src/features/admin/components/revenue/revenue-format.ts` - `mergeMonthlyRevenue`
  đã gộp sẵn ba series theo tháng, dùng thẳng cho `LineChart`

## Implementation Steps

1. **Ghi lại số hiện tại trước khi sửa.** Chụp màn hình `/admin`,
   `/admin/revenue`, `/provider` và ghi các con số đang hiển thị. Sau khi thay,
   số phải **y hệt** - chỉ cách vẽ đổi.
2. `CollectionChart` trước - đơn giản nhất, một series.
3. `MonthlyChart` - đổi sang `LineChart`. `mergeMonthlyRevenue` đã trả đúng cấu
   trúc `{ month, gross, platform, provider }`, ánh xạ thẳng sang ba series.
4. `AdminDashboardPage`: `BarList` → `DonutChart` cho trạng thái (dùng
   `getOrderStatusMeta` từ phase 0 để lấy nhãn + tông) và `BarChart` cho danh mục.
5. `ProviderRevenueChart` - consumer thứ hai. **Ghi lại chỗ nào phải sửa wrapper**;
   đó là thông tin có giá trị cho phase 5.
6. Xoá code tính toán thủ công không còn dùng. Grep `Math.max` trong bốn file.
7. Đối chiếu số với bước 1.

## Todo List

- [ ] Ghi lại số liệu hiển thị hiện tại của 4 chart
- [ ] `CollectionChart` → `BarChart`
- [ ] `MonthlyChart` → `LineChart` 3 series
- [ ] `AdminDashboardPage`: `BarList` → `DonutChart` + `BarChart`
- [ ] `ProviderRevenueChart` → `BarChart`, ghi lại chỗ wrapper phải sửa
- [ ] Xoá code tính phần trăm/`Math.max` thừa
- [ ] Đối chiếu số liệu với bước 1
- [ ] Kiểm ở 360px và ở cột hẹp của `/provider`
- [ ] `npx tsc -b` + `npm run lint` sạch

## Success Criteria

- `grep -rn "Math.max" src/features/admin/components/revenue src/features/provider/components/home` → không còn dùng để vẽ.
- Không còn `style={{ width: ... % }}` hay `style={{ height: ... }}` để vẽ dữ liệu.
- Số liệu hiển thị **trùng khớp** bản ghi ở bước 1.
- Chart co giãn đúng khi thu hẹp cửa sổ (khiếm khuyết cũ của `CollectionChart`).
- `/provider` vẫn đổi được tuần/tháng như cũ.

## Risk Assessment

| Rủi ro | Giảm thiểu |
|---|---|
| Đổi cách vẽ vô tình đổi số | Bước 1 ghi lại số trước, đối chiếu sau |
| Wrapper không đủ linh hoạt cho `ProviderRevenueChart` | Đó là kết quả mong đợi - sửa wrapper, không tạo chart riêng |
| Dữ liệu dev lệch khiến khó nhận ra chart sai | Nghiệm thu trên fixture ở phase 3 trước, rồi mới xem trên dữ liệu thật |
| Xoá nhầm code còn dùng ở `useProviderHomeData` | Chỉ xoá sau khi `tsc` xác nhận không còn tham chiếu |

## Security Considerations

Không có. Không đổi nguồn dữ liệu, không đổi quyền truy cập.

## Next Steps

Mở khoá phase 5. Thông tin "wrapper phải sửa chỗ nào để nhận consumer thứ hai"
thu được ở bước 5 sẽ định hình chart mới ở phase 5.
