# Handigo Implement API Workflow

## Purpose

Thêm hoặc sửa API backend Handigo theo kiến trúc Express/TypeScript/Mongoose hiện có.

## When To Use It

Dùng khi tạo endpoint, sửa route/controller/service, thêm validation, thêm middleware hoặc kết nối API với frontend.

## Inputs

- Endpoint hoặc hành vi API cần có.
- Role được phép gọi.
- Request/response contract.
- Model/service liên quan.

## Expected Outputs

- Route, validation, controller, service được cập nhật đúng layer.
- Auth/authorization và ownership check đầy đủ.
- Build backend pass hoặc lỗi được báo rõ.
- Tài liệu contract cập nhật nếu cần.

## Step-by-step Process

1. Tìm module API tương tự trong `handigo-backend/src`.
2. Kiểm tra route group đã mount trong `src/app.ts` chưa.
3. Tạo hoặc sửa Zod schema trong `validations`.
4. Thêm nghiệp vụ trong `services`, dùng `AppError` cho lỗi nghiệp vụ.
5. Controller chỉ đọc `req`, gọi service và trả response.
6. Route gắn `validate`, `authMiddleware`, `roleMiddleware` theo nhu cầu.
7. Nếu frontend gọi API, cập nhật file `features/<feature>/api`.
8. Chạy `npm run build` trong `handigo-backend`.

## Validation Checklist

- Input được validate trước khi ghi DB.
- User hiện tại lấy từ `req.user`, không lấy từ body/query tùy ý.
- Không trả dữ liệu nhạy cảm.
- Status code và response shape nhất quán với module.
- Query có xử lý not found, soft delete và quyền truy cập.

## Completion Criteria

- API hoạt động theo contract.
- Không phá route hiện có.
- Backend build pass hoặc lỗi ngoài scope được ghi rõ.

