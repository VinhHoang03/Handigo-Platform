# Handigo Refactor Code Workflow

## Purpose

Cải thiện cấu trúc code Handigo mà không đổi hành vi, API contract, schema hoặc UI output ngoài mục tiêu refactor.

## When To Use It

Dùng khi giảm trùng lặp, tách hàm/component, chuyển logic về đúng layer, cải thiện type hoặc làm code dễ bảo trì.

## Inputs

- Khu vực cần refactor.
- Ràng buộc hành vi phải giữ nguyên.
- Lý do refactor: readability, duplication, type safety, separation of concerns.

## Expected Outputs

- Code sạch hơn, scope nhỏ.
- Hành vi public giữ nguyên.
- Build/lint liên quan pass.
- Tóm tắt điểm đổi cấu trúc.

## Step-by-step Process

1. Đọc các call site trước khi sửa.
2. Ghi nhận contract cần giữ: route, props, response, schema, enum, field name.
3. Chọn refactor nhỏ nhất tạo giá trị rõ.
4. Không format hàng loạt hoặc đổi tên file/public API nếu không cần.
5. Backend: giữ route/controller/service/model/validation đúng trách nhiệm.
6. Frontend: giữ component/common và feature boundaries hiện có.
7. Chạy build/lint để bắt lỗi type hoặc import.

## Validation Checklist

- Không đổi status code, response shape, route path hoặc field name.
- Không đổi schema/index/default/required ngoài yêu cầu.
- Không làm mất auth/authorization/validation.
- Không tạo abstraction mới nếu chưa giảm độ phức tạp thật.
- Diff tập trung vào file liên quan.

## Completion Criteria

- Hành vi trước/sau tương đương.
- Code dễ đọc hơn hoặc giảm trùng lặp có thể chỉ ra rõ.
- Không có lỗi build/lint liên quan.

