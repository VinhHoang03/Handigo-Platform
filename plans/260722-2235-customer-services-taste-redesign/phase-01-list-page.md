# Phase 1 — Trang danh sách dịch vụ

**Ưu tiên:** Cao · **Trạng thái:** ☐ Chưa bắt đầu · **Phụ thuộc:** Phase 0

Trang này có một việc duy nhất: giúp khách **tìm và so sánh** dịch vụ. Mọi thứ
không phục vụ việc đó đều là nhiễu.

## Liên kết

- [plan.md](plan.md) · [Phase 0](phase-00-trust-and-data.md)
- Ảnh audit: `audit-before/audit-svc-list-1440.jpeg`, `audit-svc-list-390.jpeg`

## Kết quả audit

| Vấn đề | Vị trí | Mức |
|---|---|---|
| **Mobile: 11 nút danh mục chiếm trọn màn hình đầu**, phải cuộn qua hết mới thấy dịch vụ đầu tiên. Trang cao 7226px | `CustomerServiceListPage` + `ServiceCategoryFilter` | **Nghiêm trọng** |
| Sắp xếp "Phổ biến nhất" `return 0`, không làm gì | `CustomerServiceListPage:139` | **Cao** — chức năng giả |
| Ô tìm kiếm nhỏ, nằm nép phải, dù đây là hành động chính của trang | `ServiceListToolbar` | Cao |
| Gõ 1 ký tự vào ô tìm kiếm → bắn **16 request** `/services/:id/options` cùng lúc | `CustomerServiceListPage:53-91` | Cao — hiệu năng |
| Panel "Bộ lọc" có tiêu đề + icon `tune` nhưng chỉ chứa **một** nhóm lọc | `ServiceCategoryFilter` | Trung bình |
| Thẻ có khoảng trống lớn giữa ảnh và chữ ở mobile | `ServiceCard` | Trung bình |
| Nhãn danh mục uppercase trên **mỗi** thẻ (16 nhãn) + eyebrow "DỊCH VỤ HANDIGO" | `ServiceCard`, `ServiceListToolbar` | Trung bình |
| Không phân trang; `limit: 100` cứng | `serviceCatalog.api.ts` | Thấp (16 dịch vụ) — ghi nợ |

## Sai lệch có chủ ý so với skill

Section 9.C cấm "3 thẻ đều nhau". **Không áp dụng ở đây.** Lưới catalog phải đồng
nhất thì mắt mới quét và so sánh được giá giữa các dịch vụ. Luật đó viết cho hàng
thẻ tính năng ở trang marketing. Nhịp điệu của trang này đến từ **bộ lọc và mật
độ**, không đến từ việc phá vỡ lưới.

## Yêu cầu

**Chức năng**
- Giữ URL và query param `categoryId`, `search`
- Lọc, tìm kiếm, sắp xếp giữ nguyên hành vi (trừ mục sắp xếp giả)
- Mọi thứ hiển thị được phải bấm được và dẫn tới kết quả thật

**Phi chức năng**
- Không tăng số request khi gõ tìm kiếm
- File < 200 dòng, build xanh, ESLint 0 lỗi
- 0 tràn ngang ở 360 / 390 / 768 / 1024 / 1440

## Kiến trúc

```
features/customer-service/
  ├── pages/CustomerServiceListPage.tsx   bố cục, bỏ N+1 request
  ├── components/
  │   ├── ServiceListToolbar.tsx          tìm kiếm thành hành động chính
  │   ├── ServiceCategoryFilter.tsx       thêm chế độ mobile
  │   ├── ServiceFilterSheet.tsx          MỚI: bộ lọc dạng tấm trượt cho mobile
  │   ├── ServiceCard.tsx                 nhãn giá mới, mật độ chặt hơn
  │   └── ServiceListEmpty.tsx            MỚI: trạng thái rỗng có lối thoát
  └── hooks/useServiceCatalog.ts          MỚI: tách logic lọc/sắp xếp khỏi page
```

## Các bước

1. **Sửa mobile trước.** Dưới `md`, bộ lọc không đổ thẳng vào luồng trang. Hai
   lựa chọn, chọn một:
   - **(Khuyến nghị)** Nút `Bộ lọc` cố định ở toolbar mở `ServiceFilterSheet`
     (tấm trượt từ đáy, `dialog` gốc HTML hoặc `role="dialog"` + bẫy focus).
     Nhãn nút kèm số lọc đang bật.
   - Hoặc dải chip danh mục cuộn ngang ngay dưới toolbar.
   Desktop giữ nguyên sidebar dính.
2. **Ô tìm kiếm thành hành động chính** của toolbar: đưa lên hàng riêng, chiều
   rộng thoải mái, `min-h-14` cho khớp thang input chung, có nút xoá khi có chữ.
3. **Gỡ mục sắp xếp giả.** "Phổ biến nhất" không có dữ liệu độ phổ biến (API
   không trả lượt đặt). Hai lựa chọn:
   - Gỡ mục đó, để mặc định là `Tên A-Z` (có thật, ổn định).
   - Hoặc nếu backend có `totalCompletedOrders` cho dịch vụ thì nối vào — **cần
     kiểm tra trước**, không đoán.
   Không giữ một mục sắp xếp trả về nguyên thứ tự cũ.
4. **Bỏ N+1 request khi tìm kiếm.** (Chốt 2026-07-22.) Hiện tại mỗi lần gõ nạp
   option của **tất cả** dịch vụ để tìm trong tên tuỳ chọn. Thay bằng: tìm trên
   tên + mô tả dịch vụ + tên danh mục (đã có sẵn trong bộ nhớ), **bỏ phần tìm
   trong tuỳ chọn**.
   ⚠️ Đây là **thu hẹp phạm vi chức năng**, không phải tối ưu thuần tuý: gõ
   "50 mét vuông" sẽ không còn ra kết quả. Chấp nhận đánh đổi vì tuỳ chọn hiện
   tại đều là thông số dạng "Dưới 50 mét vuông", ít ai dùng làm từ khoá tìm dịch
   vụ. Muốn khôi phục thì phải làm tìm kiếm phía server, nằm ngoài đợt này.
5. **Thẻ dịch vụ:** siết mật độ theo `VISUAL_DENSITY 5`. Nhãn giá dùng
   `getServicePriceLabel` từ Phase 0. Gỡ nhãn danh mục uppercase khỏi **thẻ** khi
   đang lọc theo đúng danh mục đó (thừa thông tin), giữ khi xem "Tất cả".
6. **Trạng thái rỗng có lối thoát.** Hiện tại chỉ có dòng chữ "Chưa có dịch vụ
   phù hợp." Bổ sung: nêu rõ đang lọc theo gì, và nút xoá bộ lọc / xoá từ khoá.
7. **Đối chiếu số đếm.** `Hiển thị N dịch vụ phù hợp` phải khớp số thẻ thật sự
   render, kể cả khi đang lọc và tìm kiếm cùng lúc.
8. **Chuyển động ở mức 3:** chỉ phản hồi. Đổi bộ lọc → danh sách chuyển mượt
   (`transition` trên `opacity`), không stagger từng thẻ, không reveal khi cuộn.
   Mỗi hiệu ứng phải trả lời được "nó truyền đạt điều gì".
9. Build + lint + chụp ảnh desktop/mobile đối chiếu.

## Todo

- [ ] Bộ lọc mobile không còn chặn nội dung (sheet hoặc chip cuộn ngang)
- [ ] Ô tìm kiếm thành hành động chính, có nút xoá
- [ ] Gỡ hoặc nối thật mục sắp xếp "Phổ biến nhất"
- [ ] Bỏ 16 request `/options` khi gõ tìm kiếm
- [ ] Thẻ dùng nhãn giá mới, siết mật độ
- [ ] Trạng thái rỗng nêu bộ lọc hiện tại + nút xoá lọc
- [ ] Số đếm khớp số thẻ render
- [ ] Tách `useServiceCatalog` để page dưới 200 dòng
- [ ] Build xanh + ESLint 0 lỗi + ảnh đối chiếu

## Tiêu chí hoàn thành

- Ở 390px, dịch vụ đầu tiên thấy được sau **một** lần cuộn, không phải sau 11 nút
- Gõ vào ô tìm kiếm → tab Network không thấy loạt request `/options`
- Không mục sắp xếp nào chọn xong mà thứ tự không đổi
- Lọc danh mục rỗng kết quả → thấy nút xoá lọc, bấm vào quay lại danh sách đầy đủ
- 0 tràn ngang ở 4 breakpoint; 0 vùng chạm dưới 44px
- `Hiển thị N dịch vụ` khớp số thẻ ở mọi tổ hợp lọc + tìm kiếm

## Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Bỏ tìm theo tên tuỳ chọn làm mất kết quả khách quen tìm | Trung bình | Đo trước: tuỳ chọn hiện tại là "Dưới 50 mét vuông" dạng thông số, ít ai gõ để tìm dịch vụ. Nếu cần thì làm tìm kiếm phía server ở đợt sau |
| Sheet lọc trên mobile làm hỏng bẫy focus / phím Esc | Trung bình | Dùng `<dialog>` gốc HTML, kiểm bằng bàn phím trước khi chốt |
| Gỡ "Phổ biến nhất" bị hiểu là mất tính năng | Thấp | Ghi rõ trong commit: mục đó chưa từng hoạt động |

## Bảo mật

- Không đưa `_id` nội bộ vào chuỗi hiển thị
- Ô tìm kiếm lọc phía client trên dữ liệu đã công khai; không dựng truy vấn từ
  chuỗi người dùng nhập

## Bước kế tiếp

Độc lập với Phase 2.
