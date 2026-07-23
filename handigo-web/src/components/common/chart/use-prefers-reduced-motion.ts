import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Recharts bật animation mặc định và không tự đọc `prefers-reduced-motion`
 * (khối `@media` trong `index.css` chỉ tắt được animation CSS, không tắt được
 * animation do JS điều khiển). Hook này để truyền vào `isAnimationActive`.
 */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const onChange = () => setReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
