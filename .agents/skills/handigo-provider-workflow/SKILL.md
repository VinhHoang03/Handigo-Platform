---
name: handigo-provider-workflow
description: Hướng dẫn workflow provider của Handigo. Dùng khi sửa đăng ký provider, provider profile, provider application, admin duyệt hồ sơ, khu vực hoạt động, service suggestion, order assignment hoặc provider dashboard.
---

# Handigo Provider Workflow

## Domain chính

- Provider application: đăng ký trở thành provider, hồ sơ/chứng chỉ, OCR, admin review.
- Provider profile: thông tin provider, dịch vụ, khu vực hoạt động.
- Provider order: nhận assignment, xử lý đơn, lịch làm việc.
- Service suggestion: provider đề xuất dịch vụ.

## Backend liên quan

- Routes: `providerApplication.routes.ts`, `provider.routes.ts`, `providerAsset.routes.ts`, `providerApplicationAsset.routes.ts`, `serviceSuggestion.routes.ts`, `order.routes.ts`.
- Controllers/services/models cùng domain trong `controllers`, `services`, `models`.
- Helper khu vực provider nằm trong `utils/providerArea.ts`.
- Validation provider nằm trong `validations/provider*.ts`.

## Frontend liên quan

- `features/provider-application`
- `features/provider`
- `features/service-suggestion`
- `features/admin/pages/AdminProviderApplicationsPage.tsx`
- `features/admin/components/applications`

## Quy tắc

- CUSTOMER là role mặc định; không tự nâng role thành PROVIDER nếu chưa qua workflow hợp lệ.
- Khi duyệt provider, kiểm tra provider document/profile và trạng thái application.
- Không tin serviceIds, working areas hoặc providerId từ client nếu user không có quyền.
- Với admin review, giữ lịch sử review nếu module hiện có đang lưu.

