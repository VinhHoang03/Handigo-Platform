---
title: Hợp nhất icon về lucide-react
status: completed
created: 2026-07-23
branch: feat/unify-icon-library
blockedBy: []
blocks: []
---

# Hợp nhất icon về lucide-react

Gỡ Material Symbols khỏi `handigo-web`, đưa toàn bộ icon về `lucide-react`, và
xoá request font icon từ Google khỏi `index.html`.

Nối tiếp `plans/reports/ui-audit-260723-1456-deep-pages.md` mục T0-3.

## Vì sao

1. **Hai họ icon chạy song song.** 161 file dùng Material Symbols (278 lượt), 51
   file dùng lucide. Không file nào trộn cả hai, nhưng người dùng đi qua nhiều
   trang thì thấy nét, độ dày và bo góc icon đổi giữa các khu vực.
2. **Xoá được request CDN cuối cùng.** `index.html` còn nạp stylesheet từ
   `fonts.googleapis.com`. Đây là phụ thuộc ngoài duy nhất còn lại, mâu thuẫn
   với mục tiêu của plan `260722-1248`.
3. **Material Symbols nạp theo danh sách tên cắt gọn nên sai là im lặng.** Icon
   không có trong `icon_names=` sẽ render ra đúng chuỗi tên. Đã có hai chỗ dính
   lỗi này: `PendingAssignmentCard.tsx:126` và (trước khi sửa)
   `ProviderAssignmentModal.tsx` đều dùng `shield_lock` không có trong danh sách.
   Với lucide, icon không tồn tại là **lỗi biên dịch**, không phải chữ lạ trên UI.

## Khảo sát (2026-07-23, sau khi merge main)

| Hạng mục | Số lượng |
|---|---|
| File dùng Material Symbols | 161 |
| Lượt dùng | 278 |
| Tên icon viết cứng, riêng biệt | 87 |
| Chỗ dùng tên icon **động** | 19 |
| File đã dùng lucide | 51 |

**Điểm quan trọng:** icon duy nhất đến từ backend là `category.icon`, và nó đã đi
qua `components/common/CategoryIcon.tsx` — vốn đã map tên sang lucide, có chuẩn
hoá và fallback ảnh. **Không cần đụng backend, không cần migrate dữ liệu.**
19 chỗ động còn lại đều nhận tên từ hằng số frontend nên đổi thẳng sang truyền
component `LucideIcon` được, không cần bảng tra tên.

## Cách làm

1. Dựng bảng ánh xạ 87 tên Material → component lucide.
2. Codemod cho chỗ viết cứng: `<span className="material-symbols-outlined ...">name</span>`
   → `<Icon className={...} size={...} />`, tự thu thập và chèn import.
   Cỡ chữ (`text-[18px]`, `text-2xl`...) quy sang `size` bằng số.
3. Sửa tay 19 chỗ động: đổi kiểu dữ liệu từ `string` sang `LucideIcon`.
4. Xoá `components/common/MaterialIcon.tsx`.
5. Xoá thẻ `<link>` Google Fonts trong `index.html`.
6. Kiểm: `tsc`, `eslint`, build, và soát bằng trình duyệt.

## Ca cần xử lý riêng

- `RatingStars` dùng `fontVariationSettings: 'FILL' 1` cho sao đặc → lucide dùng
  `fill="currentColor"`.
- `progress_activity` (5 chỗ) là spinner đang quay → `Loader2` + `animate-spin`.
- `MaterialIcon` tự thêm `aria-hidden`; lucide **không** tự thêm, phải đặt thủ công.

## Todo

- [x] Bảng ánh xạ 137 icon (87 viết cứng + 50 trong dữ liệu)
- [x] Codemod chỗ viết cứng
- [x] 19 chỗ động
- [x] Ca riêng: sao đặc, spinner, aria-hidden
- [x] Xoá `MaterialIcon.tsx` và link Google Fonts
- [x] `tsc` + `eslint` + build sạch
- [x] Soát trình duyệt: trang chủ, đặt đơn, thợ, admin
- [x] Đo lại bundle và số request ngoài

## Tiêu chí hoàn thành

- `grep -r "material-symbols-outlined"` → 0.
- `index.html` không còn tham chiếu `fonts.googleapis.com`.
- Không còn icon nào render ra chuỗi tên.
- Bundle first-load không tăng.
