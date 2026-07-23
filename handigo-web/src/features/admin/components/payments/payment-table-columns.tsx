import { Eye } from "lucide-react";
import type { DataTableColumn } from "@/components/common/dashboard/DataTable";
import { toneChipClasses } from "@/utils/statusTone";
import type { AdminPayment } from "../../types/adminOperations.types";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONES,
  PAYMENT_TYPE_LABELS,
  paymentDateTime,
  paymentMoney,
} from "./payment-constants";

/** Mã dài rút gọn 10 ký tự cuối, viết hoa — giữ nguyên quy ước của bản cũ. */
const shortCode = (value: string) => value.slice(-10).toUpperCase();

export const buildPaymentTableColumns = (
  onOpenDetail: (paymentId: string) => void,
): Array<DataTableColumn<AdminPayment>> => [
  {
    key: "transactionCode",
    header: "Mã giao dịch",
    className: "font-mono text-xs",
    render: (payment) =>
      payment.transactionCode || payment.gatewayTransactionId || shortCode(payment._id),
  },
  {
    key: "orderId",
    header: "Đơn hàng",
    className: "font-mono text-xs",
    render: (payment) => shortCode(String(payment.orderId)),
  },
  {
    key: "paymentType",
    header: "Loại",
    className: "text-sm",
    render: (payment) => PAYMENT_TYPE_LABELS[payment.paymentType],
  },
  {
    key: "method",
    header: "Phương thức",
    className: "text-sm",
    render: (payment) => PAYMENT_METHOD_LABELS[payment.method],
  },
  {
    key: "amount",
    header: "Số tiền",
    className: "font-bold tabular-nums",
    render: (payment) => paymentMoney.format(payment.amount),
  },
  {
    key: "status",
    header: "Trạng thái",
    render: (payment) => (
      <span
        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${toneChipClasses[PAYMENT_STATUS_TONES[payment.status]]}`}
      >
        {PAYMENT_STATUS_LABELS[payment.status]}
      </span>
    ),
  },
  {
    key: "createdAt",
    header: "Thời gian",
    className: "text-sm tabular-nums",
    render: (payment) => paymentDateTime.format(new Date(payment.createdAt)),
  },
  {
    key: "actions",
    header: "Chi tiết",
    className: "text-right",
    render: (payment) => (
      <button
        type="button"
        onClick={() => onOpenDetail(payment._id)}
        title="Xem chi tiết"
        className="inline-grid h-10 w-10 place-items-center rounded-xl border border-outline-variant text-primary"
      >
        <Eye size={18} />
      </button>
    ),
  },
];
