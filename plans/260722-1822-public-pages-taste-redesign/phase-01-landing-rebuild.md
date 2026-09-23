# Phase 1 — Dựng lại trang chủ

**Ưu tiên:** Cao nhất · **Trạng thái:** ✅ Hoàn thành (2026-07-22) · **Phụ thuộc:** Phase 0

Trang gây ấn tượng đầu. Hiện tại là 4 section liên tiếp cùng một khuôn "lưới thẻ
trắng", **không có một tấm ảnh nào**, và thứ chiếm nửa màn hình đầu là một **giao
diện đơn hàng giả dựng bằng div**.

## Liên kết

- [plan.md](plan.md) · [Phase 0](phase-00-visual-foundation.md)

## Kết quả audit trang chủ

| Vấn đề | Vị trí | Mức |
|---|---|---|
| Giao diện đơn hàng giả (`#HG-2847`, thợ "Vũ Hoàng · 4,9 · 218 đánh giá", `280.000đ`, mốc giờ 09:12/09:34) | `HeroPreviewCard.tsx` | **Nghiêm trọng** — skill gọi đây là dấu hiệu AI số 1, và nó bịa cả người lẫn giao dịch |
| 0 ảnh thật trên toàn trang | Tất cả | **Nghiêm trọng** |
| Dấu gạch dài `—` trong text hiển thị | `HeroSection.tsx:57` | Cao |
| Hàng avatar + "50.000+ việc đã hoàn thành" nằm trong hero | `HeroSection.tsx` | Cao — skill cấm nhét social-proof vào hero |
| Copy độn lặp 8 lần | `CategoriesSection.tsx:57` | Cao |
| Thẻ thợ hiện "0.0" sao và tên "Provider01"; thẻ thứ 5 bị cắt cụt | `ProvidersSection.tsx` | Cao |
| Đánh giá 2 chữ ("sạch, đẹp"), tên viết thường "duc trung", một thẻ lồng hộp trả lời | `TestimonialsSection.tsx` | Cao |
| Dải số liệu chưa xác thực, mâu thuẫn với trang Giới thiệu | `StatsSection.tsx` | **Nghiêm trọng** |
| Thiếu hẳn section "cách hoạt động" và CTA đóng trang | — | Trung bình |
| 4/6 section dùng chung khuôn lưới thẻ | — | Trung bình |

## Bố cục mới — 8 section, 8 khuôn khác nhau

Skill yêu cầu ≥4 khuôn bố cục khác nhau trên 8 section; thiết kế này dùng 8.

| # | Section | Khuôn bố cục | Thay đổi chính |
|---|---|---|---|
| 1 | **Hero** | Chia đôi bất đối xứng | Gỡ thẻ đơn hàng giả. Bên phải là **ảnh dịch vụ thật**. Gỡ hàng avatar ra khỏi hero |
| 2 | **Dải cam kết** | Dải ngang mảnh, không thẻ | Nhận 3 cam kết định tính + hàng avatar bị đuổi khỏi hero |
| 3 | **Danh mục dịch vụ** | **Bento** ô to nhỏ xen kẽ, có ảnh nền | Gỡ copy độn, ô lớn mang ảnh thật, ô nhỏ chỉ tên + số dịch vụ (số thật) |
| 4 | **Cách Handigo hoạt động** | Chuỗi bước nối tiếp (MỚI) | 4 bước, nhãn là động từ (`Mô tả việc` / `Nhận báo giá` / `Thợ đến làm` / `Thanh toán & đánh giá`) — **không** đánh số "Bước 1/2/3" |
| 5 | **Thợ trong hệ thống** | Carousel scroll-snap | Lọc bỏ thợ 0 sao và tên placeholder; xử lý mép cắt bằng fade + snap |
| 6 | **Vì sao chọn Handigo** | Editorial chữ lớn + danh sách | Thay 2×2 thẻ icon. Gánh vai trò thuyết phục sau khi bỏ dải số |
| 7 | **Khách hàng nói gì** | 1 trích dẫn lớn + 2 nhỏ (bất đối xứng) | Chỉ hiện đánh giá đủ dài; không đủ chất lượng thì **ẩn cả section** |
| 8 | **CTA đóng trang** | Dải full-width (MỚI) | Trang hiện kết thúc ở đánh giá rồi rơi thẳng vào footer |

Kiểm tra chống lặp: không có 3 section liên tiếp nào cùng kiểu "ảnh + chữ chia
đôi" (chỉ section 1 dùng). Ngân sách eyebrow: `ceil(8/3) = 3`; hero dùng 1, còn 2.

## Nguồn ảnh

Dùng lại ảnh dịch vụ qua API công khai (đã xác minh gọi được khi chưa đăng nhập).
Ưu tiên nạp qua `ReliableImage` + `normalizeImageUrl` sẵn có.

- Hero: 1 ảnh dịch vụ tiêu biểu, bo góc theo thang radius chung
- Bento danh mục: 3–4 ô lớn mang ảnh, các ô nhỏ để trống nền theo token
- **Cấm** dựng lại ảnh chụp màn hình giả bằng div (skill Section 4.8)
- Ảnh phải có `alt` mô tả nội dung; ảnh trang trí thuần thì `alt=""`

## File liên quan

**Sửa**
- `components/home/HeroSection.tsx` — bố cục mới, gỡ `—`, gỡ social proof
- `components/home/CategoriesSection.tsx` — chuyển sang bento, gỡ copy độn
- `components/home/ProvidersSection.tsx` — lọc dữ liệu + xử lý mép carousel
- `components/home/TestimonialsSection.tsx` — bố cục bất đối xứng + lọc chất lượng
- `components/home/FeaturesSection.tsx` — chuyển sang editorial
- `components/home/HomeCards.tsx` — cập nhật thẻ theo khuôn mới
- `components/home/HomeFooter.tsx` — **gỡ huy hiệu Google Play / App Store** (không
  có link, sản phẩm chỉ có web → đang là tuyên bố sai)
- `pages/LandingPage.tsx` — thứ tự section mới
- `features/home/data/homeData.ts` — thay `stats` bằng cam kết định tính

**Tạo**
- `components/home/TrustStrip.tsx` — dải cam kết (section 2)
- `components/home/HowItWorksSection.tsx` — chuỗi bước (section 4)
- `components/home/ClosingCta.tsx` — CTA đóng trang (section 8)
- `components/home/CategoryBento.tsx` — lưới bento danh mục

**Xoá**
- `components/home/HeroPreviewCard.tsx` — thẻ đơn hàng giả
- `components/home/StatsSection.tsx` — dải số liệu chưa xác thực

## Các bước

1. **Gỡ thẻ đơn hàng giả trước tiên.** Xoá `HeroPreviewCard.tsx`, thay bằng ảnh
   dịch vụ thật. Đây là thay đổi đơn lẻ có tác động lớn nhất toàn plan.
2. **Sửa hero:** headline giữ tối đa 2 dòng, subtext ≤20 từ và **thay `—` bằng
   dấu chấm hoặc phẩy**, thanh tìm kiếm là CTA chính (đúng bản chất sàn dịch vụ),
   `pt` tối đa `pt-24`. Chuyển hàng avatar + số việc xuống section 2.
3. **Dựng `TrustStrip`** với 3 cam kết định tính lấy từ `homeData.ts` mới.
4. **Chuyển danh mục sang bento.** Số ô = đúng số danh mục (8), **không để ô
   trống**. Ô lớn mang ảnh; thay copy độn bằng số dịch vụ thật trong danh mục.
5. **Dựng `HowItWorksSection`** — 4 bước, nhãn động từ, có ảnh hoặc icon nhất quán.
6. **Lọc dữ liệu thợ:** chỉ hiện thợ đã xác minh, có điểm > 0, tên không phải
   dạng placeholder (`Provider\d+`). Không đủ 3 thợ đạt chuẩn thì ẩn section.
   ⚠️ Lọc ở **tầng hiển thị**, không đổi API.
7. **Đánh giá:** chỉ lấy nhận xét ≥ 40 ký tự, tối đa 3 dòng, tên viết hoa đúng
   chuẩn, bỏ hộp trả lời lồng nhau. Không đủ 3 thì ẩn section.
8. **`FeaturesSection` sang editorial** — một câu khẳng định cỡ lớn + danh sách
   luận điểm, thay 4 thẻ icon đều nhau.
9. **Dựng `ClosingCta`** — một CTA duy nhất, trùng ý với CTA hero (skill cấm 2
   CTA khác chữ cùng ý trên một trang → thống nhất nhãn).
10. **Gắn `.reveal`** (Phase 0) cho section 3–8. Hero **không** reveal (phải thấy
    ngay). Mỗi animation phải trả lời được "nó truyền đạt điều gì".
11. Build + lint + chụp ảnh full-page desktop/mobile đối chiếu.

## Todo

- [x] Xoá `HeroPreviewCard.tsx`, thay bằng ảnh dịch vụ thật
- [x] Sửa hero: 2 dòng headline, subtext ≤20 từ, gỡ `—`, gỡ social proof
- [x] Tạo `TrustStrip.tsx`
- [x] Chuyển danh mục sang `CategoryBento.tsx`, gỡ copy độn 8 chỗ
- [x] Tạo `HowItWorksSection.tsx` (nhãn động từ, không "Bước 1/2/3")
- [x] Lọc thợ (0 sao, tên placeholder) + sửa mép carousel
- [x] Lọc đánh giá theo độ dài, bố cục 1 lớn + 2 nhỏ
- [x] `FeaturesSection` sang editorial
- [x] Tạo `ClosingCta.tsx`, thống nhất nhãn CTA toàn trang
- [x] Xoá `StatsSection.tsx`, thay `stats` bằng cam kết định tính
- [x] Gỡ huy hiệu Google Play / App Store khỏi footer
- [x] Gắn `.reveal` cho section 3–8
- [x] Build xanh + ESLint 0 lỗi + ảnh đối chiếu desktop/mobile

## Tiêu chí hoàn thành

- `grep -rn "HG-2847\|HeroPreviewCard" src/` → 0
- `grep -rn "—" src/components/home` → 0 trong chuỗi hiển thị
- Trang chủ có **≥4 ảnh thật**; 0 giao diện giả dựng bằng div
- 8 section dùng 8 khuôn bố cục khác nhau; không 3 section liên tiếp cùng kiểu
- Không còn chuỗi `"Xem các dịch vụ phù hợp trong danh mục"`
- Không hiển thị thợ 0 sao hay tên `Provider01`
- Hero vừa trong màn hình đầu ở 1440×900 và 390×844, CTA thấy được không cần cuộn
- Không còn con số nào chưa xác thực trên trang

## Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Lọc dữ liệu chặt quá → section trống trên môi trường thật | **Cao** | Định nghĩa rõ ngưỡng ẩn cả section thay vì hiện danh sách nghèo nàn; test với DB thật |
| Ảnh dịch vụ tỉ lệ không đồng nhất làm vỡ bento | Trung bình | `object-cover` + khung tỉ lệ cố định; kiểm với đủ 16 ảnh |
| Bỏ dải số liệu làm trang mất "sức nặng" | Trung bình | Section 6 (editorial) và 2 (cam kết) gánh lại bằng lời hứa cụ thể thay vì con số |
| Gỡ huy hiệu app store bị hiểu là mất tính năng | Thấp | Ghi rõ trong commit: sản phẩm chưa có app di động |

## Bảo mật

- Ảnh và tên thợ hiển thị công khai: chỉ lấy trường vốn đã công khai ở
  `/customer/providers/:id`, **không** thêm số điện thoại hay địa chỉ chi tiết
- Không đưa `id` nội bộ của đơn hàng vào DOM trang công khai

## Bước kế tiếp

Độc lập với Phase 2, 3.
