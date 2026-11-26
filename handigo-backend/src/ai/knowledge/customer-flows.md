# Luồng khách hàng bổ sung trong agent

Các thao tác ghi dùng xác nhận bằng nút, kiểm tra lại quyền/điều kiện trước ghi và ledger chống thực hiện lặp. Lỗi chưa xác định kết quả phải đối soát hành động cũ trước khi ghi tiếp. Không đổi route, schema hoặc enum của API nghiệp vụ.

| Luồng | Ngoại lệ chính |
| --- | --- |
| Báo cáo hành vi trên đơn/cuộc trò chuyện; báo cáo ứng dụng | Sai chủ sở hữu; không có cuộc trò chuyện; thiếu mô tả/ảnh; ảnh khác phiên; hồ sơ kết thúc hoặc xác minh riêng; lỗi ghi chưa rõ; không kết luận vi phạm hoặc hoàn tiền |
| Hướng dẫn dời lịch và giờ thợ đến | Đề nghị chờ chưa đổi lịch; đề nghị hết hạn; GPS cũ/thiếu; định tuyến lỗi; thợ đã tới hoặc thay phân công; không cam kết giờ đến |
| Rút tiền và tra yêu cầu | Chưa có ngân hàng hoạt động; ngân hàng người khác; thông tin nhận thay đổi; vượt giới hạn; thiếu số dư; hai yêu cầu đồng thời; mất phản hồi; không duyệt/hủy thay admin |
| Xóa địa chỉ/đổi mặc định | Chọn nhầm mục; mục người khác/đã xóa; phiên bản thay đổi; địa chỉ đang dùng trong bản nháp; đổi mặc định đồng thời; không đổi địa chỉ đơn đã tạo |
| Tư vấn sự cố và đề xuất dịch vụ | Ống cấp khác ống thoát; gãy/rò khác tắc; không có bài; nguồn/catalog lỗi; chưa nhận diện thiết bị; nguy hiểm ưu tiên an toàn; thiếu thợ; ảnh mờ hoặc khác mục đích |

Agent chỉ hướng dẫn báo cáo ngoài ngữ cảnh đơn/cuộc trò chuyện tại màn hình Báo cáo; không nhận danh tính thợ tùy ý từ model. Ảnh của hồ sơ phải do khách chọn và tải trong đúng phiên. Chỉ đọc tài khoản ngân hàng của chính khách và trả số đã che. Không trả người duyệt, ghi chú nội bộ hoặc dữ liệu gateway thô.

## Kiểm tra

Trong `handigo-backend`, chạy:

```powershell
node --test --test-reporter=spec tests/agent-customer-flows.test.cjs tests/agent-authorization.test.cjs tests/agent-customer-expansion.test.cjs tests/repair-advice.test.cjs tests/repair-news.test.cjs tests/manual-address.test.cjs tests/voucher-wallet.test.cjs tests/wallet-deposit-qr.test.cjs
node --test --test-reporter=spec tests/agent-customer-flows.integration.test.cjs
npm run build
```

Test tích hợp dùng replica MongoDB tạm và gateway giả, không tải `.env`. Runtime test ngoài dự án cần có `mongodb-memory-server`; mặc định tại thư mục tạm `handigo-agent-customer-test-runtime`, hoặc truyền đường dẫn bằng `AGENT_CUSTOMER_TEST_RUNTIME`.

Trong `handigo-web`, chạy test `tests/agent-customer-flows.test.cjs`, ESLint cho hai file chatbot đã sửa và TypeScript/build. Test giao diện dùng component thật để kiểm tra bản xác nhận ngân hàng, báo cáo, địa chỉ và bản hết hạn.

## Đồng bộ kho kiến thức khi triển khai

Nguồn nội bộ đã có mã ổn định cho báo cáo, rút tiền, dời lịch và thời gian thợ đến. Khi dùng nguồn tĩnh, bản code mới có hiệu lực sau triển khai. Nếu bật kho Atlas, cần nhập lại nguồn đã duyệt và chạy worker để công bố phiên bản mới; không mặc định graph/index tự cập nhật.

Trong tiến trình đã được cấu hình kết nối, dùng người duyệt nguồn thực tế:

```powershell
npm run ai:knowledge -- enqueue-builtins --approved-by="ma-nguoi-duyet-nguon"
npm run ai:knowledge -- worker --watch
npm run ai:knowledge -- status
```

Chờ công việc hoàn tất và kiểm tra truy vấn dời lịch, giờ thợ đến, rút tiền, báo cáo hành vi và xóa địa chỉ trả nguồn mới trước khi mở luồng cho khách. Không dùng lời khách hoặc tài liệu cũ để bỏ quyền, điều kiện, xác nhận hay đối soát. Phiên `langgraph-readonly` vẫn chỉ tra cứu; các thao tác mới cần engine có quyền ghi và policy công cụ được bật.
