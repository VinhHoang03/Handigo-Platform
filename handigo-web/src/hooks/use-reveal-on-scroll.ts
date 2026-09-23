import { useEffect, useRef } from "react";

/**
 * Gắn class `.reveal-in` cho phần tử khi nó vào viewport lần đầu.
 *
 * Dùng IntersectionObserver thay vì nghe sự kiện `scroll`: trình duyệt tự lên
 * lịch, không chạy handler mỗi frame cuộn. Chỉ kích hoạt một lần (`once`) — nội
 * dung đã hiện thì không ẩn lại khi cuộn ngược.
 *
 * Người bật "giảm chuyển động" trong OS vẫn thấy nội dung ngay: class `.reveal`
 * tự vô hiệu hoá trong khối `prefers-reduced-motion` ở `index.css`.
 */
export function useRevealOnScroll<T extends HTMLElement = HTMLElement>(
  rootMargin = "0px 0px -10% 0px",
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Trình duyệt quá cũ hoặc môi trường test không có API: hiện luôn nội dung.
    if (typeof IntersectionObserver === "undefined") {
      element.classList.add("reveal-in");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("reveal-in");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin, threshold: 0.1 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin]);

  return ref;
}
