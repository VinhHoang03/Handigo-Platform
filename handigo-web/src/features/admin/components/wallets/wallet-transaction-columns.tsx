import type { DataTableColumn } from "@/components/common/dashboard/DataTable";
import type { WalletTransaction } from "@/features/wallet/types/wallet.types";
import { walletDateTime, walletMoney } from "./wallet-table-columns";

/** Bảng lịch sử giao dịch bên trong modal chi tiết ví. */
export const walletTransactionColumns: Array<DataTableColumn<WalletTransaction>> = [
  {
    key: "code",
    header: "Mã",
    className: "font-mono text-xs",
    render: (transaction) => transaction.transactionCode || transaction._id.slice(-8),
  },
  {
    key: "type",
    header: "Loại",
    render: (transaction) => transaction.type,
  },
  {
    key: "amount",
    header: "Số tiền",
    className: "font-bold tabular-nums",
    render: (transaction) => (
      <span className={transaction.direction === "in" ? "text-success" : "text-error"}>
        {transaction.direction === "in" ? "+" : "-"}
        {walletMoney.format(transaction.amount)}
      </span>
    ),
  },
  {
    key: "balanceAfter",
    header: "Số dư sau",
    className: "tabular-nums",
    render: (transaction) => walletMoney.format(transaction.balanceAfter),
  },
  {
    key: "createdAt",
    header: "Thời gian",
    className: "tabular-nums",
    render: (transaction) => walletDateTime.format(new Date(transaction.createdAt)),
  },
];
