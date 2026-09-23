import type { ReactNode } from "react";
import { useRevealOnScroll } from "@/hooks/use-reveal-on-scroll";

interface RevealProps {
  children: ReactNode;
  className?: string;
}

/**
 * Bọc một khối nội dung để nó trượt lên và hiện dần khi cuộn tới.
 *
 * Chuyển động ở đây nói một điều duy nhất: "phần này vừa vào tầm mắt". Không
 * dùng cho nội dung phải thấy ngay (hero) vì như vậy là bắt người dùng chờ.
 * Người bật "giảm chuyển động" thấy nội dung ngay lập tức — xử lý ở `index.css`.
 */
export const Reveal = ({ children, className = "" }: RevealProps) => {
  const ref = useRevealOnScroll<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  );
};
