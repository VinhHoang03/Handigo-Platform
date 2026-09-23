# Phase 2 - Ba bảng thô về `DataTable`

## Context Links

- Plan: [plan.md](plan.md)
- Phân tích: `plans/reports/analysis-260723-1632-admin-refactor-va-chart.md` mục A2
- Component đích: `src/components/common/dashboard/DataTable.tsx`

## Overview

- **Priority:** Trung bình cao - giải quyết ba việc bằng một thay đổi
- **Status:** ⬜ Chưa bắt đầu
- Ba nơi tự viết `<table>` thô trong khi đã có `DataTable` dùng chung viết tốt.

## Key Insights

`DataTable` đã có JSDoc đầy đủ, xử lý cuộn ngang trong khung riêng (trang không
bao giờ cuộn ngang), empty state, `onRowClick`, `minWidthClassName`. **16 nơi
đang dùng.** Ba nơi bỏ qua nó:

| File | Dòng dài nhất |
|---|---|
| `admin/pages/AdminWalletsPage.tsx` | **3.425 ký tự** |
| `admin/pages/AdminPaymentsPage.tsx` | **2.098 ký tự** |
| `admin/components/users/UserTable.tsx` | - |

Đây chính là hai file có dòng dài nhất repo. Chúng đạt luật "<200 dòng" bằng cách
dồn toàn bộ JSX vào một dòng - đúng con số, phá đúng mục đích. Không đọc được,
không review được, không diff được.

Chuyển sang `DataTable` giải quyết đồng thời: DRY, độ dài dòng, và nhất quán
bảng biểu. **Ba việc, một thay đổi** - đây là lý do phase này đáng làm sớm.

Mẫu tham chiếu tốt sẵn có: `admin/components/withdrawals/withdrawal-table-columns.tsx`
tách phần định nghĩa cột ra file riêng, page chỉ còn lắp ráp.

## Requirements

**Chức năng**
- Ba nơi trên dùng `DataTable`, giữ **nguyên** cột, thứ tự cột, định dạng, hành vi.
- Định nghĩa cột tách ra file `*-table-columns.tsx` theo mẫu đang có.

**Phi chức năng**
- Không dòng nào vượt 200 ký tự.
- Không đổi API, không đổi tham số truy vấn, không đổi phân trang.

## Architecture

```
admin/pages/AdminPaymentsPage.tsx        → chỉ fetch + state + lắp ráp
admin/components/payments/
    payment-table-columns.tsx            (MỚI) định nghĩa cột
    PaymentDetailModal.tsx               (MỚI) tách modal chi tiết khỏi page

admin/pages/AdminWalletsPage.tsx         → tương tự
admin/components/wallets/
    wallet-table-columns.tsx             (MỚI)
    WalletDetailModal.tsx                (MỚI)

admin/components/users/UserTable.tsx     → dùng DataTable, cột tách ra
    user-table-columns.tsx               (MỚI)
```

`AdminPaymentsPage` hiện nhồi cả modal chi tiết vào một dòng cùng bảng. Tách modal
là điều kiện để phần bảng gọn lại được.

## Related Code Files

**Sửa**
- `src/features/admin/pages/AdminPaymentsPage.tsx`
- `src/features/admin/pages/AdminWalletsPage.tsx`
- `src/features/admin/components/users/UserTable.tsx`

**Tạo mới**
- `src/features/admin/components/payments/payment-table-columns.tsx`
- `src/features/admin/components/payments/PaymentDetailModal.tsx`
- `src/features/admin/components/wallets/wallet-table-columns.tsx`
- `src/features/admin/components/wallets/WalletDetailModal.tsx`
- `src/features/admin/components/users/user-table-columns.tsx`

**Đọc để tham chiếu**
- `src/components/common/dashboard/DataTable.tsx`
- `src/features/admin/components/withdrawals/withdrawal-table-columns.tsx` (mẫu tốt)

## Implementation Steps

1. **Chụp lại hành vi hiện tại trước khi sửa.** Mở `/admin/payments`,
   `/admin/wallets`, `/admin/users`; ghi lại danh sách cột, định dạng tiền/ngày,
   hành vi click dòng, nút trong dòng. Đây là bản đối chiếu khi nghiệm thu.
2. `UserTable` trước - nhỏ nhất, ít rủi ro nhất, dùng để làm quen khuôn.
3. `AdminWalletsPage`: tách modal chi tiết → tách cột → thay `<table>` bằng `DataTable`.
4. `AdminPaymentsPage`: như trên. Chú ý modal có nhánh hoàn tiền
   (`metadata.refund`) và nút "Thử hoàn tiền lại" - giữ nguyên logic.
5. Thêm `tabular-nums` cho cột tiền và ngày (JSDoc của `DataTable` có nhắc).
6. Đối chiếu với bản ghi ở bước 1.

## Todo List

- [ ] Ghi lại hành vi hiện tại của 3 bảng
- [ ] `UserTable` → `DataTable`
- [ ] Tách `WalletDetailModal` + cột, chuyển `AdminWalletsPage`
- [ ] Tách `PaymentDetailModal` + cột, chuyển `AdminPaymentsPage`
- [ ] Thêm `tabular-nums` cho cột số
- [ ] Đối chiếu hành vi, kiểm ở 360px
- [ ] `npx tsc -b` + `npm run lint` sạch

## Success Criteria

- `grep -rln "<table" src/features/admin` → 0.
- Không file admin nào có dòng > 200 ký tự.
- Ba trang hiển thị **đúng** cột và định dạng như trước khi sửa.
- Nút "Thử hoàn tiền lại" ở modal payment vẫn hoạt động.
- Bảng cuộn ngang trong khung riêng; trang không cuộn ngang ở 360px.

## Risk Assessment

| Rủi ro | Giảm thiểu |
|---|---|
| Mất cột hoặc đổi định dạng khi viết lại | Bước 1 ghi lại hành vi trước, đối chiếu sau |
| Logic hoàn tiền trong modal payment phức tạp, dễ gãy | Tách modal **nguyên trạng** trước, chuyển bảng sau - hai bước riêng |
| `DataTable` chưa đủ chỗ cho nhu cầu của 3 bảng này | Nếu thiếu thì **mở rộng `DataTable`**, không quay lại `<table>` thô |

## Security Considerations

`AdminPaymentsPage` hiển thị `customerId`, `orderId`, mã giao dịch cổng thanh
toán. Giữ nguyên mức hiển thị hiện tại - **không** thêm trường mới vào bảng khi
refactor. Nút "Thử hoàn tiền lại" gọi API thay đổi trạng thái tiền: giữ nguyên
điều kiện hiển thị (`failed`/`manual_review`/`retry_required`), không nới lỏng.

## Next Steps

Độc lập với chart. Có thể làm song song phase 0-1, nhưng cùng chạm
`AdminPaymentsPage`/`AdminWalletsPage` với phase 1 (em-dash) - **làm phase 1 trước**
để tránh sửa hai lần.
