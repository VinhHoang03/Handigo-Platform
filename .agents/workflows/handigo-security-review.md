# Handigo Security Review Workflow

## Purpose

Đánh giá thay đổi hoặc module Handigo theo rủi ro bảo mật thực tế: auth, authorization, dữ liệu nhạy cảm, upload, payment, secret và trust boundary.

## When To Use It

Dùng cho review auth, admin/provider/customer permission, upload/OCR, payment/wallet, webhook, socket, config deploy hoặc endpoint public.

## Inputs

- Module hoặc diff cần review.
- Role được phép thao tác.
- Dữ liệu nhạy cảm liên quan.
- Entry point: route, socket event, page, webhook.

## Expected Outputs

- Findings bảo mật theo severity.
- Kịch bản khai thác hoặc misuse cụ thể.
- Gợi ý sửa theo pattern repo.

## Step-by-step Process

1. Xác định trust boundary: client, API, socket, webhook, upload, third-party service.
2. Kiểm tra route/socket có auth và role đúng không.
3. Kiểm tra service có ownership check bằng dữ liệu server-side không.
4. Kiểm tra input validation, file validation và rate limit nếu có upload/OCR.
5. Kiểm tra response/log không lộ secret, token, password, internal note.
6. Kiểm tra webhook/payment có verify và chống duplicate/replay theo pattern hiện có.
7. Kiểm tra CORS/cookie/JWT/env nếu thay đổi deploy hoặc auth.

## Validation Checklist

- Không dùng dữ liệu client để quyết định quyền.
- Không đọc/sửa `.env` thật.
- Không hard-code secret hoặc credential.
- Refresh token, OTP, password hash không bị trả về/log.
- Socket join room luôn qua service permission check.

## Completion Criteria

- Rủi ro bảo mật chính đã được liệt kê hoặc xác nhận không thấy.
- Mỗi finding có vị trí và cách sửa cụ thể.

