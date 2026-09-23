import { useCallback, useEffect, useState, type FormEvent } from "react";
import { RefreshCw, Search } from "lucide-react";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { DataTable } from "@/components/common/dashboard/DataTable";
import { Pagination } from "@/components/common/Pagination";
import type { WalletTransaction } from "@/features/wallet/types/wallet.types";
import { getErrorMessage } from "@/utils/apiError";
import { adminOperationsApi } from "../api/adminOperations.api";
import { buildWalletTableColumns } from "../components/wallets/wallet-table-columns";
import { WalletDetailModal } from "../components/wallets/WalletDetailModal";
import type {
  AdminWalletDetail,
  AdminWalletQuery,
  AdminWalletRow,
} from "../types/adminOperations.types";

export default function AdminWalletsPage() {
  const [query, setQuery] = useState<AdminWalletQuery>({ page: 1, limit: 20, sortByBalance: "desc" });
  const [searchInput, setSearchInput] = useState("");
  const [items, setItems] = useState<AdminWalletRow[]>([]);
  const [selected, setSelected] = useState<AdminWalletDetail | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionTotalPages, setTransactionTotalPages] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await adminOperationsApi.wallets(query);
      setItems(result.items);
      setTotalPages(result.pagination.totalPages || 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Không thể tải danh sách ví."));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const loadDetail = async (providerId: string, page = 1) => {
    try {
      setDetailLoading(true);
      setActionError("");
      const [detail, history] = await Promise.all([
        adminOperationsApi.wallet(providerId),
        adminOperationsApi.walletTransactions(providerId, { page, limit: 10 }),
      ]);
      setSelected(detail);
      setTransactions(history.items);
      setTransactionPage(page);
      setTransactionTotalPages(history.pagination.totalPages || 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Không thể tải chi tiết ví."));
    } finally {
      setDetailLoading(false);
    }
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setQuery((current) => ({ ...current, page: 1, search: searchInput.trim() || undefined }));
  };

  const adjust = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    try {
      setBusy(true);
      setActionError("");
      await adminOperationsApi.adjustWallet(selected.providerId, {
        amount: Number(amount),
        direction,
        reason: reason.trim(),
      });
      setAmount("");
      setReason("");
      await Promise.all([load(), loadDetail(selected.providerId, 1)]);
    } catch (requestError) {
      setActionError(getErrorMessage(requestError, "Không thể điều chỉnh số dư ví."));
    } finally {
      setBusy(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setTransactions([]);
    setActionError("");
  };

  return (
    <DashboardShell role="ADMIN">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-headline-lg font-bold">Quản lý ví provider</h1>
          <p className="mt-2 text-on-surface-variant">
            Kiểm tra số dư, lịch sử giao dịch và điều chỉnh có ghi nhận lý do.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2.5 font-semibold text-primary disabled:opacity-40"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} /> Làm mới
        </button>
      </header>

      <section className="rounded-2xl border border-outline-variant/40 bg-surface p-4">
        <form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <Search size={18} className="pointer-events-none absolute left-3 top-3 text-on-surface-variant" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              maxLength={100}
              placeholder="Tìm theo tên, email hoặc số điện thoại..."
              aria-label="Tìm provider"
              className="min-h-11 w-full rounded-xl border border-outline-variant pl-10 pr-3"
            />
          </label>
          <select
            value={query.sortByBalance}
            onChange={(event) =>
              setQuery((current) => ({
                ...current,
                page: 1,
                sortByBalance: event.target.value as "asc" | "desc",
              }))
            }
            aria-label="Sắp xếp theo số dư"
            className="min-h-11 rounded-xl border border-outline-variant px-3"
          >
            <option value="desc">Số dư cao đến thấp</option>
            <option value="asc">Số dư thấp đến cao</option>
          </select>
          <button type="submit" className="btn-primary">Tìm kiếm</button>
        </form>
      </section>

      <AsyncState
        loading={loading}
        error={error}
        empty={!items.length}
        emptyMessage="Không có ví provider phù hợp."
        onRetry={load}
      >
        <DataTable
          columns={buildWalletTableColumns((providerId) => void loadDetail(providerId))}
          rows={items}
          rowKey={(wallet) => wallet.providerId}
          minWidthClassName="min-w-[850px]"
        />
      </AsyncState>

      <Pagination
        page={query.page || 1}
        totalPages={totalPages}
        onChange={(page) => setQuery((current) => ({ ...current, page }))}
      />

      <WalletDetailModal
        detail={selected}
        detailLoading={detailLoading}
        transactions={transactions}
        transactionPage={transactionPage}
        transactionTotalPages={transactionTotalPages}
        onTransactionPageChange={(page) => void loadDetail(selected!.providerId, page)}
        onClose={closeDetail}
        busy={busy}
        actionError={actionError}
        direction={direction}
        onDirectionChange={setDirection}
        amount={amount}
        onAmountChange={setAmount}
        reason={reason}
        onReasonChange={setReason}
        onSubmitAdjust={adjust}
      />
    </DashboardShell>
  );
}
