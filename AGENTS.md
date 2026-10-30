# AGENTS.md - Handigo AI Engineering Rules

## Project Context

Handigo là nền tảng kết nối khách hàng và provider dịch vụ tại nhà.

### Roles

- ADMIN
- CUSTOMER (default)
- PROVIDER (có Provider Profile riêng)

### Tech Stack

Backend

- Node.js
- Express.js
- TypeScript
- MongoDB / Mongoose
- JWT
- Socket.IO
- Zod
- Cloudinary
- PayOS
- Google Vision OCR

Frontend

- React
- Vite
- TypeScript
- Tailwind CSS
- Zustand
- Axios
- React Router

---

# General Principles

- Luôn phân tích codebase hiện có trước khi đề xuất hoặc sửa đổi.
- Ưu tiên tái sử dụng code, module, service và component hiện có.
- Chỉ sửa đúng phạm vi được yêu cầu.
- Không mở rộng phạm vi công việc nếu chưa được yêu cầu.
- Không tự ý đổi business logic, API contract, schema, enum, route hoặc field name.
- Không rewrite hoặc format hàng loạt khi chỉ cần sửa một phần nhỏ.
- Không tạo abstraction mới nếu pattern hiện tại vẫn phù hợp.
- Không thêm dependency nếu chưa thực sự cần thiết.
- Không tự ý cập nhật package hoặc framework.
- Không đọc hoặc sửa `.env`, secret, token hoặc credential.
- Không hard-code dữ liệu nhạy cảm.
- Không dùng Git nếu chưa được yêu cầu rõ, bao gồm cả lệnh chỉ đọc như `git status`, `git diff`, `git log`, `git show`, `git branch`.

---

# Analysis Before Coding

Trước khi sửa hoặc tạo code:

- Phân tích module liên quan.
- Xác định file cần sửa.
- Xác định ảnh hưởng tới backend, frontend và database.
- Giữ backward compatibility nếu không có yêu cầu thay đổi.
- Nếu chưa đủ thông tin, hỏi thay vì tự suy đoán.

---

# Existing Project First

Luôn ưu tiên:

- Pattern hiện có.
- Utility hiện có.
- Shared component hiện có.
- Shared middleware hiện có.
- Shared service hiện có.
- Shared hook hiện có.
- Shared validation hiện có.

Không tạo implementation mới nếu project đã có giải pháp tương tự.

---

# Language Rules

Toàn bộ nội dung hướng tới dự án phải sử dụng tiếng Việt có dấu, bao gồm:

- Comment
- Error message
- Validation message
- Label UI
- Documentation
- Markdown
- Log mô tả nghiệp vụ

Tên biến, tên hàm, tên class và tên file vẫn tuân theo quy ước lập trình hiện có.

---

# Git Safety

Mặc định không sử dụng bất kỳ lệnh Git nào nếu user chưa yêu cầu rõ. Quy tắc này áp dụng cả lệnh đọc và lệnh ghi để tránh tốn token/usage không cần thiết.

Không tự chạy:

- `git status`
- `git diff`
- `git log`
- `git show`
- `git branch`
- `git ls-files`
- `git check-ignore`
- `git blame`

Không sử dụng trong mọi trường hợp nếu chưa có yêu cầu trực tiếp và rõ ràng:

- git reset --hard
- git checkout --
- git clean -fd
- revert hoặc xóa hàng loạt

Không tạo commit nếu chưa được yêu cầu.

Không thêm build, cache hoặc file tạm vào commit.

Khi cần kiểm tra file đã sửa, ưu tiên đọc trực tiếp file liên quan hoặc chạy validation cụ thể như build, lint, typecheck theo phạm vi task. Không dùng Git để tự động xác nhận diff/trạng thái sau khi sửa.

---

# Backend Rules

- Controller chỉ xử lý request và response.
- Business logic nằm trong Service.
- Validation phải thực hiện trước khi ghi database.
- Không tin dữ liệu gửi từ client.
- User hiện tại luôn lấy từ Authentication Middleware.
- Route cần bảo vệ phải kiểm tra Authentication và Authorization.
- Không trả về dữ liệu nhạy cảm.
- Password phải hash theo cơ chế hiện có.
- Secret luôn lấy từ config hoặc environment.

---

# API Contract

Không tự ý thay đổi:

- Response shape
- HTTP Status Code
- Field name
- Enum
- Route
- Pagination format
- Error response format

Nếu bắt buộc thay đổi, phải chỉ rõ tất cả module bị ảnh hưởng.

---

# Authorization Rules

- CUSTOMER là role mặc định.
- PROVIDER phải có Provider Profile hợp lệ.
- ADMIN route phải kiểm tra quyền ADMIN.
- Người dùng chỉ thao tác tài nguyên của chính mình nếu không có quyền quản trị.
- Không tin role, userId hoặc providerId gửi từ client.

---

# MongoDB Rules

- Không tự ý thay đổi schema hiện có.
- Field mới phải tương thích với dữ liệu cũ.
- Không xóa field cũ nếu chưa có migration.
- Cập nhật document phải bật validation.
- Kiểm tra index khi thay đổi query hoặc filter.
- Đồng bộ schema, validation và API khi thêm field.

---

# Frontend Rules

- Tuân theo cấu trúc feature hiện có.
- Tái sử dụng component trước khi tạo component mới.
- Sử dụng API client chung.
- Không duplicate logic.
- Luôn xử lý Loading, Error và Empty State.
- Giữ UI nhất quán với Design System của dự án.

---

# Security Rules

Luôn kiểm tra:

- Authentication
- Authorization
- Ownership
- Upload validation
- Input validation
- Sensitive data exposure
- Payment verification
- Webhook verification
- Socket permission

Không tin bất kỳ dữ liệu nào từ client nếu chưa được xác thực.

---

# AI Working Rules

## Sử dụng Graphify

- Với mỗi nhiệm vụ phân tích, sửa hoặc review code, tra Graphify trước để xác định module liên quan và phạm vi ảnh hưởng. Không cần tra graph cho câu hỏi chung hoặc thay đổi văn bản không liên quan tới code.
- Chạy từ thư mục gốc dự án, dùng graph tại `graphify-out/graph.json`: `graphify query "<chủ đề hoặc tên thành phần>"`, `graphify explain "<tên thành phần>"`, hoặc `graphify path "<A>" "<B>"` theo nhu cầu.
- Chỉ truy vấn phần liên quan; không đọc toàn bộ `graph.json` hoặc báo cáo lớn vào ngữ cảnh. Đọc code thực tế để xác minh kết quả trước khi kết luận hoặc sửa đổi.
- Nếu lệnh không khả dụng, graph thiếu, cũ hoặc không bao phủ phần cần tìm, nêu rõ giới hạn và tiếp tục kiểm tra trực tiếp code; không suy diễn rằng thành phần không tồn tại chỉ vì graph không tìm thấy.
- Khi cần tạo hoặc cập nhật graph, dùng phạm vi loại trừ trong `.graphifyignore` và chế độ code-only. Không tự cài hook hoặc chạy chức năng Graphify gọi Git khi chưa được phép theo mục Git Safety.
- Sau khi thay đổi code, nếu watch đang chạy thì chờ cập nhật hoàn tất trước khi tra lại; nếu chưa cập nhật được thì ghi rõ graph có thể cũ. Không mặc định rằng cài Graphify hoặc MCP đồng nghĩa graph tự cập nhật.
- Trong báo cáo hoàn thành nhiệm vụ liên quan tới code, nêu ngắn gọn truy vấn Graphify đã dùng hoặc lý do không dùng được.

## Quy trình thực hiện

Mặc định:

1. Phân tích trước khi code.
2. Chỉ sửa file cần thiết.
3. Giữ thay đổi nhỏ nhất có thể.
4. Không tạo code trùng lặp.
5. Không phá vỡ API hoặc business logic.
6. Tuân theo Skills và Workflows của repository.
7. Sau khi hoàn thành, tự kiểm tra:
   - Coding style
   - Type safety
   - Validation
   - Security
   - Regression risk
   - Ảnh hưởng tới module khác

Nếu phát hiện giả định chưa được xác minh, phải nêu rõ thay vì tự quyết định.
