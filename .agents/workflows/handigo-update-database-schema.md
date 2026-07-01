# Handigo Update Database Schema Workflow

## Purpose

Thay đổi schema MongoDB/Mongoose của Handigo theo cách tương thích dữ liệu cũ và an toàn khi triển khai.

## When To Use It

Dùng khi thêm/sửa field, enum, index, relation, soft delete behavior, migration hoặc seed.

## Inputs

- Model cần đổi.
- Lý do đổi schema.
- Dữ liệu cũ cần tương thích.
- API/frontend phụ thuộc field đó.

## Expected Outputs

- Model/schema cập nhật đúng scope.
- Service/validation/API/frontend liên quan được cập nhật.
- Migration/seed script nếu cần.
- Ghi chú deploy/migration nếu có rủi ro.

## Step-by-step Process

1. Đọc model hiện có và các service/query liên quan.
2. Xác định field mới có cần default, optional, index hoặc migration không.
3. Ưu tiên thay đổi backward-compatible.
4. Không đổi enum/default/required/index hiện có nếu không bắt buộc.
5. Cập nhật validation và type frontend/backend tương ứng.
6. Nếu cần migration, tạo script trong `handigo-backend/src/scripts` theo pattern hiện có.
7. Chạy `npm run build` trong backend; chạy frontend build nếu contract ảnh hưởng UI.

## Validation Checklist

- Dữ liệu cũ không bị invalid vì required/default mới.
- Update query dùng `{ new: true, runValidators: true }` khi phù hợp.
- Query nghiệp vụ vẫn lọc `isDeleted: false` nếu cần.
- Không tạo index rủi ro cao mà không có kế hoạch migration.
- Không làm lệch API response mà frontend đang dùng.

## Completion Criteria

- Schema mới tương thích dữ liệu hiện có.
- Migration/seed có hướng dẫn chạy nếu cần.
- Các layer phụ thuộc đã đồng bộ.

