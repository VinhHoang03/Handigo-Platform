---
name: handigo-code-review
description: Review code Handigo theo rủi ro thực tế. Dùng khi review diff, PR, implementation hoặc thay đổi backend/frontend/mobile dựa trên conventions, auth, API contract, MongoDB, payment, realtime và UI của repo này.
---

# Handigo Code Review

## Cách review

1. Xác định file thay đổi và domain bị ảnh hưởng.
2. So sánh với pattern hiện có trong cùng module.
3. Ưu tiên finding về bug, security, regression, data loss, thiếu authz, sai API contract, thiếu validation.
4. Không nêu nit style nếu không gây rủi ro thật.
5. Dẫn file/dòng cụ thể khi có thể.

## Điểm rủi ro cao

- Route thiếu `authMiddleware` hoặc `roleMiddleware`.
- Service tin `userId`, `providerId`, `role` từ client.
- Response lộ `passwordHash`, token, internal note hoặc dữ liệu user khác.
- Mongoose update thiếu validator ở nơi cần `{ new: true, runValidators: true }`.
- Thay đổi enum/status/field làm hỏng dữ liệu cũ hoặc frontend hiện có.
- Payment/wallet/order update không đồng bộ trạng thái.
- Socket event không kiểm tra quyền truy cập conversation/order.
- Frontend RouteGuard bị xem là kiểm soát quyền duy nhất.

## Format trả lời review

- Findings trước, theo mức độ nghiêm trọng.
- Mỗi finding gồm: vấn đề, tác động, vị trí, kịch bản lỗi.
- Nếu không có finding, nói rõ không thấy lỗi và nêu phần chưa kiểm chứng nếu có.

