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
    className="mx-auto mt-14 max-w-7xl px-4 py-10 text-on-surface md:mt-20 md:px-8 md:py-14"
  >
    <div className="flex flex-col items-start gap-8 border-t border-outline-variant/50 pt-10 lg:flex-row lg:items-center lg:justify-between">
      <div className="max-w-2xl">
        <h2
          id="closing-cta-heading"
          className="text-balance font-headline-lg text-headline-lg tracking-[-0.02em]"
        >
          Bớt một việc lo, thêm thời gian cho bạn.
        </h2>
        <p className="mt-3 text-pretty text-body-lg text-on-surface-variant">
          Mô tả việc cần làm, xem báo giá rồi mới quyết định.
        </p>
      </div>

      <Link
        to="/customer/services"
        className="inline-flex min-h-14 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3 text-label-md font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover focus-visible:ring-4 focus-visible:ring-primary/30 active:scale-[0.98] sm:w-auto"
      >
        Tìm thợ
        <ArrowRight aria-hidden="true" size={18} />
      </Link>
    </div>
  </section>
);
