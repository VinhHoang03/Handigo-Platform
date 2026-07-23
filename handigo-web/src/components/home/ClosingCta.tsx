import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

/**
 * Dải đóng trang. Trước đây trang kết thúc ở khối đánh giá rồi rơi thẳng vào
 * footer — người cuộn hết trang không được mời làm gì cả.
 *
 * Nhãn nút trùng đúng chữ với nút tìm kiếm ở hero ("Tìm thợ"): một ý thì một
 * nhãn, không đặt hai cách gọi khác nhau cho cùng một hành động.
 */
export const ClosingCta = () => (
  <section
    aria-labelledby="closing-cta-heading"
    className="mt-lg bg-primary py-lg text-on-primary"
  >
    <div className="mx-auto flex max-w-7xl flex-col items-start gap-8 px-4 md:px-8 lg:flex-row lg:items-center lg:justify-between">
      <div className="max-w-2xl">
        <h2
          id="closing-cta-heading"
          className="text-balance font-headline-lg text-headline-lg tracking-[-0.02em]"
        >
          Nhà đang hỏng thứ gì?
        </h2>
        <p className="mt-3 text-pretty text-body-lg text-on-primary/80">
          Mô tả việc cần làm, xem báo giá rồi mới quyết định.
        </p>
      </div>

      <Link
        to="/customer/services"
        className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-lg bg-surface px-8 py-3 text-label-md font-semibold text-primary transition-colors duration-200 hover:bg-surface-container active:scale-[0.98]"
      >
        Tìm thợ
        <ArrowRight aria-hidden="true" size={18} />
      </Link>
    </div>
  </section>
);
