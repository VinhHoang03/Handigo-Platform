import { Link } from "react-router-dom";
import { ArrowLeft, CircleAlert } from "lucide-react";

type BookingDetailErrorProps = {
  message: string | null;
};

/** Trạng thái lỗi tải trang / không tìm thấy đơn hàng (không phân biệt được lý do cụ thể). */
export const BookingDetailError = ({ message }: BookingDetailErrorProps) => (
  <section role="alert" className="mx-auto flex min-h-[400px] w-full min-w-0 max-w-[640px] flex-col items-center justify-center gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-6 py-10 text-center sm:px-10">
    <span className="grid size-16 shrink-0 place-items-center rounded-full bg-error/10 text-error">
      <CircleAlert aria-hidden="true" size={32} />
    </span>
    <h2 className="w-full break-words font-headline-md text-headline-md text-on-surface">
      {message || "Không tìm thấy đơn hàng"}
    </h2>
    <p className="w-full max-w-[480px] text-sm leading-6 text-on-surface-variant sm:text-base">
      {message
        ? "Vui lòng kiểm tra lại đường dẫn hoặc quay lại danh sách."
        : "Đơn hàng này không tồn tại hoặc bạn không có quyền xem."}
    </p>
    <Link
      to="/customer/bookings"
      className="btn-primary mt-2 w-full whitespace-nowrap sm:w-auto"
    >
      <ArrowLeft aria-hidden="true" size={18} className="shrink-0" />
      Quay lại danh sách
    </Link>
  </section>
);
