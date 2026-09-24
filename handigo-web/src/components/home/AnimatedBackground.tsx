import { useEffect, useRef } from "react";
import "./home-motion.css";

/** Nền độc lập với ảnh minh họa, chỉ vẽ khi trang đang hiển thị. */
export const AnimatedBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let width = 0;
    let height = 0;
    let frame = 0;
    let lastTime = 0;
    let phase = 0;
    const target = { x: .65, y: .35 };
    const pointer = { ...target };
    const particles = Array.from({ length: 32 }, (_, index) => ({
      x: ((index * 137.508) % 100) / 100,
      y: ((index * 73.31) % 100) / 100,
      radius: 1.4 + index % 3,
    }));

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const glow = context.createRadialGradient(pointer.x * width, pointer.y * height, 0, pointer.x * width, pointer.y * height, Math.max(width * .5, 350));
      glow.addColorStop(0, "rgba(135, 122, 245, .20)");
      glow.addColorStop(.5, "rgba(135, 122, 245, .07)");
      glow.addColorStop(1, "rgba(135, 122, 245, 0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      const horizon = height * .22;
      const center = width * .5 + (pointer.x - .5) * 100;
      const drift = phase % 1;
      context.lineWidth = 1;
      context.strokeStyle = "rgba(89, 72, 191, .12)";
      for (let index = -12; index <= 12; index++) {
        context.beginPath();
        context.moveTo(center + index * 28, horizon);
        context.lineTo(center + index * width / 7, height + 40);
        context.stroke();
      }
      for (let index = 0; index < 15; index++) {
        const depth = (index + drift) / 15;
        const y = horizon + depth * depth * (height - horizon + 70);
        context.strokeStyle = `rgba(89, 72, 191, ${.025 + depth * .13})`;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }

      particles.forEach((particle, index) => {
        const x = particle.x * width + Math.sin(phase * .7 + index) * 22 + (pointer.x - .5) * 35;
        const y = ((particle.y * height - phase * 24) % height + height) % height;
        context.fillStyle = index % 3 === 0 ? "rgba(0, 104, 122, .28)" : "rgba(83, 61, 201, .24)";
        context.beginPath();
        context.arc(x, y, particle.radius, 0, Math.PI * 2);
        context.fill();
      });
    };
    const tick = (time: number) => {
      if (time - lastTime >= 32) {
        const delta = lastTime ? Math.min(time - lastTime, 64) : 0;
        lastTime = time;
        phase += delta * .0001;
        pointer.x += (target.x - pointer.x) * .09;
        pointer.y += (target.y - pointer.y) * .09;
        draw();
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      lastTime = 0;
      draw();
      if (!reduced.matches && !document.hidden) frame = requestAnimationFrame(tick);
    };
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      sync();
    };
    const move = (event: PointerEvent) => {
      if (reduced.matches || !finePointer.matches || event.pointerType !== "mouse") return;
      target.x = event.clientX / width;
      target.y = event.clientY / height;
    };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
    };
  }, []);

  return (
    <div className="home-page-background" aria-hidden="true"><canvas ref={canvasRef} /></div>
  );
};
