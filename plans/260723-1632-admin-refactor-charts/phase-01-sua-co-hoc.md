# Phase 1 - Sửa cơ học toàn repo

## Context Links

- Plan: [plan.md](plan.md)
- Audit gốc: `plans/reports/ui-audit-260723-1456-deep-pages.md` mục T0-1, T0-5, T0-6, T1-2

## Overview

- **Priority:** Cao - rẻ, không phụ thuộc gì, sửa lỗi thật
- **Status:** ⬜ Chưa bắt đầu
- Hai nhóm lỗi cơ học: class typography không tồn tại, em-dash làm placeholder.
  Cộng thêm `min-h-screen` → `min-h-dvh` và ghi thành văn quy tắc bo góc.

> **Đính chính so với audit ngày 2026-07-23.** Audit ghi "4 chỗ dùng `h-screen`"
> và "7 bậc bo góc, không quy tắc". Kiểm lại thì cả hai đều bị nói quá - chi
> tiết ở Key Insights. Phạm vi phase này đã điều chỉnh theo thực tế.

## Key Insights

**Class typography không tồn tại là lỗi im lặng.** Tailwind v4 chỉ sinh utility
từ `@theme`. `text-title-lg`, `text-title-md`, `text-headline-sm` không có trong
`src/index.css` → không sinh CSS → heading render bằng cỡ chữ kế thừa (16px).
Build xanh, ESLint 0 lỗi, mắt thường khó bắt vì heading vẫn `font-bold`.

20 vị trí: 4 trong admin, 16 ngoài admin. **Thêm 3 token vào một file vá được cả
20 chỗ** - đây là lý do sửa repo-wide rẻ hơn sửa riêng admin.

M3 vốn có cấp `title-*`; thiếu chúng chính là lý do mọi người tự chế class.

**Em-dash gần như chỉ là vấn đề của admin.** 16 chỗ trong admin, **1 chỗ** ngoài
admin (`OrderProgressCard.tsx:48`). 74 lần còn lại nằm trong comment tiếng Việt -
không phải chữ hiển thị, không thuộc phạm vi luật.

**Đính chính 1 - không có `h-screen` nào cả.** Audit đếm 4, nhưng grep chính xác
cho thấy **0 chỗ dùng `h-screen` trần**; cả 11 chỗ đều là `min-h-screen`. Đây là
khác biệt quan trọng: `h-screen` khoá chiều cao cứng và thực sự gây nhảy layout,
còn `min-h-screen` chỉ đặt chiều cao tối thiểu nên hậu quả nhẹ hơn nhiều. Vấn đề
còn lại là `100vh` trên iOS Safari vẫn cao hơn vùng nhìn thấy, gây thừa một
khoảng cuộn khi thanh địa chỉ thu lại. Sửa bằng `min-h-dvh` - **11 chỗ**, đổi
tiện ích thuần, gần như không rủi ro.

**Đính chính 2 - bo góc không loạn như audit mô tả.** Audit ghi "7 bậc, không có
quy tắc". Đọc thực tế thì các bậc đang được dùng **khá nhất quán theo kích cỡ
phần tử**: `full` cho pill/avatar, `2xl`/`3xl` cho panel, `xl` cho nút và input,
`lg` cho phần tử trong card, `md` cho chip nhỏ và thumbnail. Vấn đề thật là
**quy tắc này chưa được ghi ở đâu**, nên người mới dễ chọn bừa.

Kéo theo: đề xuất ban đầu "xoá `rounded-md` (8 chỗ)" là **sai** - ép chip cao
20px sang `rounded-xl` sẽ trông hỏng. Và `rounded-[2px]` (1 chỗ) là mũi tên
tooltip hình vuông 16px xoay 45° (`ProviderProfessionalSummarySection.tsx:48`) -
bo 2px ở đó là có chủ đích, không phải rác.

→ Việc cần làm rút gọn thành **ghi quy tắc thành văn**, không migration.

## Requirements

**Chức năng**
- 0 class typography không tồn tại trong toàn repo.
- 0 ký tự `—` trong chuỗi hiển thị (comment không tính).
- 0 `h-screen`.
- Quy tắc bo góc được ghi thành văn và áp trong admin.

**Phi chức năng**
- Không đổi bố cục, không đổi màu, không đổi copy ngoài việc thay placeholder.

## Architecture

Thêm vào `src/index.css` khối `@theme`, bám đúng thang M3 và khớp cỡ chữ đang
được kỳ vọng ở nơi dùng:

```
--text-title-lg: 22px / 28px / 600
--text-title-md: 16px / 24px / 600 / +0.01em
--text-headline-sm: 20px / 28px / 600
--font-title-lg, --font-title-md, --font-headline-sm  → Hanken Grotesk (khớp headline-*)
```

Đặt cạnh các token `headline-*` sẵn có, kèm comment giải thích vì sao bổ sung.

## Related Code Files

**Sửa - token**
- `src/index.css` - thêm 3 cấp chữ

**Sửa - em-dash → `-` hoặc chuỗi rõ nghĩa** (17 chỗ)
- `admin/components/categories/category-table-columns.tsx:31`
- `admin/pages/AdminPaymentsPage.tsx:64` (4 lần)
- `admin/pages/AdminWalletsPage.tsx:60` (4 lần)
- `provider/components/orders/OrderProgressCard.tsx:48`
- Grep lại để bắt phần còn lại trong admin

**Sửa - `min-h-screen` → `min-h-dvh`** (11 chỗ)
- `booking/components/OrderCreationShell.tsx:9,11`
- `content/components/PublicContentLayout.tsx:7`
- `customer-service/components/CustomerServiceLayout.tsx:10,13`
- `components/common/dashboard/DashboardLayout.tsx:58,89`
- `components/auth/ProfileRoute.tsx:12`, `components/common/RouteGuard.tsx:24`
- `pages/LandingPage.tsx:31`, `pages/NotFoundPage.tsx:7`

**Sửa - thang chữ heading trong admin**
- `admin/pages/AdminDashboardPage.tsx` - `text-lg`, `text-2xl` dùng làm heading
- Chỉ đụng **heading**, không đụng body text (`text-sm`/`text-xs` để đợt sau)

## Implementation Steps

1. Thêm 3 token vào `src/index.css`, kèm comment lý do.
2. Chạy `npm run build`, mở `/admin/revenue` và `/wallet` xem heading đã đúng cỡ.
   **Đây là bước nghiệm thu thật** - nếu cỡ chữ trông sai thì token chọn sai giá trị.
3. Thay em-dash. Với ô trống trong bảng, ưu tiên chuỗi rõ nghĩa ("Chưa có") hơn
   dấu gạch trần, trừ khi cột hẹp.
4. Thay 11 `min-h-screen` → `min-h-dvh`.
5. Đổi heading admin sang token (`text-lg` → `text-title-lg`, `text-2xl` → `text-headline-md`).
6. **Ghi quy tắc bo góc** vào `docs/code-standards.md` theo đúng cách đang dùng:
   `full` pill/avatar · `3xl`/`2xl` panel · `xl` nút và input · `lg` phần tử
   trong card · `md` chip nhỏ và thumbnail. **Không migration** - xem Đính chính 2.

## Todo List

- [ ] Thêm `title-lg`, `title-md`, `headline-sm` vào `@theme`
- [ ] Nghiệm thu bằng mắt trên `/admin/revenue` và `/wallet`
- [ ] Thay 17 em-dash hiển thị
- [ ] Thay 11 `min-h-screen` → `min-h-dvh`
- [ ] Đổi heading admin sang token
- [ ] Ghi quy tắc bo góc vào `docs/code-standards.md` (không migration)
- [ ] `npx tsc -b` + `npm run lint` sạch

## Success Criteria

- `grep -rn "text-title-lg\|text-title-md\|text-headline-sm"` → mọi kết quả đều
  có token tương ứng trong `index.css`.
- `grep -rn "—" --include=*.tsx` → chỉ còn trong comment.
- `grep -rn "min-h-screen"` → 0.
- `docs/code-standards.md` có mục quy tắc bo góc.
- Heading ở `/admin/revenue`, `/wallet`, `/customer/bookings/new` hiển thị đúng
  cấp bậc, không còn heading bằng cỡ body.

## Risk Assessment

| Rủi ro | Giảm thiểu |
|---|---|
| Chọn sai giá trị 3 token → 20 heading đổi cỡ sai loạt | Bước 2 nghiệm thu bằng mắt trước khi đi tiếp; giá trị bám thang M3 chuẩn |
| Đổi heading admin làm vỡ layout hẹp | Kiểm ở 360px trên trang có heading dài nhất (`AdminSystemConfigsPage`) |
| Thay em-dash bằng chuỗi dài làm vỡ cột bảng | Cột hẹp dùng `-`, cột rộng dùng "Chưa có" |

## Security Considerations

Không có. Thuần trình bày.

## Next Steps

Độc lập với phase khác. Nên làm sớm vì chạm nhiều file - để lâu sẽ xung đột với
phase 2 và 4.
