# Phase 0 — Nền tảng dùng chung

**Ưu tiên:** Cao nhất · **Trạng thái:** ☐ Chưa bắt đầu · **Chặn:** Phase 1–4

Chuẩn hoá lớp dung chứa trước khi chạm vào từng trang. Không làm phase này trước
thì mỗi trang sẽ tự phát minh quy ước riêng và phải sửa lại lần hai.

## Liên kết

- [plan.md](plan.md)
- Tham chiếu thực tế đã làm: commit `87cd616` (landing page)

## Kết quả khảo sát quan trọng

1. **`tailwind.config.js` đã bị xoá** — Tailwind v4 chỉ đọc `@theme` trong
   `src/index.css`. Mọi token mới phải khai ở đây.
2. **`AsyncState` đã tồn tại và đang dùng ở 23 file**, nhưng trạng thái loading
   của nó vẫn là dòng chữ `"Đang tải dữ liệu..."`. Nâng cấp component này ăn
   ngay cho 23 file — hiệu quả cao nhất trong toàn bộ plan.
3. **`ReliableImage` đã tồn tại (12 file)** và đã dùng `normalizeImageUrl`.
   `InitialsAvatar` mới tạo cho landing bổ sung phần chữ cái đầu.
4. **Bẫy DRY đã gặp:** vòng landing từng tạo `utils/normalizeImageSrc.ts` trùng
   với `utils/imageUrl.ts` có sẵn. Đã gộp. **Luôn `grep` trước khi tạo util.**
5. **`index.css` có quy tắc base áp cho MỌI nút:**
   ```css
   button:not(:disabled) { @apply cursor-pointer hover:-translate-y-0.5 active:translate-y-0; }
   ```
   Nghĩa là mọi nút trong app đều nhấc lên khi rê chuột, kể cả nút trong bảng,
   dropdown, tab. Đây là nguồn gốc của cảm giác "UI nhấp nhổm". Cần thu hẹp
   phạm vi quy tắc này.

## Yêu cầu

**Chức năng**
- Không thay đổi hành vi bất kỳ trang nào
- `AsyncState` hỗ trợ truyền skeleton tuỳ biến, vẫn tương thích ngược với 23 file đang dùng

**Phi chức năng**
- Build xanh, ESLint 0 lỗi
- Không tăng kích thước bundle đáng kể

## Kiến trúc

```
src/index.css              @theme = nguồn token DUY NHẤT
  ├── màu M3 + primary-hover/pressed
  ├── thang chữ, spacing, radius
  └── @layer base — thu hẹp quy tắc nút

src/components/common/     lớp dùng chung
  ├── AsyncState.tsx       ← nâng cấp: nhận skeleton
  ├── Skeleton.tsx         ← MỚI: primitive dùng chung
  ├── InitialsAvatar.tsx   ← đã có
  ├── ReliableImage.tsx    ← đã có
  └── ...

src/utils/imageUrl.ts      normalizeImageUrl (đã lọc 'null'/'undefined')
```

## File liên quan

**Sửa**
- `src/index.css` — thu hẹp quy tắc nút, rà token thiếu
- `src/components/common/AsyncState.tsx` — thêm prop `skeleton`
- `src/components/home/HomeSkeletons.tsx` — chuyển primitive lên `common/Skeleton.tsx`

**Tạo**
- `src/components/common/Skeleton.tsx` — `<Skeleton />`, `<SkeletonText />`, `<SkeletonCard />`

**Không đụng tới**
- `glass-card` / `glass-panel` trong `@layer components` — còn 16 file dùng, gỡ ở phase sau

## Các bước

1. **Rà token thiếu.** `grep -ro '#[0-9a-fA-F]\{6\}' --include=*.tsx src/` → 29 chỗ / 4 file.
   Xác định màu nào cần thành token, màu nào là giá trị dùng một lần hợp lệ (ví dụ
   shadow tint) thì giữ nguyên.
2. **Thu hẹp quy tắc nút.** Bỏ `hover:-translate-y-0.5` khỏi selector `button` toàn cục;
   chuyển vào các class `.btn-primary` / `.btn-secondary` để chỉ nút hành động chính mới nhấc.
   ⚠️ Ảnh hưởng rộng — chụp ảnh vài trang trước/sau để đối chiếu.
3. **Tạo `common/Skeleton.tsx`** với 3 primitive, dời phần dùng chung từ `HomeSkeletons.tsx` sang.
4. **Nâng cấp `AsyncState`:** thêm prop `skeleton?: ReactNode`. Khi có thì render
   skeleton, không có thì giữ nguyên hành vi cũ (tương thích ngược 23 file).
5. **Bổ sung `sr-only` skip-link** vào `App.tsx` cho điều hướng bàn phím.
6. Build + lint + chụp ảnh đối chiếu.

## Phát hiện bổ sung khi thực hiện (2026-07-22)

**Hệ màu ngầm thứ hai: 281 lần dùng bảng màu mặc định Tailwind trên 38 file**
(`emerald` 111 · `amber` 71 · `red` 58 · còn lại ~41). Nhiều hơn cả `bg-white` (162).

Nguyên nhân gốc: **M3 chỉ định nghĩa `error`, không có `success`/`warning`**, nên
mọi trạng thái tích cực/chờ xử lý đều phải mượn palette Tailwind. `StatusBadge` —
component nhãn trạng thái dùng chung — là ví dụ điển hình: toàn bộ bảng màu của nó
nằm ngoài hệ token.

→ Đã bổ sung 8 token (`success`/`warning` × 4 biến) theo đúng khuôn của `error`,
và chuyển `StatusBadge` sang dùng chúng. 281 chỗ còn lại chuyển dần ở Phase 1–4.

## Todo

- [x] Rà 29 mã hex, quyết định token hoá hay giữ
      → màu thương hiệu Google/Facebook (5) **giữ nguyên**, không được token hoá;
        SVG mascot chatbot (10) giữ; `OrderTrackingMap` (12) xử lý ở Phase 2
- [x] Bổ sung token `success` + `warning` (phát hiện mới, xem trên)
- [x] Chuyển `StatusBadge` sang token ngữ nghĩa
- [x] Thu hẹp quy tắc `button` toàn cục trong `@layer base`
- [x] Gỡ 9 override `hover:translate-y-0` đã thành thừa sau khi bỏ quy tắc trên
- [x] Tạo `common/Skeleton.tsx`
- [x] Thêm prop `skeleton` cho `AsyncState` (giữ tương thích ngược)
- [x] Dời primitive từ `HomeSkeletons.tsx` sang `common/`
- [x] Thêm skip-link vào `App.tsx` + `id="main-content"` cho 7 landmark
- [x] Build xanh + ESLint 0 lỗi
- [x] Kiểm tra mắt bằng Playwright (landing, skip-link, register)

## Bài học vận hành (ghi lại để khỏi mất thời gian lần sau)

Suốt phần lớn quá trình verify, trình duyệt hiển thị một overlay lỗi ESLint không
có thật. Tôi đã chẩn đoán nhầm là "công cụ chụp ảnh trả về ảnh đóng băng".

Nguyên nhân thật: **một tiến trình Vite cũ vẫn giữ cổng 5173.** Nó khởi động từ
đầu phiên làm việc và không chết khi bị stop, nên mọi lần "khởi động lại" chỉ tạo
tiến trình mới không bind được cổng — log "ESLint 0 lỗi" là của tiến trình mới,
còn trang phục vụ lại đến từ tiến trình cũ đang kẹt ở trạng thái giữa chừng.

Khi thấy giao diện không khớp với code trên đĩa, kiểm tra chủ sở hữu cổng trước
khi nghi ngờ bất cứ thứ gì khác:

```powershell
Get-NetTCPConnection -LocalPort 5173 -State Listen |
  ForEach-Object { Get-Process -Id $_.OwningProcess } |
  Select-Object Id, Name, StartTime
```

`StartTime` cũ hơn lần sửa code gần nhất là đủ để kết luận.

> **Dark mode: đã chốt KHÔNG làm.** Giữ `color-scheme: light`, chỉ một bảng token
> sáng. Vẫn phải thay `text-white`/`bg-white` bằng token `on-*`/`surface-*` —
> không phải để hỗ trợ theme tối, mà để màu nằm ở một nguồn duy nhất.

## Tiêu chí hoàn thành

- `AsyncState` render được skeleton, 23 file đang dùng không đổi hành vi
- Không còn nút phụ nào nhấc lên khi hover
- `npm run build` xanh, `npx eslint src/` 0 lỗi
- Ảnh trước/sau của ít nhất 3 trang thuộc 3 vai trò khác nhau

## Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Sửa quy tắc `button` toàn cục làm vỡ layout rải rác | **Cao** | ✅ Đã xác minh: CSS build cho ra đúng `button:not(:disabled){cursor:pointer}` (không còn `translate`), và kiểm tra mắt bằng Playwright trên landing + register — render đúng, không lỗi console ngoài 401 `refresh-token` dự kiến với khách chưa đăng nhập. |
| Đổi `AsyncState` làm hỏng 23 file | Trung bình | Prop mới optional, mặc định giữ nguyên hành vi cũ |
| Tạo util/component trùng với cái đã có | Trung bình | `grep` trong `src/utils` và `src/components/common` trước khi tạo |

## Bảo mật

Không có bề mặt tấn công mới — phase này chỉ đụng CSS và component trình bày.
Lưu ý duy nhất: `normalizeImageUrl` là nơi chặn `src` rác, đừng bỏ qua nó khi
render ảnh từ dữ liệu người dùng.

## Bước kế tiếp

Xong Phase 0 → Phase 1–4 chạy được song song.
