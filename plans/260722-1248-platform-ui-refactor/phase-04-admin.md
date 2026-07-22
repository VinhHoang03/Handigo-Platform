# Phase 4 — Trang quản trị

**Ưu tiên:** Trung bình · **Trạng thái:** ☐ Chưa bắt đầu · **Phụ thuộc:** Phase 0

15 trang admin — nhóm đông trang nhất nhưng ít người dùng nhất. Ưu tiên **hiệu quả
thao tác** hơn thẩm mỹ: bảng dữ liệu, lọc, phân trang, hành động hàng loạt.

## Liên kết

- [plan.md](plan.md) · [Phase 0](phase-00-shared-foundation.md)

## Kết quả khảo sát

| Chỉ số | Giá trị |
|---|---|
| File `.tsx` | 23 |
| File > 200 dòng | **11** |
| `bg-white`/`text-white` | 18 |
| `glass-card` | **0** ✓ |
| `ui-avatars.com` | 2 file |
| `"Đang tải"` text thô | **13** — cao nhất dự án |

Admin **không dùng `glass-card`** — sạch hơn nhóm thợ về mặt này. Vấn đề chính là
kích thước file và trạng thái tải.

## File liên quan

| File | Dòng |
|---|---|
| `admin/pages/AdminServicesPage.tsx` | **967** |
| `admin/pages/AdminSystemConfigsPage.tsx` | 858 |
| `admin/pages/AdminSupportPage.tsx` | 822 |
| `admin/pages/AdminPromotionsPage.tsx` | 719 |
| `admin/pages/AdminProviderApplicationsPage.tsx` | 633 |
| `admin/pages/AdminCategoryServicesPage.tsx` | 491 |
| `admin/pages/AdminNewsPage.tsx` | 444 |
| `admin/pages/AdminCategoriesPage.tsx` | 412 |
| `admin/pages/AdminWithdrawalsPage.tsx` | 335 | ⚠️ Duyệt rút tiền |
| `admin/pages/AdminRevenuePage.tsx` | 311 |
| `admin/pages/AdminCasesPage.tsx` | 264 |
| `admin/pages/AdminUsersPage.tsx` | 78 | ✓ |
| `admin/pages/AdminDashboardPage.tsx` | 72 | ✓ |
| `admin/pages/AdminPaymentsPage.tsx` | 66 | ✓ |
| `admin/pages/AdminWalletsPage.tsx` | 64 | ✓ |
| `admin/components/users/UserTable.tsx` | — | `ui-avatars` |
| `admin/components/applications/ApplicationList.tsx` | — | `ui-avatars` |

4 trang đã dưới 200 dòng — mô hình tốt để noi theo khi tách 11 trang còn lại.

## Cơ hội DRY lớn nhất

11 trang admin đều theo cùng một khuôn: **tiêu đề → bộ lọc → bảng → phân trang →
modal sửa/xoá**. Hiện mỗi trang tự dựng lại khuôn này.

Đề xuất trích ra:

```
components/common/dashboard/
  ├── DataTable.tsx        header, sort, hàng, trạng thái rỗng
  ├── TableToolbar.tsx     tìm kiếm + lọc + hành động hàng loạt
  └── TableSkeleton.tsx    skeleton đúng số cột
```

Đã có sẵn `components/common/Pagination.tsx` và thư mục `common/dashboard/` —
**kiểm tra trước xem đã có `DataTable` chưa rồi hãy tạo.**

Làm được việc này thì 11 trang admin rút ngắn đáng kể mà không cần tách thủ công
từng trang.

## Các bước

1. **Khảo sát `components/common/dashboard/`** xem đã có gì. Không tạo trùng.
2. **Trích `DataTable` + `TableToolbar` + `TableSkeleton`** từ một trang đơn giản
   trước (gợi ý: `AdminCasesPage` 264 dòng), kiểm chứng, rồi mới nhân rộng.
3. Áp dụng lần lượt cho 11 trang, **mỗi trang một commit**.
4. Thay 13 chỗ `"Đang tải"` bằng `TableSkeleton`.
5. 2 file `ui-avatars` → `InitialsAvatar`.
6. `bg-white` → `bg-surface-container-lowest` (18 chỗ).
7. Bảng số liệu: thêm `tabular-nums` cho mọi cột số/tiền/ngày.

## Todo

- [ ] Khảo sát `common/dashboard/` trước khi tạo mới
- [ ] Trích `DataTable`, `TableToolbar`, `TableSkeleton`
- [ ] Kiểm chứng trên `AdminCasesPage` trước
- [ ] Áp dụng cho 11 trang còn lại (mỗi trang 1 commit)
- [ ] 13 chỗ `"Đang tải"` → `TableSkeleton`
- [ ] 2 file `ui-avatars` → `InitialsAvatar`
- [ ] 18 chỗ `bg-white` → token
- [ ] `tabular-nums` cho mọi cột số
- [ ] Build xanh + ESLint 0 lỗi

## Tiêu chí hoàn thành

- Không còn file > 200 dòng trong `features/admin`
- 11 trang bảng dùng chung `DataTable`, không copy-paste khuôn bảng
- Mọi bảng có skeleton + trạng thái rỗng
- Cột số thẳng hàng nhờ `tabular-nums`

## Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| `DataTable` gom quá sớm, không đủ linh hoạt cho 11 trang | **Cao** | Kiểm chứng trên 1 trang rồi 1 trang phức tạp, mới nhân rộng. Sẵn sàng cho phép override |
| `AdminWithdrawalsPage`: đổi UI làm duyệt nhầm lệnh rút tiền | **Cao** | Giữ nguyên `ConfirmDialog` trước mọi hành động duyệt/từ chối |
| `AdminSystemConfigsPage` (858): đổi form làm sai cấu hình hệ thống | Trung bình | Đối chiếu payload gửi lên trước/sau refactor |

## Bảo mật

- **Quan trọng nhất phase này:** admin có quyền cao nhất. Khi tách file, kiểm tra
  mọi điều kiện `RouteGuard` / kiểm tra vai trò còn nguyên — không được để lộ
  hành động admin cho vai trò khác do render sai điều kiện.
- Không hiển thị đầy đủ số tài khoản, CCCD người dùng trong bảng danh sách
- Hành động phá huỷ (xoá, khoá tài khoản, duyệt rút tiền) phải giữ bước xác nhận
- Không log payload chứa dữ liệu cá nhân khi debug

## Bước kế tiếp

Độc lập với Phase 1, 2, 3.
