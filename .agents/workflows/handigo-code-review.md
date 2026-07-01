# Handigo Code Review Workflow

## Purpose

Review thay đổi Handigo để phát hiện bug, regression, thiếu test, sai quyền hoặc sai contract trước khi merge.

## When To Use It

Dùng khi user yêu cầu review diff, PR, branch, implementation hoặc kiểm tra thay đổi vừa làm.

## Inputs

- Diff do user cung cấp hoặc danh sách file cần review.
- Mục tiêu thay đổi nếu có.
- Khu vực rủi ro cần chú ý.

## Expected Outputs

- Findings trước, theo mức độ nghiêm trọng.
- Mỗi finding có vị trí file/dòng, tác động và kịch bản lỗi.
- Test gaps và residual risk nếu không có finding.

## Step-by-step Process

1. Xác định change surface bằng diff user cung cấp hoặc file user chỉ định.
   - Không tự chạy `git diff`, `git status`, `git log` hoặc lệnh Git khác nếu user chưa yêu cầu rõ.
2. Đọc code liên quan chưa sửa nhưng bị ảnh hưởng.
3. Kiểm tra contract: route, response, schema, enum, props, env.
4. Kiểm tra auth/authz/ownership.
5. Kiểm tra validation, error path, empty state, null/undefined, race condition.
6. Kiểm tra test hoặc validation có đủ khóa regression không.
7. Chỉ nêu style nếu dẫn tới bug hoặc khó bảo trì đáng kể.

## Validation Checklist

- Findings có bằng chứng cụ thể.
- Không bỏ qua dữ liệu cũ và role khác.
- Không nhầm frontend guard là bảo mật backend.
- Không bỏ qua payment/wallet/order state nếu liên quan.
- Không nêu nhận xét mơ hồ không hành động được.

## Completion Criteria

- User có danh sách rủi ro rõ để sửa.
- Nếu không có issue, nói rõ không thấy finding và còn thiếu kiểm tra nào.
