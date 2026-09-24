import { Eye } from "lucide-react";
import type { DataTableColumn } from "@/components/common/dashboard/DataTable";
import type { AdminWalletRow } from "../../types/adminOperations.types";

export const walletMoney = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
});

export const walletDateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
});

export const buildWalletTableColumns = (
  onOpenDetail: (providerId: string) => void,
): Array<DataTableColumn<AdminWalletRow>> => [
  {
    key: "provider",
    header: "Provider",
    className: "font-bold",
    render: (wallet) => wallet.provider?.fullName || "Provider",
  },
  {
    key: "contact",
    header: "Liên hệ",
    className: "text-sm",
    render: (wallet) => (
      <>
        <p>{wallet.provider?.email || "Chưa có email"}</p>
        <p className="text-on-surface-variant">
          {wallet.provider?.phone || "Chưa có số điện thoại"}
        </p>
      </>
    ),
  },
  {
    key: "balance",
    header: "Số dư",
    className: "font-bold tabular-nums text-primary",
    render: (wallet) => walletMoney.format(wallet.balance),
  },
  {
    key: "pendingBalance",
    header: "Số dư chờ",
    className: "tabular-nums",
    render: (wallet) => walletMoney.format(wallet.pendingBalance),
  },
  {
    key: "status",
    header: "Trạng thái",
    className: "text-sm",
    render: (wallet) => wallet.provider?.status || "Chưa rõ",
  },
  {
    key: "actions",
    header: "Chi tiết",
    className: "text-right",
    render: (wallet) => (
      <button
        type="button"
        onClick={() => onOpenDetail(wallet.providerId)}
        title="Xem chi tiết"
        className="inline-grid h-10 w-10 place-items-center rounded-xl border border-outline-variant text-primary"
      >
        <Eye size={18} />
      </button>
    ),
  },
];
