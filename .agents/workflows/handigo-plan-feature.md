# Handigo Plan Feature Workflow

## Purpose

Lập kế hoạch triển khai tính năng Handigo đủ rõ để agent khác có thể thực hiện mà không phải quyết định lại kiến trúc chính.

## When To Use It

Dùng trước tính năng lớn, thay đổi nhiều module, thay đổi API/schema, payment, auth, provider workflow hoặc realtime.

## Inputs

- Mục tiêu sản phẩm.
- Role và quyền liên quan.
- Module bị ảnh hưởng nếu đã biết.
- Ràng buộc về API, database, UI, deploy hoặc thời gian.

## Expected Outputs

- Plan có scope, non-goals, assumptions, dependencies.
- Phân rã backend/frontend/database/documentation.
- Acceptance criteria có thể kiểm chứng.
- Rủi ro và cách giảm rủi ro.

## Step-by-step Process

1. Đọc `ARCHITECTURE.md`, module tương tự và route/page hiện có.
2. Xác định mục tiêu cụ thể và phần không làm.
3. Xác định dữ liệu cần đọc/ghi và quyền từng role.
4. Chọn hướng tích hợp theo pattern hiện có thay vì tạo kiến trúc mới.
5. Chia việc theo thứ tự: schema/contract -> backend -> frontend -> validation -> docs.
6. Đặt checkpoint cho thay đổi rủi ro cao như migration, payment, auth, socket.
7. Viết acceptance criteria theo hành vi, không theo hoạt động.

## Validation Checklist

- Plan nêu rõ file/module dự kiến.
- Không còn câu hỏi chặn triển khai an toàn.
- Có chiến lược validation cho backend và frontend.
- Có xử lý dữ liệu cũ nếu schema thay đổi.
- Có rollback/fallback nếu deploy hoặc migration rủi ro.

## Completion Criteria

- Implementer có thể bắt đầu làm ngay.
- Scope và acceptance criteria đủ rõ để review.
- Rủi ro lớn đã có checkpoint hoặc mitigation.

