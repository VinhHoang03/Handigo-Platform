---
name: handigo-realtime-socket
description: Hướng dẫn realtime Socket.IO của Handigo. Dùng khi sửa chat, notification realtime, order tracking, socket auth, socket rooms/events hoặc tích hợp socket ở web/mobile.
---

# Handigo Realtime Socket

## Backend socket

- Socket được khởi tạo trong `handigo-backend/src/sockets/initSocket.ts`.
- `server.ts` tạo HTTP server rồi gọi `initSocket(server)`.
- Socket auth dùng access token ở `socket.handshake.auth.token`.
- User socket được kiểm tra bằng JWT, database user, `isDeleted: false`, `status !== "locked"`.

## Room và event hiện có

- User room: `user:<userId>`.
- Conversation room: `conversation:<conversationId>`.
- Order room: `order:<orderId>`.
- Event chat: `conversation:join`, `message:send`, `conversation:seen`, `message:new`, `message:seen`.
- Event tracking: `order:tracking:join`, `order:location:update`, `order:location`.

## Quy tắc sửa realtime

- Trước khi join room, luôn kiểm tra quyền qua service.
- Không emit dữ liệu nhạy cảm hoặc dữ liệu ngoài quyền user.
- Callback socket nên trả `{ success, data?, message? }` theo pattern hiện có.
- Khi thêm event mới, cập nhật cả server và client hook/component tương ứng.
- Frontend hiện có hook chat trong `features/chat/hooks/useChatSocket.ts`.

