# AGENTS.md - Handigo Rules

## Project Context

Handigo là nền tảng kết nối khách hàng và provider dịch vụ tại nhà.

Roles:

- ADMIN
- CUSTOMER (default)
- PROVIDER (có provider profile riêng)

Tech stack:

- Node.js
- Express.js
- TypeScript
- MongoDB/Mongoose
- JWT
- React/Vite/Tailwind

---

# General Rules

- Không tự ý đổi business logic, API contract, schema, enum, route, field name.
- Không rewrite hoặc format hàng loạt khi chỉ cần sửa nhỏ.
- Chỉ sửa file liên quan.
- Giữ nguyên structure và coding style hiện có.
- Ưu tiên pattern đã tồn tại trong dự án.
- Không thêm dependency nếu không cần thiết.
- Không đọc/sửa `.env`, secret, token, credential.
- Không hard-code dữ liệu nhạy cảm.
- Không commit hoặc reset git nếu chưa được yêu cầu.
- Tất cả nội dung phản hồi, comment, log mô tả, tên biến business và tài liệu sinh ra cho dự án phải dùng tiếng Việt có dấu rõ ràng nếu không có yêu cầu khác.
- Khi generate hoặc sửa code cho project này, ưu tiên:
  - comment tiếng Việt có dấu
  - message/error tiếng Việt có dấu
  - label/UI tiếng Việt có dấu
  - tài liệu markdown tiếng Việt có dấu
- Không dùng tiếng Anh cho nội dung hướng tới người dùng cuối nếu hệ thống hiện tại đang dùng tiếng Việt.
- Giữ nhất quán ngôn ngữ trong cùng module/file.

---

# Git Safety

- Không dùng:
  - `git reset --hard`
  - `git checkout --`
  - revert/xóa hàng loạt
- Kiểm tra conflict trước khi sửa.
- Không đưa build/cache/log/temp file vào commit.

---

# Backend Rules

- Giữ nguyên response shape, status code và API contract.
- Controller chỉ xử lý request/response.
- Business logic nằm trong service.
- Validate input trước khi ghi DB.
- Không tin dữ liệu client:
  - role
  - userId
  - providerId
  - isAdmin
  - isVerified
- User hiện tại phải lấy từ auth/JWT middleware.
- Route cần bảo vệ phải có auth/authorization.
- Không trả dữ liệu nhạy cảm:
  - password
  - token
  - internal note
- Password phải hash theo cơ chế hiện có.
- Config/JWT secret lấy từ env/config.

---

# Roles & Authorization

- CUSTOMER là role mặc định.
- PROVIDER cần provider document/profile hợp lệ.
- ADMIN route phải check role ADMIN.
- User chỉ thao tác tài nguyên của chính mình trừ ADMIN.

---

# MongoDB & Mongoose

- Không tự đổi schema/index/default/required.
- Field mới phải compatible với dữ liệu cũ.
- Update ưu tiên:

```ts
{ new: true, runValidators: true }
```
