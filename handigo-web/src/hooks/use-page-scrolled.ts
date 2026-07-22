import { useEffect, useState } from "react";

/**
 * Báo trang đã cuộn quá `offset` pixel đầu tiên hay chưa.
 *
 * Dùng một phần tử mốc cao `offset` px ở đầu `body` + IntersectionObserver thay
 * cho `window.addEventListener("scroll")`: handler scroll chạy mỗi frame cuộn và
 * mỗi lần đọc `window.scrollY` là một lần buộc trình duyệt tính lại bố cục.
 */
export function usePageScrolled(offset = 20) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText = `position:absolute;top:0;left:0;width:1px;height:${offset}px;pointer-events:none;`;
    document.body.prepend(sentinel);

    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      sentinel.remove();
    };
  }, [offset]);

  return scrolled;
}
