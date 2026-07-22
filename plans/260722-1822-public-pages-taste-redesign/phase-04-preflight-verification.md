# Phase 4 — Pre-flight + kiểm chứng

**Ưu tiên:** Cao · **Trạng thái:** ☐ Chưa bắt đầu · **Phụ thuộc:** Phase 1–3

Phase kiểm chứng, không thiết kế lại. Chạy bộ pre-flight của taste skill trên
toàn nhóm trang công khai, rồi kiểm tra bằng trình duyệt thật.

## Liên kết

- [plan.md](plan.md) · Phase [1](phase-01-landing-rebuild.md)
  [2](phase-02-about-support.md) [3](phase-03-news-services-auth.md)

## Bộ pre-flight — quét cơ học

Chạy được bằng lệnh, không cần mắt người. Mỗi dòng phải trả về 0.

```bash
cd handigo-web/src
# 1. Gạch dài trong chuỗi hiển thị (bỏ qua comment)
grep -rn '—\|–' --include=*.tsx components/home features/content components/auth pages

# 2. Tàn dư giao diện giả / nội dung bịa
grep -rn "HG-2847\|HeroPreviewCard\|Nguyễn Văn A\|Trần Thị B\|Lê Văn C" .

# 3. Copy độn lặp
grep -rn "Xem các dịch vụ phù hợp trong danh mục" .

# 4. Bảng màu Tailwind mặc định trong nhóm công khai
grep -rEn '(bg|text|border|ring)-(red|green|emerald|amber|blue|slate|gray)-[0-9]+' \
  components/home features/content

# 5. Cấm nghe sự kiện scroll trực tiếp
grep -rn 'addEventListener("scroll"\|addEventListener('"'"'scroll'"'"'' .

# 6. Hai hệ icon
grep -rl "lucide-react" components/home features/content components/auth
```

**Đếm eyebrow** (nhãn chữ hoa nhỏ trên tiêu đề section): số lượng phải
`≤ ceil(số section / 3)`. Trang chủ 8 section → tối đa 3.

## Bộ pre-flight — soát mắt

Từng mục lấy từ Section 14 của taste skill, giữ lại phần áp dụng được cho dự án:

**Bố cục**
- [ ] Hero vừa màn hình đầu ở 1440×900 và 390×844; CTA thấy được không cần cuộn
- [ ] Headline hero ≤ 2 dòng; subtext ≤ 20 từ
- [ ] Hero có tối đa 4 khối chữ; không có social-proof nhét trong hero
- [ ] Nav một hàng ở desktop, cao ≤ 80px
- [ ] 8 section trang chủ dùng ≥ 4 khuôn bố cục khác nhau
- [ ] Không 3 section liên tiếp cùng kiểu "ảnh + chữ chia đôi"
- [ ] Bento có đúng số ô bằng số nội dung, không ô trống

**Màu, hình khối, chữ**
- [ ] Một màu nhấn duy nhất xuyên suốt, không đổi tông giữa các section
- [ ] Một thang bo góc duy nhất
- [ ] Một chủ đề sáng/tối cho cả trang, không section nào đảo tông
- [ ] Dấu tiếng Việt hiển thị đúng ở 12px và ở cỡ headline

**Nội dung**
- [ ] Đọc lại **mọi chuỗi hiển thị**: không câu nào sai ngữ pháp, không câu nào
      nghe như máy viết cho có
- [ ] Không con số nào không truy được về dữ liệu thật
- [ ] Không hai CTA khác chữ cùng một ý trên một trang
- [ ] Trích dẫn đánh giá ≤ 3 dòng, có tên + vai trò
- [ ] Không nhãn/pill đè lên ảnh

**Ảnh**
- [ ] Trang chủ ≥ 4 ảnh thật; trang Giới thiệu ≥ 2 ảnh thật
- [ ] Không giao diện giả dựng bằng div ở bất kỳ đâu
- [ ] Mọi ảnh có `alt` mô tả đúng; ảnh trang trí `alt=""`

**Chuyển động**
- [ ] `MOTION_INTENSITY 5` có thật: section 3–8 trang chủ có reveal khi cuộn
- [ ] Mỗi animation trả lời được câu "nó truyền đạt điều gì"
- [ ] Bật "giảm chuyển động" trong OS → mọi reveal biến mất, nội dung hiện ngay
- [ ] Chỉ animate `transform` và `opacity`

**Tiếp cận & hiệu năng**
- [ ] Đi hết luồng đăng ký bằng bàn phím; focus ring thấy rõ
- [ ] Tương phản chữ/nền đạt WCAG AA; nút CTA đọc được trên nền của nó
- [ ] Nhãn CTA không xuống 2 dòng ở desktop
- [ ] 0 tràn ngang ở 360 / 768 / 1024 / 1440px
- [ ] Vùng chạm ≥ 44×44px trên di động
- [ ] Lighthouse: LCP < 2.5s, CLS < 0.1 trên trang chủ

## Các bước

1. Chạy 6 lệnh grep ở trên, sửa hết cho tới khi cả 6 trả về rỗng.
2. Đếm eyebrow bằng `grep -c "uppercase tracking"` theo từng trang.
3. Khởi động dev server **sau khi kiểm cổng 5173 không bị tiến trình cũ giữ**
   (bài học từ đợt trước):
   ```powershell
   Get-NetTCPConnection -LocalPort 5173 -State Listen |
     ForEach-Object { Get-Process -Id $_.OwningProcess } |
     Select-Object Id, Name, StartTime
   ```
4. Chụp full-page 8 trang công khai ở 1440px và 390px, đối chiếu với ảnh audit
   trước khi làm (`audit-*.jpeg` ở gốc repo).
5. Soát mắt theo bảng trên, ghi lỗi vào báo cáo.
6. Chạy Lighthouse cho `/`, `/gioi-thieu`, `/tin-tuc`.
7. Kiểm `prefers-reduced-motion` bằng cách bật trong OS hoặc devtools.
8. Viết báo cáo tổng kết vào `plans/260722-1822-public-pages-taste-redesign/reports/`.

## Todo

- [ ] 6 lệnh quét cơ học trả về rỗng
- [ ] Đếm eyebrow đạt ngưỡng
- [ ] Chụp đối chiếu 8 trang × 2 breakpoint
- [ ] Soát mắt đủ bảng pre-flight
- [ ] Lighthouse 3 trang chính
- [ ] Kiểm reduced-motion
- [ ] Soát bàn phím + tương phản
- [ ] Viết báo cáo tổng kết

## Tiêu chí hoàn thành

- Toàn bộ mục pre-flight tick được một cách trung thực
- 0 lỗi console (ngoài 401 `refresh-token` dự kiến với khách chưa đăng nhập)
- 0 tràn ngang ở cả 4 breakpoint
- Có ảnh trước/sau của cả 8 trang làm bằng chứng
- Báo cáo lưu trong `plans/`, không phải `docs/` (docs nằm ngoài git)

## Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Tick cho xong thay vì kiểm thật | **Cao** | Mỗi mục soát mắt phải kèm ảnh chụp hoặc số đo, không tick trần |
| Phát hiện lỗi cấu trúc muộn, phải sửa lại nhiều trang | Trung bình | Chạy quét cơ học ngay sau mỗi phase thay vì dồn tới đây |

## Bảo mật

- Kiểm `alt` và `aria-label` không vô tình lộ dữ liệu nhạy cảm (số điện thoại
  đầy đủ, mã đơn nội bộ, tên khách hàng chưa được phép công bố)

## Bước kế tiếp

Xong phase này → đóng plan, mở PR.
