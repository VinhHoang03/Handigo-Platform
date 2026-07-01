---
name: handigo-expo-mobile
description: Hướng dẫn chuẩn bị hoặc thêm ứng dụng Expo/React Native cho Handigo dựa trên backend và web hiện có. Dùng khi user yêu cầu mobile app, Expo, React Native, mobile authentication, mobile API integration hoặc chia sẻ contract với Handigo backend.
---

# Handigo Expo Mobile

## Trạng thái hiện tại

Repository hiện chưa có app Expo, React Native, Android native hoặc iOS native. Không giả định có thư mục mobile runtime nếu chưa được tạo.

## Khi thêm app Expo mới

1. Xác nhận vị trí thư mục app mobile với user nếu chưa rõ.
2. Dựa vào API contract backend hiện có, không tự đổi route hoặc response shape để phục vụ mobile.
3. Tái sử dụng domain hiện có: auth, booking, provider, wallet, notification, chat, tracking.
4. Đồng bộ role `CUSTOMER`, `PROVIDER`, `ADMIN` với backend.
5. Tách API client, token storage, navigation guard và feature modules tương tự web nhưng phù hợp mobile.

## Auth mobile

- Không lưu refresh token trong storage thường nếu backend đang dùng cookie web; cần thiết kế rõ cách mobile nhận và refresh token trước khi code.
- Access token phải được gửi bằng Bearer token.
- Không tin role/userId từ client; backend là nguồn quyết định quyền.

## Realtime mobile

- Nếu dùng Socket.IO client, gửi access token qua `socket.handshake.auth.token` như backend đang yêu cầu.
- Tôn trọng room/event hiện có: chat, conversation, order tracking.

