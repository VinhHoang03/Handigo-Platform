# Handigo Add Feature Workflow

## Purpose

Thêm một tính năng mới vào Handigo theo đúng kiến trúc hiện có, không mở rộng scope hoặc đổi contract ngoài yêu cầu.

## When To Use It

Dùng khi user yêu cầu thêm tính năng có thể ảnh hưởng backend, frontend, hoặc cả hai.

## Inputs

- Mô tả hành vi mong muốn.
- Role liên quan: `CUSTOMER`, `PROVIDER`, `ADMIN`.
- API/page/module bị ảnh hưởng nếu đã biết.
- Acceptance criteria hoặc luồng nghiệp vụ mong muốn.

## Expected Outputs

- Code thay đổi đúng scope trong `handigo-backend` và/hoặc `handigo-web`.
- Validation, auth, ownership check và UI state phù hợp.
- Tài liệu cập nhật nếu có contract hoặc workflow mới.
- Kết quả build/lint/test hoặc lý do chưa chạy được.

## Step-by-step Process

1. Đọc `ARCHITECTURE.md`, `AGENTS.md` và module tương tự trong repo.
2. Xác định domain: auth, booking, provider, admin, wallet, feedback, chat, notification, service hoặc content.
3. Xác định contract hiện có trước khi sửa route, schema, enum hoặc field name.
4. Nếu cần backend, đi theo thứ tự: validation -> service -> controller -> route -> mount route nếu cần.
5. Nếu cần frontend, đi theo thứ tự: type -> API client theo feature -> state/hook -> page/component -> route guard.
6. Bảo vệ route bằng `authMiddleware`, `roleMiddleware` và ownership check trong service.
7. Chỉ thêm field/schema/dependency khi thật sự cần và tương thích dữ liệu cũ.
8. Chạy kiểm tra phù hợp: backend `npm run build`, frontend `npm run build` hoặc `npm run lint`.
9. Cập nhật tài liệu liên quan nếu có endpoint, biến môi trường, luồng deploy hoặc workflow mới.

## Validation Checklist

- Không đổi API contract ngoài scope.
- Không tin `role`, `userId`, `providerId`, `isAdmin`, `isVerified` từ client.
- Response không lộ password, token, secret hoặc internal note.
- Message/UI mới dùng tiếng Việt có dấu nếu hướng tới user.
- Frontend dùng `src/api/client.ts` và type hiện có.
- Backend giữ controller mỏng, nghiệp vụ trong service.

## Completion Criteria

- Tính năng chạy đúng luồng chính và luồng lỗi quan trọng.
- Build/lint liên quan pass hoặc lỗi được báo rõ.
- Chỉ file liên quan bị thay đổi.
- Tài liệu/contract liên quan đã cập nhật nếu cần.

