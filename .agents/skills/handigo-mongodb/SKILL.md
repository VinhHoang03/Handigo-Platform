---
name: handigo-mongodb
description: Hướng dẫn MongoDB/Mongoose cho Handigo. Dùng khi thêm, sửa, review model, schema, query, index, soft delete, populate, transaction hoặc migration trong `handigo-backend/src/models` và services liên quan.
---

# Handigo MongoDB

## Quy tắc schema

- Không tự đổi schema, enum, default, required, index hoặc collection name nếu không được yêu cầu.
- Field mới phải tương thích dữ liệu cũ.
- Dùng `models/common.ts` cho helper chung như `baseFields`, `objectIdRef`, `Money`, `ObjectId` khi phù hợp.
- Giữ soft delete theo pattern `isDeleted`, `deletedAt` nếu model/domain đang dùng.
- Không trả field nhạy cảm như `passwordHash`, token hash hoặc thông tin nội bộ.

## Query và update

- Luôn lọc `isDeleted: false` khi nghiệp vụ chỉ làm việc với bản ghi còn hiệu lực.
- Khi update document qua Mongoose query, ưu tiên `{ new: true, runValidators: true }`.
- Kiểm tra ownership bằng dữ liệu server-side: user từ JWT, provider profile/document từ database.
- Với dữ liệu tiền, trạng thái order/payment/wallet, tránh update nhiều collection nếu chưa hiểu đủ luồng nghiệp vụ.

## Migration và seed

- Script hiện có nằm trong `handigo-backend/src/scripts`.
- Không chạy migration/seed nếu user chưa yêu cầu.
- Nếu sửa script migration, đảm bảo script idempotent hoặc ghi rõ điều kiện chạy an toàn.

