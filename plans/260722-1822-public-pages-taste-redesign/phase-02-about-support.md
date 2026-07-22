# Phase 2 — Giới thiệu + Hỗ trợ

**Ưu tiên:** Cao · **Trạng thái:** ☐ Chưa bắt đầu · **Phụ thuộc:** Phase 0

Hai trang xây niềm tin. Trang Giới thiệu đang chứa **lỗi tin cậy nặng nhất toàn
dự án**; trang Hỗ trợ có một ô tìm kiếm không tìm được gì.

## Liên kết

- [plan.md](plan.md) · [Phase 0](phase-00-visual-foundation.md)

## Kết quả audit

### Giới thiệu (`/gioi-thieu`)

| Vấn đề | Mức |
|---|---|
| Đội ngũ lãnh đạo **"Nguyễn Văn A / Trần Thị B / Lê Văn C"** với avatar chữ cái | **Nghiêm trọng** — tương đương "John Doe" bản tiếng Việt, đăng công khai như ban lãnh đạo thật |
| Số liệu **mâu thuẫn trực tiếp với trang chủ**: ở đây "50.000+ khách hàng", trang chủ "10.000+ khách hàng" | **Nghiêm trọng** |
| Số liệu tự mâu thuẫn với dòng thời gian ngay bên dưới: khởi tạo 5/2026, tức ~2 tháng tuổi, nhưng tuyên bố 50.000+ khách hàng và 5.000+ đối tác | **Nghiêm trọng** |
| Dấu `—` trong đoạn văn (`AboutPage.tsx:44`) | Cao |
| **0 ảnh** trên toàn trang (di sản của việc gỡ 12 ảnh Stitch mà chưa thay) | Cao |
| Mọi section đều căn giữa; 4 thẻ giá trị cốt lõi đều nhau | Trung bình |

### Hỗ trợ (`/ho-tro`)

| Vấn đề | Mức |
|---|---|
| Ô tìm kiếm "Tìm kiếm câu hỏi thường gặp..." nhưng **trang không có FAQ nào** để tìm | **Cao** — chức năng giả |
| Số điện thoại + email lặp lại 2 lần trên cùng một màn hình | Trung bình |
| Dấu `—` trong `PublicSupportCta.tsx:25` | Cao |
| 4 thẻ danh mục đều nhau, cùng khuôn với trang chủ và Giới thiệu | Trung bình |

## Yêu cầu

**Chức năng**
- Không đổi URL, không đổi tên nav
- Trang Hỗ trợ: mọi thứ hiển thị được phải bấm được và dẫn tới nội dung thật
- Không tuyên bố số liệu chưa xác thực

**Phi chức năng**
- File < 200 dòng, build xanh, ESLint 0 lỗi

## Kiến trúc

```
features/content/pages/AboutPage.tsx        bố cục mới, bỏ đội ngũ giả
features/content/components/
  ├── AboutHero.tsx          MỚI: hero bất đối xứng + ảnh
  ├── AboutValues.tsx        MỚI: giá trị cốt lõi (thay 4 thẻ đều nhau)
  ├── AboutTimeline.tsx      MỚI: dòng thời gian tách ra
  └── SupportFaq.tsx         MỚI: FAQ accordion + tìm kiếm thật
features/content/data/
  └── support-faq.ts         MỚI: nội dung FAQ (nguồn cho ô tìm kiếm)
```

## Các bước — Giới thiệu

1. **Gỡ section "Đội ngũ lãnh đạo".** Không thay bằng người thật trừ khi bạn cung
   cấp tên + chức danh + ảnh thật. Một công ty 2 tháng tuổi không cần trang ban
   lãnh đạo; **không có** tốt hơn **có mà giả**.
2. **Gỡ dải số liệu** (50.000+ / 5.000+ / 100+). Thay bằng khối cam kết định tính
   dùng chung ngôn ngữ với `TrustStrip` ở Phase 1 (giữ nhất quán 2 trang).
   Ngoại lệ được phép giữ: **số danh mục dịch vụ thật**, đếm từ API.
3. **Bổ sung ảnh** từ bộ minh hoạ dịch vụ: 1 ảnh cho hero, 1–2 ảnh chen giữa các
   khối chữ để trang không còn là một bức tường văn bản.
4. **Phá thế căn giữa**: hero chuyển sang bất đối xứng, phần "Chúng tôi là ai"
   dùng cột lệch, giá trị cốt lõi bỏ khuôn 4 thẻ đều nhau.
5. **Sửa `—`** ở dòng 44.
6. **Giữ dòng thời gian** — sau khi bỏ số liệu thổi phồng thì mốc 5/2026–7/2026
   trở nên trung thực và hợp lý, không cần giấu.

## Các bước — Hỗ trợ

7. **Quyết định số phận ô tìm kiếm.** Hai lựa chọn, chọn một:
   - **(Khuyến nghị)** Viết nội dung FAQ thật vào `support-faq.ts` (8–12 câu theo
     4 nhóm sẵn có: Tài khoản / Thanh toán / Dịch vụ / Lỗi kỹ thuật), dựng
     `SupportFaq.tsx` dạng accordion, ô tìm kiếm lọc trên chính nội dung đó.
     Trang có thực chất, và 4 thẻ danh mục có nơi để trỏ tới.
   - Hoặc **gỡ hẳn ô tìm kiếm**, để 4 thẻ danh mục làm lối vào duy nhất.
   Không chấp nhận giữ nguyên hiện trạng: ô tìm kiếm không tìm được gì là chức
   năng giả, đúng loại lỗi mà đợt refactor trước đã gỡ ở form gửi hỗ trợ.
8. **Gỡ khối liên hệ trùng** — giữ một chỗ duy nhất (khuyến nghị: cột "Kênh hỗ trợ").
9. **Sửa `—`** ở `PublicSupportCta.tsx:25`.
10. **Đa dạng hoá bố cục** để không lặp lại khuôn 4 thẻ của trang chủ.
11. Build + lint + chụp ảnh đối chiếu.

## Todo

- [ ] Gỡ section đội ngũ lãnh đạo giả khỏi `AboutPage`
- [ ] Gỡ dải số liệu chưa xác thực, thay bằng cam kết định tính
- [ ] Bổ sung 2–3 ảnh thật vào trang Giới thiệu
- [ ] Phá thế căn giữa toàn trang, đổi khuôn 4 thẻ giá trị
- [ ] Sửa `—` ở `AboutPage.tsx:44` và `PublicSupportCta.tsx:25`
- [ ] Viết `support-faq.ts` + dựng `SupportFaq.tsx` (hoặc gỡ ô tìm kiếm)
- [ ] Gỡ khối liên hệ lặp trên trang Hỗ trợ
- [ ] Build xanh + ESLint 0 lỗi + ảnh đối chiếu

## Tiêu chí hoàn thành

- `grep -rn "Nguyễn Văn A\|Trần Thị B\|Lê Văn C" src/` → 0
- Không còn con số nào trên trang Giới thiệu mà không truy được về dữ liệu thật
- Số liệu (nếu còn) **khớp nhau** giữa trang chủ và Giới thiệu
- Ô tìm kiếm trên trang Hỗ trợ trả về kết quả thật, hoặc đã bị gỡ
- Trang Giới thiệu có ≥2 ảnh thật
- 4 thẻ danh mục hỗ trợ đều bấm được và tới nội dung có thật

## Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Gỡ đội ngũ + số liệu làm trang Giới thiệu trống trải | Trung bình | Bù bằng ảnh, khối cam kết, và dòng thời gian trung thực |
| Viết FAQ tốn thời gian ngoài phạm vi "refactor UI" | Trung bình | Chấp nhận: đây là hệ quả tất yếu của việc gỡ chức năng giả. Nếu không có thời gian thì chọn phương án gỡ ô tìm kiếm |

## Bảo mật

- Không đăng tên/ảnh người thật khi chưa có sự đồng ý
- Nội dung FAQ không được lộ chi tiết vận hành nội bộ (quy tắc chống gian lận,
  ngưỡng duyệt rút tiền, logic phân công thợ)

## Bước kế tiếp

Độc lập với Phase 1, 3.
