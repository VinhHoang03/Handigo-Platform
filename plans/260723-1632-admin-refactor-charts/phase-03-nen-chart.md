# Phase 3 - Nền chart dùng chung

## Context Links

- Plan: [plan.md](plan.md)
- Phân tích: `plans/reports/analysis-260723-1632-admin-refactor-va-chart.md` phần B
- Phụ thuộc: [phase-00](phase-00-gom-nhan-trang-thai-don.md) (cần `getOrderStatusMeta`)

## Overview

- **Priority:** Cao - chặn phase 4 và 5
- **Status:** ⬜ Chưa bắt đầu
- Cài Recharts và dựng lớp bọc dùng chung. **Phase này không đụng trang nào** -
  chỉ tạo nền và một trang demo nội bộ để nghiệm thu.

## Key Insights

**Vì sao Recharts chứ không phải Chart.js.** Recharts render SVG, nên màu series
viết thẳng `fill="var(--color-primary)"` và tự ăn theo token M3 cùng mọi thay đổi
token về sau. Chart.js dùng canvas: phải đọc `getComputedStyle` ra hex rồi nạp
vào, tức dựng một cầu nối thủ công giữa hai hệ màu - đúng loại nợ mà
`utils/statusTone.ts` vừa dọn xong. Chart.js nhẹ hơn ~30KB gzip, nhưng xem dưới.

**Vì sao bundle không phải rào cản.** Cả 17 trang admin đã lazy-load
(`routes/admin-lazy-pages.tsx` có 17 lần `lazy(`), provider 9. Thư viện chỉ nằm
trong chunk admin/provider, **không vào first load của khách**. Điều kiện để giữ
được tính chất này: **không import chart ở tầng dùng chung nào được eager-load**.

**Vì sao wrapper phải có hai consumer ngay từ đầu.** Wrapper viết cho đúng một nơi
gọi gần như chắc chắn sai trừu tượng - nó sẽ bám vào giả định của admin (khoảng
ngày, định dạng tiền, mật độ). `ProviderRevenueChart` ở phase 4 là consumer thứ
hai trong ngữ cảnh khác, và đó là cách rẻ nhất để lộ ra chỗ cần tham số hoá.

**Recharts ra SVG trần, không tự có a11y.** Không xử lý thì biểu đồ vô hình với
screen reader.

## Requirements

**Chức năng**
- Wrapper cho ba loại: tròn (donut), đường, cột.
- Màu series lấy từ token M3, ánh xạ qua `StatusTone` khi dữ liệu là trạng thái.
- Trạng thái rỗng, đang tải (skeleton), lỗi - dùng lại `AsyncState`/`Skeleton` sẵn có.
- Format tiền VND và nhãn tháng dùng chung, không mỗi chart một kiểu.

**Phi chức năng**
- Không page nào import thẳng `recharts`.
- Mỗi chart có `role="img"` + `aria-label` tóm tắt số liệu, kèm bảng dữ liệu ẩn
  cho screen reader.
- Tôn trọng `prefers-reduced-motion` (Recharts mặc định **bật** animation).
- Bundle first-load của khách không tăng.

## Architecture

```
src/components/common/chart/
    ChartCard.tsx          khung: tiêu đề, mô tả, action, trạng thái tải/rỗng/lỗi
    ChartA11yTable.tsx     bảng dữ liệu ẩn (sr-only) đi kèm mọi chart
    chart-theme.ts         màu series theo token M3 + StatusTone, tick, grid, tooltip
    chart-format.ts        format tiền VND, nhãn tháng/ngày (gom từ revenue-format)
    DonutChart.tsx
    LineChart.tsx
    BarChart.tsx
    useReducedMotion.ts    (hoặc dùng lại nếu đã có)
```

**Quy ước màu series** trong `chart-theme.ts`:
- Dữ liệu **trạng thái** → màu theo `StatusTone` (`success`/`warning`/`error`/`info`/`brand`).
  Nhờ vậy "đã huỷ" trên chart cùng màu với chip "đã huỷ" trong bảng.
- Dữ liệu **không phải trạng thái** (danh mục, provider) → dãy màu xoay vòng lấy
  từ token, không dùng palette mặc định của thư viện.

## Related Code Files

**Tạo mới** - toàn bộ `src/components/common/chart/` như trên

**Sửa**
- `handigo-web/package.json` - thêm `recharts`
- `docs/code-standards.md` - ghi quy ước "chart chỉ đi qua wrapper"

**Đọc để tham chiếu**
- `src/utils/statusTone.ts`, `src/utils/orderStatus.ts` (phase 0)
- `src/features/admin/components/revenue/revenue-format.ts` (đã có `money`, `compactMoney`, `monthLabel` - gom vào `chart-format.ts`)
- `src/components/common/AsyncState.tsx`, `src/components/common/Skeleton.tsx`

## Implementation Steps

1. `npm install recharts` (3.10.0, peer hỗ trợ React 19).
2. **Đo bundle trước và sau.** Chạy `npm run build` trước khi cài, ghi lại kích
   thước chunk vào-đầu-tiên. Chạy lại sau phase này. Nếu chunk khách tăng nghĩa
   là chart đã lọt vào tầng eager - phải tìm và sửa ngay.
3. `chart-format.ts`: chuyển `money`, `compactMoney`, `monthLabel` từ
   `revenue-format.ts` sang, để `revenue-format.ts` re-export giữ đường dẫn cũ.
4. `chart-theme.ts`: hằng số màu, cỡ chữ tick, màu lưới, style tooltip - đều tham
   chiếu `var(--color-*)`.
5. `ChartCard` + `ChartA11yTable`, rồi ba loại chart.
6. **Fixture cục bộ** `src/components/common/chart/__fixtures__/` với ba bộ:
   bình thường, rỗng, lệch cực đoan (mô phỏng dữ liệu dev 66% huỷ). Không seed DB.
7. Trang demo nội bộ (route dev-only hoặc file dựng tay) render cả ba loại chart
   với cả ba bộ fixture. **Đây là nơi nghiệm thu**, không phải trang admin thật.
8. Kiểm: bật "giảm chuyển động" của HĐH → chart không animate. Dùng screen reader
   → đọc được `aria-label` và bảng ẩn.

## Todo List

- [ ] Ghi kích thước bundle trước khi cài
- [ ] `npm install recharts`
- [ ] `chart-format.ts` (gom từ `revenue-format.ts`, giữ re-export)
- [ ] `chart-theme.ts` bám token M3 + `StatusTone`
- [ ] `ChartCard`, `ChartA11yTable`
- [ ] `DonutChart`, `LineChart`, `BarChart`
- [ ] Ba bộ fixture
- [ ] Trang demo nghiệm thu
- [ ] Kiểm `prefers-reduced-motion` và screen reader
- [ ] Đo lại bundle, so với bước 1
- [ ] Ghi quy ước vào `docs/code-standards.md`

## Success Criteria

- Ba loại chart render đúng với cả ba bộ fixture, gồm bộ rỗng và bộ lệch.
- Màu "đã huỷ" trên chart **trùng** màu chip "đã huỷ" trong bảng.
- Bật giảm chuyển động → không có animation nào.
- Screen reader đọc được nội dung chart.
- `npm run build`: chunk first-load của khách **không tăng** so với trước khi cài.
- `grep -rn "from \"recharts\"" src` → chỉ trong `components/common/chart/`.

## Risk Assessment

| Rủi ro | Giảm thiểu |
|---|---|
| Recharts lọt vào chunk eager, tăng bundle khách | Bước 2 đo trước/sau; quy tắc cấm import ngoài wrapper |
| Wrapper sai trừu tượng vì mới có một consumer | Phase 4 thêm `ProviderRevenueChart` ở ngữ cảnh khác; chấp nhận sửa chữ ký wrapper lúc đó |
| Recharts không đọc được `var()` ở vài thuộc tính (một số prop nhận số, không nhận chuỗi CSS) | Xử lý sớm ở `chart-theme.ts`, không rải workaround khắp nơi |
| Tự viết `useReducedMotion` trùng với cái đã có | Grep trước khi tạo |

## Security Considerations

Không có. Thư viện hiển thị, không gọi mạng, không nhận input người dùng. Cần
kiểm `npm audit` sau khi cài như mọi phụ thuộc mới.

## Next Steps

Mở khoá phase 4 (thay 4 chart tự dựng) và phase 5 (chart mới).
