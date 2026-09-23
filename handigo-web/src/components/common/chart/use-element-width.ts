import { useEffect, useRef, useState } from "react";

/**
 * Bề rộng thực tế của một phần tử.
 *
 * `YAxis` của Recharts chỉ nhận `width` là số cố định, không nhận phần trăm. Đặt
 * cứng 140px thì trên màn hình 375px trục Y chiếm nửa khung vẽ, cột bị bóp lại
 * và mốc trục X bị rụng. Đo container rồi tính bề rộng trục theo tỷ lệ.
 */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
