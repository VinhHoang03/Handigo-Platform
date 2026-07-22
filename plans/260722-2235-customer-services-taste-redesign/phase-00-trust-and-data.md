# Phase 0 — Nợ tin cậy và dữ liệu

**Ưu tiên:** Cao nhất · **Trạng thái:** ☐ Chưa bắt đầu · **Chặn:** Phase 1–2

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
- Không đổi logic tính giá khi đặt đơn (`useServicePricing`)

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
   ⚠️ Giữ `getServicePrice()` cho khâu **sắp xếp** (Phase 1) nhưng đổi tên thành
   `getServiceSortValue()` để không ai dùng nhầm nó cho hiển thị.
2. **Gỡ `4.8 / 128 đánh giá / 300+ đơn hàng`** khỏi `ServiceGallery`. Nếu muốn giữ
   chỗ cho số thật thì chỉ hiện khi API trả về; hiện tại API dịch vụ **không có**
   trường đánh giá, nên gỡ hẳn, không để placeholder.
3. **Sửa thư viện ảnh:** dịch vụ chỉ có một ảnh thì hiện **một** ảnh tràn khung,
   không dựng lưới 3 ô lặp lại. Chỉ dựng lưới khi thực sự có nhiều ảnh khác nhau.
4. **Xử lý 2 nút chết:** gỡ nút `favorite` (chưa có tính năng lưu). Giữ nút chia
   sẻ **chỉ khi** nối vào `navigator.share` với `navigator.clipboard` làm dự
   phòng, và có `aria-label`. Không đủ thời gian thì gỡ cả hai.
5. **Lọc danh mục rỗng** ở sidebar: đếm dịch vụ theo danh mục ở trang danh sách,
   truyền xuống, chỉ hiện danh mục có `count > 0` và **in kèm số**
   (`Thiết Bị Gia Dụng · 4`). Giống cách đã làm ở bento trang chủ.
6. **Ảnh dự phòng cùng tông:** thay 4 link Unsplash bằng một ô giữ chỗ theo token
   (nền `surface-container` + icon danh mục), hoặc dùng lại ảnh của một dịch vụ
   khác **cùng danh mục** nếu có. Không hotlink ảnh chụp thật vào một site dùng
   minh hoạ 3D.

## Todo

- [ ] `getServicePriceLabel()` phân biệt giá / cọc / báo giá
- [ ] Đổi tên `getServicePrice` → `getServiceSortValue`, chỉ dùng cho sắp xếp
- [ ] Gỡ `4.8`, `128 đánh giá`, `300+ đơn hàng` khỏi `ServiceGallery`
- [ ] Sửa lưới ảnh: một ảnh thì hiện một ảnh
- [ ] Gỡ nút `favorite`; nút chia sẻ nối `navigator.share` hoặc gỡ
- [ ] Lọc danh mục rỗng + in số dịch vụ trong sidebar
- [ ] Thay ảnh dự phòng Unsplash bằng ô giữ chỗ theo token
- [ ] Build xanh + ESLint 0 lỗi + ảnh đối chiếu

## Tiêu chí hoàn thành

- `grep -rn "4.8\|128 đánh giá\|300+" src/features/customer-service` → 0
- Không thẻ nào ghép chữ `Từ` với `depositAmount`. Kiểm bằng cách mở
  `/customer/services`, đối chiếu 11 dịch vụ `variable_price` với dữ liệu API
- Trang chi tiết của một dịch vụ có 1 ảnh → hiện đúng 1 ảnh, không lặp
- Sidebar chỉ còn danh mục có dịch vụ; mỗi mục có số đếm khớp kết quả khi bấm
- Không nút nào bấm vào mà không xảy ra gì

## Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Đổi cách hiển thị giá làm khách tưởng dịch vụ đắt lên | Trung bình | Không đổi con số nào, chỉ đổi **nhãn**. "Báo giá sau khảo sát" đúng với bản chất `variable_price` |
| `getServicePrice` còn được dùng chỗ khác | Trung bình | Grep toàn repo trước khi đổi tên; TypeScript bắt được chỗ sót |
| Lọc danh mục rỗng làm mất lối vào danh mục mới tạo | Thấp | Danh mục tự hiện lại ngay khi có dịch vụ đầu tiên |

## Bảo mật

Không có bề mặt tấn công mới. Lưu ý `navigator.share` chỉ chia sẻ URL công khai
của dịch vụ, không kèm dữ liệu người dùng.

## Bước kế tiếp

Xong Phase 0 → Phase 1 và 2 chạy song song.
