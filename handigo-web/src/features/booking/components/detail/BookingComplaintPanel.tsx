import { Link } from "react-router-dom";
import { Flag } from "lucide-react";

type BookingComplaintPanelProps = {
  orderId: string;
};

/** Liên kết báo cáo vấn đề đơn hàng, dẫn tới form khiếu nại của trung tâm hỗ trợ. */
export const BookingComplaintPanel = ({ orderId }: BookingComplaintPanelProps) => (
  <Link
    to={`/customer/support?tab=report&create=report&orderId=${encodeURIComponent(orderId)}`}
    className="flex items-center justify-center gap-2 text-on-surface-variant hover:text-primary transition-colors py-2 group"
  >
    <Flag aria-hidden="true" size={14} />
    <span className="text-label-sm font-label-sm border-b border-transparent group-hover:border-primary">
      Báo cáo vấn đề đơn hàng
    </span>
  </Link>
);
