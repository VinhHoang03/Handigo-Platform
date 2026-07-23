# Phase 0 - Gom nhãn trạng thái đơn về một nguồn

## Context Links

- Plan: [plan.md](plan.md)
- Phân tích: `plans/reports/analysis-260723-1632-admin-refactor-va-chart.md` mục A3-2
- Tiền lệ cần noi theo: `src/utils/statusTone.ts` (đã gom **màu** trạng thái rất gọn)

## Overview

- **Priority:** Cao - chặn phase 3 và 5 (chart C1 cần cặp nhãn + tông)
- **Status:** ⬜ Chưa bắt đầu
- Trạng thái đơn dịch vụ đang được dịch sang tiếng Việt ở ba nơi, với **chữ khác
  nhau**. Gom về một module, ghép với `statusTone` sẵn có.

## Key Insights

`utils/statusTone.ts` đã gom màu trạng thái về một chỗ và ghi rõ lý do trong
JSDoc. Nhưng **chữ** thì chưa, nên cùng một trạng thái hiện khác nhau tuỳ trang:

| Mã | `providerHome.utils.ts` | `BookingHistoryPage:73-82` |
|---|---|---|
| `created` | "Đang chờ" | "Đang xử lý" |
| `accepted` | "Đã nhận" | "Đã chấp nhận" |
| `in_progress` | "Đang làm" | "Đang thực hiện" |
| `completed` | "Hoàn tất" | "Đã hoàn thành" |
| `cancelled` | "Đã hủy" | "Đã hủy" |

Bốn trong năm trạng thái lệch chữ. Khách xem lịch sử đơn thấy "Đã hoàn thành",
thợ xem cùng đơn đó thấy "Hoàn tất".

`AdminDashboardPage:58` thì không dịch gì cả - đẩy thẳng mã enum tiếng Anh vào
nhãn biểu đồ. Chart mới ở phase 5 sẽ hiển thị lại đúng chỗ này nên phải sửa trước.

Kèm theo một lỗi đã xác minh: **không có token `accent-*` nào** trong
`index.css`, nhưng hai file vẫn dùng `border-accent-cyan` cho trạng thái
`accepted` (`providerHome.utils.ts:19`, `providerOrder.utils.ts:20`) - kèm cả
`bg-accent-cyan/5`. Tailwind không sinh class cho token không khai báo, nên
trạng thái "Đã chấp nhận" hiện **không có màu** ở cả hai nơi. Gom về `statusTone`
xoá luôn lỗi này.

## Requirements

**Chức năng**
- Một module duy nhất xuất nhãn tiếng Việt + `StatusTone` cho trạng thái đơn.
- Mọi nơi đang tự khai báo phải dùng module đó.
- Chọn một bộ chữ thống nhất (xem Implementation Steps bước 1).

**Phi chức năng**
- Không đổi mã trạng thái, không đổi API, không đổi bộ lọc URL.
- Kiểu dữ liệu ràng buộc theo `Order["status"]`, không dùng `Record<string, string>`
  để lỗi thiếu trạng thái bị bắt lúc biên dịch.

## Architecture

```
src/utils/statusTone.ts          (giữ nguyên - tông màu)
src/utils/orderStatus.ts         (MỚI - nhãn + tông cho trạng thái đơn)
        ├── orderStatusLabels: Record<OrderStatus, string>
        ├── orderStatusTones:  Record<OrderStatus, StatusTone>
        └── getOrderStatusMeta(status): { label, tone }
```

`getOrderStatusMeta` nhận cả chuỗi lạ (dữ liệu cũ trong DB) và lùi về
`{ label: status, tone: 'neutral' }` thay vì ném lỗi.

## Related Code Files

**Tạo mới**
- `src/utils/orderStatus.ts`

**Sửa**
- `src/features/provider/components/home/providerHome.utils.ts` - xoá `statusLabels`, `statusStyles`
- `src/features/provider/utils/providerOrder.utils.ts:20` - cũng dùng `accent-cyan` không tồn tại
- `src/features/booking/pages/BookingHistoryPage.tsx` - xoá `mapStatusToLabel`, `mapStatusToTone`
- `src/features/booking/components/detail/bookingDetailFormatters.ts` - dùng module chung
- `src/features/admin/pages/AdminDashboardPage.tsx:58` - dịch nhãn thay vì đẩy enum thô
- Nơi nào import `statusLabels`/`statusStyles` từ `providerHome.utils` (kiểm bằng grep)

**Không đụng**
- `case-status.constants.ts`, `caseStatusLabels.constants.ts`, `support.constants.ts`
  - khác miền trạng thái, ghi trong plan.md là việc nối tiếp.

## Implementation Steps

1. **Chốt bộ chữ.** Lấy bản của `BookingHistoryPage` làm chuẩn ("Đang xử lý",
   "Đã chấp nhận", "Đang thực hiện", "Đã hoàn thành", "Đã hủy") - đó là bản khách
   hàng nhìn thấy nhiều nhất và đầy đủ nghĩa hơn bản rút gọn của thợ.
2. Tạo `src/utils/orderStatus.ts` với JSDoc giải thích **vì sao** tồn tại, theo
   đúng giọng của `statusTone.ts`.
3. Ánh xạ tông: `created`→`warning`, `accepted`→`brand`, `in_progress`→`info`,
   `completed`→`success`, `cancelled`→`error`. Khớp với `orderStatusClass` đang
   có trong `BookingHistoryCard.tsx`.
4. Thay từng nơi tiêu thụ. Chạy `npx tsc -b` sau mỗi file.
5. Sửa `AdminDashboardPage:58` dùng `getOrderStatusMeta(item.status).label`.
6. Grep lại `statusLabels|mapStatusToLabel|border-accent-cyan` để chắc không sót.

## Todo List

- [ ] Chốt bộ chữ chuẩn
- [ ] Tạo `src/utils/orderStatus.ts` kèm JSDoc
- [ ] Thay ở `providerHome.utils.ts`
- [ ] Thay ở `BookingHistoryPage.tsx`
- [ ] Thay ở `bookingDetailFormatters.ts`
- [ ] Sửa nhãn enum thô ở `AdminDashboardPage.tsx:58`
- [ ] Grep xác nhận không còn khai báo trùng
- [ ] `npx tsc -b` và `npm run lint` sạch

## Success Criteria

- `grep -rn "Đã hoàn thành\|Hoàn tất"` không còn hai cách viết cho cùng mã trạng thái.
- Không còn `border-accent-cyan` (token không tồn tại).
- Dashboard admin hiện nhãn tiếng Việt, không còn "accepted"/"cancelled".
- Mở `/customer/bookings` và `/provider/orders` trên cùng một đơn → chữ giống nhau.

## Risk Assessment

| Rủi ro | Giảm thiểu |
|---|---|
| Đổi chữ làm gãy test/e2e đang so khớp chuỗi cũ | Grep chuỗi cũ trong thư mục test trước khi đổi |
| Dữ liệu cũ có mã trạng thái ngoài 5 giá trị | `getOrderStatusMeta` lùi về `neutral` thay vì ném lỗi |
| Đổi chữ ảnh hưởng bộ lọc theo nhãn | Bộ lọc dùng `value` (mã), không dùng nhãn - đã kiểm ở `BookingHistoryPage:10-16` |

## Security Considerations

Không có. Thuần hiển thị, không chạm quyền, không chạm dữ liệu.

## Next Steps

Mở khoá phase 3 (nền chart cần `getOrderStatusMeta` để tô màu series theo tông
ngữ nghĩa) và phase 5 (chart C1 đơn theo trạng thái).
