import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Eye, RefreshCw, Search } from "lucide-react";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { Modal } from "@/components/common/Modal";
import { Pagination } from "@/components/common/Pagination";
import type { WalletTransaction } from "@/features/wallet/types/wallet.types";
import { getErrorMessage } from "@/utils/apiError";
import { adminOperationsApi } from "../api/adminOperations.api";
import type { AdminWalletDetail, AdminWalletQuery, AdminWalletRow } from "../types/adminOperations.types";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });

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
    try { setLoading(true); setError(""); const result = await adminOperationsApi.wallets(query); setItems(result.items); setTotalPages(result.pagination.totalPages || 1); }
    catch (requestError) { setError(getErrorMessage(requestError, "Không thể tải danh sách ví.")); }
    finally { setLoading(false); }
  }, [query]);

  useEffect(() => { const timeoutId = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timeoutId); }, [load]);

  const loadDetail = async (providerId: string, page = 1) => {
    try { setDetailLoading(true); setActionError(""); const [detail, history] = await Promise.all([adminOperationsApi.wallet(providerId), adminOperationsApi.walletTransactions(providerId, { page, limit: 10 })]); setSelected(detail); setTransactions(history.items); setTransactionPage(page); setTransactionTotalPages(history.pagination.totalPages || 1); }
    catch (requestError) { setError(getErrorMessage(requestError, "Không thể tải chi tiết ví.")); }
    finally { setDetailLoading(false); }
  };

  const submitSearch = (event: FormEvent) => { event.preventDefault(); setQuery((current) => ({ ...current, page: 1, search: searchInput.trim() || undefined })); };

  const adjust = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    try { setBusy(true); setActionError(""); await adminOperationsApi.adjustWallet(selected.providerId, { amount: Number(amount), direction, reason: reason.trim() }); setAmount(""); setReason(""); await Promise.all([load(), loadDetail(selected.providerId, 1)]); }
    catch (requestError) { setActionError(getErrorMessage(requestError, "Không thể điều chỉnh số dư ví.")); }
    finally { setBusy(false); }
  };

  return <DashboardShell role="ADMIN">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-headline-lg font-bold">Quản lý ví provider</h1><p className="mt-2 text-on-surface-variant">Kiểm tra số dư, lịch sử giao dịch và điều chỉnh có ghi nhận lý do.</p></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2.5 font-semibold text-primary disabled:opacity-40"><RefreshCw size={18} className={loading ? "animate-spin" : ""} /> Làm mới</button></header>
    <section className="rounded-2xl border border-outline-variant/40 bg-surface p-4"><form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search size={18} className="pointer-events-none absolute left-3 top-3 text-on-surface-variant" /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} maxLength={100} placeholder="Tìm theo tên, email hoặc số điện thoại..." className="min-h-11 w-full rounded-xl border border-outline-variant pl-10 pr-3" /></label><select value={query.sortByBalance} onChange={(event) => setQuery((current) => ({ ...current, page: 1, sortByBalance: event.target.value as "asc" | "desc" }))} className="min-h-11 rounded-xl border border-outline-variant px-3"><option value="desc">Số dư cao đến thấp</option><option value="asc">Số dư thấp đến cao</option></select><button type="submit" className="btn-primary">Tìm kiếm</button></form></section>
    <AsyncState loading={loading} error={error} empty={!items.length} emptyMessage="Không có ví provider phù hợp." onRetry={load}><div className="overflow-x-auto rounded-2xl border border-outline-variant/40 bg-surface"><table className="w-full min-w-[850px] text-left"><thead className="bg-surface-container-low text-sm"><tr><th className="p-4">Provider</th><th className="p-4">Liên hệ</th><th className="p-4">Số dư</th><th className="p-4">Số dư chờ</th><th className="p-4">Trạng thái</th><th className="p-4 text-right">Chi tiết</th></tr></thead><tbody>{items.map((wallet) => <tr key={wallet.providerId} className="border-t border-outline-variant/30"><td className="p-4 font-bold">{wallet.provider?.fullName || "Provider"}</td><td className="p-4 text-sm"><p>{wallet.provider?.email || "—"}</p><p className="text-on-surface-variant">{wallet.provider?.phone || "—"}</p></td><td className="p-4 font-bold text-primary">{money.format(wallet.balance)}</td><td className="p-4">{money.format(wallet.pendingBalance)}</td><td className="p-4 text-sm">{wallet.provider?.status || "—"}</td><td className="p-4 text-right"><button type="button" onClick={() => void loadDetail(wallet.providerId)} title="Xem chi tiết" className="inline-grid h-10 w-10 place-items-center rounded-xl border border-outline-variant text-primary"><Eye size={18} /></button></td></tr>)}</tbody></table></div></AsyncState>
    <Pagination page={query.page || 1} totalPages={totalPages} onChange={(page) => setQuery((current) => ({ ...current, page }))} />
    <Modal open={Boolean(selected) || detailLoading} title="Chi tiết ví provider" onClose={() => { setSelected(null); setTransactions([]); setActionError(""); }} size="xl" closeOnOverlayClick={!busy}>{detailLoading && !selected ? <div className="p-10 text-center text-on-surface-variant">Đang tải chi tiết...</div> : selected ? <div className="space-y-6"><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Số dư hiện tại", money.format(selected.balance)], ["Thu nhập", money.format(selected.totalEarnings)], ["Đã rút", money.format(selected.totalWithdrawn)], ["Phí nền tảng", money.format(selected.totalPlatformFeesPaid)]].map(([label, value]) => <div key={label} className="rounded-xl bg-surface-container-low p-4"><p className="text-xs text-on-surface-variant">{label}</p><p className="mt-1 font-bold">{value}</p></div>)}</section><section><h3 className="mb-3 font-bold">Lịch sử giao dịch</h3>{transactions.length ? <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr><th className="p-3">Mã</th><th className="p-3">Loại</th><th className="p-3">Số tiền</th><th className="p-3">Số dư sau</th><th className="p-3">Thời gian</th></tr></thead><tbody>{transactions.map((transaction) => <tr key={transaction._id} className="border-t border-outline-variant/30"><td className="p-3 font-mono text-xs">{transaction.transactionCode || transaction._id.slice(-8)}</td><td className="p-3">{transaction.type}</td><td className={`p-3 font-bold ${transaction.direction === "in" ? "text-success" : "text-error"}`}>{transaction.direction === "in" ? "+" : "-"}{money.format(transaction.amount)}</td><td className="p-3">{money.format(transaction.balanceAfter)}</td><td className="p-3">{dateTime.format(new Date(transaction.createdAt))}</td></tr>)}</tbody></table><Pagination page={transactionPage} totalPages={transactionTotalPages} onChange={(page) => void loadDetail(selected.providerId, page)} /></div> : <p className="rounded-xl border border-dashed border-outline-variant p-6 text-center text-on-surface-variant">Chưa có giao dịch.</p>}</section><form onSubmit={adjust} className="rounded-2xl border border-error/20 bg-error/5 p-4"><h3 className="font-bold text-error">Điều chỉnh số dư</h3><div className="mt-3 grid gap-3 sm:grid-cols-3"><select value={direction} onChange={(event) => setDirection(event.target.value as "in" | "out")} disabled={busy} className="min-h-11 rounded-xl border border-outline-variant px-3"><option value="in">Cộng số dư</option><option value="out">Trừ số dư</option></select><input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} min={1} step={1} required disabled={busy} placeholder="Số tiền" className="min-h-11 rounded-xl border border-outline-variant px-3" /><input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} required disabled={busy} placeholder="Lý do điều chỉnh" className="min-h-11 rounded-xl border border-outline-variant px-3" /></div>{actionError && <p className="mt-3 text-sm font-semibold text-error">{actionError}</p>}<button type="submit" disabled={busy || !amount || !reason.trim()} className="mt-3 rounded-xl bg-error px-5 py-2.5 font-semibold text-on-error disabled:opacity-40">{busy ? "Đang điều chỉnh..." : "Xác nhận điều chỉnh"}</button></form></div> : null}</Modal>
  </DashboardShell>;
}
