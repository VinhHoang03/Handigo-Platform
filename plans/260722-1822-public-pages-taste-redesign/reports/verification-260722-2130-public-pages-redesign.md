# Báo cáo kiểm chứng — Làm mới UI nhóm trang công khai

**Ngày:** 2026-07-22 · **Nhánh:** `feat/ui-refactor-landing` · **Phase 0–4: xong**

Ảnh đối chiếu: `../evidence/` (27 tệp, `phase04-*` là bộ cuối 8 trang × 2 breakpoint).

---

## 1. Quét cơ học

| # | Lệnh | Kết quả |
|---|---|---|
| 1 | Gạch dài `—` trong **chuỗi hiển thị** | **0** trên cả 8 trang (đo bằng `innerText` trình duyệt, không phải grep tệp) |
| 2 | `HG-2847` / `HeroPreviewCard` / `Nguyễn Văn A|B|C` | 0 |
| 3 | `"Xem các dịch vụ phù hợp trong danh mục"` | 0 |
| 4 | Bảng màu Tailwind mặc định trong nhóm công khai | 0 |
| 5 | `addEventListener("scroll")` | 0 (2 chỗ cũ thay bằng `IntersectionObserver`) |
| 6 | `lucide-react` trong nhóm công khai | 0 |

⚠️ Grep thô lệnh 1 vẫn còn ~12 dòng chứa `—`, **toàn bộ nằm trong khối chú thích
`/** */`**, không dòng nào là chuỗi hiển thị. Đây là sai lệch có ý thức so với
cách diễn đạt của plan (plan ghi "bỏ qua comment").

**Eyebrow** (ngưỡng `ceil(số section / 3)`): trang chủ 0/3 · Giới thiệu 1 ·
Tin tức 2 · Hỗ trợ 1. Đạt.

---

## 2. Đo trên trình duyệt thật

| Hạng mục | Kết quả |
|---|---|
| Tràn ngang @ 360 / 390 / 768 / 1024 / 1440 | **0px** trên cả 5 trang nội dung |
| `prefers-reduced-motion: reduce` | 6/6 khối reveal → `opacity:1, transform:none, transition:0s`. Tắt emulation → 6/6 ẩn lại. **Kiểm bằng `emulateMedia`, không phải đọc CSS** |
| Chiều cao navbar desktop | 70px (≤ 80) |
| Vùng chạm < 44px @390px | **0** trên `/`, `/gioi-thieu`, `/tin-tuc`, `/ho-tro`, `/customer/services`, `/login`, `/register`, `/forgot-password` |
| Bàn phím: 14 điểm dừng Tab trên form đăng ký | 14/14 có focus ring thấy được, không có bẫy focus |
| `alt` thiếu | 0/105 ảnh trên 8 trang |
| `<h1>` mỗi trang | đúng 1 |

### Core Web Vitals (dev server, 1440×900)

| Trang | LCP | CLS | FCP |
|---|---|---|---|
| `/` | 1344ms | 0.0004 | 292ms |
| `/gioi-thieu` | 1336ms | 0.0005 | 312ms |
| `/tin-tuc` | 600ms | 0.0006 | 268ms |

Ngưỡng LCP < 2.5s và CLS < 0.1: đạt với biên rộng.

### Tương phản WCAG AA

Quét toàn bộ nút chữ trên 6 trang (chuẩn hoá màu qua canvas vì Tailwind v4 phát
màu `oklch`, hàm parse `rgb()` thông thường cho kết quả sai).

- **0 lỗi** trên `/gioi-thieu`, `/tin-tuc`, `/ho-tro`, `/login`.
- **Đã sửa:** `text-outline` (#777587) trên nền trắng chỉ đạt **4.49** (hụt AA
  đúng 0.01) ở 2 chỗ trang dịch vụ → đổi sang `text-on-surface-variant`.
- **Đã sửa:** chữ trên ô bento trang chủ. Đo pixel thật (ẩn chữ, chụp riêng vùng
  chữ chiếm): điểm sáng nhất của ảnh lọt qua lớp phủ chỉ còn **4.06** với chữ
  trắng 18px. Đổi chân dải phủ từ `on-surface/85` sang đặc hoàn toàn → điểm sáng
  nhất nay là **8.98** và **11.47**, trung bình ~14.

### Console

Toàn bộ 8 trang × 2 breakpoint: **1 lỗi duy nhất** là `POST /api/auth/refresh-token`
của khách chưa đăng nhập. Backend trả **401 `Missing refresh token`** khi không có
cookie (kiểm bằng `curl`, cả trực tiếp lẫn qua proxy Vite) — đúng như plan dự kiến.
Trình duyệt test hiện 404 `Không tìm thấy người dùng` vì profile còn cookie refresh
cũ trỏ tới tài khoản đã bị xoá khỏi DB; không phải lỗi mã nguồn.

Mọi lời gọi dữ liệu khác: `categories/active`, `services`, `providers/featured`,
`feedback/latest` → 200.

---

## 3. Sai lệch có chủ ý so với plan

| # | Plan yêu cầu | Đã làm | Lý do |
|---|---|---|---|
| 1 | Lọc thợ: xác minh **và** điểm > 0 **và** tên thật | Chỉ lọc tên placeholder; thợ chưa có đánh giá hiện nhãn "Chưa có đánh giá" thay cho "0.0 ★" | DB thật chỉ có 2/9 thợ đạt cả 3 tiêu chí → dưới ngưỡng 3 → mất cả section. **Bạn đã chọn phương án này.** Kết quả: 6 thợ hiện, không bịa số nào |
| 2 | Bento "đúng 8 danh mục" | 7 danh mục | DB có 11 danh mục nhưng chỉ 7 có dịch vụ. 4 danh mục rỗng bấm vào ra trang trắng nên không đưa lên trang chủ |
| 3 | Trang chủ 8 section | 7 section, 7 khuôn bố cục | Section "Khách hàng nói gì" tự ẩn: cả 3 đánh giá trong DB đều dưới 40 ký tự (`"sạch, đẹp"`, `"tốt, chuyên nghiệp"`, rỗng). Đúng luật của plan; section tự hiện lại khi có đánh giá đạt chuẩn |
| 4 | Chỉ sửa **ngày** bài viết + bài khuyến mãi hết hạn | Gỡ thêm 2 bài, viết lại 1 bài | Xem mục 4 dưới |
| 5 | Ảnh thương hiệu cho panel trái trang auth (tuỳ chọn) | Không làm | Plan ghi "chỉ làm nếu ảnh khớp tông, không đủ hợp thì giữ nguyên". Thêm một lời gọi API vào trang đăng nhập chỉ để trang trí là cái giá không đáng |

## 4. Nội dung bịa gỡ thêm (ngoài phạm vi plan nêu tên)

Ba bài viết trong `content.data.ts` cùng loại lỗi với bài khuyến mãi mà plan đã
chỉ ra. Không phải dữ liệu DB — tất cả nằm trong tệp nguồn, **không ghi gì vào DB
dùng chung**.

| Bài | Vấn đề | Xử lý |
|---|---|---|
| "Siêu deal tháng 10: Giảm 20%" | Ưu đãi bịa, đã hết hạn, hiển thị như đang chạy | Gỡ |
| "Nhà sạch - Phố xanh: hơn 500 kỹ thuật viên..." | Sự kiện cộng đồng chưa từng diễn ra ở một công ty 2 tháng tuổi | Gỡ |
| "Nâng cấp bảo mật: triển khai xác thực hai lớp" | **Hệ thống không có 2FA** (đã kiểm `user.model.ts`, `auth.service.ts`) | Viết lại thành "Đăng nhập bằng Google và Facebook" — tính năng có thật |

Ngày 4 bài còn lại: 2023 → 28/05–15/07/2026, khớp mốc khởi tạo 5/2026.
Danh mục "Khuyến mãi" và "Tin tức cộng đồng" gỡ khỏi bộ lọc tĩnh (không còn bài);
danh mục mới vẫn tự xuất hiện khi có bài từ API.

## 5. Font

Be Vietnam Pro đạt cổng chặn của Phase 0: `ế ộ ữ ẩ ỡ ằ Đ đ` render sạch ở 400/500/
600/700 và ở 12/14/16/24/48px, không dính dấu, không lệch dấu chồng
(`evidence/phase00-font-vietnamese-check.png`). Chốt đổi.

Cả hai font self-host qua `@fontsource`, có subset `vietnamese` riêng và
`font-display: swap`. `index.html` chỉ còn một `<link>` Google cho Material
Symbols — **nợ còn lại**.

---

## Nợ ghi nhận cho đợt sau

1. Material Symbols vẫn nạp từ `fonts.googleapis.com`.
2. `lucide-react` còn ~47 tệp ngoài nhóm trang công khai (`CategoryIcon.tsx` nằm
   trong `components/common` nên vẫn dùng lucide, dù nhánh đó là dead code với dữ
   liệu thật vì `category.icon` là URL SVG).
3. Hai ngôn ngữ hình ảnh trên cùng một site: minh hoạ 3D (dịch vụ, trang chủ,
   Giới thiệu) và ảnh chụp thật (Tin tức). Cần chốt **một** phong cách.
4. Liên kết footer và `SocialLink` đều trỏ `to="#"`.
5. Trang Giới thiệu chưa có mục ban lãnh đạo — chờ tên + chức danh + ảnh thật.
6. Lighthouse đầy đủ chưa chạy; số liệu trên đo bằng `PerformanceObserver` trên
   dev server, chưa phải bản build production.

## Câu hỏi chưa giải quyết

- Nội dung 16 câu FAQ do tôi soạn từ hành vi thật của hệ thống (chính sách hoàn
  tiền lấy đúng từ `refundPolicy.service.ts`). **Cần bạn duyệt lại về mặt vận
  hành** trước khi phát hành.
- Ba bài viết bị gỡ: có muốn thay bằng nội dung thật, hay để trang Tin tức chạy
  với 4 bài?
