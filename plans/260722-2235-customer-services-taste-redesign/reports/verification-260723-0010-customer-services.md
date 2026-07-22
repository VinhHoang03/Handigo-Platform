# Báo cáo kiểm chứng — Làm mới UI trang duyệt dịch vụ

**Ngày:** 2026-07-23 · **Nhánh:** `feat/ui-refactor-landing` · **Phase 0–3: xong**

Ảnh: `../evidence/` (`phase03-*` là bộ cuối, 2 trang × 2 breakpoint).

---

## 1. Quét cơ học — 7/7 rỗng

| # | Lệnh | Kết quả |
|---|---|---|
| 1 | Gạch dài `—` `–` trong `features/customer-service` | **0** (kể cả trong chú thích) |
| 2 | Copy độn `"Tùy chọn bổ sung cho dịch vụ này"` | 0 |
| 3 | Số liệu viết cứng `128 đánh giá` / `300+ đơn` / `4.8` | 0 |
| 4 | `Provider` / `chuyên gia` trong chuỗi hiển thị | 0 |
| 5 | Bảng màu Tailwind mặc định | 0 |
| 6 | `addEventListener("scroll")` | 0 |
| 7 | Ảnh hotlink `images.unsplash.com` | 0 |

## 2. Đối chiếu số với API — 16/16 khớp

Điểm quan trọng nhất của đợt này. So từng dịch vụ giữa DOM và `GET /services`:

| Loại | Số dịch vụ | Nhãn render | Khớp |
|---|---|---|---|
| `fixed_price` có `minOptionPrice` | 3 | `Từ 300.000 ₫` / `Từ 200.000 ₫` / `Từ 100.000 ₫` | ✅ |
| `variable_price` | 13 | `Báo giá sau khảo sát` + `Đặt cọc 20.000 ₫` (hoặc 40.000) | ✅ |

**0 sai lệch.** Không thẻ nào còn ghép chữ "Từ" với `depositAmount`.

Số đếm sidebar: 7 danh mục, tổng 16, **0 lệch** so với đếm từ API. 4 danh mục
không có dịch vụ đã ẩn.

Trang chi tiết `variable_price`: dòng "Giá tạm tính" hiện `Báo giá sau khảo sát`,
**không in con số nào**.

## 3. Đo trên trình duyệt

| Hạng mục | Kết quả |
|---|---|
| Tràn ngang @ 360/390/768/1024/1440, cả 2 trang | **0px** (10/10 tổ hợp) |
| Vùng chạm < 44px | **0** trên cả hai trang, cả hai breakpoint |
| Bàn phím, 10 điểm dừng đầu trang danh sách | 10/10 có focus ring |
| Tương phản WCAG AA (chuẩn hoá qua canvas vì Tailwind v4 phát `oklch`) | **0 lỗi** |
| Tấm trượt lọc mobile | `:modal` = true, focus nằm trong dialog, Esc đóng được |
| Console | Chỉ 1 lỗi: `401 refresh-token` của khách chưa đăng nhập, đúng dự kiến |
| CLS | 0 (danh sách), 0 (chi tiết) |
| FCP | 332ms / 316ms |

### Hành vi đã kiểm bằng thao tác thật

- Gõ vào ô tìm kiếm: **0 request** `/services/:id/options` (trước là 16 mỗi lần gõ)
- Tìm "may" (không dấu) → 3 kết quả Máy Giặt / Máy Rửa Chén / Máy Sấy Quần Áo,
  số đếm "3 dịch vụ khớp" khớp đúng 3 thẻ render
- Nút xoá từ khoá → về lại 16 thẻ
- Đổi sắp xếp sang "Giá thấp đến cao" → thứ tự **đổi thật**, dịch vụ có giá lên
  trước (100k → 200k → 300k), dịch vụ báo giá xuống cuối
- Từ khoá không khớp → trạng thái rỗng nêu đúng từ khoá đang tìm + nút thoát
- Bấm thẻ danh mục trong tấm trượt → sheet đóng, URL đổi, tiêu đề và danh sách
  lọc theo, huy hiệu số lọc hiện lên
- Giả lập API chết (`route.abort`) → hiện `role="alert"` với thông báo lỗi, trang
  không trắng
- Nút chia sẻ: chép đúng URL vào clipboard, hiện báo rồi tự tắt sau 2s
- **Luồng đặt đơn:** chọn gói → giá tạm tính đổi `Chọn gói dịch vụ` → 300.000 ₫ →
  450.000 ₫; đơn lựa chọn giữ đúng một mục; bấm "Đặt lịch ngay" khi chưa đăng
  nhập → chuyển sang `/login`, không lỗi

## 4. Mục KHÔNG kiểm được — ghi rõ thay vì tick

| Mục | Lý do |
|---|---|
| **LCP < 2.5s** | Chromium headless trên máy này **không phát entry `largest-contentful-paint`** dù đã thử 4 cách (observer trước navigate, đọc buffer sau load, cả trên dev server lẫn bản build production qua http). Đã đo thay bằng FCP (332ms/316ms) và CLS (0). Cần chạy Lighthouse trên môi trường thật để chốt. |
| **Đặt một đơn thật rồi huỷ** | Chưa làm. Đã kiểm tới bước chuyển hướng `/login` với khách. Rủi ro của thay đổi giá đã được khép lại bằng đường khác: `CreateOrderPayload` không có trường tiền nào, backend tự dựng pricing snapshot từ DB (`order.service.ts:331`), nên `estimatePrice` phía client không thể ảnh hưởng số tiền khách bị tính. |
| **agent-browser** | Không dùng được trên máy này: từ chối cert tự ký của dev server (`ERR_CERT_AUTHORITY_INVALID`), và treo vô hạn khi mở qua http (thử 4 lần, mỗi lần > 150s). Thay bằng runner Playwright độc lập dùng Chromium sẵn có. |
| **`prefers-reduced-motion`** | Không áp dụng: trang này ở `MOTION_INTENSITY 3`, không có scroll-reveal hay animation trang trí nào để tắt (`grep reveal` → 0). |

## 5. Sai lệch có chủ ý so với plan

| # | Nội dung | Lý do |
|---|---|---|
| 1 | Giữ lưới thẻ đồng nhất, **không** áp luật cấm "3 thẻ đều nhau" (skill 9.C) | Lưới catalog phải đồng nhất mới so sánh giá được. Luật đó viết cho hàng thẻ tính năng ở trang marketing. |
| 2 | Bỏ tìm kiếm theo tên tuỳ chọn | Đánh đổi để loại 16 request mỗi lần gõ. Bạn đã chốt. Gõ "50 mét vuông" không còn ra kết quả. |
| 3 | Gỡ nút "Xem chi tiết" trong thẻ | Cả thẻ vốn đã là liên kết. Ở lưới 3 cột, nút đó ép cả nó lẫn nhãn giá xuống 2 dòng. |
| 4 | Sửa `MaterialIcon` (ngoài phạm vi feature) | Phát hiện khi test: icon không có `aria-hidden` nên trình đọc màn hình đọc tên ligature. Nút lọc có tên là "tune Danh mục". Sửa ở gốc, ảnh hưởng toàn app; kèm `aria-label` cho 3 liên kết mạng xã hội ở footer vốn tên là "social_leaderboard". |
| 5 | Quét thuật ngữ "thợ" ra cả trang hồ sơ thợ | Cùng thư mục `features/customer-service`, để tiêu chí "0 chỗ còn chuyên gia" đúng thật chứ không đúng nửa vời. |

## 6. Chất lượng mã

- Build xanh, ESLint 0 lỗi, `tsc` 0 lỗi
- Mọi tệp đụng tới < 200 dòng (lớn nhất: `CustomerServiceDetailPage.tsx` 196)
- Tách `useServiceCatalog` đưa trang danh sách từ 193 → 110 dòng

---

## Nợ ghi nhận

1. Không phân trang; `limit: 100` viết cứng. 16 dịch vụ thì chưa sao, thêm nữa
   thì trang mobile dài vô tận (hiện 6408px cho 16 thẻ).
2. Tìm kiếm theo tên tuỳ chọn cần endpoint phía server nếu muốn khôi phục.
3. Sắp xếp theo độ phổ biến cần backend trả `totalCompletedOrders` cho dịch vụ.
4. Lighthouse thật trên bản production chưa chạy.
5. `CategoryIcon` vẫn import `lucide-react` (nhánh dead code với dữ liệu thật vì
   `category.icon` là URL SVG) — nằm trong đợt gỡ lucide toàn app.
6. Trang hồ sơ thợ `/customer/providers/:id` chưa được audit thẩm mỹ, mới chỉ
   đồng bộ thuật ngữ.

## Câu hỏi chưa giải quyết

- Có muốn tôi đặt một đơn thật bằng tài khoản test rồi huỷ, để đóng nốt mục kiểm
  cuối cùng không? Việc này ghi một bản ghi vào DB dev dùng chung.
- "Đặt cọc 20.000 ₫" hiện trên thẻ danh sách: giữ hay ẩn đi, chỉ hiện ở bước đặt
  đơn? Hiện tại giữ vì nó trả lời câu "tôi phải trả gì ngay bây giờ".
