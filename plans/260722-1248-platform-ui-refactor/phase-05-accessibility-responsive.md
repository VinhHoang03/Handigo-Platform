# Phase 5 — Kiểm tra a11y + responsive toàn bộ

**Ưu tiên:** Trung bình · **Trạng thái:** ✅ Xong phần tự động hoá được (xem ghi chú cuối file) · **Phụ thuộc:** Phase 1–4

> **Kết quả vòng kiểm chứng sau đăng nhập (2026-07-22 tối):** tạo 3 tài khoản
> test đánh dấu rõ trong DB dev (đã xoá sạch sau khi test — users/providers/
> wallets/sessions đều 0 sót). Quét bằng Playwright cả 3 vai trò:
> **customer** (bookings, wallet, profile, bookings/new, support),
> **provider** (home, orders, profile, bank-accounts, feedbacks, service-suggestions),
> **admin** (dashboard, services, system-configs, promotions, withdrawals,
> support, users, news, revenue). Tất cả: **0 lỗi console** (ngoài 401
> refresh-token dự kiến), **0 tràn ngang**, bảng admin có dữ liệu thật render
> đúng, InitialsAvatar hiển thị đúng ở navbar/hồ sơ.
> Quét cơ học: class chết đã sửa (`accent-cyan`), `.glass-card` mồ côi đã xoá,
> handler giả = 0, `prefers-reduced-motion` bổ sung cho animation trang trí,
> tràn ngang 360px = 0 trên các trang public.
> **Chưa làm (cần môi trường/người thật):** test tay luồng tiền PayOS sandbox
> (đặt đơn → thanh toán → hoàn tiền, duyệt rút tiền) — khuyến nghị bấm tay
> trước khi merge; chạy axe-core có hệ thống; đo tương phản từng cặp token.

Rà soát cuối cùng sau khi 50 trang đã refactor xong. Đây là phase **kiểm chứng**,
không phải phase thiết kế lại.

## Liên kết

- [plan.md](plan.md) · Phase [1](phase-01-public-and-auth.md) [2](phase-02-customer.md) [3](phase-03-provider.md) [4](phase-04-admin.md)

## Hiện trạng

| Chỉ số | Giá trị | Đánh giá |
|---|---|---|
| `aria-label` | 112 lần | Có nền tảng, cần rà chất lượng |
| `alt=` | 75 lần | Cần kiểm tra alt rỗng/vô nghĩa |
| `window.alert()` | **0** | ✓ Tốt |
| `prefers-reduced-motion` | 2 chỗ | Chỉ marquee + carousel |

Điểm mạnh: không dùng `alert()` ở đâu cả. Điểm cần rà: `alt` và `aria-label` có
thực sự mô tả đúng nội dung không, hay chỉ là chuỗi cho có.

## Yêu cầu

**Bàn phím**
- Mọi luồng chính đi được bằng Tab/Enter/Escape: đăng ký → đặt đơn → thanh toán
- Focus ring nhìn thấy được ở mọi phần tử tương tác
- Modal: bẫy focus khi mở, trả focus về nút kích hoạt khi đóng
- Skip-link (thêm ở Phase 0) hoạt động

**Ảnh & icon**
- `alt` mô tả nội dung; ảnh trang trí dùng `alt=""`
- Icon-only button phải có `aria-label`

**Màu & tương phản**
- Chữ thường ≥ 4.5:1, chữ lớn ≥ 3:1 so với nền
- Không truyền đạt thông tin **chỉ** bằng màu (trạng thái đơn phải có chữ hoặc icon)

**Responsive** — kiểm tra ở 360 / 768 / 1024 / 1440 px
- Không có tràn ngang ở bất kỳ trang nào
- Bảng admin cuộn ngang trong khung riêng, không đẩy cả trang
- Vùng chạm ≥ 44×44 px trên di động

**Chuyển động**
- Tôn trọng `prefers-reduced-motion` cho mọi animation, không chỉ 2 chỗ hiện tại

## Các bước

1. **Lập ma trận kiểm tra** 50 trang × 4 breakpoint. Ghi kết quả vào
   `plans/260722-1248-platform-ui-refactor/reports/`.
2. **Chạy tự động trước:** `npx @axe-core/cli` hoặc Lighthouse a11y cho các trang
   công khai. Lọc bớt lỗi máy phát hiện được trước khi soát tay.
3. **Soát tay bàn phím** 4 luồng chính (đăng ký, đặt đơn, thợ nhận việc, admin duyệt).
4. **Đo tương phản** các cặp token đang dùng thật. Chú ý:
   - `text-on-surface-variant` (#464555) trên `surface-container-low`
   - `text-on-primary/75` trên `primary` ở dải số liệu
   - `primary/6`, `primary/8` làm nền — kiểm tra chữ trên nền này
5. **Rà `prefers-reduced-motion`** — bổ sung cho mọi `animate-*` còn lại.
6. **Kiểm tra tràn ngang** ở 360px cho toàn bộ 50 trang.
7. **Quét class không tồn tại** (bài học `shadow-soft`/`success-green` ở Phase 0):
   mọi class trong `.tsx` không khớp token nào trong `index.css` cũng không phải
   utility Tailwind hợp lệ → phần tử render không màu mà không ai báo lỗi.
8. **Quét chức năng giả** (bài học form hỗ trợ ở Phase 1): mọi `onSubmit` /
   handler nút hành động không có lời gọi mạng nào nhưng vẫn báo thành công.

## Todo

- [ ] Lập ma trận 50 trang × 4 breakpoint
- [ ] Chạy axe/Lighthouse cho trang công khai
- [ ] Soát bàn phím 4 luồng chính
- [ ] Kiểm tra bẫy focus ở mọi `Modal`
- [ ] Đo tương phản các cặp token thực dùng
- [ ] Rà toàn bộ `alt` và `aria-label` cho đúng nghĩa
- [ ] Bổ sung `prefers-reduced-motion` cho animation còn lại
- [ ] Kiểm tra tràn ngang ở 360px
- [ ] Vùng chạm ≥ 44px trên di động
- [ ] Quét class không tồn tại (toàn `src/`)
- [ ] Quét `onSubmit`/handler không gọi mạng nhưng báo thành công
- [ ] Viết báo cáo tổng kết

## Tiêu chí hoàn thành

- 0 lỗi a11y mức critical/serious từ axe trên các trang công khai
- 4 luồng chính đi được hoàn toàn bằng bàn phím
- 0 trang tràn ngang ở 360px
- Mọi cặp màu chữ/nền đạt tối thiểu AA
- Báo cáo lưu tại `plans/260722-1248-platform-ui-refactor/reports/`

## Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Sửa tương phản làm lệch bảng màu thương hiệu | Trung bình | Ưu tiên chỉnh token `on-*` thay vì đổi màu nền chính |
| Phát hiện lỗi a11y cấu trúc phải sửa lại nhiều trang | Trung bình | Rà sớm vài trang mẫu ngay từ Phase 1 thay vì để dồn tới đây |

## Bảo mật

- Kiểm tra `aria-label` / `alt` không vô tình rò dữ liệu nhạy cảm (số tài khoản,
  số điện thoại đầy đủ, mã đơn nội bộ)
- Thông báo lỗi cho trình đọc màn hình không được tiết lộ chi tiết hệ thống

## Bước kế tiếp

Xong phase này → đóng plan.

`docs/` đã chốt là **không đưa vào git**. Vì vậy báo cáo tổng kết a11y lưu tại
`plans/260722-1248-platform-ui-refactor/reports/` (có trong repo) chứ không phải
`docs/`, để đội còn đọc được.
