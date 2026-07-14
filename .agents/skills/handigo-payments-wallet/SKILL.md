---
name: handigo-payments-wallet
description: Hướng dẫn module payment, wallet, withdrawal và PayOS của Handigo. Dùng khi sửa thanh toán đơn hàng, nạp ví, rút tiền, webhook, transaction, trạng thái payment/order/wallet hoặc review rủi ro tài chính.
---

# Handigo Payments Wallet

## Phạm vi

Các file liên quan thường nằm trong:

- `handigo-backend/src/services/payment.service.ts`
- `handigo-backend/src/services/wallet.service.ts`
- `handigo-backend/src/services/withdrawal.service.ts`
- `handigo-backend/src/models/payment.model.ts`
- `handigo-backend/src/models/wallet.model.ts`
- `handigo-backend/src/models/walletTransaction.model.ts`
- `handigo-backend/src/models/withdrawRequest.model.ts`
- Frontend feature `wallet`, `bank-account`, `booking`, `admin/withdrawals`.

## Quy tắc an toàn

- Không tự đổi trạng thái payment/order/wallet nếu chưa lần theo toàn bộ luồng.
- Chặn duplicate payment theo pattern hiện có.
- Kiểm tra ownership order trước khi tạo payment.
- Với ADMIN, vẫn kiểm tra quyền qua route/middleware.
- Không log API key PayOS, checksum key hoặc thông tin thanh toán nhạy cảm.
- Webhook phải verify theo config/service hiện có trước khi cập nhật dữ liệu.

## Khi sửa

1. Đọc model trạng thái liên quan trước.
2. Đọc service đang cập nhật nhiều collection.
3. Kiểm tra frontend đang kỳ vọng field nào.
4. Chạy build backend sau khi sửa TypeScript.
5. Nếu không có test tự động, mô tả manual verification cần làm.

