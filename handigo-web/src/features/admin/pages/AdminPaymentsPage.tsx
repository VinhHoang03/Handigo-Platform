import { useCallback, useEffect, useState } from "react";
import { Eye, RefreshCw } from "lucide-react";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { Modal } from "@/components/common/Modal";
import { Pagination } from "@/components/common/Pagination";
import { getErrorMessage } from "@/utils/apiError";
import { adminOperationsApi } from "../api/adminOperations.api";
import type { AdminPayment, PaymentMethod, PaymentQuery, PaymentStatus, PaymentType } from "../types/adminOperations.types";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });
const STATUS: Record<PaymentStatus, string> = { pending: "Chờ thanh toán", paid: "Đã thanh toán", failed: "Thất bại", refunded: "Đã hoàn tiền" };
const METHOD: Record<PaymentMethod, string> = { payos: "PayOS", vnpay: "VNPay", cash: "Tiền mặt", wallet: "Ví", bank: "Chuyển khoản" };
const TYPE: Record<PaymentType, string> = { full: "Thanh toán toàn bộ", remaining: "Thanh toán còn lại", inspection_deposit: "Đặt cọc khảo sát" };

export default function AdminPaymentsPage() {
  const [query, setQuery] = useState<PaymentQuery>({ page: 1, limit: 20 });
  const [items, setItems] = useState<AdminPayment[]>([]);
  const [selected, setSelected] = useState<AdminPayment | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try { setLoading(true); setError(""); const result = await adminOperationsApi.payments(query); setItems(result.items); setTotalPages(result.pagination.totalPages || 1); }
    catch (requestError) { setError(getErrorMessage(requestError, "Không thể tải lịch sử thanh toán.")); }
    finally { setLoading(false); }
  }, [query]);

  useEffect(() => { const timeoutId = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timeoutId); }, [load]);

  const openDetail = async (id: string) => {
    try { setDetailLoading(true); setSelected(await adminOperationsApi.payment(id)); }
    catch (requestError) { setError(getErrorMessage(requestError, "Không thể tải chi tiết giao dịch.")); }
    finally { setDetailLoading(false); }
  };

  return <DashboardShell role="ADMIN">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-headline-lg font-bold">Quản lý thanh toán</h1><p className="mt-2 text-on-surface-variant">Tra cứu lịch sử và kiểm tra thông tin giao dịch trên toàn hệ thống.</p></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2.5 font-semibold text-primary disabled:opacity-40"><RefreshCw size={18} className={loading ? "animate-spin" : ""} /> Làm mới</button></header>
    <section className="grid gap-3 rounded-2xl border border-outline-variant/40 bg-surface p-4 sm:grid-cols-3"><select value={query.status || ""} onChange={(event) => setQuery((current) => ({ ...current, page: 1, status: (event.target.value || undefined) as PaymentStatus | undefined }))} className="min-h-11 rounded-xl border border-outline-variant px-3"><option value="">Tất cả trạng thái</option>{Object.entries(STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select value={query.method || ""} onChange={(event) => setQuery((current) => ({ ...current, page: 1, method: (event.target.value || undefined) as PaymentMethod | undefined }))} className="min-h-11 rounded-xl border border-outline-variant px-3"><option value="">Tất cả phương thức</option>{Object.entries(METHOD).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select value={query.paymentType || ""} onChange={(event) => setQuery((current) => ({ ...current, page: 1, paymentType: (event.target.value || undefined) as PaymentType | undefined }))} className="min-h-11 rounded-xl border border-outline-variant px-3"><option value="">Tất cả loại thanh toán</option>{Object.entries(TYPE).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></section>
    <AsyncState loading={loading} error={error} empty={!items.length} emptyMessage="Không có giao dịch phù hợp." onRetry={load}><div className="overflow-x-auto rounded-2xl border border-outline-variant/40 bg-surface"><table className="w-full min-w-[980px] text-left"><thead className="bg-surface-container-low text-sm"><tr><th className="p-4">Mã giao dịch</th><th className="p-4">Đơn hàng</th><th className="p-4">Loại</th><th className="p-4">Phương thức</th><th className="p-4">Số tiền</th><th className="p-4">Trạng thái</th><th className="p-4">Thời gian</th><th className="p-4 text-right">Chi tiết</th></tr></thead><tbody>{items.map((payment) => <tr key={payment._id} className="border-t border-outline-variant/30"><td className="p-4 font-mono text-xs">{payment.transactionCode || payment.gatewayTransactionId || payment._id.slice(-10).toUpperCase()}</td><td className="p-4 font-mono text-xs">{String(payment.orderId).slice(-10).toUpperCase()}</td><td className="p-4 text-sm">{TYPE[payment.paymentType]}</td><td className="p-4 text-sm">{METHOD[payment.method]}</td><td className="p-4 font-bold">{money.format(payment.amount)}</td><td className="p-4"><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{STATUS[payment.status]}</span></td><td className="p-4 text-sm">{dateTime.format(new Date(payment.createdAt))}</td><td className="p-4 text-right"><button type="button" onClick={() => void openDetail(payment._id)} title="Xem chi tiết" className="inline-grid h-10 w-10 place-items-center rounded-xl border border-outline-variant text-primary"><Eye size={18} /></button></td></tr>)}</tbody></table></div></AsyncState>
    <Pagination page={query.page || 1} totalPages={totalPages} onChange={(page) => setQuery((current) => ({ ...current, page }))} />
    <Modal open={Boolean(selected) || detailLoading} title="Chi tiết giao dịch" onClose={() => setSelected(null)} size="lg">{detailLoading && !selected ? <div className="p-10 text-center text-on-surface-variant">Đang tải chi tiết...</div> : selected ? <div className="grid gap-4 sm:grid-cols-2">{[["Trạng thái", STATUS[selected.status]], ["Số tiền", money.format(selected.amount)], ["Phương thức", METHOD[selected.method]], ["Loại thanh toán", TYPE[selected.paymentType]], ["Payment ID", selected._id], ["Order ID", String(selected.orderId)], ["Customer ID", String(selected.customerId)], ["Mã giao dịch", selected.transactionCode || "—"], ["Gateway order code", selected.gatewayOrderCode || "—"], ["Gateway transaction ID", selected.gatewayTransactionId || "—"], ["Tạo lúc", dateTime.format(new Date(selected.createdAt))], ["Thanh toán lúc", selected.paidAt ? dateTime.format(new Date(selected.paidAt)) : "—"]].map(([label, value]) => <div key={label} className="rounded-xl bg-surface-container-low p-4"><p className="text-xs text-on-surface-variant">{label}</p><p className="mt-1 break-all font-semibold">{value}</p></div>)}{selected.metadata?.refund && <div className="sm:col-span-2 rounded-xl bg-primary/10 p-4 text-sm text-primary"><p className="font-bold">Hoàn {selected.metadata.refund.rate ?? 100}% · {money.format(selected.metadata.refund.amount ?? selected.amount)}</p><p className="mt-1">Trạng thái đối soát: {selected.metadata.refund.status || "đang xử lý"}</p></div>}{(selected.failureReason || selected.refundReason) && <div className="sm:col-span-2 rounded-xl bg-error/10 p-4 text-sm text-error">{selected.failureReason || selected.refundReason}</div>}</div> : null}</Modal>
  </DashboardShell>;
}
