# Phase 3 — Trang thợ

**Ưu tiên:** Trung bình-cao · **Trạng thái:** ✅ Xong (`d30254e`) · **Phụ thuộc:** Phase 0

Nhóm có **mật độ vi phạm cao nhất** toàn dự án: 50 chỗ hardcode màu và 20 chỗ
`glass-card` — nhiều hơn bất kỳ nhóm nào khác.

## Liên kết

- [plan.md](plan.md) · [Phase 0](phase-00-shared-foundation.md)

## Kết quả khảo sát

| Nhóm | File | >200 dòng | bg/text-white | glass-card | ui-avatars | "Đang tải" |
|---|---|---|---|---|---|---|
| `provider` | 18 | **12** | **50** | **20** | 5 | 10 |
| `provider-application` | 7 | 5 | 2 | 1 | 0 | 3 |
| `bank-account` | 1 | 1 | 0 | 0 | 0 | 0 |
| `feedback` | 7 | 0 | 2 | 6 | 0 | 0 |

`feedback` là nhóm duy nhất **không có file nào vượt 200 dòng** — chỉ cần gỡ
6 `glass-card`.

## File liên quan

| File | Dòng | Ghi chú |
|---|---|---|
| `provider/pages/ProviderProfilePage.tsx` | **857** | |
| `provider/pages/ProviderOrderDetailPage.tsx` | 724 | ⚠️ Đụng luồng nhận/hoàn thành việc |
| `provider/pages/ProviderHomePage.tsx` | 705 | Dùng `provider-status-marquee` |
| `provider-application/components/ProviderDescriptionStep.tsx` | 678 | |
| `provider-application/components/ProviderApplicationHistory.tsx` | 546 | |
| `provider/components/ProviderProfileForms.tsx` | 520 | |
| `bank-account/pages/ProviderBankAccountsPage.tsx` | 513 | ⚠️ Đụng số tài khoản |
| `provider-application/pages/RegisterProviderPage.tsx` | 346 | |
| `provider/pages/ProviderOrdersPage.tsx` | 214 | |
| `service-suggestion/pages/ProviderServiceSuggestionPage.tsx` | 205 | ⁺ Bổ sung khi verify plan (22-07) — nằm ngoài `features/provider` nên khảo sát ban đầu sót |
| `provider/pages/ProviderSchedulePage.tsx` | 175 | Đã đạt chuẩn |
| `provider/components/ProviderFeedbackSection.tsx` | — | Dùng `TestimonialCard` từ `components/home` |

## Nợ kỹ thuật đáng chú ý

**`ProviderFeedbackSection.tsx` import `TestimonialCard` từ `@/components/home/HomeCards`.**
Component trang chủ bị dùng lại ở trang thợ → sửa landing có nguy cơ vỡ trang thợ
(đã suýt xảy ra khi gỡ prop `hasQuoteIcon` ở vòng landing). Nên chuyển
`TestimonialCard` lên `components/common/` vì nó không còn thuộc riêng trang chủ.

Ngoài ra file này truyền `img={customer?.avatar || DEFAULT_AVATAR}` — kiểm tra
`DEFAULT_AVATAR` có phải URL `ui-avatars.com` không; nếu có thì bỏ hẳn, để
`InitialsAvatar` tự xử lý.

## Các bước

1. **Chuyển `TestimonialCard` → `components/common/`**, cập nhật 2 nơi import.
   Làm trước để tách được ràng buộc home ↔ provider.
2. **Gỡ 20 `glass-card` trong `provider`** — thay bằng `bg-surface-container-lowest`
   + viền mảnh. Đây là nhóm chiếm hơn nửa tổng số `glass-card` toàn app.
3. **50 chỗ `bg-white`/`text-white` → token.** Nhiều nhất dự án.
4. Tách 18 file > 200 dòng, ưu tiên `ProviderProfilePage` (857) và
   `ProviderOrderDetailPage` (724).
5. **`ProviderHomePage`** — kiểm tra `provider-status-marquee`. `index.css` đã có
   `@media (prefers-reduced-motion: reduce)` cho class này; giữ nguyên.
6. Thay 10 chỗ `"Đang tải"` bằng skeleton; 5 file `ui-avatars` → `InitialsAvatar`.

## Todo

- [ ] Chuyển `TestimonialCard` sang `components/common/`
- [ ] Kiểm tra & gỡ `DEFAULT_AVATAR` trong `ProviderFeedbackSection`
- [ ] Gỡ 20 `glass-card` (`provider`) + 6 (`feedback`) + 1 (`provider-application`)
- [ ] 50 chỗ `bg-white`/`text-white` → token
- [ ] Tách 18 file > 200 dòng (+ `ProviderServiceSuggestionPage` 205 ⁺)
- [ ] 5 file `ui-avatars.com` → `InitialsAvatar`
- [ ] 10 chỗ `"Đang tải"` → skeleton
- [ ] Test tay: nhận việc → cập nhật tiến độ → hoàn thành → nhận tiền
- [ ] Build xanh + ESLint 0 lỗi

## Tiêu chí hoàn thành

- `grep -ro 'glass-card' src/features/provider src/features/feedback` → 0
- Không còn file > 200 dòng trong 4 nhóm này + `ProviderServiceSuggestionPage`
- `TestimonialCard` không còn nằm trong `components/home`
- Luồng nhận việc → hoàn thành chạy đúng

## Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| `ProviderOrderDetailPage`: đổi UI làm sai chuyển trạng thái đơn | **Cao** | Test tay đủ các trạng thái đơn |
| `ProviderBankAccountsPage`: lộ/sai số tài khoản | **Cao** | Giữ nguyên logic che số; chỉ đụng trình bày |
| Chuyển `TestimonialCard` làm vỡ trang chủ | Trung bình | Sửa cả 2 nơi import trong cùng một commit, build ngay |

## Bảo mật

- Số tài khoản ngân hàng phải giữ nguyên cách che (chỉ hiện 4 số cuối)
- Không hiển thị thông tin liên hệ khách hàng trước khi thợ nhận việc — kiểm tra
  điều kiện render còn nguyên sau khi tách file
- Ảnh CCCD/giấy tờ trong hồ sơ đăng ký thợ: không đặt vào thẻ `<img>` có URL đoán được

## Bước kế tiếp

Độc lập với Phase 1, 2, 4.
