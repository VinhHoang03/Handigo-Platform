import {
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

/**
 * Carousel tự trôi ngang, lặp vô hạn và cho phép kéo bằng chuột/cảm ứng.
 * Danh sách phải được render lặp 3 chu kỳ, chu kỳ giữa đánh dấu
 * `data-cycle-start="true"` để tính điểm cuộn vòng.
 *
 * Tôn trọng `prefers-reduced-motion`: người dùng tắt hiệu ứng thì không tự trôi,
 * nhưng vẫn kéo tay được.
 */
export const useAutoScrollCarousel = (itemCount: number) => {
  const carouselRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({
    active: false,
    startX: 0,
    lastX: 0,
    lastTime: 0,
    moved: false,
  });
  const velocityRef = useRef(0);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel || itemCount === 0) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let animationFrame = 0;
    let previousTime = performance.now();
    const initializeFrame = requestAnimationFrame(() => {
      const cycleStart = carousel.querySelector<HTMLElement>(
        '[data-cycle-start="true"]',
      );
      if (cycleStart) carousel.scrollLeft = cycleStart.offsetLeft;
    });

    const animate = (time: number) => {
      const elapsed = Math.min(time - previousTime, 32);
      previousTime = time;
      const cycleStart = carousel.querySelector<HTMLElement>(
        '[data-cycle-start="true"]',
      );
      const cycleWidth = cycleStart?.offsetLeft || 0;

      if (!dragState.current.active) {
        const autoSpeed = prefersReducedMotion ? 0 : 0.025 * elapsed;
        carousel.scrollLeft += autoSpeed + velocityRef.current * elapsed;
        velocityRef.current *= Math.pow(0.94, elapsed / 16.67);
        if (Math.abs(velocityRef.current) < 0.01) velocityRef.current = 0;
      }

      if (cycleWidth > 0) {
        if (carousel.scrollLeft >= cycleWidth * 2)
          carousel.scrollLeft -= cycleWidth;
        if (carousel.scrollLeft < cycleWidth * 0.5)
          carousel.scrollLeft += cycleWidth;
      }
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(initializeFrame);
      cancelAnimationFrame(animationFrame);
    };
  }, [itemCount]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    dragState.current = {
      active: true,
      startX: event.clientX,
      lastX: event.clientX,
      lastTime: performance.now(),
      moved: false,
    };
    velocityRef.current = 0;
    carousel.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const carousel = carouselRef.current;
    if (!carousel || !dragState.current.active) return;
    const now = performance.now();
    const distance = event.clientX - dragState.current.lastX;
    const elapsed = Math.max(now - dragState.current.lastTime, 1);
    if (Math.abs(event.clientX - dragState.current.startX) > 5)
      dragState.current.moved = true;
    carousel.scrollLeft -= distance;
    velocityRef.current = -distance / elapsed;
    dragState.current.lastX = event.clientX;
    dragState.current.lastTime = now;
  };

  const stopDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragState.current.active = false;
    if (carouselRef.current?.hasPointerCapture(event.pointerId)) {
      carouselRef.current.releasePointerCapture(event.pointerId);
    }
  };

  /** Chặn click phát sinh sau thao tác kéo, tránh điều hướng ngoài ý muốn. */
  const onClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (dragState.current.moved) {
      event.preventDefault();
      event.stopPropagation();
      dragState.current.moved = false;
    }
  };

  return {
    carouselRef,
    onPointerDown,
    onPointerMove,
    onPointerUp: stopDragging,
    onPointerCancel: stopDragging,
    onClickCapture,
  };
};
