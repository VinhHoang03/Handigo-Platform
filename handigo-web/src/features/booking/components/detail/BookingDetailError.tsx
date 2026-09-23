import { Link } from "react-router-dom";
import { CircleAlert } from "lucide-react";

type BookingDetailErrorProps = {
  message: string | null;
};

/** Trạng thái lỗi tải trang / không tìm thấy đơn hàng (không phân biệt được lý do cụ thể). */
export const BookingDetailError = ({ message }: BookingDetailErrorProps) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-md">
    <CircleAlert aria-hidden="true" size={60} className="text-error mb-sm" />
    <h2 className="font-headline-md text-headline-md">
      {message || "Không tìm thấy đơn hàng"}
    </h2>
    <p className="text-on-surface-variant mb-md max-w-xs">
      {message
        ? "Vui lòng kiểm tra lại đường dẫn hoặc quay lại danh sách."
        : "Đơn hàng này không tồn tại hoặc bạn không có quyền xem."}
    </p>
    <Link
      to="/customer/bookings"
      className="bg-primary text-on-primary px-lg py-2 rounded-full font-bold transition-all active:scale-95 shadow-lg shadow-primary/20"
    >
      Quay lại danh sách
    </Link>
  </div>
);
