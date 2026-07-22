---
title: Làm mới UI nhóm trang công khai Handigo (taste-driven)
status: planned
created: 2026-07-22
branch: feat/ui-refactor-landing
blockedBy: []
blocks: []
---

# Làm mới UI nhóm trang công khai Handigo

Dựng lại ngôn ngữ thị giác cho 8 trang người chưa đăng nhập nhìn thấy. Đợt
refactor trước (plan `260722-1248`) đã dọn sạch **nợ kỹ thuật** (token hoá màu,
tách file, skeleton). Đợt này xử lý **nợ thẩm mỹ và nợ tin cậy** — thứ mà build
xanh và ESLint 0 lỗi không phát hiện được.

## Design Read

> Trang landing + nội dung công khai của một **sàn kết nối dịch vụ gia đình cho
> người Việt**, đối tượng là chủ nhà cần thợ gấp. Ngôn ngữ **trust-first, thực
> dụng**, giữ hệ Material 3 sẵn có nhưng thay lớp trình bày bằng ảnh thương hiệu
> thật và bố cục bất đối xứng.

Ràng buộc ngầm: đây là **thương mại dựa trên niềm tin**. Người dùng sắp cho một
người lạ vào nhà mình. Mọi chi tiết bịa (số liệu, tên người, đơn hàng mẫu) đều
là rủi ro thật, không phải vấn đề trang trí. Ràng buộc này **cao hơn** mọi ưu
tiên thẩm mỹ và là lý do các dial dưới đây không đẩy lên mức "agency/Awwwards".

## Ba dial

| Dial | Hiện tại | Mục tiêu | Lý do |
|---|---|---|---|
| `DESIGN_VARIANCE` | ~3 | **7** | Chốt "làm mới mạnh". Trần 7 chứ không 9 vì trust-first commerce cần đọc được ngay, không đánh đố. |
| `MOTION_INTENSITY` | ~1 | **5** | Mức 4–7 theo skill là **CSS thuần** (transition + reveal). **Không thêm thư viện animation** — đúng YAGNI, không tăng bundle. |
| `VISUAL_DENSITY` | ~4 | **3** (marketing) / 4 (tiện ích) | Trang bán hàng cần thở; trang tra cứu dịch vụ giữ mật độ cũ. |

## Ba quyết định đã chốt (2026-07-22)

1. **Làm mới mạnh landing** — giữ brand (`#3525cd`), IA, URL, SEO; thay bố cục.
2. **Tái dùng bộ minh hoạ dịch vụ sẵn có** — 16 ảnh, phong cách thống nhất, có
   đồng phục Handigo, lấy qua API công khai đang dùng ở `/customer/services`.
3. **Thay nội dung chưa xác thực bằng nội dung định tính** — không tuyên bố con
   số khi chưa có dữ liệu thật.

## Các phase

| # | Phase | Trạng thái | Phụ thuộc |
|---|---|---|---|
| 0 | [Nền tảng thị giác](phase-00-visual-foundation.md) | ☐ | — |
| 1 | [Dựng lại landing](phase-01-landing-rebuild.md) | ☐ | Phase 0 |
| 2 | [Giới thiệu + Hỗ trợ](phase-02-about-support.md) | ☐ | Phase 0 |
| 3 | [Tin tức + Dịch vụ + Auth](phase-03-news-services-auth.md) | ☐ | Phase 0 |
| 4 | [Pre-flight + kiểm chứng](phase-04-preflight-verification.md) | ☐ | Phase 1–3 |

Phase 0 chặn tất cả. Phase 1–3 độc lập, chạy song song được (khác thư mục).

## Ba tầng vấn đề tìm được khi audit

**Tầng 1 — Nợ tin cậy (nghiêm trọng nhất, không phải vấn đề thẩm mỹ):**
đội ngũ lãnh đạo "Nguyễn Văn A / Trần Thị B / Lê Văn C"; số khách hàng mâu thuẫn
giữa landing (10.000+) và Giới thiệu (50.000+); tin tức đề 2023 trong khi công ty
khởi tạo 5/2026; đơn hàng mẫu `#HG-2847` với thợ "Vũ Hoàng · 4,9 · 218 đánh giá";
huy hiệu Google Play / App Store **không có link** cho một sản phẩm chỉ có web.

**Tầng 2 — Nợ thẩm mỹ:** landing và Giới thiệu **0 ảnh** trong khi dự án có sẵn
16 ảnh minh hoạ; 4 section liên tiếp cùng một khuôn "lưới thẻ trắng đều nhau";
copy độn `"Xem các dịch vụ phù hợp trong danh mục"` lặp 8 lần; thiếu hẳn section
"cách hoạt động" và CTA đóng trang.

**Tầng 3 — Nợ vệ sinh:** 4 dấu gạch dài `—` trong text hiển thị; font nạp qua
`<link>` Google; 2 hệ icon song song (Material Symbols 273 chỗ + lucide 50 file);
thiếu `og:image`; CTA trùng ý trên trang tin tức.

## Nguyên tắc xuyên suốt

1. **Không đụng logic dữ liệu.** Vẫn là refactor trình bày.
2. **Không đổi URL, IA, tên nav, tên field form** (Section 11.F của skill).
3. **Không bịa số liệu.** Thiếu dữ liệu thì đổi cách nói, không đổi con số.
4. Mỗi phase build xanh + ESLint 0 lỗi + chụp ảnh đối chiếu trước/sau.
5. File vẫn giữ dưới 200 dòng như chuẩn hiện hành.

## Quyết định kế thừa

- **Không làm dark mode** (chốt từ plan trước). Skill khuyến nghị dual-mode nhưng
  đây là quyết định sản phẩm đã có; token `on-*`/`surface-*` vẫn giữ để đổi ý
  được sau. Ghi nhận là sai lệch có chủ đích so với Section 6.C.
- Icon: hợp nhất về **Material Symbols** (khớp hệ M3 sẵn có). Gỡ lucide khỏi
  nhóm trang công khai ở đợt này; 50 file còn lại xử lý ở đợt sau.
