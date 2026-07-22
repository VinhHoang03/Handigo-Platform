---
title: Làm mới UI trang duyệt dịch vụ (/customer/services)
status: planned
created: 2026-07-22
branch: feat/ui-refactor-landing
blockedBy: []
blocks: []
---

# Làm mới UI trang duyệt dịch vụ

Hai trang: danh sách (`/customer/services`) và chi tiết (`/customer/services/:id`).
Đây là nơi khách **quyết định chi tiền**, nên nợ tin cậy ở đây đắt hơn ở trang
marketing. Đợt `260722-1822` đã dọn nhóm trang công khai; đợt này xử lý bề mặt
thương mại.

## Design Read

> Trang **duyệt danh mục thương mại + chi tiết sản phẩm** của sàn dịch vụ gia
> đình, cho chủ nhà đang cần thợ (thường gấp, thường trên điện thoại). Ngôn ngữ
> **thực dụng, dễ so sánh**, giữ hệ Material 3 và brand `#3525cd` sẵn có.

## Phạm vi của taste skill ở đây

Section 13 của skill nói rõ: skill này **không dành cho** product UI dày đặc và
bảng dữ liệu. Áp dụng có chọn lọc:

- **Áp dụng:** thẻ dịch vụ, ảnh, trạng thái rỗng/đang tải/lỗi, copy, tương phản,
  vùng chạm, chuyển động có lý do, danh sách AI tells.
- **Không áp dụng:** luật hero, ngân sách eyebrow chặt, và đặc biệt là luật cấm
  "3 thẻ đều nhau" (Section 9.C). Lưới catalog **phải** đồng nhất mới so sánh
  được; luật đó viết cho hàng thẻ tính năng ở trang marketing. Đây là sai lệch
  có chủ ý, ghi lại để không ai "sửa" nhầm về sau.

## Ba dial

| Dial | Hiện tại | Mục tiêu | Lý do |
|---|---|---|---|
| `DESIGN_VARIANCE` | ~4 | **5** | Thấp hơn landing (7). Bất đối xứng làm hỏng khả năng so sánh giữa các dịch vụ. |
| `MOTION_INTENSITY` | ~1 | **3** | Thấp hơn landing (5). Đây là trang tra cứu; chuyển động chỉ để **phản hồi** (đang lọc, đang tải), không để trang trí. |
| `VISUAL_DENSITY` | ~4 | **5** | Cao hơn landing (3). Người duyệt 16 dịch vụ cần thấy nhiều hơn mỗi màn hình. |

## Ba tầng vấn đề tìm được khi audit

**Tầng 1 — Nợ tin cậy (nghiêm trọng nhất):**
11/16 dịch vụ là `variable_price`, thẻ hiển thị **"Từ 20.000 đ"** — đó là **tiền
cọc**, không phải giá. Khách nhìn "Chuyển Nhà · Từ 20.000đ" và hiểu là chuyển
nhà giá 20 nghìn. Kèm theo: `"4.8 (128 đánh giá)"` và `"300+ đơn hàng thành
công"` viết cứng, hiện **giống hệt nhau trên mọi dịch vụ**.

**Tầng 2 — Chức năng giả:** thư viện ảnh chi tiết hiện **cùng một tấm ảnh 3 lần**;
nút chia sẻ và yêu thích không làm gì; sắp xếp "Phổ biến nhất" trả về nguyên thứ
tự cũ; 4/11 danh mục trong sidebar không có dịch vụ nào.

**Tầng 3 — Nợ thẩm mỹ:** mobile bắt cuộn qua 11 nút danh mục mới tới dịch vụ đầu
tiên (trang cao 7226px); mọi tuỳ chọn dịch vụ hiện ô ảnh vỡ + copy độn `"Tùy chọn
bổ sung cho dịch vụ này."`; 5 thẻ trắng xếp chồng ở trang chi tiết; "Provider"
lẫn "chuyên gia" lẫn "thợ" trong cùng một màn hình.

## Các phase

| # | Phase | Trạng thái | Phụ thuộc |
|---|---|---|---|
| 0 | [Nợ tin cậy + dữ liệu](phase-00-trust-and-data.md) | ☐ | — |
| 1 | [Trang danh sách](phase-01-list-page.md) | ☐ | Phase 0 |
| 2 | [Trang chi tiết](phase-02-detail-page.md) | ☐ | Phase 0 |
| 3 | [Kiểm chứng](phase-03-verification.md) | ☐ | Phase 1–2 |

Phase 0 chặn tất cả. Phase 1 và 2 độc lập, chạy song song được.

## Nguyên tắc xuyên suốt

1. **Không đổi URL, IA, tên nav, tên field form.**
2. **Không bịa số.** Thiếu dữ liệu thì đổi cách nói, không đổi con số.
3. **Không hiển thị tiền cọc như thể là giá.** Đây là luật cứng của đợt này.
4. Không đụng logic đặt đơn, chọn địa chỉ, tính giá.
5. Mỗi phase build xanh + ESLint 0 lỗi + ảnh đối chiếu trước/sau.
6. File dưới 200 dòng.

## Quyết định kế thừa

- Không làm dark mode (chốt từ hai đợt trước).
- Icon: Material Symbols. `CategoryIcon` còn dùng lucide nhưng nhánh đó là dead
  code với dữ liệu thật (`category.icon` là URL SVG) — xử lý ở đợt gỡ lucide.
- Phong cách ảnh: minh hoạ 3D. Ảnh dự phòng hiện là ảnh chụp Unsplash, lệch tông
  — xử lý ở Phase 0.
