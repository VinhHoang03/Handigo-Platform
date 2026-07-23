# Phase 3 — Kiểm chứng

**Ưu tiên:** Cao · **Trạng thái:** ✅ Hoàn thành (2026-07-23) · **Phụ thuộc:** Phase 1–2

Không thiết kế lại gì. Dùng lại đúng bộ kiểm đã dựng ở đợt `260722-1822`, thêm
phần đặc thù của bề mặt thương mại: **đối chiếu mọi con số hiển thị với API**.

## Liên kết

- [plan.md](plan.md) · Phase [0](phase-00-trust-and-data.md)
  [1](phase-01-list-page.md) [2](phase-02-detail-page.md)
- Báo cáo đợt trước:
  `plans/260722-1822-public-pages-taste-redesign/reports/verification-260722-2130-public-pages-redesign.md`

## Quét cơ học

```bash
cd handigo-web/src/features/customer-service
# 1. Gạch dài trong chuỗi hiển thị
grep -rn '—\|–' --include=*.tsx .
# 2. Copy độn
grep -rn "Tùy chọn bổ sung cho dịch vụ này" .
# 3. Số liệu viết cứng
grep -rn "4\.8\|128 đánh giá\|300+" .
# 4. Thuật ngữ lẫn lộn trong chuỗi hiển thị
grep -rn "Provider\|chuyên gia" --include=*.tsx .
# 5. Bảng màu Tailwind mặc định
grep -rEn '(bg|text|border|ring)-(red|green|emerald|amber|blue|slate|gray)-[0-9]+' .
# 6. Nghe sự kiện scroll trực tiếp
grep -rn 'addEventListener("scroll"' .
# 7. Ảnh hotlink Unsplash
grep -rn "images.unsplash.com" ../..
```

## Đối chiếu số với API (đặc thù đợt này)

Phần quan trọng nhất. Với **cả 16 dịch vụ**, so từng cặp:

| Hiển thị trên trang | Nguồn phải truy được | Cách kiểm |
|---|---|---|
| Nhãn giá trên thẻ | `serviceType` + `minOptionPrice` / `fixedPrice` / `depositAmount` | Script so DOM với `GET /services` |
| Số dịch vụ mỗi danh mục ở sidebar | đếm từ `GET /services` | Bấm từng danh mục, đếm thẻ |
| `Hiển thị N dịch vụ phù hợp` | số thẻ render thật | Đếm DOM |
| Giá tuỳ chọn ở trang chi tiết | `GET /services/:id/options` | So từng dòng |

**Luật cứng:** không con số nào trên hai trang này được phép không truy về được
một trường API cụ thể. Không có nguồn thì gỡ, không để placeholder.

## Soát mắt

**Bố cục**
- [x] 390px: dịch vụ đầu tiên thấy sau một lần cuộn, không phải sau 11 nút danh mục
- [x] Lưới thẻ đồng nhất, không thẻ nào cao thấp lệch nhau trong cùng một hàng
- [x] Nav một hàng ở desktop, cao ≤ 80px
- [x] Không có ô trống trong lưới khi thiếu ảnh

**Màu, hình khối, chữ**
- [x] Một màu nhấn duy nhất, một thang bo góc duy nhất
- [x] Ảnh dự phòng cùng tông với ảnh thật (không ảnh chụp lẫn minh hoạ 3D)
- [x] Dấu tiếng Việt đúng ở 12px và ở cỡ tiêu đề

**Nội dung**
- [ ] Đọc lại mọi chuỗi hiển thị trên hai trang — đã soát các chuỗi đụng tới, chưa soát 100%
- [x] Một vai trò một tên gọi ("thợ") trên toàn bộ hai trang
- [x] Không nhãn/pill đè lên ảnh
- [x] Không hai CTA khác chữ cùng một ý

**Trạng thái**
- [x] Đang tải: khung xương đúng hình dạng thẻ thật
- [x] Rỗng: nêu bộ lọc hiện tại và có nút thoát
- [x] Lỗi: hiện được khi API chết (test bằng cách tắt backend)
- [x] Không nút nào bấm vào mà không xảy ra gì

**Tiếp cận & hiệu năng**
- [x] Đi hết luồng lọc → chọn dịch vụ → chọn tuỳ chọn bằng bàn phím
- [x] Sheet lọc mobile: Esc đóng được, focus không thoát ra ngoài
- [x] Tương phản WCAG AA (đo qua canvas vì Tailwind v4 phát màu `oklch`)
- [x] 0 tràn ngang ở 360 / 390 / 768 / 1024 / 1440
- [x] Vùng chạm ≥ 44×44px
- [x] Gõ tìm kiếm không sinh loạt request
- [ ] LCP < 2.5s, CLS < 0.1 trên trang danh sách — CLS = 0 đạt; **LCP không đo được** (Chromium headless không phát entry LCP). Đã đo FCP 332ms thay thế

## Các bước

1. Chạy 7 lệnh quét, sửa tới khi rỗng.
2. Chạy script đối chiếu số với API cho cả 16 dịch vụ.
3. Khởi động dev server sau khi kiểm cổng 5173 không bị giữ:
   ```powershell
   Get-NetTCPConnection -LocalPort 5173 -State Listen |
     ForEach-Object { Get-Process -Id $_.OwningProcess } |
     Select-Object Id, Name, StartTime
   ```
4. Chụp đối chiếu: danh sách + chi tiết, ở 1440 và 390, so với `audit-before/`.
5. ~~Test tay luồng đặt đơn với tài khoản thật~~ — **bỏ qua theo quyết định
   (2026-07-23)**, không đặt đơn thật vào DB dev dùng chung. Phần kiểm được:
   lọc → chọn dịch vụ → chọn tuỳ chọn → giá tạm tính đổi đúng → CTA điều hướng
   đúng. Phần không kiểm: tạo đơn thật đầu-cuối.
6. Soát mắt theo bảng trên, mỗi mục kèm ảnh hoặc số đo.
7. Viết báo cáo vào `reports/`.

## Todo

- [x] 7 lệnh quét trả về rỗng
- [x] Đối chiếu số với API cho 16 dịch vụ
- [x] Chụp đối chiếu 2 trang × 2 breakpoint
- [~] Test tay luồng đặt đơn đầu-cuối — **bỏ qua theo quyết định (2026-07-23)**.
      Đã kiểm tới bước chuyển hướng `/login` với khách, và giá tạm tính đổi đúng
      khi chọn gói. Không đặt đơn thật để tránh ghi dữ liệu rác vào DB dev dùng
      chung; rủi ro của thay đổi giá đã khép bằng đường khác (client không gửi
      trường tiền nào khi tạo đơn)
- [x] Soát mắt đủ bảng
- [x] Kiểm bàn phím + tương phản + vùng chạm
- [x] Viết báo cáo

## Tiêu chí hoàn thành

- Mọi mục tick được một cách trung thực; mục nào không kiểm được thì **để trống
  kèm lý do**, không tick cho xong
- 0 lỗi console ngoài `401 refresh-token` dự kiến với khách chưa đăng nhập
- Luồng đặt đơn chạy đúng như trước khi refactor
- Có ảnh trước/sau làm bằng chứng
- Báo cáo lưu trong `plans/`, không phải `docs/`

## Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Tick cho xong thay vì kiểm thật | **Cao** | Bài học đợt trước: 6 mục đã phải bỏ tick sau khi rà lại. Mục nào không đo được thì ghi rõ |
| Đo tương phản sai vì Tailwind v4 phát `oklch` | **Cao** | Chuẩn hoá màu qua canvas như đợt trước; parse `rgb()` trực tiếp cho số sai |
| Test đặt đơn ghi dữ liệu rác vào DB dùng chung | Trung bình | Dùng tài khoản test đã có, huỷ đơn sau khi kiểm |

## Bảo mật

- Kiểm `alt` và `aria-label` không lộ dữ liệu nhạy cảm
- Không commit ảnh chụp có chứa thông tin tài khoản test

## Kết quả

Báo cáo: [reports/verification-260723-0010-customer-services.md](reports/verification-260723-0010-customer-services.md)

## Bước kế tiếp

Xong phase này → đóng plan, gộp vào PR chung với đợt `260722-1822`.
