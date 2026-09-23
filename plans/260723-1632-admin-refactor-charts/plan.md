---
title: Refactor UI admin + hệ biểu đồ analytics
status: completed
created: 2026-07-23
branch: feat/ui-refactor-landing
blockedBy: []
blocks: []
---

# Refactor UI admin + hệ biểu đồ analytics

Đưa 17 trang admin về cùng hệ với phần còn lại của nền tảng, thay bốn hệ biểu đồ
tự dựng bằng một hệ chart thật (Recharts), và hiển thị phần dữ liệu analytics mà
backend đã trả nhưng UI đang vứt đi.

Nối tiếp `plans/reports/analysis-260723-1632-admin-refactor-va-chart.md`.

## Bối cảnh

- React 19.2.6 · Tailwind v4 (`@theme` trong `src/index.css` là nguồn token duy nhất)
- 17 trang admin **đều đã lazy-load** → thư viện chart chỉ nằm trong chunk admin,
  không vào first load của khách. Đây là lý do bundle không phải rào cản.
- **Backend không cần sửa gì.** Đã gọi thật 4 endpoint `/dashboard/*` bằng token
  admin; mọi chart trong plan này chạy trên dữ liệu đang có.

## Bốn quyết định đã chốt (2026-07-23)

1. **Recharts 3.10.0** - render SVG nên nhận thẳng `var(--color-*)` của M3.
   Chart.js nhẹ hơn ~30KB nhưng dùng canvas, phải dựng cầu nối token→hex thủ công.
2. **Gồm cả `ProviderRevenueChart`** (ngoài admin) - để wrapper dùng chung có
   consumer thứ hai ngay từ đầu, tránh trừu tượng bám vào giả định của admin.
3. **Không seed DB dùng chung.** Atlas là DB dev của cả team; bơm đơn giả sẽ làm
   lệch số liệu người khác và khó dọn (đơn kéo theo payment/wallet/feedback).
   Dùng fixture cục bộ với 3 bộ: bình thường, rỗng, lệch cực đoan.
4. **Tách phần mật độ/bố cục admin sang đợt sau** - đó là phần duy nhất thuần
   thẩm mỹ, và phải làm sau khi có chart thật để căn.

## Các phase

| # | Phase | Trạng thái | Phụ thuộc |
|---|---|---|---|
| 0 | [Gom nhãn trạng thái đơn](phase-00-gom-nhan-trang-thai-don.md) | ✅ | - |
| 1 | [Sửa cơ học](phase-01-sua-co-hoc.md) | ✅ | - |
| 2 | [Ba bảng thô về DataTable](phase-02-datatable.md) | ✅ | - |
| 3 | [Nền chart dùng chung](phase-03-nen-chart.md) | ✅ | 0 |
| 4 | [Thay 4 chart tự dựng](phase-04-thay-chart-cu.md) | ✅ | 3 |
| 5 | [Chart analytics mới](phase-05-chart-moi.md) | ✅ | 3, 4 |

Phase 0-2 không cần thư viện. Phase 3-4 thay nền vẽ mà không đổi nội dung.
Phase 5 mới thêm giá trị mới. Dừng sau bất kỳ phase nào dự án vẫn nhất quán.

## Tiêu chí hoàn thành cả đợt

- Không còn biểu đồ nào dựng bằng `<div>` + `width/height` tính tay.
- Mọi chart đi qua wrapper `components/common/chart/`, không page nào import
  thẳng `recharts`.
- Chart đọc được bằng screen reader và tôn trọng `prefers-reduced-motion`.
- 0 class typography không tồn tại trong toàn repo.
- `AdminPaymentsPage`, `AdminWalletsPage`, `UserTable` dùng `DataTable`.
- Bundle first-load của khách **không tăng** (kiểm bằng `npm run build`).

## Việc nối tiếp, cố ý để ngoài phạm vi

- **Chữ trạng thái lệch nhau ở miền khiếu nại và ticket hỗ trợ.** Cùng loại lỗi
  với phase 0 nhưng thuộc `case-management`, không chặn chart. Ví dụ: "Chờ bổ
  sung bằng chứng" vs "Cần bổ sung bằng chứng"; "Chờ người dùng" vs "Chờ phản hồi".
- Mật độ + bố cục 17 trang admin (`VISUAL_DENSITY` 5 → 7).
- Hợp nhất họ icon về `lucide-react` (217 chỗ Material Symbols).
- Dark mode - đã chốt **không làm**.
- 601 `text-sm` + 279 `text-xs` lấn át thang token M3 ở tầng body text.
