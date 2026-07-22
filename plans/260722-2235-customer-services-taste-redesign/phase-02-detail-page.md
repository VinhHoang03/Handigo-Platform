# Phase 2 — Trang chi tiết dịch vụ

**Ưu tiên:** Cao · **Trạng thái:** ☐ Chưa bắt đầu · **Phụ thuộc:** Phase 0

Đây là màn hình cuối trước khi khách bấm "Đặt lịch ngay". Mọi chi tiết sai ở đây
đều làm khách chần chừ đúng lúc không nên chần chừ.

## Liên kết

- [plan.md](plan.md) · [Phase 0](phase-00-trust-and-data.md)
- Ảnh audit: `audit-before/audit-svc-detail-1440.jpeg`

## Kết quả audit

| Vấn đề | Vị trí | Mức |
|---|---|---|
| Mọi tuỳ chọn hiện **ô ảnh vỡ** (icon `image_not_supported`): API trả `image: null` cho toàn bộ tuỳ chọn | `ServiceOptionsSection:56` | **Cao** — trông như lỗi tải |
| Copy độn `"Tùy chọn bổ sung cho dịch vụ này."` lặp lại ở **mọi** tuỳ chọn | `ServiceOptionsSection:73` | Cao — đúng loại lỗi đã gỡ ở trang chủ đợt trước |
| Tên tuỳ chọn xuống dòng giữa cụm ("Dưới 50 mét / vuông") và đâm vào cột giá | `ServiceOptionsSection` | Cao |
| Tiêu đề **"Danh mục công việc"** nhưng nội dung là cam kết dịch vụ | `ServiceChecklistSection` | Cao — nhãn sai bản chất |
| Ba cách gọi cùng một vai trò trên **một màn hình**: "Provider đã được xác minh", "tìm chuyên gia phù hợp", "CÁC CHUYÊN GIA PHỤ TRÁCH". Trang chủ đã thống nhất là **"thợ"** | `BookingSidebar`, `NearbyProviderSelector`, `ServiceDescriptionSection` | Cao |
| Mô tả mặc định dùng chữ "provider" trong câu tiếng Việt | `ServiceDescriptionSection:14` | Cao |
| 5 thẻ trắng bo góc xếp chồng, cùng nền, cùng bo góc, cùng đổ bóng | toàn trang | Trung bình |
| 4 nhãn uppercase trong màn hình đầu (`VỆ SINH & LÀM SẠCH`, `LOẠI GIÁ`, `ĐỊA CHỈ THỰC HIỆN`, `CÁC CHUYÊN GIA PHỤ TRÁCH`) | nhiều nơi | Trung bình |
| Khối "Các chuyên gia phụ trách" là ô viền đứt rỗng với khách chưa đăng nhập | `NearbyProviderSelector` | Trung bình |
| Checklist 6 mục giống hệt nhau trên mọi dịch vụ | `ServiceChecklistSection` | Thấp |

## Yêu cầu

**Chức năng**
- Không đụng `useServicePricing`, `useAddressSelection`, `useBookNowHandler`
- Không đổi luồng đặt đơn, không đổi thứ tự bước
- Không đổi URL, không đổi `serviceId` param

**Phi chức năng**
- File < 200 dòng, build xanh, ESLint 0 lỗi

## Kiến trúc

```
features/customer-service/components/
  ├── ServiceGallery.tsx            (Phase 0 đã sửa ảnh) chỉnh phần tiêu đề
  ├── ServiceOptionsSection.tsx     gỡ ô ảnh vỡ + copy độn, sửa xuống dòng
  ├── ServiceChecklistSection.tsx   đổi tiêu đề, đổi thành dải mảnh
  ├── ServiceDescriptionSection.tsx sửa thuật ngữ
  ├── BookingSidebar.tsx            thống nhất "thợ", giảm nhãn uppercase
  └── NearbyProviderSelector.tsx    trạng thái rỗng nói được việc cần làm
features/customer-service/pages/
  └── CustomerServiceDetailPage.tsx nhịp điệu section
```

## Các bước

1. **Gỡ ô ảnh vỡ ở tuỳ chọn.** Tuỳ chọn không có ảnh thì **không dựng khung ảnh**.
   Chỉ hiện khung khi `option.image` tồn tại. Ô `image_not_supported` xám hiện
   trên mọi tuỳ chọn đọc như trang đang lỗi.
2. **Gỡ copy độn.** `option.description || "Tùy chọn bổ sung cho dịch vụ này."` →
   không có mô tả thì **không render dòng đó**. Chỗ trống tốt hơn chữ vô nghĩa.
3. **Sửa bố cục hàng tuỳ chọn:** tên và giá không được đâm vào nhau. Tên chiếm
   phần co giãn được, giá `shrink-0` căn phải, `tabular-nums`. Kiểm với tên dài
   nhất trong dữ liệu thật ("Từ 80 - 120 mét vuông").
4. **Đổi tiêu đề `ServiceChecklistSection`** từ "Danh mục công việc" sang đúng
   bản chất, ví dụ "Đơn nào cũng có". Đồng thời chuyển từ thẻ trắng sang **dải
   mảnh** để phá chuỗi 5 thẻ giống nhau, và dùng chung ngôn ngữ với `TrustStrip`
   ở trang chủ (đợt trước) để hai trang nói cùng một điều.
5. **Thống nhất thuật ngữ về "thợ"** trên toàn trang. Trang chủ, FAQ và trang
   Giới thiệu đã dùng "thợ" sau đợt trước. Grep `provider`/`Provider`/`chuyên gia`
   trong chuỗi hiển thị của `features/customer-service` và đổi hết.
   ⚠️ **Chỉ đổi chuỗi hiển thị.** Không đổi tên biến, tên hàm, key API.
6. **Nhịp điệu section.** Năm khối liên tiếp cùng khuôn `rounded-xl bg-surface-
   container-lowest p-5 shadow-sm`. Giữ thẻ cho khối cần tách bạch (tuỳ chọn, vì
   nó tương tác được), bỏ thẻ cho khối chỉ là chữ (mô tả) và dùng khoảng trắng +
   đường kẻ thay thế. Mục tiêu: mắt phân biệt được đâu là chỗ cần thao tác.
7. **Giảm nhãn uppercase** trong màn hình đầu từ 4 xuống tối đa 2.
8. **Trạng thái rỗng của "Các chuyên gia phụ trách"** phải nói được người dùng
   cần làm gì tiếp theo, không phải một ô viền đứt. Với khách chưa đăng nhập:
   nêu rõ cần đăng nhập và chọn địa chỉ mới tìm được thợ gần.
9. **Chuyển động mức 3:** chỉ phản hồi khi chọn/bỏ chọn tuỳ chọn và khi giá tạm
   tính đổi. Không reveal khi cuộn, không hiệu ứng trang trí.
10. Build + lint + chụp ảnh đối chiếu desktop/mobile.

## Todo

- [ ] Tuỳ chọn không có ảnh → không dựng khung ảnh
- [ ] Gỡ copy độn "Tùy chọn bổ sung cho dịch vụ này."
- [ ] Sửa xuống dòng tên tuỳ chọn / va chạm với cột giá
- [ ] Đổi tiêu đề "Danh mục công việc", chuyển sang dải mảnh
- [ ] Thống nhất "thợ" trong mọi chuỗi hiển thị
- [ ] Phá chuỗi 5 thẻ trắng giống nhau
- [ ] Nhãn uppercase màn hình đầu ≤ 2
- [ ] Trạng thái rỗng của khối thợ nói được bước tiếp theo
- [ ] Build xanh + ESLint 0 lỗi + ảnh đối chiếu

## Tiêu chí hoàn thành

- `grep -rn "Tùy chọn bổ sung cho dịch vụ này" src/` → 0
- Không ô `image_not_supported` nào trên trang chi tiết của cả 16 dịch vụ
- `grep -rn "provider\|Provider\|chuyên gia" src/features/customer-service` →
  không còn trong chuỗi hiển thị (còn trong tên biến/API là chấp nhận được)
- Tên tuỳ chọn dài nhất không đâm vào cột giá ở 390px và 1440px
- Luồng đặt lịch chạy đúng như trước: chọn tuỳ chọn → giá tạm tính đổi → đặt được

## Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Đổi thuật ngữ đụng nhầm tên biến hoặc key API | **Cao** | Chỉ sửa trong JSX text và chuỗi trong tệp `data`. Chạy build sau mỗi tệp |
| Bỏ thẻ trắng làm mất ranh giới giữa các khối | Trung bình | Giữ thẻ cho khối tương tác được; kiểm bằng mắt trên ảnh chụp |
| Sửa `ServiceOptionsSection` làm vỡ chọn tuỳ chọn | **Cao** | Chỉ đụng phần trình bày, không đụng `onToggleOption` / `selectedOptionIds`; test tay luồng đặt đơn |

## Bảo mật

- Không hiện số điện thoại hay địa chỉ chi tiết của thợ ở trang công khai
- Không log `serviceId`, `addressId` ra console

## Bước kế tiếp

Độc lập với Phase 1. Xong cả hai → Phase 3.
