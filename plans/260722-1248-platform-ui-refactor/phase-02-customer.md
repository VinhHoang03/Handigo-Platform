# Phase 2 — Trang khách hàng

**Ưu tiên:** Cao · **Trạng thái:** ✅ Xong (`d0cad37`; `BookingDetailPage` + route split ở `c547c3e`) · **Phụ thuộc:** Phase 0

Luồng tạo ra doanh thu: tìm dịch vụ → đặt → thanh toán → theo dõi → đánh giá.
Đây là phase **rủi ro cao nhất** của toàn plan.

## Liên kết

- [plan.md](plan.md) · [Phase 0](phase-00-shared-foundation.md)

## Kết quả khảo sát

| Nhóm | File | >200 dòng | bg/text-white | glass-card | "Đang tải" |
|---|---|---|---|---|---|
| `booking` | 7 | **7/7** | 20 | 7 | 3 |
| `customer-service` | 5 | 4 | 26 | 0 | 4 |
| `customer` | 2 | 2 | 9 | 0 | 1 |
| `wallet` | 2 | 1 | 0 | 0 | 1 |
| `notification` | 1 | 1 | 0 | 0 | 1 |
| `profile` | 4 | 4 | 4 | 0 | 3 |
| `tracking` | 1 | 1 | 2 | 1 | 0 |
| `chat` ⁺ | 5 | 2 | — | 0 | 1 |
| `chatbot` ⁺ | 5 | 0 | — | 0 | 1 |
| `case-management` ⁺ | 4 | 2 | — | 0 | 1 |

**`booking` không có file nào dưới 200 dòng.**

⁺ *Bổ sung khi verify plan (2026-07-22): 3 nhóm này bị sót khỏi khảo sát ban đầu.
Chúng thuộc luồng khách hàng (chat gắn với đơn hàng, khiếu nại, chatbot hỗ trợ)
nên gộp vào phase này.*

## File liên quan (sắp theo rủi ro giảm dần)

| File | Dòng | Ghi chú |
|---|---|---|
| `booking/pages/BookingDetailPage.tsx` | **1911** | ⚠️ Rủi ro cao nhất toàn dự án |
| `customer-service/pages/CustomerServiceDetailPage.tsx` | 931 | Trang chọn dịch vụ + tuỳ chọn giá |
| `notification/pages/NotificationsPage.tsx` | 685 | |
| `customer/pages/CustomerProfilePage.tsx` | 681 | |
| `booking/pages/CreateBookingStep2Page.tsx` | 628 | |
| `booking/pages/ConfirmPaymentPage.tsx` | 594 | ⚠️ Đụng PayOS |
| `wallet/pages/WalletPage.tsx` | 559 | ⚠️ Đụng số dư tiền |
| `tracking/components/OrderTrackingMap.tsx` | 849 | Leaflet, nhiều side-effect |
| `profile/components/AddressBookModal.tsx` | 724 | |
| `profile/components/UserProfileSection.tsx` | 630 | |
| `customer-service/pages/PublicProviderProfilePage.tsx` | 486 | |
| `customer-service/pages/CustomerServiceListPage.tsx` | 327 | |
| `booking/pages/CreateBookingStep1Page.tsx` | 275 | |
| `booking/pages/BookingSuccessPage.tsx` | 248 | |
| `booking/pages/BookingHistoryPage.tsx` | 200 | |
| `case-management/pages/CaseManagementPage.tsx` | 318 | ⁺ Bổ sung khi verify |
| `case-management/components/CreateCaseModal.tsx` | 238 | ⁺ |
| `chat/components/MessageThread.tsx` | 244 | ⁺ |
| `chat/components/ChatPopup.tsx` | 222 | ⁺ |

## Thứ tự thực hiện (quan trọng)

Làm từ **thấp rủi ro → cao rủi ro** để tích luỹ hiểu biết về codebase trước khi
chạm vào file 1911 dòng:

1. `BookingHistoryPage` (200) → `BookingSuccessPage` (248) → `CreateBookingStep1Page` (275)
2. `CustomerServiceListPage` (327) → `PublicProviderProfilePage` (486)
2b. ⁺ Nhóm bổ sung, rủi ro thấp-trung bình: `ChatPopup` (222) → `MessageThread` (244)
    → `CreateCaseModal` (238) → `CaseManagementPage` (318). Kèm theo: gỡ
    `ui-avatars` trong `MessageCenter`, skeleton cho `CaseDetailModal` + `ChatbotPanel`
3. `NotificationsPage` (685) → `CustomerProfilePage` (681) → `AddressBookModal` (724)
4. `WalletPage` (559) → `ConfirmPaymentPage` (594) ⚠️ test thanh toán kỹ
5. `CreateBookingStep2Page` (628) → `CustomerServiceDetailPage` (931)
6. `OrderTrackingMap` (849) — tách riêng, nhiều side-effect Leaflet
7. **`BookingDetailPage` (1911) — làm cuối cùng**

## Ghi chú riêng cho `BookingDetailPage.tsx`

Trang này gộp: chi tiết đơn, trạng thái, thanh toán, hoàn tiền, khiếu nại, chat,
đánh giá. Đề xuất tách theo **khối nghiệp vụ**, không theo khối giao diện:

```
booking/pages/BookingDetailPage.tsx        ← chỉ còn bố cục + điều phối
booking/components/detail/
  ├── BookingStatusTimeline.tsx
  ├── BookingServiceSummary.tsx
  ├── BookingPaymentPanel.tsx      ⚠️ đụng tiền
  ├── BookingRefundPanel.tsx       ⚠️ đụng tiền
  ├── BookingComplaintPanel.tsx
  └── BookingFeedbackPanel.tsx
```

**Bắt buộc:** tách từng khối một, build + test tay sau mỗi khối. Không tách cả
7 khối rồi mới chạy thử.

## Todo

- [ ] Tách 15 file theo đúng thứ tự rủi ro ở trên (+ 4 file nhóm ⁺: 2 `chat`, 2 `case-management`)
- [ ] `bg-white`/`text-white` → token (57 chỗ trong nhóm này)
- [ ] Gỡ 7 `glass-card` trong `booking`
- [ ] Thay text tải thô ở tầng trang bằng skeleton (xem định nghĩa metric trong plan.md — không đếm `aria-label`)
- [ ] Thay `ui-avatars.com` còn lại trong nhóm bằng `InitialsAvatar` (`BookingDetailPage`, `chat/MessageCenter`)
- [ ] Định dạng tiền tệ nhất quán (`tabular-nums` + `Intl.NumberFormat('vi-VN')`)
- [ ] Test tay: đặt đơn → thanh toán → theo dõi → đánh giá
- [ ] Build xanh + ESLint 0 lỗi

## Tiêu chí hoàn thành

- Không còn file > 200 dòng trong `booking`, `customer-service`, `customer`, `wallet`, `profile`, `notification`, `chat`, `chatbot`, `case-management`
- Luồng đặt đơn hoàn chỉnh chạy được từ đầu tới cuối, không lỗi console
- Số tiền hiển thị đúng định dạng Việt Nam ở mọi trang
- Không còn `ui-avatars.com` trong nhóm này

## Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Tách `BookingDetailPage` làm sai luồng thanh toán/hoàn tiền | **Rất cao** | Làm cuối cùng, tách từng khối, test tay sau mỗi khối, commit nhỏ |
| `ConfirmPaymentPage` + PayOS: đổi UI làm hỏng callback return/cancel | **Cao** | Không đụng logic URL redirect; test bằng đơn thật ở sandbox |
| `WalletPage` hiển thị sai số dư sau refactor | **Cao** | Đối chiếu số hiển thị với response API trước/sau |
| `OrderTrackingMap` — Leaflet cleanup sai gây rò bộ nhớ | Trung bình | Giữ nguyên `useEffect` cleanup, chỉ đụng phần trình bày |

## Bảo mật

- **Không** đưa số tài khoản, mã giao dịch PayOS đầy đủ ra UI hoặc `console.log`
- Giữ nguyên kiểm tra quyền sở hữu đơn hàng — refactor UI không được bỏ điều kiện
  render dựa trên vai trò
- Không cache dữ liệu ví/thanh toán vào `localStorage` khi refactor state

## Bước kế tiếp

Độc lập với Phase 1, 3, 4.
