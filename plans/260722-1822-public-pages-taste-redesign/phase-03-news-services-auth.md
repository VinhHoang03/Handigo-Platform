# Phase 3 — Tin tức + Duyệt dịch vụ + Auth

**Ưu tiên:** Trung bình · **Trạng thái:** ✅ Hoàn thành (2026-07-22) · **Phụ thuộc:** Phase 0

Ba nhóm trang **đã ở trạng thái tốt nhất** trong nhóm công khai. Phase này là
chỉnh sửa có chọn lọc, không dựng lại. Nguyên tắc: đụng ít nhất có thể.

## Liên kết

- [plan.md](plan.md) · [Phase 0](phase-00-visual-foundation.md)

## Kết quả audit

### Tin tức (`/tin-tuc`) — trang mạnh nhất nhóm công khai

Đây là trang **duy nhất đã có ảnh thật chất lượng tốt**, phong cách nhất quán.
Dùng làm chuẩn tham chiếu cho các trang khác.

| Vấn đề | Mức |
|---|---|
| Thẻ nổi bật có **2 nút cùng ý**: "Đọc chi tiết" + "Xem bài viết" | Cao — skill xếp CTA trùng ý vào lỗi chặn |
| Bài viết đề ngày **2023** trong khi trang Giới thiệu nói công ty khởi tạo 5/2026 | Cao — mâu thuẫn nội dung |
| "Siêu deal tháng 10: Giảm 20%" — khuyến mãi đã hết hạn hiển thị như đang chạy | Trung bình |

### Duyệt dịch vụ (`/customer/services`, `/customer/services/:id`)

| Vấn đề | Mức |
|---|---|
| Nhãn danh mục **đè lên ảnh** (`VỆ SINH & LÀM SẠCH`...) | Trung bình — skill cấm dán nhãn lên ảnh |
| Phong cách ảnh (minh hoạ 3D) khác hẳn ảnh trang Tin tức (ảnh chụp thật) | Trung bình — hai ngôn ngữ hình ảnh trên cùng một site |
| Bố cục và mật độ nhìn chung tốt, không cần đụng | — |

### Auth (`/login`, `/register`, `/forgot-password`)

| Vấn đề | Mức |
|---|---|
| Còn 3 khối comment dài giải thích lịch sử class `mix-blend-mode` trong `AuthLayout.tsx` (dòng 65, 66, 99) | Thấp — rác lịch sử, không phải comment giải thích ràng buộc |
| Panel trái dùng ảnh minh hoạ chung chung, chưa tận dụng bộ ảnh thương hiệu | Thấp |
| Bố cục, tương phản, `autocomplete` đã đạt sau đợt refactor trước | — |

## Yêu cầu

**Chức năng**
- Không đổi luồng đăng nhập/đăng ký/OAuth
- Không đổi URL bài viết, slug danh mục

**Phi chức năng**
- File < 200 dòng, build xanh, ESLint 0 lỗi

## Các bước

1. **Tin tức — gỡ CTA trùng ý.** Giữ **một** nút trên thẻ nổi bật. Thống nhất
   nhãn với CTA đọc bài ở nơi khác (một ý một nhãn trên toàn trang).
2. **Tin tức — xử lý ngày tháng.** Bài viết là dữ liệu thật trong DB, ngày 2023
   đến từ seed. Hai lựa chọn:
   - **(Khuyến nghị)** Cập nhật ngày trong dữ liệu seed cho khớp mốc thời gian
     thật của sản phẩm. Một câu lệnh, và trung thực.
   - Hoặc ẩn ngày hiển thị (giữ trong `<time datetime>` cho SEO).
   ⚠️ Đây là **sửa dữ liệu**, nằm ngoài phạm vi "chỉ UI" — cần bạn đồng ý trước.
3. **Tin tức — bài khuyến mãi hết hạn.** Nếu là dữ liệu seed thì gỡ hoặc đổi
   ngày; nếu là bài thật đã hết hạn thì bổ sung nhãn trạng thái "đã kết thúc".
4. **Dịch vụ — chuyển nhãn danh mục xuống dưới ảnh**, không đè lên ảnh nữa.
   Ảnh tự nói, chú thích nằm ngoài khung ảnh.
5. **Dịch vụ — ghi nhận khác biệt phong cách ảnh.** Chưa xử lý ở đợt này; ghi vào
   mục nợ. Nếu sau này sinh thêm ảnh thì chốt **một** phong cách cho toàn site.
6. **Auth — dọn 3 khối comment lịch sử** trong `AuthLayout.tsx`. Giữ comment giải
   thích ràng buộc, bỏ comment kể chuyện đã sửa gì.
7. **Auth — cân nhắc dùng ảnh thương hiệu** cho panel trái. Chỉ làm nếu ảnh khớp
   tông; không đủ hợp thì giữ nguyên (đụng ít nhất có thể).
8. Build + lint + chụp ảnh đối chiếu.

## Todo

- [x] Gỡ CTA trùng ý trên thẻ nổi bật trang Tin tức
- [x] Chốt phương án ngày tháng bài viết (sửa seed hoặc ẩn ngày)
- [x] Xử lý bài khuyến mãi đã hết hạn
- [x] Chuyển nhãn danh mục ra khỏi ảnh ở `ServiceCard`
- [x] Dọn 3 khối comment lịch sử trong `AuthLayout.tsx`
- [ ] (Tuỳ chọn) Ảnh thương hiệu cho panel trái trang auth — **bỏ qua có chủ ý**: plan cho phép giữ nguyên nếu không đủ hợp
- [x] Build xanh + ESLint 0 lỗi + ảnh đối chiếu

## Tiêu chí hoàn thành

- Không còn 2 nút cùng ý trên bất kỳ thẻ nào của trang Tin tức
- Không còn ngày bài viết sớm hơn mốc khởi tạo công ty
- `grep -n "absolute.*top-.*rounded.*bg-primary" ServiceCard.tsx` → nhãn không
  còn nằm trong khung ảnh
- Luồng đăng nhập / đăng ký / Google / Facebook chạy đúng như trước

## Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Sửa dữ liệu seed vượt phạm vi refactor UI | Trung bình | Hỏi ý kiến trước (bước 2); không tự ý ghi vào DB dùng chung |
| Đụng `AuthLayout` làm vỡ 3 trang auth cùng lúc | Thấp | Chỉ xoá comment, không đụng JSX; build ngay sau đó |

## Bảo mật

- Không log token/mật khẩu; giữ `autocomplete="new-password"` ở đăng ký
- Không đưa `VITE_GOOGLE_CLIENT_ID` / `VITE_FACEBOOK_APP_ID` ra chỗ hiển thị

## Bước kế tiếp

Độc lập với Phase 1, 2. Xong cả ba → Phase 4.
