import type { DataTableColumn } from "@/components/common/dashboard/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import type { Voucher } from "../../types/voucher.types";
import { dateTime, discountText, money, statusValue } from "./promotion-format";
import { Pencil, Trash2 } from "lucide-react";

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
    header: "Voucher",
    render: (voucher) => (
      <div className="min-w-0">
        <p className="font-semibold text-on-surface">{voucher.name}</p>
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
        <button
          onClick={() => onEdit(voucher)}
          className="rounded-lg p-2 text-primary hover:bg-primary/10"
          aria-label="Sửa voucher"
        >
          <Pencil aria-hidden="true" size={20} />
        </button>
        <button
          onClick={() => onToggle(voucher)}
          className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-high"
          aria-label="Đổi trạng thái voucher"
        >
          <span className="material-symbols-outlined text-[20px]">
            {voucher.isActive && voucher.status === "ACTIVE" ? "pause_circle" : "play_circle"}
          </span>
        </button>
        <button
          onClick={() => onDelete(voucher)}
          className="rounded-lg p-2 text-error hover:bg-error/10"
          aria-label="Xóa voucher"
        >
          <Trash2 aria-hidden="true" size={20} />
        </button>
      </div>
    ),
  },
];
