# Phase 0 — Nền tảng thị giác

**Ưu tiên:** Cao nhất · **Trạng thái:** ☐ Chưa bắt đầu · **Chặn:** Phase 1–3

Chuẩn bị 4 thứ mà mọi trang sau đều cần: chữ, icon, chuyển động, ảnh. Không làm
trước thì mỗi trang tự chọn một kiểu và phải sửa lại lần hai.

## Liên kết

- [plan.md](plan.md)
- Đợt refactor kỹ thuật trước: `plans/260722-1248-platform-ui-refactor/`

## Kết quả khảo sát

1. **Font nạp qua `<link>` Google Fonts** trong `index.html` (Inter + Hanken
   Grotesk + Material Symbols). Skill Section 3.A cấm cách này ở production:
   chặn render, phụ thuộc mạng bên thứ ba, không kiểm soát được `font-display`.
2. **`Inter` đang là font body mặc định.** Skill Section 4.1 xếp Inter vào nhóm
   "không nên dùng làm mặc định". Ở đây có lựa chọn tốt hơn hẳn về mặt ngữ cảnh.
3. **Hai hệ icon song song:** `material-symbols-outlined` 273 chỗ + `lucide-react`
   50 file. Skill Section 3.C: một dự án một hệ icon.
4. **Không có thư viện animation nào.** Đây là lợi thế: `MOTION_INTENSITY 5`
   nằm trong dải 4–7 mà skill định nghĩa là **CSS thuần** — không cần cài gì.
5. **`index.css` đã có sẵn khối `prefers-reduced-motion`** từ đợt trước, chỉ cần
   mở rộng cho các animation mới.
6. **Ảnh dịch vụ lấy được không cần đăng nhập** — đã xác minh `/customer/services`
   render 16 ảnh khi chưa login. Đây là nguồn ảnh cho Phase 1–2.

## Yêu cầu

**Chức năng**
- Không đổi hành vi trang nào
- Font mới phải hiển thị **đủ dấu tiếng Việt** ở mọi trọng lượng dùng tới

**Phi chức năng**
- Không tăng bundle đáng kể; font self-host phải `font-display: swap` + preload
- Không thêm dependency animation
- Build xanh, ESLint 0 lỗi

## Kiến trúc

```
index.html               gỡ 3 thẻ <link> Google Fonts, thêm og:image
src/main.tsx             import @fontsource-variable/... (self-host)
src/index.css
  ├── @theme             cập nhật --font-* sang bộ chữ mới
  └── @layer utilities   MỚI: .reveal / .reveal-in (scroll-reveal thuần CSS)
src/hooks/
  └── use-reveal-on-scroll.ts   MỚI: IntersectionObserver dùng chung
public/og-image.png      MỚI: 1200x630
```

## Quyết định chữ (cần chốt trước khi code)

| Vai trò | Hiện tại | Đề xuất | Lý do |
|---|---|---|---|
| Display | Hanken Grotesk | **Giữ nguyên** | Đã có cá tính, dấu tiếng Việt tốt, không có lý do đổi |
| Body | Inter | **Be Vietnam Pro** | Font Google do foundry Việt thiết kế, xử lý dấu tiếng Việt (đặc biệt dấu chồng: ế, ộ, ữ) tốt hơn Inter vốn thiết kế cho tiếng Latin phương Tây. Vừa thoát mặc định Inter mà skill cảnh báo, vừa **đúng ngữ cảnh sản phẩm** thay vì đổi font cho khác đi |

⚠️ Bắt buộc kiểm mắt trước khi chốt: render thử chuỗi `ế ộ ữ ẩ ỡ ằ Đ` ở 400/500/
600/700 và ở cỡ nhỏ 12–14px. Nếu dấu bị dính hoặc lệch thì **giữ Inter** và ghi
lại lý do — không đổi font chỉ để thoát danh sách cấm.

## File liên quan

**Sửa**
- `index.html` — gỡ `<link>` font, thêm `og:image` + `twitter:card=summary_large_image`
- `src/main.tsx` — import font self-host
- `src/index.css` — `--font-*`, utility reveal, mở rộng `prefers-reduced-motion`

**Tạo**
- `src/hooks/use-reveal-on-scroll.ts` — IntersectionObserver dùng chung
- `public/og-image.png` — ảnh chia sẻ mạng xã hội 1200×630

**Không đụng**
- Bảng màu token trong `@theme` — brand giữ nguyên `#3525cd`

## Các bước

1. **Cài font self-host.** `npm i @fontsource-variable/be-vietnam-pro
   @fontsource-variable/hanken-grotesk`. Import trong `main.tsx`. Gỡ 2 thẻ
   `<link>` font chữ khỏi `index.html` (giữ thẻ Material Symbols tới bước 3).
2. **Kiểm dấu tiếng Việt** theo cảnh báo trên. Chốt giữ hay đổi.
3. **Hợp nhất icon.** Trong phạm vi trang công khai: thay `lucide-react` bằng
   `material-symbols-outlined`. Đếm trước bằng
   `grep -rl lucide-react src/components/home src/features/content`. Material
   Symbols vẫn nạp qua Google (font icon) — chấp nhận ở đợt này, ghi vào nợ sau.
4. **Tạo tiện ích scroll-reveal thuần CSS.**
   ```css
   @layer utilities {
     .reveal { opacity: 0; transform: translateY(24px);
       transition: opacity .6s cubic-bezier(.16,1,.3,1),
                   transform .6s cubic-bezier(.16,1,.3,1); }
     .reveal-in { opacity: 1; transform: none; }
   }
   ```
   Hook `use-reveal-on-scroll.ts` gắn `.reveal-in` khi phần tử vào viewport
   (`IntersectionObserver`, `once: true`). **Cấm** `window.addEventListener("scroll")`
   (skill Section 5.D).
5. **Mở rộng `prefers-reduced-motion`:** thêm `.reveal { opacity:1; transform:none;
   transition:none; }` để người tắt chuyển động thấy nội dung ngay.
6. **Tạo `og:image`** 1200×630 (logo + tagline trên nền brand), khai báo trong
   `index.html`, đổi `twitter:card` thành `summary_large_image`.
7. Build + lint + chụp ảnh 2 trang đối chiếu font trước/sau.

## Todo

- [ ] Cài + import font self-host, gỡ `<link>` Google Fonts
- [ ] Kiểm dấu tiếng Việt ở 4 trọng lượng, chốt giữ/đổi body font
- [ ] Cập nhật `--font-*` trong `@theme`
- [ ] Thay lucide → Material Symbols trong nhóm trang công khai
- [ ] Tạo `.reveal` utility + `use-reveal-on-scroll.ts`
- [ ] Bổ sung reduced-motion cho `.reveal`
- [ ] Tạo và khai báo `og:image` 1200×630
- [ ] Build xanh + ESLint 0 lỗi + ảnh đối chiếu

## Tiêu chí hoàn thành

- `grep -n "fonts.googleapis" index.html` → chỉ còn dòng Material Symbols
- Dấu tiếng Việt render đúng ở 12px và 48px, có ảnh chụp làm bằng
- `grep -rl "lucide-react" src/components/home src/features/content` → 0
- `.reveal` hoạt động, và biến mất hoàn toàn khi bật "giảm chuyển động" trong OS
- Dán URL vào công cụ xem trước OG → hiện ảnh, không phải ô trống

## Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Font mới lỗi dấu tiếng Việt ở cỡ nhỏ | **Cao** | Bước 2 là cổng chặn: không đạt thì giữ Inter, ghi lý do |
| Đổi font làm vỡ chiều cao dòng/bố cục rải rác | Trung bình | Đổi ở `@theme` một chỗ; chụp 3 trang trước/sau |
| Thay icon làm mất/lệch glyph | Trung bình | Đối chiếu từng tên icon; Material Symbols đặt tên khác lucide |

## Bảo mật

Không có bề mặt tấn công mới. Lưu ý self-host font **giảm** rò rỉ IP người dùng
sang Google — là cải thiện quyền riêng tư, nên ghi vào changelog.

## Bước kế tiếp

Xong Phase 0 → Phase 1, 2, 3 chạy song song.
