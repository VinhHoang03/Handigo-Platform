import { TableToolbar } from "@/components/common/dashboard/TableToolbar";
import type { VoucherQuery } from "../../types/voucher.types";

export function PromotionToolbar({
  query,
  onQueryChange,
  onRefresh,
}: {
  query: VoucherQuery;
  onQueryChange: (query: VoucherQuery) => void;
  onRefresh: () => void;
}) {
  return (
    <TableToolbar
      search={{
        value: query.search || "",
        onChange: (value) => onQueryChange({ ...query, search: value, page: 1 }),
        placeholder: "Tìm theo mã, tên hoặc mô tả...",
      }}
      filters={
        <select
          value={query.status || ""}
          onChange={(event) => onQueryChange({ ...query, status: event.target.value as VoucherQuery["status"], page: 1 })}
          className="min-h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-3"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Hoạt động</option>
          <option value="INACTIVE">Tạm dừng</option>
          <option value="EXPIRED">Hết hạn</option>
        </select>
      }
      actions={
        <button
          onClick={onRefresh}
          className="rounded-xl border border-outline-variant px-4 py-3 text-on-surface-variant hover:bg-surface-container-low"
          aria-label="Tải lại"
        >
          <span className="material-symbols-outlined">refresh</span>
        </button>
      }
    />
  );
}
