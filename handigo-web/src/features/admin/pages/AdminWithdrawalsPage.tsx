import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { Pagination } from "@/components/common/Pagination";
import { DataTable } from "@/components/common/dashboard/DataTable";
import type { DataTableColumn } from "@/components/common/dashboard/DataTable";
import { TableSkeleton } from "@/components/common/dashboard/TableSkeleton";
import { getErrorMessage } from "@/utils/apiError";
import { adminApi } from "../api/admin.api";
import { WithdrawalDetailModal } from "../components/withdrawals/WithdrawalDetailModal";
import { WithdrawalStatsAndFilters } from "../components/withdrawals/WithdrawalStatsAndFilters";
import { withdrawalFilterOptions, withdrawalMoney, withdrawalTableColumns } from "../components/withdrawals/withdrawal-table-columns";
import type { AdminQuery, AdminWithdrawal } from "../types/admin.types";

const LOAD_ERROR_FALLBACK = "Không thể tải dữ liệu.";

export default function AdminWithdrawalsPage() {
  const [query, setQuery] = useState<AdminQuery>({ page: 1, limit: 10, status: "" });
  const [items, setItems] = useState<AdminWithdrawal[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<AdminWithdrawal | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await adminApi.withdrawals({ ...query, status: query.status || undefined });
      setItems(result.items);
      setTotalPages(result.pagination.totalPages || 1);
    } catch (err) {
      setError(getErrorMessage(err, LOAD_ERROR_FALLBACK));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const stats = useMemo(() => {
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const activeFilter = withdrawalFilterOptions.find((option) => option.value === (query.status || ""));
    return [
      { label: "Số yêu cầu", value: items.length.toLocaleString("vi-VN") },
      { label: "Tổng tiền", value: withdrawalMoney.format(totalAmount) },
      { label: "Danh sách", value: activeFilter?.label || "Tất cả" },
    ];
  }, [items, query.status]);

  const closeModal = () => {
    setSelected(null);
    setAdminNote("");
  };

  const submitReview = async (action: "approve" | "reject") => {
    if (!selected) return;

    try {
      setBusy(true);
      setError("");
      setNotice("");
      if (action === "approve") {
        await adminApi.approveWithdrawal(selected._id, adminNote.trim() || undefined);
        setNotice("Đã duyệt yêu cầu rút tiền.");
      } else {
        await adminApi.rejectWithdrawal(selected._id, adminNote.trim() || undefined);
        setNotice("Đã từ chối yêu cầu rút tiền và hoàn tiền về ví.");
      }
      closeModal();
      await load();
    } catch (err) {
      setError(getErrorMessage(err, LOAD_ERROR_FALLBACK));
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo<Array<DataTableColumn<AdminWithdrawal>>>(
    () => [
      ...withdrawalTableColumns,
      {
        key: "actions",
        header: "Thao tác",
        className: "text-right",
        render: (item) => (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              title="Xem chi tiết"
              onClick={() => setSelected(item)}
              className="rounded-lg border border-outline-variant p-2 text-primary"
            >
              <Eye size={18} />
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <DashboardShell role="ADMIN">
      <header>
        <h1 className="text-headline-lg font-bold">Duyệt rút tiền</h1>
        <p className="text-on-surface-variant">
          Kiểm tra tài khoản nhận tiền, xử lý yêu cầu chờ duyệt và xem lịch sử các đơn đã duyệt.
        </p>
      </header>

      <WithdrawalStatsAndFilters
        stats={stats}
        statusValue={query.status || ""}
        onStatusChange={(value) => setQuery({ ...query, status: value, page: 1 })}
        loading={loading}
        onRefresh={() => void load()}
      />

      {notice && (
        <p className="rounded-lg bg-success-container px-4 py-3 text-sm font-semibold text-on-success-container">
          {notice}
        </p>
      )}

      <AsyncState
        loading={loading}
        error={error}
        empty={!items.length}
        emptyMessage="Không có yêu cầu rút tiền phù hợp."
        onRetry={load}
        skeleton={<TableSkeleton columns={columns.length} rowCount={query.limit || 10} />}
      >
        <DataTable columns={columns} rows={items} rowKey={(item) => item._id} minWidthClassName="min-w-[900px]" />
      </AsyncState>

      <Pagination page={query.page || 1} totalPages={totalPages} onChange={(page) => setQuery({ ...query, page })} />

      <WithdrawalDetailModal
        withdrawal={selected}
        busy={busy}
        adminNote={adminNote}
        onNoteChange={setAdminNote}
        onClose={closeModal}
        onApprove={() => void submitReview("approve")}
        onReject={() => void submitReview("reject")}
      />
    </DashboardShell>
  );
}
