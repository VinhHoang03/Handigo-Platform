# Tin tức Handigo ngày 30/10/2026

`articles.json` gồm 4 bài chuyển từ `content.data.ts` đã hoàn thiện thân bài và 4 bài hướng dẫn mới. Giữ nguyên slug, ảnh bìa và ngày xuất bản của 4 bài cũ. Tác giả hiển thị là Ban biên tập Handigo. Các bài kỹ thuật có liên kết nguồn chính thức ở cuối bài.

Nhập vào collection `news_articles`, có cả `content` dạng chữ thuần và `richContent` cho trình soạn thảo. Script kiểm tra Zod, Mongoose và đọc lại sau khi ghi. Người tạo kỹ thuật được gán cho tài khoản ADMIN đang hoạt động được tạo sớm nhất; không tạo hoặc sửa tài khoản.

Chạy từ thư mục `handigo-backend`:

```powershell
node -r ts-node/register src/scripts/importNewsArticles.ts --validate-only
node -r ts-node/register src/scripts/importNewsArticles.ts --load-env --database=FixNow
node -r ts-node/register src/scripts/importNewsArticles.ts --load-env --database=FixNow --apply
```

`--load-env` nạp cấu hình hiện có mà không hiển thị giá trị kết nối; chỉ dùng khi người vận hành cho phép. Nếu không có cờ này, script chỉ dùng cấu hình đã được cấp cho tiến trình. Tên database phải khớp với `--database`.

Mặc định chỉ xem trước. Khi ghi, chỉ thêm slug chưa tồn tại. Bài đã có, kể cả đã xóa mềm, được giữ nguyên. Có thể chạy lại sau khi gián đoạn mà không ghi đè bài đã biên tập. Kết quả ghi từng bài nằm trong `import-result.json`.

Website đọc danh sách và chi tiết từ API tin tức, không ghép trở lại bài tĩnh. Bài đã ẩn hoặc xóa trong admin sẽ không xuất hiện lại từ mã frontend.
