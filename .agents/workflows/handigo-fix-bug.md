# Handigo Fix Bug Workflow

## Purpose

Tái hiện, cô lập nguyên nhân và sửa lỗi trong Handigo mà không tạo regression hoặc refactor ngoài phạm vi.

## When To Use It

Dùng cho bug, regression, lỗi runtime, lỗi build, sai dữ liệu, sai quyền, sai UI state hoặc lỗi tích hợp API.

## Inputs

- Mô tả lỗi, bước tái hiện, log hoặc ảnh chụp nếu có.
- Môi trường xảy ra lỗi: backend, web, deploy, socket, payment, upload.
- Kết quả mong đợi và kết quả thực tế.

## Expected Outputs

- Root cause cụ thể.
- Patch nhỏ nhất xử lý lỗi.
- Kiểm tra chứng minh lỗi đã được xử lý.
- Ghi chú rủi ro còn lại nếu chưa thể kiểm chứng hết.

## Step-by-step Process

1. Xác định phạm vi lỗi và module liên quan.
2. Tái hiện hoặc mô phỏng bằng cách đọc luồng code nếu không thể chạy app.
3. Lần theo dữ liệu từ entrypoint: route/page -> controller/component -> service/API -> model/store.
4. Xác định nguyên nhân trước khi sửa.
5. Sửa nhỏ nhất tại layer đúng trách nhiệm.
6. Nếu lỗi liên quan auth/permission, kiểm tra cả backend và frontend guard.
7. Nếu lỗi liên quan database, kiểm tra dữ liệu cũ, soft delete, enum, index và validator.
8. Chạy kiểm tra tập trung cho module bị sửa.

## Validation Checklist

- Có nguyên nhân cụ thể, không chỉ phỏng đoán.
- Không che lỗi bằng catch rỗng hoặc fallback mơ hồ.
- Không bỏ qua validation/authz để làm lỗi biến mất.
- Không thay đổi business logic không liên quan.
- Luồng lỗi chính và luồng thành công đều được kiểm tra.

## Completion Criteria

- Lỗi được sửa tại đúng layer.
- Không có thay đổi lan rộng không cần thiết.
- Có bằng chứng kiểm chứng: command, build, manual check hoặc phân tích code rõ ràng.

