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
| **Bảng màu mặc định Tailwind** (emerald/amber/red…) | **281 lần / 38 file** |
| Mã hex viết thẳng | 29 lần / 4 file |
| `ui-avatars.com` (CDN ngoài) | 19 lần / **18 file** |
| `glass-card` | 35 lần / 16 file |
| `"Đang tải"` text thô | 49 lần ⚠️ xem định nghĩa lại bên dưới |
| Ảnh Stitch `aida-public` còn sót | 12 lần / `AboutPage.tsx` |

> ⚠️ **Định nghĩa lại metric `"Đang tải"` (verify 22-07):** grep thô đếm cả các
> chuỗi *hợp lệ* — `aria-label` trong `Skeleton.tsx`, message mặc định của
> `AsyncState`, fallback lazy-load trong `App.tsx`. Những chỗ đó **nên** có chữ
> "Đang tải" cho screen reader. Tiêu chí đúng: **không còn trang nào render text
> tải thô thay vì skeleton ở tầng trang** — không dùng con số 49 làm đích.

## Các phase

| # | Phase | Trạng thái | Phụ thuộc |
|---|---|---|---|
| 0 | [Nền tảng dùng chung](phase-00-shared-foundation.md) | ✅ Xong (`b2df0e5`) | — |
| 1 | [Công khai + Auth](phase-01-public-and-auth.md) | ✅ Xong (`9b36193`, `33458de`) | Phase 0 |
| 2 | [Khách hàng](phase-02-customer.md) (+ `chat`, `chatbot`, `case-management`) | ◐ **Đang dở** — mới quét cơ học (`e648a50`) | Phase 0 |
| 3 | [Thợ](phase-03-provider.md) (+ trang gợi ý dịch vụ của thợ) | ☐ Chưa bắt đầu | Phase 0 |
| 4 | [Quản trị](phase-04-admin.md) (+ trang duyệt gợi ý dịch vụ) | ☐ Chưa bắt đầu | Phase 0 |
| 5 | [A11y + Responsive](phase-05-accessibility-responsive.md) | ☐ Chưa bắt đầu | Phase 1–4 |

### Phase 2 đã làm tới đâu (tạm dừng 2026-07-22)

**Xong:** token tông trạng thái dùng chung (`utils/statusTone.ts`), gỡ `ui-avatars.com`
khỏi khung dùng chung (Navbar/DashboardLayout/DashboardShell) và 4 file nhóm khách
hàng, sửa class chết `success-green`, gỡ `glass-card` + màu hardcode ở nhóm booking,
`BookingHistoryPage` dùng `AsyncState` + skeleton.

**Chưa làm — toàn bộ phần tách file**, đây mới là phần nặng:
`BookingDetailPage` 1911 · `CustomerServiceDetailPage` 931 · `OrderTrackingMap` 849 ·
`NotificationsPage` 685 · `CustomerProfilePage` 681 · `CreateBookingStep2Page` 628 ·
`ConfirmPaymentPage` 594 · `WalletPage` 559 · `AddressBookModal` 724 ·
`UserProfileSection` 630 · `PublicProviderProfilePage` 486 · và 4 file khác.

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

## Phát hiện trong lúc thực hiện — nên soi lại khi verify plan

Bốn thứ tìm được khi làm mà lúc lập plan không thấy. Chúng gợi ý rằng khảo sát
ban đầu còn sót, nên khi rà lại plan hãy chủ động tìm thêm cùng loại:

1. **Class CSS không tồn tại vẫn được dùng.** `shadow-soft` và `success-green`
   được viết ở 9+ chỗ nhưng chưa bao giờ khai báo → phần tử render không màu.
   `mix-blend-mode-screen` cũng sai tên (đúng là `mix-blend-screen`).
   → Nên quét: mọi class không khớp token nào trong `index.css` cũng không phải
   utility Tailwind hợp lệ.
2. **Chức năng giả.** Form gửi yêu cầu hỗ trợ công khai không gọi API nào mà vẫn
   báo "đã được ghi nhận". → Nên quét: `onSubmit` không có lời gọi mạng.
3. **Nội dung rác lọt vào bản chính thức.** Câu "Tôi thích phản hồi này hơn" từ
   giao diện chat AI nằm giữa đoạn văn trang Giới thiệu.
4. **Hệ màu ngầm thứ hai.** 281 lần dùng palette mặc định Tailwind trên 38 file,
   nhiều hơn cả `bg-white` (162) — nguyên nhân là M3 thiếu `success`/`warning`.

## Kết quả verify plan (2026-07-22 chiều)

Đã đối chiếu toàn bộ số liệu plan với code thực tế. Build xanh, ESLint 0 lỗi,
các claim "đã xong" của Phase 0–1 đều kiểm chứng đúng (`aida-public` = 0, không
còn file > 200 dòng trong `auth`/`content`, `AsyncState` có prop `skeleton`).

Số liệu cập nhật: file > 200 dòng **66 → 55** · palette Tailwind **281 → 233**
(33 file) · `bg/text-white` **204 → 171** · `ui-avatars` **18 → 9 file thật**
(1 hit còn lại là comment trong `InitialsAvatar`) · `glass-card` **35 → 32**.

**Sửa đổi plan từ đợt verify:**

1. **Bổ sung 4 feature bị sót khỏi khảo sát ban đầu** (~2.600 dòng, 7 file > 200):
   `chat` + `chatbot` + `case-management` → Phase 2;
   `service-suggestion` tách đôi: trang provider → Phase 3, trang admin → Phase 4.
   Bài học: khảo sát theo nhóm vai trò đã bỏ qua các feature cắt ngang vai trò.
2. **Định nghĩa lại metric `"Đang tải"`** (xem ghi chú ở bảng khảo sát).
3. **Sync header trạng thái** các phase file với bảng phase ở trên.
4. **Thêm 2 phép quét vào Phase 5**: class không tồn tại + handler giả không gọi
   mạng (hai loại lỗi đã gặp ở Phase 0–1, cần rà nốt toàn dự án).

## Câu hỏi chưa chốt

- Bộ số liệu `10.000+ / 2.000+ / 50.000+` và `50.000+ việc đã hoàn thành` ở
  landing có phản ánh số thật không? Đang giữ nguyên giá trị cũ.
- ~~Nguồn ảnh thay thế cho 12 ảnh Stitch ở `AboutPage.tsx`~~ — đã giải quyết ở
  Phase 1: `aida-public` = 0 toàn dự án, bố cục không còn phụ thuộc ảnh ngoài.
