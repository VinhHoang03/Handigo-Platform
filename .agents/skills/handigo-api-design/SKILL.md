---
name: handigo-api-design
description: Hướng dẫn thiết kế API Handigo. Dùng khi thêm endpoint, đổi API contract, chuẩn hóa response, validation, pagination, authz, naming hoặc lập tài liệu API cho backend Express hiện có.
---

# Handigo API Design

## Nguyên tắc

- Không đổi business logic, route, field name, enum, status code hoặc response shape nếu không có yêu cầu rõ.
- API mới phải theo domain hiện có: auth, users, providers, services, orders, payments, wallets, notifications, feedback, admin.
- Controller chỉ xử lý request/response; nghiệp vụ nằm trong service.
- Validate input trước khi ghi database.

## Naming

- Route group dùng danh từ số nhiều hoặc pattern đang có: `/users`, `/orders`, `/providers`, `/wallets`.
- Giữ cách đặt file: `<domain>.routes.ts`, `<domain>.controller.ts`, `<domain>.service.ts`, `<domain>.validator.ts`.
- Nếu endpoint thuộc admin, ưu tiên route dưới `/admin` hoặc route admin hiện có.

## Response và lỗi

- Giữ response shape của module đang sửa.
- Lỗi nghiệp vụ dùng `AppError` trong service.
- Lỗi validation dùng Zod và middleware `validate`.
- Không trộn tiếng Anh/tiếng Việt trong cùng module khi thêm message mới; ưu tiên tiếng Việt có dấu.

## Tài liệu hóa

- Khi thêm nhóm API lớn, cập nhật tài liệu liên quan hoặc Postman README nếu repo đang dùng cho nhóm đó.
- Không đưa secret, token, credential hoặc `.env` thật vào ví dụ.

