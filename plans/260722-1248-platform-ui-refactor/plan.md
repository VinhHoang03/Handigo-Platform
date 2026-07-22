---
title: Refactor UI/UX toàn nền tảng Handigo
status: in-progress
created: 2026-07-22
branch: feat/ui-refactor-landing
blockedBy: []
blocks: []
---

# Refactor UI/UX toàn nền tảng Handigo

Chuẩn hoá UI 50 trang của `handigo-web` về một hệ design token duy nhất, gỡ phụ
thuộc CDN ngoài, thay trạng thái tải/rỗng tạm bợ bằng component dùng chung, và
tách các file quá lớn. Landing page đã hoàn thành ở commit `87cd616`.

## Bối cảnh kỹ thuật

- React 19 · Tailwind **v4** (CSS-first, `@theme` trong `src/index.css` là nguồn
  token **duy nhất** — `tailwind.config.js` đã xoá vì v4 không đọc)
- Material 3 token: `primary` / `secondary` / `tertiary` / `surface-*` / `on-*`
- Đã bổ sung `primary-hover` `#2a1ca6`, `primary-pressed` `#221584`

## Số liệu khảo sát (2026-07-22)

| Hạng mục | Số lượng |
|---|---|
| Trang (`*Page.tsx`) | 50 |
| File `.tsx` | 155 |
| File > 200 dòng (vi phạm rule) | **66** |
| `bg-white` / `text-white` hardcode | 162 / 42 lần |
| Mã hex viết thẳng | 29 lần / 4 file |
| `ui-avatars.com` (CDN ngoài) | 19 lần / **18 file** |
| `glass-card` | 35 lần / 16 file |
| `"Đang tải"` text thô | 49 lần |
| Ảnh Stitch `aida-public` còn sót | 12 lần / `AboutPage.tsx` |

## Các phase

| # | Phase | Trạng thái | Phụ thuộc |
|---|---|---|---|
| 0 | [Nền tảng dùng chung](phase-00-shared-foundation.md) | ☐ Chưa bắt đầu | — |
| 1 | [Công khai + Auth](phase-01-public-and-auth.md) | ◐ Landing xong | Phase 0 |
| 2 | [Khách hàng](phase-02-customer.md) | ☐ Chưa bắt đầu | Phase 0 |
| 3 | [Thợ](phase-03-provider.md) | ☐ Chưa bắt đầu | Phase 0 |
| 4 | [Quản trị](phase-04-admin.md) | ☐ Chưa bắt đầu | Phase 0 |
| 5 | [A11y + Responsive](phase-05-accessibility-responsive.md) | ☐ Chưa bắt đầu | Phase 1–4 |

**Phase 0 chặn tất cả.** Làm trước để phase 1–4 chỉ còn là áp dụng, không phải
vừa làm vừa nghĩ ra quy ước. Phase 1–4 độc lập nhau, chạy song song được nếu
mỗi người giữ một nhóm feature riêng (không đụng file chung).

## Nguyên tắc xuyên suốt

1. **Không đổi hành vi.** Đây là refactor giao diện, không phải đổi luồng nghiệp vụ.
2. **Tái sử dụng trước khi tạo mới.** Đã có `AsyncState` (23 file), `ReliableImage`
   (12 file), `InitialsAvatar`, `SectionHeader`, `StatusBadge`, `Modal`,
   `FormField`, `Pagination`, `RatingStars`, `ConfirmDialog`.
3. **Mỗi phase phải build xanh** (`npm run build`) + ESLint 0 lỗi trước khi sang phase kế.
4. **Tách file > 200 dòng ngay trong lúc chạm vào**, không để thành việc riêng.
5. Chụp ảnh trước/sau mỗi nhóm trang để đối chiếu.

## Rủi ro lớn nhất

`features/booking/pages/BookingDetailPage.tsx` — **1911 dòng**, là trang nghiệp vụ
phức tạp nhất (thanh toán, hoàn tiền, khiếu nại). Tách file ở đây rủi ro cao nhất;
xem chi tiết ở Phase 2.

## Quyết định đã chốt

- **Không làm dark mode.** Giữ `color-scheme: light` và bảng token sáng duy nhất.
  Hệ quả: không cần cặp token tối, nhưng vẫn phải dùng token `on-*` thay vì
  `text-white` hardcode — để sau này đổi ý còn sửa được ở một chỗ.
- **`docs/` tiếp tục nằm ngoài git** (`.gitignore`). Không đưa vào repo.
  Hệ quả: tài liệu phát sinh từ plan này chỉ lưu cục bộ; mọi thứ cần chia sẻ với
  đội phải nằm trong `plans/` hoặc chính comment trong code.

## Câu hỏi chưa chốt

- Bộ số liệu `10.000+ / 2.000+ / 50.000+` và `50.000+ việc đã hoàn thành` ở
  landing có phản ánh số thật không? Đang giữ nguyên giá trị cũ.
- Nguồn ảnh thay thế cho 12 ảnh Stitch ở `AboutPage.tsx` (xem Phase 1) —
  sinh ảnh AI đang bị chặn vì key Gemini ở free tier.
