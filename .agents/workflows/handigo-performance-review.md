# Handigo Performance Review Workflow

## Purpose

Đánh giá hiệu năng Handigo trên API, MongoDB, realtime và frontend mà không tối ưu đoán mò.

## When To Use It

Dùng khi endpoint/page chậm, query nặng, render lag, socket nhiều event, upload/OCR chậm hoặc build/frontend bundle có dấu hiệu vấn đề.

## Inputs

- Khu vực cần review.
- Dấu hiệu chậm hoặc metric nếu có.
- Dữ liệu/traffic giả định nếu đã biết.

## Expected Outputs

- Bottleneck có bằng chứng hoặc giả thuyết kiểm chứng được.
- Đề xuất tối ưu theo mức rủi ro thấp trước.
- Validation plan sau tối ưu.

## Step-by-step Process

1. Xác định path nóng: route/service/query/component/socket event.
2. Tìm thao tác lặp: query trong loop, populate dư, render lại nhiều, request waterfall.
3. Kiểm tra MongoDB query có filter/index phù hợp và giới hạn dữ liệu không.
4. Kiểm tra API có pagination/search/filter thay vì trả toàn bộ dữ liệu lớn không.
5. Kiểm tra frontend có gọi API lặp, state global không cần, list không phân trang.
6. Kiểm tra socket event có emit quá rộng room hoặc gửi payload lớn không.
7. Đề xuất thay đổi nhỏ, đo được; tránh rewrite lớn nếu chưa có bằng chứng.

## Validation Checklist

- Có baseline hoặc lý do rõ nếu chưa đo được.
- Không tối ưu bằng cách bỏ validation/authz.
- Không thêm cache làm sai dữ liệu quyền user.
- Không tạo index/migration rủi ro cao nếu chưa có kế hoạch.
- UI vẫn đúng empty/loading/error state.

## Completion Criteria

- Bottleneck/rủi ro hiệu năng được mô tả rõ.
- Có bước kiểm chứng sau thay đổi.
- Không có tối ưu mơ hồ hoặc đổi behavior không cần.

