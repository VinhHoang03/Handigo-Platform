# Handigo Generate Tests Workflow

## Purpose

Tạo hoặc đề xuất test cho Handigo theo rủi ro thực tế, không tự thêm test framework hoặc dependency khi chưa cần.

## When To Use It

Dùng khi thêm test cho bug fix, API, service, UI, auth, payment, database migration hoặc regression quan trọng.

## Inputs

- Hành vi cần test.
- File/module thay đổi.
- Rủi ro cần khóa lại.
- Test framework hiện có hoặc yêu cầu cụ thể của user.

## Expected Outputs

- Test tập trung vào behavior/risk.
- Hoặc plan test/manual verification nếu repo chưa có hạ tầng test phù hợp.
- Command kiểm tra được chạy hoặc lý do chưa chạy được.

## Step-by-step Process

1. Kiểm tra `package.json` của backend/frontend để xác định test framework thật sự có hay không.
2. Nếu có test framework, tìm pattern test hiện có trước khi viết test mới.
3. Nếu chưa có framework, không tự thêm dependency trừ khi user yêu cầu; đề xuất test strategy hoặc dùng build/lint/manual verification.
4. Chọn test có giá trị cao: authz, validation, payment state, schema migration, UI route guard, regression bug.
5. Viết test nhỏ, deterministic, không phụ thuộc secret hoặc dịch vụ ngoài thật.
6. Mock network, payment, email, OAuth, Cloudinary, Google Vision khi cần.
7. Chạy test/build/lint phù hợp.

## Validation Checklist

- Test fail được nếu bug quay lại.
- Không test implementation detail rỗng.
- Không dùng credential thật hoặc `.env` thật.
- Không thêm dependency nếu chưa có quyết định.
- Manual verification rõ ràng nếu không có test tự động.

## Completion Criteria

- Có test tự động pass, hoặc có test plan cụ thể phù hợp tình trạng repo.
- Rủi ro chính đã được kiểm tra.
- Kết quả command được báo lại.

