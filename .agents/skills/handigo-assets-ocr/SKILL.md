---
name: handigo-assets-ocr
description: Hướng dẫn upload asset và OCR trong Handigo. Dùng khi sửa Cloudinary, Multer, provider/admin assets, provider application OCR, Google Vision OCR hoặc file upload backend/frontend.
---

# Handigo Assets OCR

## Upload asset

- Middleware upload nằm trong `handigo-backend/src/middlewares`.
- Các middleware chuyên biệt hiện có: admin asset, provider asset, provider application asset, order attachment, feedback upload, cloudinary, multer.
- Route asset hiện có: `/admin/assets`, `/provider-assets`, `/provider-application-assets`.
- Không hard-code credential Cloudinary; dùng env/config hiện có.

## OCR

- Module OCR nằm trong `handigo-backend/src/modules/ocr`.
- Có service, controller, routes, types và upload riêng cho OCR.
- Script test OCR nằm ở `src/scripts/testGoogleVisionOcr.ts`.
- Tài liệu setup hiện có: `GOOGLE_VISION_OCR_SETUP.md`.

## Quy tắc an toàn

- Validate loại file, kích thước và quyền user trước khi upload/xử lý.
- Không trả đường dẫn nội bộ hoặc metadata nhạy cảm.
- Khi OCR provider application, kiểm tra rate limit/middleware hiện có.
- Không đọc hoặc ghi credential thật; chỉ dùng `.env.example` khi cần tài liệu hóa.

