import type { DataTableColumn } from "@/components/common/dashboard/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import type { Voucher } from "../../types/voucher.types";
import { dateTime, discountText, money, statusValue } from "./promotion-format";
import { PauseCircle, Pencil, PlayCircle, Trash2 } from "lucide-react";

interface VoucherColumnHandlers {
  onEdit: (voucher: Voucher) => void;
  onToggle: (voucher: Voucher) => void;
  onDelete: (voucher: Voucher) => void;
}

/** Cột bảng voucher — trang truyền các callback hành động để dựng cột cuối. */
export const buildVoucherColumns = ({
  onEdit,
  onToggle,
  onDelete,
}: VoucherColumnHandlers): Array<DataTableColumn<Voucher>> => [
  {
    key: "voucher",
    header: "Mã giảm giá",
    render: (voucher) => (
      <div className="min-w-0">
        <p className="font-semibold text-on-surface">{voucher.name}</p>
        <p className="mt-1 text-xs font-medium text-primary">{voucher.ownerId ? "Mã đổi điểm · Dùng riêng cho khách" : "Mã thông thường"}</p>
        {voucher.ownerId && <p className="mt-1 break-all text-xs text-on-surface-variant">Khách hàng: {voucher.ownerId}</p>}
        {voucher.applicableOrderType && <p className="mt-1 text-xs text-on-surface-variant">{voucher.applicableOrderType === "variable_price" ? "Chỉ giảm phí cọc đơn báo giá" : "Áp dụng cho đơn giá cố định"}</p>}
        {voucher.reservedOrderId && <p className="mt-1 break-all text-xs text-on-surface-variant">Đơn giữ mã: {voucher.reservedOrderId}</p>}
        <p className="mt-1 inline-flex rounded-lg bg-primary/10 px-2 py-1 font-mono text-sm font-semibold text-primary">
          {voucher.code}
        </p>
        {voucher.description && (
          <p className="mt-2 whitespace-normal break-words text-sm leading-5 text-on-surface-variant">
            {voucher.description}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-on-surface-variant">
          <span>
            Đơn tối thiểu:{" "}
            <b>
              {voucher.minOrderAmount == null ? "-" : money.format(voucher.minOrderAmount)}
            </b>
          </span>
          <span>
            Sử dụng:{" "}
            <b>
              {voucher.usedCount}
              {voucher.usageLimit == null ? "" : `/${voucher.usageLimit}`}
            </b>
            {(voucher.reservedCount ?? 0) > 0 && <span> · Đang giữ: {voucher.reservedCount}</span>}
          </span>
          <span>
            Hạn:{" "}
            <b>
              {dateTime.format(new Date(voucher.startAt))} - {dateTime.format(new Date(voucher.endAt))}
            </b>
          </span>
        </div>
      </div>
    ),
  },
  {
    key: "discount",
    header: "Ưu đãi",
    className: "font-medium tabular-nums",
    render: (voucher) => discountText(voucher),
  },
  {
    key: "status",
    header: "Trạng thái",
    render: (voucher) => <StatusBadge value={statusValue(voucher)} />,
  },
  {
    key: "actions",
    header: "",
    className: "text-right",
    render: (voucher) => (
      <div className="flex justify-end gap-1">
        {!voucher.ownerId && <button
          onClick={() => onEdit(voucher)}
          className="rounded-lg p-2 text-primary hover:bg-primary/10"
          aria-label="Sửa mã giảm giá"
        >
          <Pencil aria-hidden="true" size={20} />
        </button>}
        <button
          onClick={() => onToggle(voucher)}
          className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-high"
          aria-label="Đổi trạng thái mã giảm giá"
        >
          {voucher.isActive && voucher.status === "ACTIVE" ? <PauseCircle aria-hidden="true" size={20} /> : <PlayCircle aria-hidden="true" size={20} />}
        </button>
        <button
          onClick={() => onDelete(voucher)}
          disabled={Boolean(voucher.ownerId && voucher.usedCount > 0)}
          title={voucher.ownerId && voucher.usedCount > 0 ? "Không thể xóa mã đổi điểm đã sử dụng" : "Xóa mã giảm giá"}
          className="rounded-lg p-2 text-error hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Xóa mã giảm giá"
        >
          <Trash2 aria-hidden="true" size={20} />
        </button>
      </div>
    ),
  },
];
