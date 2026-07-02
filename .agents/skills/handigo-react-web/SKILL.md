---
name: handigo-react-web
description: Hướng dẫn làm việc với frontend React/Vite/Tailwind của Handigo. Dùng khi thêm, sửa, debug hoặc review page, feature, component, route guard, API client, Zustand store, UI state trong `handigo-web`.
---

# Handigo React Web

## Cấu trúc

- Page theo domain ưu tiên đặt trong `src/features/<feature>/pages`.
- API theo feature đặt trong `src/features/<feature>/api`.
- Type theo feature đặt trong `src/features/<feature>/types`.
- Component dùng chung đặt trong `src/components/common`.
- Dùng alias `@` thay cho relative import dài khi phù hợp.

## Routing và auth

- Route chính nằm trong `src/App.tsx`.
- Route cần role dùng `RouteGuard`.
- Điều hướng theo role dùng helper trong `features/auth/utils/roleNavigation`.
- Không quyết định quyền chỉ ở frontend; backend vẫn phải enforce auth/authorization.

## API client

- Dùng Axios instance từ `src/api/client.ts`.
- Không tạo Axios client mới nếu không có lý do rõ.
- Access token được tự gắn vào `Authorization`.
- Refresh token dùng `/auth/refresh-token`, cookie `httpOnly` phía backend và `withCredentials: true`.

## UI và ngôn ngữ

- Giữ UI tiếng Việt có dấu cho nội dung hướng tới người dùng cuối.
- Dùng component/common hiện có trước khi tạo component mới.
- Giữ Tailwind token và style hiện có; tránh rewrite toàn bộ layout khi chỉ cần sửa nhỏ.

