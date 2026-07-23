import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { DataTable } from "@/components/common/dashboard/DataTable";
import { Pagination } from "@/components/common/Pagination";
import { getErrorMessage } from "@/utils/apiError";
import { adminOperationsApi } from "../api/adminOperations.api";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
} from "../components/payments/payment-constants";
import { buildPaymentTableColumns } from "../components/payments/payment-table-columns";
import { PaymentDetailModal } from "../components/payments/PaymentDetailModal";
import type {
  AdminPayment,
  PaymentMethod,
  PaymentQuery,
  PaymentStatus,
  PaymentType,
} from "../types/adminOperations.types";

export default function AdminPaymentsPage() {
  const [query, setQuery] = useState<PaymentQuery>({ page: 1, limit: 20 });
  const [items, setItems] = useState<AdminPayment[]>([]);
  const [selected, setSelected] = useState<AdminPayment | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [retryingRefund, setRetryingRefund] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await adminOperationsApi.payments(query);
      setItems(result.items);
      setTotalPages(result.pagination.totalPages || 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Không thể tải lịch sử thanh toán."));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const openDetail = async (id: string) => {
    try {
      setDetailLoading(true);
      setSelected(await adminOperationsApi.payment(id));
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Không thể tải chi tiết giao dịch."));
    } finally {
      setDetailLoading(false);
    }
  };

  const retryRefund = async () => {
    if (!selected) return;
    try {
      setRetryingRefund(true);
      setError("");
      setNotice("");
      await adminOperationsApi.retryPaymentRefund(selected._id);
      setSelected(await adminOperationsApi.payment(selected._id));
      setNotice("Đã đưa yêu cầu hoàn tiền vào hàng đợi xử lý lại.");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Không thể thử lại yêu cầu hoàn tiền."));
    } finally {
      setRetryingRefund(false);
    }
  };

  return (
    <DashboardShell role="ADMIN">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-headline-lg font-bold">Quản lý thanh toán</h1>
          <p className="mt-2 text-on-surface-variant">
            Tra cứu lịch sử và kiểm tra thông tin giao dịch trên toàn hệ thống.
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

      {notice && (
        <p className="rounded-xl bg-primary/10 px-4 py-3 text-sm font-medium text-primary">{notice}</p>
      )}

      <section className="grid gap-3 rounded-2xl border border-outline-variant/40 bg-surface p-4 sm:grid-cols-3">
        <select
          value={query.status || ""}
          onChange={(event) =>
            setQuery((current) => ({
              ...current,
              page: 1,
              status: (event.target.value || undefined) as PaymentStatus | undefined,
            }))
          }
          aria-label="Lọc theo trạng thái"
          className="min-h-11 rounded-xl border border-outline-variant px-3"
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          value={query.method || ""}
          onChange={(event) =>
            setQuery((current) => ({
              ...current,
              page: 1,
              method: (event.target.value || undefined) as PaymentMethod | undefined,
            }))
          }
          aria-label="Lọc theo phương thức"
          className="min-h-11 rounded-xl border border-outline-variant px-3"
        >
          <option value="">Tất cả phương thức</option>
          {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          value={query.paymentType || ""}
          onChange={(event) =>
            setQuery((current) => ({
              ...current,
              page: 1,
              paymentType: (event.target.value || undefined) as PaymentType | undefined,
            }))
          }
          aria-label="Lọc theo loại thanh toán"
          className="min-h-11 rounded-xl border border-outline-variant px-3"
        >
          <option value="">Tất cả loại thanh toán</option>
          {Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </section>

      <AsyncState
        loading={loading}
        error={error}
        empty={!items.length}
        emptyMessage="Không có giao dịch phù hợp."
        onRetry={load}
      >
        <DataTable
          columns={buildPaymentTableColumns((paymentId) => void openDetail(paymentId))}
          rows={items}
          rowKey={(payment) => payment._id}
          minWidthClassName="min-w-[980px]"
        />
      </AsyncState>

      <Pagination
        page={query.page || 1}
        totalPages={totalPages}
        onChange={(page) => setQuery((current) => ({ ...current, page }))}
      />

      <PaymentDetailModal
        payment={selected}
        loading={detailLoading}
        retryingRefund={retryingRefund}
        onRetryRefund={() => void retryRefund()}
        onClose={() => setSelected(null)}
      />
    </DashboardShell>
  );
}
