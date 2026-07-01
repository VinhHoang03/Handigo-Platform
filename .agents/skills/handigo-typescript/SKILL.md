---
name: handigo-typescript
description: Hướng dẫn TypeScript cho Handigo backend và web. Dùng khi sửa type, interface, import alias, strict mode, React component props, Mongoose document type hoặc dữ liệu API trong repo.
---

# Handigo TypeScript

## Backend

- Backend bật `strict: true` trong `handigo-backend/tsconfig.json`.
- Dùng CommonJS khi build backend.
- Giữ type gần domain đang dùng: model type ở `models`, request input từ `validations`, response type ở service khi cần.
- Không dùng `any` nếu có thể mô tả type cụ thể; chỉ dùng khi tương thích với code hiện có hoặc thư viện trả dữ liệu động.
- Với Mongoose, giữ pattern `interface ... extends Document` hoặc model type sẵn có trong file.
- Với `req.user`, dùng shape đã khai báo trong `auth.middleware.ts`.

## Frontend

- Frontend dùng TypeScript với JSX `react-jsx`.
- Alias `@/*` trỏ tới `handigo-web/src/*`.
- Type theo feature đặt trong `features/<feature>/types` nếu đã có.
- Props component nên khai báo rõ bằng `type` hoặc inline type ngắn.
- Không tạo type trùng nếu feature đã có type tương ứng.

## Kiểm tra trước khi kết thúc

- Backend: chạy `npm run build` trong `handigo-backend` khi sửa TypeScript backend.
- Frontend: chạy `npm run build` hoặc `npm run lint` trong `handigo-web` khi sửa TypeScript/React.
- Nếu không chạy được lệnh kiểm tra, ghi rõ lý do.

