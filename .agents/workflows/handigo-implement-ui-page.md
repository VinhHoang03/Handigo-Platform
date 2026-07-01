# Handigo Implement UI Page Workflow

## Purpose

Thêm hoặc sửa page/component trong frontend Handigo theo cấu trúc React/Vite/Tailwind hiện có.

## When To Use It

Dùng khi tạo page mới, sửa dashboard, form, danh sách, modal, RouteGuard, API integration hoặc UI state.

## Inputs

- Màn hình hoặc component cần triển khai.
- Role được truy cập.
- API cần gọi.
- State loading/error/empty/success.
- Design tham khảo nếu có trong `handigo-design` hoặc `handigo-web/stitch`.

## Expected Outputs

- Page/component đặt đúng feature.
- API/type/hook/component được tách hợp lý.
- Route được thêm trong `App.tsx` nếu cần.
- UI responsive và dùng tiếng Việt có dấu.

## Step-by-step Process

1. Tìm feature tương ứng trong `handigo-web/src/features`.
2. Tái sử dụng component trong `src/components/common` trước khi tạo mới.
3. Nếu cần API, thêm vào `features/<feature>/api` và dùng `src/api/client.ts`.
4. Nếu cần type, thêm vào `features/<feature>/types`.
5. Tạo page trong `features/<feature>/pages`.
6. Thêm route và `RouteGuard` với role phù hợp nếu là route mới.
7. Xử lý loading, error, empty state và permission redirect.
8. Chạy `npm run build` hoặc `npm run lint` trong `handigo-web`.

## Validation Checklist

- Không hard-code URL backend ngoài `VITE_API_BASE_URL`.
- Không dùng frontend guard thay cho backend authorization.
- Text user-facing dùng tiếng Việt có dấu.
- Layout không phụ thuộc dữ liệu mock nếu API thật đã có.
- Không tạo state global nếu local state đủ dùng.

## Completion Criteria

- Page/component render đúng luồng chính.
- API integration dùng client chung.
- Build/lint frontend pass hoặc lỗi được báo rõ.

