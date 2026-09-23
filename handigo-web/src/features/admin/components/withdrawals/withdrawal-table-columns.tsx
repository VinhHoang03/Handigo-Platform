import { StatusBadge } from "@/components/common/StatusBadge";
import type { DataTableColumn } from "@/components/common/dashboard/DataTable";
import type { AdminWithdrawal, WithdrawalStatus } from "../../types/admin.types";

export const withdrawalFilterOptions: Array<{ label: string; value: WithdrawalStatus | "" }> = [
  { label: "Tất cả", value: "" },
  { label: "Chờ duyệt", value: "pending" },
  { label: "Lịch sử đã duyệt", value: "approved" },
  { label: "Từ chối", value: "rejected" },
];

export const withdrawalMoney = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export const withdrawalDateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
});

export const bankText = (withdrawal: AdminWithdrawal) => {
  const bank = withdrawal.bankAccountId;
  if (!bank || typeof bank === "string") return "Chưa có thông tin tài khoản";
  return `${bank.bankName} - ${bank.accountNumber}`;
};

/** Cột dùng chung cho bảng danh sách — trang tự thêm cột "Thao tác". */
export const withdrawalTableColumns: Array<DataTableColumn<AdminWithdrawal>> = [
  {
    key: "provider",
    header: "Nhà cung cấp",
    render: (item) => (
      <>
        <p className="font-semibold">{item.userId.fullName}</p>
        <p className="text-sm text-on-surface-variant">{item.userId.email}</p>
      </>
    ),
  },
  {
    key: "bank",
    header: "Tài khoản nhận",
    render: (item) => bankText(item),
  },
  {
    key: "amount",
    header: "Số tiền",
    className: "font-bold tabular-nums",
    render: (item) => withdrawalMoney.format(item.amount),
  },
  {
    key: "createdAt",
    header: "Ngày tạo",
    className: "tabular-nums",
    render: (item) => withdrawalDateTime.format(new Date(item.createdAt)),
  },
  {
    key: "status",
    header: "Trạng thái",
    render: (item) => <StatusBadge value={item.status} />,
  },
];
