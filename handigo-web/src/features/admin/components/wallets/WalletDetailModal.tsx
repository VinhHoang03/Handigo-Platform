import { type FormEvent } from "react";
import { DataTable } from "@/components/common/dashboard/DataTable";
import { Modal } from "@/components/common/Modal";
import { Pagination } from "@/components/common/Pagination";
import type { WalletTransaction } from "@/features/wallet/types/wallet.types";
import type { AdminWalletDetail } from "../../types/adminOperations.types";
import { walletMoney } from "./wallet-table-columns";
import { walletTransactionColumns } from "./wallet-transaction-columns";

interface WalletDetailModalProps {
  detail: AdminWalletDetail | null;
  detailLoading: boolean;
  transactions: WalletTransaction[];
  transactionPage: number;
  transactionTotalPages: number;
  onTransactionPageChange: (page: number) => void;
  onClose: () => void;
  /** Form điều chỉnh số dư */
  busy: boolean;
  actionError: string;
  direction: "in" | "out";
  onDirectionChange: (direction: "in" | "out") => void;
  amount: string;
  onAmountChange: (amount: string) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  onSubmitAdjust: (event: FormEvent) => void;
}

export function WalletDetailModal({
  detail,
  detailLoading,
  transactions,
  transactionPage,
  transactionTotalPages,
  onTransactionPageChange,
  onClose,
  busy,
  actionError,
  direction,
  onDirectionChange,
  amount,
  onAmountChange,
  reason,
  onReasonChange,
  onSubmitAdjust,
}: WalletDetailModalProps) {
  const summary = detail
    ? [
        { label: "Số dư hiện tại", value: walletMoney.format(detail.balance) },
        { label: "Thu nhập", value: walletMoney.format(detail.totalEarnings) },
        { label: "Đã rút", value: walletMoney.format(detail.totalWithdrawn) },
        { label: "Phí nền tảng", value: walletMoney.format(detail.totalPlatformFeesPaid) },
      ]
    : [];

  return (
    <Modal
      open={Boolean(detail) || detailLoading}
      title="Chi tiết ví provider"
      onClose={onClose}
      size="xl"
      closeOnOverlayClick={!busy}
    >
      {detailLoading && !detail ? (
        <div className="p-10 text-center text-on-surface-variant">Đang tải chi tiết...</div>
      ) : detail ? (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summary.map((item) => (
              <div key={item.label} className="rounded-xl bg-surface-container-low p-4">
                <p className="text-xs text-on-surface-variant">{item.label}</p>
                <p className="mt-1 font-bold tabular-nums">{item.value}</p>
              </div>
            ))}
          </section>

          <section>
            <h3 className="mb-3 font-bold">Lịch sử giao dịch</h3>
            <DataTable
              columns={walletTransactionColumns}
              rows={transactions}
              rowKey={(transaction) => transaction._id}
              minWidthClassName="min-w-[700px]"
              emptyState={
                <div className="p-6 text-center text-on-surface-variant">Chưa có giao dịch.</div>
              }
            />
            {transactions.length > 0 && (
              <Pagination
                page={transactionPage}
                totalPages={transactionTotalPages}
                onChange={onTransactionPageChange}
              />
            )}
          </section>

          <form onSubmit={onSubmitAdjust} className="rounded-2xl border border-error/20 bg-error/5 p-4">
            <h3 className="font-bold text-error">Điều chỉnh số dư</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <select
                value={direction}
                onChange={(event) => onDirectionChange(event.target.value as "in" | "out")}
                disabled={busy}
                aria-label="Hướng điều chỉnh"
                className="min-h-11 rounded-xl border border-outline-variant px-3"
              >
                <option value="in">Cộng số dư</option>
                <option value="out">Trừ số dư</option>
              </select>
              <input
                type="number"
                value={amount}
                onChange={(event) => onAmountChange(event.target.value)}
                min={1}
                step={1}
                required
                disabled={busy}
                placeholder="Số tiền"
                aria-label="Số tiền điều chỉnh"
                className="min-h-11 rounded-xl border border-outline-variant px-3"
              />
              <input
                value={reason}
                onChange={(event) => onReasonChange(event.target.value)}
                maxLength={500}
                required
                disabled={busy}
                placeholder="Lý do điều chỉnh"
                aria-label="Lý do điều chỉnh"
                className="min-h-11 rounded-xl border border-outline-variant px-3"
              />
            </div>
            {actionError && <p className="mt-3 text-sm font-semibold text-error">{actionError}</p>}
            <button
              type="submit"
              disabled={busy || !amount || !reason.trim()}
              className="mt-3 rounded-xl bg-error px-5 py-2.5 font-semibold text-on-error disabled:opacity-40"
            >
              {busy ? "Đang điều chỉnh..." : "Xác nhận điều chỉnh"}
            </button>
          </form>
        </div>
      ) : null}
    </Modal>
  );
}
