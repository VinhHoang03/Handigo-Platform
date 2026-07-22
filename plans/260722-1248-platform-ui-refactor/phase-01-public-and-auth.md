# Phase 1 — Trang công khai + Auth

**Ưu tiên:** Cao · **Trạng thái:** ◐ Landing đã xong · **Phụ thuộc:** Phase 0

Nhóm trang người chưa đăng nhập nhìn thấy. Ảnh hưởng trực tiếp tới ấn tượng đầu
và tỉ lệ đăng ký.

## Liên kết

- [plan.md](plan.md) · [Phase 0](phase-00-shared-foundation.md)
- Landing đã xong: commit `87cd616`

## Kết quả khảo sát

| Chỉ số | Giá trị |
|---|---|
| File > 200 dòng | 5 (`auth` 2, `content` 3) |
| `bg-white`/`text-white` | 17 lần (`content`), 0 (`auth`) |
| `"Đang tải"` text thô | 1 |
| Ảnh Stitch `aida-public` | **12 lần — chỉ còn ở `AboutPage.tsx`** |

`auth` là nhóm sạch nhất toàn dự án: 0 hardcode màu, 0 `ui-avatars`, 0 `"Đang tải"`.
Chỉ cần tách file và soát a11y.

## File liên quan

| File | Dòng | Việc chính |
|---|---|---|
| `features/content/pages/SupportPage.tsx` | **632** | Tách; nhiều `bg-white` |
| `features/auth/pages/RegisterPage.tsx` | 270 | Tách; soát lỗi form |
| `features/auth/pages/ForgotPasswordPage.tsx` | 228 | Tách |
| `features/content/pages/AboutPage.tsx` | 215 | **Gỡ 12 ảnh Stitch** |
| `features/content/pages/NewsDetailPage.tsx` | 204 | Tách nhẹ |
| `features/content/pages/NewsPage.tsx` | 188 | Skeleton cho danh sách |
| `features/auth/pages/LoginPage.tsx` | 57 | Chỉ soát a11y |
| `components/auth/AuthLayout.tsx` | — | Dùng `glass-panel` (1 chỗ duy nhất trong app) |
| `pages/NotFoundPage.tsx` | — | Kiểm tra có thân thiện chưa |

## Các bước

1. **`AboutPage.tsx` — ưu tiên số 1.** 12 ảnh trỏ tới
   `lh3.googleusercontent.com/aida-public/...` — ảnh Google Stitch sinh tạm, không
   sở hữu, có thể chết bất cứ lúc nào. Đây là **rủi ro vỡ trang thật**, không phải
   vấn đề thẩm mỹ. Thay bằng asset tự host hoặc bố cục không cần ảnh.
   ⚠️ Sinh ảnh AI đang **không khả dụng**: key Gemini của dự án ở free tier,
   Google đặt quota = 0 cho mọi model ảnh. Cần key có billing hoặc ảnh chụp thật.
2. **`SupportPage.tsx` (632 dòng)** — tách theo khối chức năng (FAQ, form liên hệ,
   danh sách ticket). Đổi `bg-white` → `bg-surface-container-lowest`.
3. **`AuthLayout.tsx`** — quyết định giữ hay bỏ `glass-panel`. Là chỗ duy nhất
   trong app dùng class này; nếu bỏ thì xoá luôn khỏi `index.css`.
4. **`NewsPage`** — thay trạng thái tải bằng skeleton dạng danh sách bài viết.
5. **Form auth** — kiểm tra đủ: lỗi inline (không dùng `alert`), trạng thái đang
   gửi, `autocomplete` đúng chuẩn (`email`, `current-password`, `new-password`).
6. **`NotFoundPage`** — đảm bảo có đường quay lại, không phải ngõ cụt.

## Todo

- [ ] Gỡ 12 ảnh Stitch khỏi `AboutPage.tsx`
- [ ] Tách `SupportPage.tsx` (632 → nhiều file < 200)
- [ ] Tách `RegisterPage.tsx`, `ForgotPasswordPage.tsx`
- [ ] Skeleton cho `NewsPage`, `NewsDetailPage`
- [ ] Quyết định số phận `glass-panel` trong `AuthLayout`
- [ ] Soát `autocomplete` + lỗi inline cho 3 trang auth
- [ ] Kiểm tra `NotFoundPage` có lối thoát
- [ ] `bg-white` → token (17 chỗ trong `content`)
- [ ] Build xanh + ESLint 0 lỗi

## Tiêu chí hoàn thành

- `grep -r "aida-public" src/` → **0 kết quả** (toàn dự án)
- Không còn file > 200 dòng trong `features/auth` và `features/content`
- Mọi form auth báo lỗi inline, không dùng `alert()`
- Điều hướng được toàn bộ luồng đăng ký bằng bàn phím

## Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Chưa có ảnh thay thế cho `AboutPage` | **Cao** | Chốt nguồn ảnh trước khi bắt đầu; hoặc thiết kế lại bố cục không cần ảnh |
| Tách form auth làm hỏng luồng OAuth Google/Facebook | Trung bình | Test tay cả 3 luồng: email, Google, Facebook |

## Bảo mật

- Không log token/mật khẩu khi refactor xử lý lỗi form
- Giữ nguyên `autocomplete="new-password"` ở đăng ký để trình duyệt không điền nhầm
- Không đưa `VITE_GOOGLE_CLIENT_ID` / `VITE_FACEBOOK_APP_ID` vào chỗ hiển thị

## Bước kế tiếp

Độc lập với Phase 2–4, chạy song song được.
