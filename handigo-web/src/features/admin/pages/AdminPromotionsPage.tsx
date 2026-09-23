import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { Pagination } from "@/components/common/Pagination";
import { DataTable } from "@/components/common/dashboard/DataTable";
import { TableSkeleton } from "@/components/common/dashboard/TableSkeleton";
import { voucherApi } from "../api/voucher.api";
import { PromotionConfirmDialogs } from "../components/promotions/PromotionConfirmDialogs";
import { PromotionHeader } from "../components/promotions/PromotionHeader";
import { PromotionToolbar } from "../components/promotions/PromotionToolbar";
import { buildVoucherColumns } from "../components/promotions/promotion-table-columns";
import { VoucherModal } from "../components/promotions/VoucherModal";
import {
  buildPayload,
  emptyForm,
  getErrorMessage,
  toLocalInputValue,
  type VoucherFormState,
} from "../components/promotions/promotion-format";
import type { Voucher, VoucherQuery } from "../types/voucher.types";

export default function AdminPromotionsPage() {
  const [query, setQuery] = useState<VoucherQuery>({
    page: 1,
    limit: 10,
    search: "",
    status: "",
  });
  const [items, setItems] = useState<Voucher[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<VoucherFormState>(emptyForm);
  const [editing, setEditing] = useState<Voucher | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Voucher | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Voucher | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        ...query,
        search: query.search?.trim() || undefined,
        status: query.status || undefined,
      };
      const result = await voucherApi.list(params);
      setItems(result.items);
      setTotalPages(result.pagination.totalPages || 1);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const stats = useMemo(() => {
    const active = items.filter((item) => item.status === "ACTIVE" && item.isActive).length;
    const inactive = items.filter((item) => item.status === "INACTIVE" || !item.isActive).length;
    const used = items.reduce((total, item) => total + item.usedCount, 0);
    return { active, inactive, used };
  }, [items]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalMode("create");
  };

  const openEdit = (voucher: Voucher) => {
    setEditing(voucher);
    setForm({
      code: voucher.code,
      name: voucher.name,
      description: voucher.description || "",
      discountType: voucher.discountType,
      discountValue: String(voucher.discountValue),
      maxDiscountAmount: voucher.maxDiscountAmount == null ? "" : String(voucher.maxDiscountAmount),
      minOrderAmount: voucher.minOrderAmount == null ? "" : String(voucher.minOrderAmount),
      usageLimit: voucher.usageLimit == null ? "" : String(voucher.usageLimit),
      startAt: toLocalInputValue(voucher.startAt),
      endAt: toLocalInputValue(voucher.endAt),
      status: voucher.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
    });
    setModalMode("edit");
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = buildPayload(form);
      if (modalMode === "edit" && editing) await voucherApi.update(editing.id, payload);
      else await voucherApi.create(payload);
      setModalMode(null);
      setEditing(null);
      setNotice(modalMode === "edit" ? "Đã cập nhật voucher." : "Đã tạo voucher mới.");
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmToggle = async () => {
    if (!toggleTarget) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (toggleTarget.isActive && toggleTarget.status === "ACTIVE") await voucherApi.disable(toggleTarget.id);
      else await voucherApi.enable(toggleTarget.id);
      setNotice("Đã cập nhật trạng thái voucher.");
      setToggleTarget(null);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await voucherApi.delete(deleteTarget.id);
      setNotice("Đã xóa voucher.");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const columns = buildVoucherColumns({ onEdit: openEdit, onToggle: setToggleTarget, onDelete: setDeleteTarget });

  return (
    <DashboardShell role="ADMIN">
      <div className="space-y-6">
        <PromotionHeader stats={stats} notice={notice} error={error} onCreate={openCreate} />

        <PromotionToolbar query={query} onQueryChange={setQuery} onRefresh={() => void load()} />

        <AsyncState
          loading={loading}
          error={error}
          onRetry={load}
          skeleton={<TableSkeleton columns={columns.length} rowCount={query.limit || 10} />}
        >
          <DataTable
            columns={columns}
            rows={items}
            rowKey={(voucher) => voucher.id}
            emptyState={<div className="p-10 text-center text-on-surface-variant">Chưa có voucher phù hợp.</div>}
            minWidthClassName="min-w-[900px]"
          />
        </AsyncState>
        <Pagination page={query.page || 1} totalPages={totalPages} onChange={(page) => setQuery((current) => ({ ...current, page }))} />
      </div>

      <VoucherModal
        open={Boolean(modalMode)}
        mode={modalMode || "create"}
        form={form}
        busy={busy}
        onChange={setForm}
        onClose={() => setModalMode(null)}
        onSubmit={save}
      />
      <PromotionConfirmDialogs
        toggleTarget={toggleTarget}
        deleteTarget={deleteTarget}
        busy={busy}
        onCancelToggle={() => setToggleTarget(null)}
        onConfirmToggle={confirmToggle}
        onCancelDelete={() => setDeleteTarget(null)}
        onConfirmDelete={confirmDelete}
      />
    </DashboardShell>
  );
}
