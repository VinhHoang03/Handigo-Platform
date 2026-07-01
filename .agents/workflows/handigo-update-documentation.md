# Handigo Update Documentation Workflow

## Purpose

Cập nhật tài liệu Handigo để phản ánh đúng code hiện tại, không ghi suy đoán hoặc thông tin không tồn tại trong repo.

## When To Use It

Dùng khi đổi kiến trúc, API, biến môi trường, deploy, workflow, model, setup hoặc thêm module lớn.

## Inputs

- Nội dung/code thay đổi.
- File tài liệu cần cập nhật nếu đã biết.
- Đối tượng đọc: developer, deployer, AI agent, reviewer.

## Expected Outputs

- Tài liệu ngắn gọn, đúng code hiện tại.
- Không chứa secret hoặc `.env` thật.
- Có đường dẫn/file/module cụ thể khi cần.

## Step-by-step Process

1. Đọc code/tài liệu nguồn trước khi viết.
2. Xác định tài liệu phù hợp: `README.md`, `ARCHITECTURE.md`, `DEPLOYMENT.md`, docs module hoặc workflow.
3. Chỉ ghi những gì tồn tại trong repo hoặc được user xác nhận.
4. Dùng tiếng Việt có dấu cho tài liệu dự án.
5. Cập nhật section liên quan, không rewrite toàn bộ nếu chỉ cần sửa nhỏ.
6. Kiểm tra link/path/command có đúng thư mục không.

## Validation Checklist

- Không mô tả mobile app nếu repo chưa có app mobile thật.
- Không đưa secret/token/credential vào tài liệu.
- Command khớp `package.json`.
- Kiến trúc khớp folder/file hiện có.
- Nội dung không mâu thuẫn với AGENTS rules.

## Completion Criteria

- Tài liệu đủ để người/agent làm đúng bước tiếp theo.
- Không có thông tin bịa hoặc stale rõ ràng.
- Diff tài liệu đúng scope.

