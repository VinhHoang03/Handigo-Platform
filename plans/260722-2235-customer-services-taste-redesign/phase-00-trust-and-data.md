# Phase 0 — Nợ tin cậy và dữ liệu

**Ưu tiên:** Cao nhất · **Trạng thái:** ✅ Hoàn thành (2026-07-22) · **Chặn:** Phase 1–2

Phase này không làm đẹp gì cả. Nó gỡ những chỗ trang đang **nói sai** với khách.
Làm trước vì Phase 1 và 2 đều dựng lại các thành phần chứa những lỗi này.

## Liên kết

- [plan.md](plan.md) · Ảnh audit: `audit-before/`
- Đợt trước: `plans/260722-1822-public-pages-taste-redesign/`

## Kết quả audit

### 0.1 Tiền cọc hiển thị như giá dịch vụ (nghiêm trọng nhất)

`getServicePrice()` trả `depositAmount` cho dịch vụ `variable_price`. Thẻ in ra
`Từ` + số đó. Dữ liệu thật:

| Dịch vụ | Loại | Số đang hiện | Thực chất |
|---|---|---|---|
| Chuyển Nhà | variable_price | Từ 20.000 đ | tiền cọc 20.000đ |
| Máy Giặt | variable_price | Từ 20.000 đ | tiền cọc 20.000đ |
| Sửa Chữa Điều Hòa | variable_price | Từ 40.000 đ | tiền cọc 40.000đ |
| Vệ Sinh Nhà Cửa | fixed_price | Từ 300.000 đ | **đúng** (minOptionPrice) |

11/16 dịch vụ đang sai kiểu này. Chữ "Từ" khiến người đọc hiểu đó là mức giá
thấp nhất của dịch vụ.

**Lỗi này không chỉ ở tầng hiển thị.** `useServicePricing` cũng gọi
`getServicePrice()` để lấy `basePrice`, và với `variable_price` thì
`estimatePrice = basePrice = depositAmount`. Kết quả trên trang chi tiết:

```
Giá tạm tính        20.000 đ      ← tiền cọc
Báo giá sau khảo sát              ← nhãn ngay bên dưới, tự mâu thuẫn
```

Sửa nửa vời (chỉ đổi nhãn ở thẻ danh sách) thì trang chi tiết vẫn sai. Đã chốt
**sửa cả hook** (xem bước 1b).

### 0.2 Số liệu viết cứng trong `ServiceGallery.tsx`

```
4.8 (128 đánh giá)          ← viết cứng, hiện y hệt trên cả 16 dịch vụ
300+ đơn hàng thành công    ← viết cứng
```

Cùng loại lỗi với dải `StatsSection` đã gỡ khỏi trang chủ ở đợt trước.

### 0.3 Thư viện ảnh hiện cùng một ảnh 3 lần

`getServiceImage(service, index)` chỉ dùng `index` cho **ảnh dự phòng**. Dịch vụ
có ảnh thật thì cả 3 ô trong lưới đều trả về đúng một URL. Xem
`audit-before/audit-svc-detail-1440.jpeg`.

### 0.4 Nút không làm gì

`share` và `favorite` trong `ServiceGallery` không có `onClick`, không có
`aria-label`. Chức năng giả.

### 0.5 Danh mục rỗng trong sidebar

11 danh mục, chỉ 7 có dịch vụ. Bấm "Diệt Côn Trùng" / "Lắp Đặt & Thi Công" /
"Sơn & Hoàn Thiện Nhà Cửa" / "Điện Nước & Hệ Thống Kỹ Thuật" → 0 kết quả.

### 0.6 Ảnh dự phòng lệch tông

`fallbackServiceImages` là 4 link Unsplash hotlink, ảnh chụp thật, trong khi toàn
bộ ảnh dịch vụ là minh hoạ 3D. Rơi vào dự phòng là lộ ngay.

## Yêu cầu

**Chức năng**
- Không đổi API, không đổi schema, không ghi vào DB
- **Có** đổi `useServicePricing` (bước 2): ngừng dùng tiền cọc làm giá tạm tính.
  Đây là thay đổi logic duy nhất của đợt này, đã được chấp thuận
- Không đổi luồng đặt đơn, thứ tự bước, hay cách chọn địa chỉ

**Phi chức năng**
- Build xanh, ESLint 0 lỗi, file < 200 dòng

## Kiến trúc

```
features/customer-service/utils/
  └── serviceDisplay.ts        thay getServicePrice bằng getServicePriceLabel
features/customer-service/components/
  ├── ServiceGallery.tsx       gỡ số liệu bịa, sửa lưới ảnh, xử lý 2 nút
  └── ServiceCategoryFilter.tsx  lọc danh mục rỗng
features/customer-service/pages/
  └── CustomerServiceListPage.tsx  truyền số dịch vụ theo danh mục xuống filter
```

## Các bước

1. **Tách nhãn giá khỏi số giá.** Thêm `getServicePriceLabel(service)` trả về một
   đối tượng có ngữ nghĩa rõ ràng thay vì một con số trần:
   - `fixed_price` + `minOptionPrice > 0` → `{ kind: "from", amount }` → hiện
     `Từ 300.000 đ`
   - `fixed_price` + `fixedPrice > 0` → `{ kind: "exact", amount }` → hiện giá
   - `variable_price` → `{ kind: "quote", deposit }` → hiện **`Báo giá sau khảo
     sát`**, và nếu muốn nêu cọc thì phải ghi đúng chữ: `Đặt cọc 20.000 đ`.
     **Cấm** ghép tiền cọc với chữ "Từ".
   - Không có dữ liệu → `{ kind: "unknown" }` → hiện `Liên hệ báo giá`
2. **Sửa `useServicePricing` (business logic).** Với `variable_price`,
   `estimatePrice` trả **0** thay vì `depositAmount`; `BookingSidebar` đã có sẵn
   nhánh hiện `Báo giá sau khảo sát` khi `estimatePrice <= 0`, nên chỉ cần ngừng
   truyền tiền cọc vào chỗ dành cho giá.
   ✅ **Cổng chặn đã kiểm (2026-07-22):** `CreateOrderPayload` trong
   `booking.api.ts` **không có trường tiền nào** (chỉ `serviceId`,
   `selectedOptionIds`, `addressId`, `paymentMethod`...). Backend tự dựng
   `buildServicePricingSnapshot(service, ...)` từ bản ghi dịch vụ trong DB
   (`order.service.ts:331`). Nghĩa là `estimatePrice` phía client **thuần là số
   để hiển thị**, đổi nó không thể làm sai số tiền khách bị tính.
   Vẫn test tay luồng đặt đơn đầu-cuối sau khi sửa (Phase 3 bước 5) để chắc
   `BookingSidebar` và `OrderSummaryCard` không rơi vào nhánh hiển thị lạ.
   ⚠️ Giữ `getServicePrice()` cho khâu **sắp xếp** (Phase 1) nhưng đổi tên thành
   `getServiceSortValue()` để không ai dùng nhầm nó cho hiển thị. TypeScript sẽ
   bắt hết chỗ gọi; `useServicePricing` là một trong số đó.
3. **Gỡ `4.8 / 128 đánh giá / 300+ đơn hàng`** khỏi `ServiceGallery`. Nếu muốn giữ
   chỗ cho số thật thì chỉ hiện khi API trả về; hiện tại API dịch vụ **không có**
   trường đánh giá, nên gỡ hẳn, không để placeholder.
4. **Sửa thư viện ảnh:** dịch vụ chỉ có một ảnh thì hiện **một** ảnh tràn khung,
   không dựng lưới 3 ô lặp lại. Chỉ dựng lưới khi thực sự có nhiều ảnh khác nhau.
5. **Xử lý 2 nút chết:** gỡ nút `favorite` (chưa có tính năng lưu). Giữ nút chia
   sẻ **chỉ khi** nối vào `navigator.share` với `navigator.clipboard` làm dự
   phòng, và có `aria-label`. Không đủ thời gian thì gỡ cả hai.
6. **Lọc danh mục rỗng** ở sidebar: đếm dịch vụ theo danh mục ở trang danh sách,
   truyền xuống, chỉ hiện danh mục có `count > 0` và **in kèm số**
   (`Thiết Bị Gia Dụng · 4`). Giống cách đã làm ở bento trang chủ.
7. **Ảnh dự phòng cùng tông:** thay 4 link Unsplash bằng một ô giữ chỗ theo token
   (nền `surface-container` + icon danh mục), hoặc dùng lại ảnh của một dịch vụ
   khác **cùng danh mục** nếu có. Không hotlink ảnh chụp thật vào một site dùng
   minh hoạ 3D.

## Todo

- [x] `getServicePriceLabel()` phân biệt giá / cọc / báo giá
- [x] Kiểm backend tự đọc `depositAmount` khi tạo đơn — **đã xác nhận**, client không gửi số tiền nào
- [x] `useServicePricing`: `variable_price` trả `estimatePrice = 0`, không trả tiền cọc
- [x] Đổi tên `getServicePrice` → `getServiceSortValue`, chỉ dùng cho sắp xếp
- [x] Gỡ `4.8`, `128 đánh giá`, `300+ đơn hàng` khỏi `ServiceGallery`
- [x] Sửa lưới ảnh: một ảnh thì hiện một ảnh
- [x] Gỡ nút `favorite`; nút chia sẻ nối `navigator.share` hoặc gỡ
- [x] Lọc danh mục rỗng + in số dịch vụ trong sidebar
- [x] Thay ảnh dự phòng Unsplash bằng ô giữ chỗ theo token
- [x] Build xanh + ESLint 0 lỗi + ảnh đối chiếu

## Tiêu chí hoàn thành

- `grep -rn "4.8\|128 đánh giá\|300+" src/features/customer-service` → 0
- Không thẻ nào ghép chữ `Từ` với `depositAmount`. Kiểm bằng cách mở
  `/customer/services`, đối chiếu 11 dịch vụ `variable_price` với dữ liệu API
- Trang chi tiết của dịch vụ `variable_price` **không in con số nào** ở dòng
  "Giá tạm tính"; chỉ hiện "Báo giá sau khảo sát"
- Trang chi tiết của một dịch vụ có 1 ảnh → hiện đúng 1 ảnh, không lặp
- Sidebar chỉ còn danh mục có dịch vụ; mỗi mục có số đếm khớp kết quả khi bấm
- Không nút nào bấm vào mà không xảy ra gì

## Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Đổi cách hiển thị giá làm khách tưởng dịch vụ đắt lên | Trung bình | Không đổi con số nào, chỉ đổi **nhãn**. "Báo giá sau khảo sát" đúng với bản chất `variable_price` |
| `getServicePrice` còn được dùng chỗ khác | Trung bình | Đã grep: dùng ở `ServiceCard`, `CustomerServiceListPage` (sắp xếp) và `useServicePricing` (tính giá). TypeScript bắt chỗ sót |
| Sửa hook tính giá làm sai số tiền khách phải trả | ~~Cao~~ → **Thấp** | Đã kiểm: client không gửi trường tiền nào khi tạo đơn, backend tự dựng snapshot giá từ DB. `estimatePrice` chỉ để hiển thị. Vẫn test tay đặt đơn ở Phase 3 |
| Lọc danh mục rỗng làm mất lối vào danh mục mới tạo | Thấp | Danh mục tự hiện lại ngay khi có dịch vụ đầu tiên |

## Bảo mật

Không có bề mặt tấn công mới. Lưu ý `navigator.share` chỉ chia sẻ URL công khai
của dịch vụ, không kèm dữ liệu người dùng.

## Bước kế tiếp

Xong Phase 0 → Phase 1 và 2 chạy song song.
